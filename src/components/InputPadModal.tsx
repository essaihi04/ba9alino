import { useMemo, useState } from 'react'
import { X, Globe } from 'lucide-react'

export type InputPadMode = 'number' | 'decimal' | 'text' | 'alphanumeric'
export type InputPadLanguage = 'ar' | 'fr'

export interface InputPadModalProps {
  open: boolean
  title: string
  value: string
  mode: InputPadMode
  placeholder?: string
  dir?: 'rtl' | 'ltr'
  min?: number
  max?: number
  maxLength?: number
  allowNegative?: boolean
  showLanguageToggle?: boolean
  language?: InputPadLanguage
  onLanguageChange?: (lang: InputPadLanguage) => void
  onChange: (value: string) => void
  onConfirm: () => void
  onClose: () => void
}

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

function isAllowedForMode(next: string, mode: InputPadMode, allowNegative?: boolean) {
  if (mode === 'number') {
    return /^-?\d*$/.test(next) && (allowNegative ? true : !next.includes('-') || next.startsWith('-'))
  }
  if (mode === 'decimal') {
    return /^-?\d*(\.\d*)?$/.test(next) && (allowNegative ? true : !next.includes('-') || next.startsWith('-'))
  }
  return true
}

export default function InputPadModal({
  open,
  title,
  value,
  mode,
  placeholder,
  dir = 'rtl',
  min,
  max,
  maxLength,
  allowNegative,
  showLanguageToggle = true,
  language = 'ar',
  onLanguageChange,
  onChange,
  onConfirm,
  onClose,
}: InputPadModalProps) {
  const [error, setError] = useState<string>('')

  const isText = mode === 'text' || mode === 'alphanumeric'
  const keys = useMemo(() => {
    if (mode === 'number' || mode === 'decimal') {
      const base = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'clear', '0', 'backspace']
      return mode === 'decimal' ? [...base, '.'] : base
    }

    const letters = language === 'ar' ? arabicRows : frenchRows
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    const symbols = ['@', '.', '-', '_', '/', '+']

    return { letters, digits, symbols }
  }, [mode, language])

  const setSafeValue = (next: string) => {
    if (maxLength != null && next.length > maxLength) return
    if (!isAllowedForMode(next, mode, allowNegative)) return
    onChange(next)
  }

  const handleKey = (k: string) => {
    setError('')

    if (k === 'clear') {
      setSafeValue('')
      return
    }

    if (k === 'backspace') {
      setSafeValue(value.slice(0, -1))
      return
    }

    if (k === 'space') {
      setSafeValue(value + ' ')
      return
    }

    if (k === 'newline') {
      setSafeValue(value + '\n')
      return
    }

    setSafeValue(value + k)
  }

  const validate = () => {
    if (mode === 'number' || mode === 'decimal') {
      const n = Number(value || 0)
      if (Number.isNaN(n)) {
        setError('قيمة غير صالحة')
        return false
      }
      if (min != null && n < min) {
        setError(`الحد الأدنى: ${min}`)
        return false
      }
      if (max != null && n > max) {
        setError(`الحد الأقصى: ${max}`)
        return false
      }
    }
    return true
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[96vw] max-h-[96vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        dir={dir}
      >
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-bold text-lg text-gray-800">{title}</div>
            {isText && showLanguageToggle && onLanguageChange && (
              <button
                type="button"
                onClick={() => onLanguageChange(language === 'ar' ? 'fr' : 'ar')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-bold text-gray-700"
              >
                <Globe size={16} />
                {language === 'ar' ? 'AR' : 'FR'}
              </button>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="w-full p-4 border-2 border-green-500 rounded-xl bg-green-50">
            <div className="text-2xl font-bold text-green-800 whitespace-pre-wrap break-words">
              {value || placeholder || '0'}
            </div>
          </div>

          {error && <div className="mt-2 text-sm font-bold text-red-600">{error}</div>}

          <div className="mt-1 overflow-auto max-h-[58vh] pr-1">
            {(mode === 'number' || mode === 'decimal') && (
              <div className="grid grid-cols-3 gap-2">
                {(keys as string[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKey(k)}
                    className={`p-4 rounded-xl font-bold text-lg transition-all ${
                      k === 'clear'
                        ? 'bg-red-100 hover:bg-red-200 text-red-700'
                        : k === 'backspace'
                          ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                          : k === '.'
                            ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    {k === 'clear' ? 'مسح' : k === 'backspace' ? '⌫' : k}
                  </button>
                ))}
              </div>
            )}

            {(mode === 'text' || mode === 'alphanumeric') && (
              <div className="space-y-2">
                <div className="grid grid-cols-10 gap-1">
                  {(keys as any).digits.map((d: string) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleKey(d)}
                      className="py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-800"
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {(keys as any).symbols.map((s: string) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleKey(s)}
                      className="py-3 rounded-xl font-bold bg-blue-50 hover:bg-blue-100 text-blue-800"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {(keys as any).letters.map((row: string[], idx: number) => (
                  <div key={idx} className="grid grid-cols-10 gap-1">
                    {row.map((c: string) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleKey(c)}
                        className="py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-800"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ))}

                <div className="grid grid-cols-12 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleKey('clear')}
                    className="col-span-3 py-3 rounded-xl font-bold bg-red-100 hover:bg-red-200 text-red-700"
                  >
                    مسح
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKey('space')}
                    className="col-span-6 py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-800"
                  >
                    مسافة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKey('backspace')}
                    className="col-span-3 py-3 rounded-xl font-bold bg-orange-100 hover:bg-orange-200 text-orange-700"
                  >
                    ⌫
                  </button>
                </div>

                {mode === 'text' && (
                  <button
                    type="button"
                    onClick={() => handleKey('newline')}
                    className="w-full mt-2 py-3 rounded-xl font-bold bg-purple-100 hover:bg-purple-200 text-purple-800"
                  >
                    سطر جديد
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-3 sticky bottom-0 bg-white pb-1">
            <button
              type="button"
              onClick={() => {
                if (!validate()) return
                onConfirm()
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-bold transition-colors shadow-lg"
            >
              موافق
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-xl font-bold transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
