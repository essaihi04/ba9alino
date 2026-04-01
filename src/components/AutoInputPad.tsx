import { useEffect, useState, useCallback, useRef } from 'react'
import { X, Globe, Keyboard, ChevronDown } from 'lucide-react'

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
  const activeRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const padRef = useRef<HTMLDivElement>(null)

  // Check localStorage preference for keyboard visibility
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem('vkb_enabled')
    return saved !== 'false' // Enabled by default
  })

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
        className="fixed bottom-0 left-0 right-0 z-[80] bg-gray-100 border-t-2 border-gray-300 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
        style={{ touchAction: 'manipulation' }}
        onMouseDown={(e) => e.preventDefault()} // Prevent blur on input
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-200 border-b border-gray-300">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-600">
              {mode === 'number' ? '🔢 أرقام' :
               mode === 'decimal' ? '🔢 أرقام عشرية' :
               mode === 'phone' ? '📞 هاتف' :
               mode === 'email' ? '📧 بريد' :
               '⌨️ نص'}
            </span>
            {!isNumeric && (
              <button
                onMouseDown={(e) => { e.preventDefault(); setLang(l => l === 'ar' ? 'fr' : 'ar') }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50 text-xs font-bold"
              >
                <Globe size={12} />
                {lang === 'ar' ? 'عربي' : 'FR'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onMouseDown={(e) => { e.preventDefault(); setMinimized(true) }}
              className="p-1.5 hover:bg-gray-300 rounded transition-colors"
              title="تصغير"
            >
              <ChevronDown size={16} className="text-gray-600" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); close() }}
              className="p-1.5 hover:bg-red-100 rounded transition-colors"
              title="إغلاق"
            >
              <X size={16} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Keyboard body */}
        <div className="p-2 max-h-[45vh] overflow-auto">
          {isNumeric ? (
            <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
              {(mode === 'decimal' ? decimalKeys : mode === 'phone' ? phoneKeys : numberKeys).map((k) => (
                <button
                  key={k}
                  onMouseDown={(e) => { e.preventDefault(); handleKey(k) }}
                  className={`py-3 rounded-lg font-bold text-lg transition-all active:scale-95 ${
                    k === 'clear'
                      ? 'bg-red-100 hover:bg-red-200 text-red-700 text-sm'
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
              {/* Digits row */}
              <div className="grid grid-cols-10 gap-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
                  <button
                    key={d}
                    onMouseDown={(e) => { e.preventDefault(); handleKey(d) }}
                    className="py-2 rounded-lg font-bold bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-sm transition-all active:scale-95"
                  >
                    {d}
                  </button>
                ))}
              </div>

              {/* Symbols for email mode */}
              {mode === 'email' && (
                <div className="grid grid-cols-8 gap-1">
                  {['@', '.', '-', '_', '+', '.com', '.ma', '.fr'].map((s) => (
                    <button
                      key={s}
                      onMouseDown={(e) => { e.preventDefault(); handleKey(s) }}
                      className="py-2 rounded-lg font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs transition-all active:scale-95"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Common symbols for text */}
              {mode === 'text' && (
                <div className="grid grid-cols-8 gap-1">
                  {['@', '.', '-', '/', '+', ':', '،', '؟'].map((s) => (
                    <button
                      key={s}
                      onMouseDown={(e) => { e.preventDefault(); handleKey(s) }}
                      className="py-2 rounded-lg font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm transition-all active:scale-95"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Letter rows */}
              {letterRows.map((row, idx) => (
                <div key={idx} className="flex justify-center gap-1">
                  {row.map((c) => (
                    <button
                      key={c}
                      onMouseDown={(e) => { e.preventDefault(); handleKey(c) }}
                      className="flex-1 max-w-[42px] py-2.5 rounded-lg font-bold bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-sm transition-all active:scale-95"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ))}

              {/* Bottom action row */}
              <div className="flex gap-1.5 pt-1">
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleKey('clear') }}
                  className="px-3 py-2.5 rounded-lg font-bold bg-red-100 hover:bg-red-200 text-red-700 text-sm transition-all active:scale-95"
                >
                  مسح
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleKey('space') }}
                  className="flex-1 py-2.5 rounded-lg font-bold bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-sm transition-all active:scale-95"
                >
                  مسافة
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleKey('backspace') }}
                  className="px-4 py-2.5 rounded-lg font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm transition-all active:scale-95"
                >
                  ⌫
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleKey('done') }}
                  className="px-4 py-2.5 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white text-sm transition-all active:scale-95"
                >
                  ✓ تم
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
