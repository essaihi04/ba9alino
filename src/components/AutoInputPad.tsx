import { useEffect, useState, useCallback, useRef } from 'react'
import { X, Globe, Keyboard, ChevronDown, Move } from 'lucide-react'

const KB_WIDTH = 720 // largeur en px du clavier
const KB_HEIGHT_EST = 360 // hauteur estimée pour clamping initial

type PadMode = 'number' | 'decimal' | 'text' | 'email' | 'phone'
type PadLang = 'ar' | 'fr'

const arabicRows: string[][] = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح'],
  ['ج', 'د', 'ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن'],
  ['م', 'ك', 'ط', 'ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة'],
  ['و', 'ز', 'ظ'],
]

const frenchRows: string[][] = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['W', 'X', 'C', 'V', 'B', 'N'],
]

function detectMode(el: HTMLInputElement | HTMLTextAreaElement): PadMode {
  const type = el.type?.toLowerCase() || 'text'
  const inputMode = el.inputMode?.toLowerCase() || ''
  const step = el.getAttribute('step')

  if (type === 'number' || inputMode === 'numeric') {
    return step ? 'decimal' : 'number'
  }
  if (inputMode === 'decimal') return 'decimal'
  if (type === 'email' || inputMode === 'email') return 'email'
  if (type === 'tel' || inputMode === 'tel') return 'phone'
  return 'text'
}

function shouldSkip(el: HTMLElement): boolean {
  if (el.getAttribute('data-no-vkb') === 'true') return true
  if (el.closest('[data-no-vkb="true"]')) return true
  // Skip hidden, disabled or readonly inputs
  const input = el as HTMLInputElement
  if (input.disabled || input.readOnly) return true
  // Skip password fields
  if (input.type === 'password') return true
  // Skip file inputs
  if (input.type === 'file') return true
  // Skip select elements (they don't need a keyboard)
  if (el.tagName === 'SELECT') return true
  return false
}

function insertText(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const before = el.value.substring(0, start)
  const after = el.value.substring(end)
  const newValue = before + text + after

  // Use native input setter to trigger React's onChange
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, newValue)
  } else {
    el.value = newValue
  }

  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))

  // Restore cursor position
  const newPos = start + text.length
  requestAnimationFrame(() => {
    el.setSelectionRange(newPos, newPos)
  })
}

function deleteChar(el: HTMLInputElement | HTMLTextAreaElement) {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length

  let newValue: string
  let newPos: number

  if (start !== end) {
    // Delete selection
    newValue = el.value.substring(0, start) + el.value.substring(end)
    newPos = start
  } else if (start > 0) {
    // Delete char before cursor
    newValue = el.value.substring(0, start - 1) + el.value.substring(start)
    newPos = start - 1
  } else {
    return
  }

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, newValue)
  } else {
    el.value = newValue
  }

  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))

  requestAnimationFrame(() => {
    el.setSelectionRange(newPos, newPos)
  })
}

function clearInput(el: HTMLInputElement | HTMLTextAreaElement) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set || Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, '')
  } else {
    el.value = ''
  }

  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export default function AutoInputPad() {
  const [visible, setVisible] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [mode, setMode] = useState<PadMode>('text')
  const [lang, setLang] = useState<PadLang>('ar')
  // Vue active en mode texte/email: lettres ou chiffres (séparés)
  const [textView, setTextView] = useState<'letters' | 'numbers'>('letters')
  const activeRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const padRef = useRef<HTMLDivElement>(null)

  // Check localStorage preference for keyboard visibility
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem('vkb_enabled')
    return saved !== 'false' // Enabled by default
  })

  // Position du clavier (drag & drop). Persistée dans localStorage.
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem('vkb_pos')
      if (raw) {
        const p = JSON.parse(raw)
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return p
      }
    } catch {}
    // Position par défaut: centrée horizontalement, en bas
    const x = Math.max(0, (window.innerWidth - KB_WIDTH) / 2)
    const y = Math.max(0, window.innerHeight - KB_HEIGHT_EST - 16)
    return { x, y }
  })

  const draggingRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
    }
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = ev.clientX - draggingRef.current.startX
      const dy = ev.clientY - draggingRef.current.startY
      const w = padRef.current?.offsetWidth ?? KB_WIDTH
      const h = padRef.current?.offsetHeight ?? KB_HEIGHT_EST
      const nextX = Math.max(0, Math.min(window.innerWidth - w, draggingRef.current.baseX + dx))
      const nextY = Math.max(0, Math.min(window.innerHeight - h, draggingRef.current.baseY + dy))
      setPos({ x: nextX, y: nextY })
    }
    const onUp = () => {
      draggingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      try { localStorage.setItem('vkb_pos', JSON.stringify({ x: pos.x, y: pos.y })) } catch {}
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [pos.x, pos.y])

  // Persiste la position après chaque déplacement
  useEffect(() => {
    try { localStorage.setItem('vkb_pos', JSON.stringify(pos)) } catch {}
  }, [pos])

  const toggleEnabled = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      localStorage.setItem('vkb_enabled', String(next))
      if (!next) setVisible(false)
      return next
    })
  }, [])

  const handleFocus = useCallback((e: FocusEvent) => {
    if (!enabled) return
    const el = e.target as HTMLElement
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return
    if (shouldSkip(el)) return

    const input = el as HTMLInputElement | HTMLTextAreaElement
    activeRef.current = input
    setMode(detectMode(input))
    setVisible(true)
    setMinimized(false)
  }, [enabled])

  const handleBlur = useCallback((e: FocusEvent) => {
    // Don't close if clicking on the virtual keyboard itself
    const related = e.relatedTarget as HTMLElement | null
    if (related && padRef.current?.contains(related)) return

    // Small delay to allow keyboard button clicks to register
    setTimeout(() => {
      if (padRef.current?.contains(document.activeElement)) return
      // Keep visible but don't clear active ref immediately
    }, 150)
  }, [])

  useEffect(() => {
    document.addEventListener('focusin', handleFocus, true)
    document.addEventListener('focusout', handleBlur, true)
    return () => {
      document.removeEventListener('focusin', handleFocus, true)
      document.removeEventListener('focusout', handleBlur, true)
    }
  }, [handleFocus, handleBlur])

  const handleKey = useCallback((key: string) => {
    const el = activeRef.current
    if (!el) return

    // Re-focus the input to keep cursor alive
    el.focus()

    if (key === 'backspace') {
      deleteChar(el)
      return
    }
    if (key === 'clear') {
      clearInput(el)
      return
    }
    if (key === 'space') {
      insertText(el, ' ')
      return
    }
    if (key === 'done') {
      setVisible(false)
      el.blur()
      return
    }

    insertText(el, key)
  }, [])

  const close = useCallback(() => {
    setVisible(false)
    activeRef.current = null
  }, [])

  // Number pad keys
  const numberKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'clear', '0', 'backspace']
  const decimalKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'backspace']
  const phoneKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '+', '0', 'backspace']

  const isNumeric = mode === 'number' || mode === 'decimal' || mode === 'phone'
  const letterRows = lang === 'ar' ? arabicRows : frenchRows

  // Toggle button (always visible)
  const toggleButton = (
    <button
      onClick={toggleEnabled}
      className={`fixed bottom-4 left-4 z-[80] p-3 rounded-full shadow-lg transition-all ${
        enabled ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
      }`}
      title={enabled ? 'إخفاء لوحة المفاتيح الافتراضية' : 'إظهار لوحة المفاتيح الافتراضية'}
    >
      <Keyboard size={20} />
    </button>
  )

  if (!visible || !enabled) return toggleButton

  if (minimized) {
    return (
      <>
        {toggleButton}
        <button
          onClick={() => setMinimized(false)}
          className="fixed bottom-4 left-20 z-[80] bg-green-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
        >
          <Keyboard size={18} />
          <span className="text-sm font-bold">لوحة المفاتيح</span>
        </button>
      </>
    )
  }

  return (
    <>
      {toggleButton}
      <div
        ref={padRef}
        className="fixed z-[80] bg-gray-100 border-2 border-gray-300 shadow-[0_8px_30px_rgba(0,0,0,0.25)] rounded-xl overflow-hidden"
        style={{
          touchAction: 'manipulation',
          left: pos.x,
          top: pos.y,
          width: KB_WIDTH,
          maxWidth: '96vw',
        }}
        onMouseDown={(e) => e.preventDefault()} // Prevent blur on input
      >
        {/* Header bar (drag handle) */}
        <div
          className="flex items-center justify-between px-3 py-1.5 bg-gray-200 border-b border-gray-300 cursor-move select-none"
          onMouseDown={onDragStart}
          title="اسحب لتحريك لوحة المفاتيح"
        >
          <div className="flex items-center gap-2">
            <Move size={14} className="text-gray-500" />
            <span className="text-xs font-bold text-gray-600">
              {mode === 'number' ? '🔢 أرقام' :
               mode === 'decimal' ? '🔢 أرقام عشرية' :
               mode === 'phone' ? '📞 هاتف' :
               mode === 'email' ? '📧 بريد' :
               '⌨️ نص'}
            </span>
            {!isNumeric && (
              <>
                <button
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setLang(l => l === 'ar' ? 'fr' : 'ar') }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50 text-xs font-bold"
                >
                  <Globe size={12} />
                  {lang === 'ar' ? 'عربي' : 'FR'}
                </button>
                <div className="flex items-center gap-0 rounded border border-gray-300 overflow-hidden">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setTextView('letters') }}
                    className={`px-2 py-1 text-xs font-bold transition-colors ${
                      textView === 'letters' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="عرض الحروف"
                  >
                    أ ب
                  </button>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setTextView('numbers') }}
                    className={`px-2 py-1 text-xs font-bold transition-colors ${
                      textView === 'numbers' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    title="عرض الأرقام"
                  >
                    123
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setMinimized(true) }}
              className="p-1.5 hover:bg-gray-300 rounded transition-colors"
              title="تصغير"
            >
              <ChevronDown size={16} className="text-gray-600" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); close() }}
              className="p-1.5 hover:bg-red-100 rounded transition-colors"
              title="إغلاق"
            >
              <X size={16} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Keyboard body */}
        <div className="p-3 max-h-[60vh] overflow-auto">
          {/* Action row STICKY en haut (uniquement en mode texte/email) */}
          {!isNumeric && (
            <div className="sticky top-0 z-10 bg-gray-100 pb-2 mb-2 border-b border-gray-200 flex gap-1.5">
              <button
                onMouseDown={(e) => { e.preventDefault(); handleKey('done') }}
                className="px-4 py-3 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white text-base transition-all active:scale-95"
              >
                ✓ تم
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleKey('clear') }}
                className="px-3 py-3 rounded-lg font-bold bg-red-100 hover:bg-red-200 text-red-700 text-base transition-all active:scale-95"
              >
                مسح
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleKey('space') }}
                className="flex-1 py-3 rounded-lg font-bold bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-base transition-all active:scale-95"
              >
                مسافة
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleKey('backspace') }}
                className="px-4 py-3 rounded-lg font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 text-base transition-all active:scale-95"
              >
                ⌫
              </button>
            </div>
          )}
          {isNumeric ? (
            <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
              {(mode === 'decimal' ? decimalKeys : mode === 'phone' ? phoneKeys : numberKeys).map((k) => (
                <button
                  key={k}
                  onMouseDown={(e) => { e.preventDefault(); handleKey(k) }}
                  className={`py-4 rounded-lg font-bold text-2xl transition-all active:scale-95 ${
                    k === 'clear'
                      ? 'bg-red-100 hover:bg-red-200 text-red-700 text-base'
                      : k === 'backspace'
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                        : k === '.' || k === '+'
                          ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                          : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200'
                  }`}
                >
                  {k === 'clear' ? 'مسح' : k === 'backspace' ? '⌫' : k}
                </button>
              ))}
              <button
                onMouseDown={(e) => { e.preventDefault(); handleKey('done') }}
                className="col-span-3 py-3 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-all active:scale-95"
              >
                ✓ تم
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-w-2xl mx-auto">
              {textView === 'numbers' ? (
                <div className="space-y-1.5">
                  {/* Raccourcis email (uniquement en mode email) */}
                  {mode === 'email' && (
                    <div className="grid grid-cols-4 gap-1.5 max-w-xl mx-auto">
                      {['@', '.com', '.ma', '.fr'].map((s) => (
                        <button
                          key={s}
                          onMouseDown={(e) => { e.preventDefault(); handleKey(s) }}
                          className="py-3 rounded-lg font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 text-base transition-all active:scale-95"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Pavé numérique avec TOUS les symboles latéraux */}
                  <div className="flex justify-center items-stretch gap-1.5 max-w-2xl mx-auto">
                    {/* Bloc gauche: 2 colonnes × 4 rangées = 8 symboles */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {['.', ',', ':', '؛', '(', ')', '،', '؟'].map((s) => (
                        <button
                          key={s}
                          onMouseDown={(e) => { e.preventDefault(); handleKey(s) }}
                          className="w-12 py-5 rounded-lg font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 text-xl transition-all active:scale-95"
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* Pavé numérique central 3 colonnes (sans clear/backspace, déjà dans la barre sticky) */}
                    <div className="grid grid-cols-3 gap-1.5 flex-1 max-w-xs">
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
                        <button
                          key={k}
                          onMouseDown={(e) => { e.preventDefault(); handleKey(k) }}
                          className="py-5 rounded-lg font-bold text-2xl bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 transition-all active:scale-95"
                        >
                          {k}
                        </button>
                      ))}
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleKey('0') }}
                        className="col-span-3 py-5 rounded-lg font-bold text-2xl bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 transition-all active:scale-95"
                      >
                        0
                      </button>
                    </div>

                    {/* Bloc droit: 2 colonnes × 4 rangées = 8 symboles */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {['+', '-', '/', '*', '@', '_', '#', '"'].map((s) => (
                        <button
                          key={s}
                          onMouseDown={(e) => { e.preventDefault(); handleKey(s) }}
                          className="w-12 py-5 rounded-lg font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 text-xl transition-all active:scale-95"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mode lettres: uniquement les rangées de lettres (les symboles sont dans le mode chiffres) */}
                  {letterRows.map((row, idx) => (
                    <div key={idx} className="flex justify-center gap-1">
                      {row.map((c) => (
                        <button
                          key={c}
                          onMouseDown={(e) => { e.preventDefault(); handleKey(c) }}
                          className="flex-1 max-w-[56px] py-5 rounded-lg font-bold bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-2xl transition-all active:scale-95"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  )
}
