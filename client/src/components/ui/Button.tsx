import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'paypal'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-[#0070BA] to-[#005ea6] text-white hover:from-[#007cd1] hover:to-[#0070BA] shadow-md shadow-blue-500/10 border border-blue-400/20 active:scale-[0.98]',
  secondary:
    'bg-surface-raised text-slate-200 border border-white/[0.09] hover:bg-surface-highlight hover:border-white/[0.18] hover:text-white',
  ghost:
    'bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]',
  danger:
    'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50',
  paypal:
    'bg-[#0070BA] hover:bg-[#003087] text-white font-semibold shadow-lg shadow-blue-600/20 border border-blue-300/30 active:scale-[0.98]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2.5 font-medium',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`focus-thread inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}
