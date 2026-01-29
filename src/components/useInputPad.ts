import React, { useCallback, useMemo, useState } from 'react'
import InputPadModal, { InputPadLanguage, InputPadMode } from './InputPadModal'

interface OpenOptions {
  title: string
  mode: InputPadMode
  initialValue: string
  placeholder?: string
  dir?: 'rtl' | 'ltr'
  min?: number
  max?: number
  maxLength?: number
  allowNegative?: boolean
  showLanguageToggle?: boolean
  onConfirm: (value: string) => void
}

export function useInputPad() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<InputPadMode>('number')
  const [value, setValue] = useState('')
  const [placeholder, setPlaceholder] = useState<string | undefined>(undefined)
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl')
  const [min, setMin] = useState<number | undefined>(undefined)
  const [max, setMax] = useState<number | undefined>(undefined)
  const [maxLength, setMaxLength] = useState<number | undefined>(undefined)
  const [allowNegative, setAllowNegative] = useState<boolean | undefined>(undefined)
  const [showLanguageToggle, setShowLanguageToggle] = useState(true)

  const [language, setLanguage] = useState<InputPadLanguage>('ar')
  const [confirmCb, setConfirmCb] = useState<((v: string) => void) | null>(null)

  const close = useCallback(() => setOpen(false), [])

  const openPad = useCallback((opts: OpenOptions) => {
    setTitle(opts.title)
    setMode(opts.mode)
    setValue(opts.initialValue ?? '')
    setPlaceholder(opts.placeholder)
    setDir(opts.dir ?? 'rtl')
    setMin(opts.min)
    setMax(opts.max)
    setMaxLength(opts.maxLength)
    setAllowNegative(opts.allowNegative)
    setShowLanguageToggle(opts.showLanguageToggle ?? true)
    setConfirmCb(() => opts.onConfirm)
    setOpen(true)
  }, [])

  const Modal = useMemo(() => {
    return React.createElement(InputPadModal, {
      open,
      title,
      value,
      mode,
      placeholder,
      dir,
      min,
      max,
      maxLength,
      allowNegative,
      showLanguageToggle,
      language,
      onLanguageChange: setLanguage,
      onChange: setValue,
      onConfirm: () => {
        if (confirmCb) confirmCb(value)
        setOpen(false)
      },
      onClose: () => setOpen(false),
    })
  }, [
    allowNegative,
    confirmCb,
    dir,
    language,
    max,
    maxLength,
    min,
    mode,
    open,
    placeholder,
    showLanguageToggle,
    title,
    value,
  ])

  return {
    open: openPad,
    close,
    Modal,
    language,
    setLanguage,
  }
}
