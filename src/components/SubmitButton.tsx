import { ButtonHTMLAttributes, ReactNode } from 'react'

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Affiche le spinner et désactive le bouton tant que l'enregistrement est en cours. */
  loading?: boolean
  children: ReactNode
}

/**
 * Bouton d'enregistrement standard : une fois cliqué (loading=true) il se désactive
 * automatiquement et affiche un spinner, ce qui empêche les doubles soumissions.
 */
export default function SubmitButton({
  loading = false,
  children,
  disabled,
  className = '',
  ...props
}: SubmitButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      aria-busy={loading}
      className={`relative inline-flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {loading && (
        <span
          className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
