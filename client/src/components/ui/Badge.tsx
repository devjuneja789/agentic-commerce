import type { ReactNode } from 'react'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const toneClasses: Record<Tone, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/25 shadow-[0_0_10px_rgba(244,63,94,0.1)]',
  neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  info: 'bg-sky-500/10 text-sky-400 border-sky-500/25 shadow-[0_0_10px_rgba(0,112,186,0.1)]',
}

const dotClasses: Record<Tone, string> = {
  success: 'bg-emerald-400 animate-pulse',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  neutral: 'bg-slate-400',
  info: 'bg-sky-400',
}

export function Badge({
  tone = 'neutral',
  withDot = true,
  children,
}: {
  tone?: Tone
  withDot?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase ${toneClasses[tone]}`}
    >
      {withDot && <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]}`} />}
      {children}
    </span>
  )
}

// --- Domain tone mappers, shared across CatalogTable / AuditTrail / BuyerAgentConsole ---

export function availabilityTone(availability: string): Tone {
  switch (availability) {
    case 'in_stock':
      return 'success'
    case 'limited_stock':
      return 'warning'
    case 'out_of_stock':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function orderStatusTone(status: string): Tone {
  switch (status) {
    case 'paid':
      return 'success'
    case 'awaiting_payment':
    case 'pending_approval':
      return 'warning'
    case 'failed':
    case 'rejected':
    case 'cancelled':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function auditActionTone(action: string): Tone {
  switch (action) {
    case 'payment_created':
    case 'payment_confirmed':
      return 'success'
    case 'gate':
    case 'catalog_update':
      return 'warning'
    case 'payment_failed':
    case 'payment_cancelled':
      return 'danger'
    case 'verify':
      return 'info'
    default:
      return 'neutral'
  }
}
