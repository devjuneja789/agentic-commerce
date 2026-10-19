import type { InputHTMLAttributes } from 'react'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`focus-thread w-full rounded-lg border border-white/[0.09] bg-surface-raised/90 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-inner transition-colors duration-150 focus:border-[#0070BA] focus:bg-surface-raised disabled:opacity-40 ${className}`}
      {...rest}
    />
  )
}
