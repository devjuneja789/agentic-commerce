import { useEffect, useState } from 'react'
import { getPendingOrders, approveOrder, denyOrder } from '../api/client'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

interface PendingApprovalsProps {
  onOrderUpdated?: () => void
  onNavigateConsole?: () => void
}

export function PendingApprovals({ onOrderUpdated, onNavigateConsole }: PendingApprovalsProps) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, 'approving' | 'denying'>>({})
  const [approvedLinks, setApprovedLinks] = useState<Record<string, string>>({})

  async function loadPending() {
    setLoading(true)
    setError(null)
    try {
      const data = await getPendingOrders()
      setOrders(data.orders)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pending orders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPending()
  }, [])

  async function handleApprove(orderId: string) {
    setActionLoading((prev) => ({ ...prev, [orderId]: 'approving' }))
    try {
      const res = await approveOrder(orderId)
      if (res.paymentLink) {
        setApprovedLinks((prev) => ({ ...prev, [orderId]: res.paymentLink! }))
      }
      setOrders((prev) => prev.filter((o) => o._id !== orderId))
      if (onOrderUpdated) onOrderUpdated()
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`)
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
    }
  }

  async function handleDeny(orderId: string) {
    const reason = prompt('Reason for denying this order (optional):', 'Order rejected by store administrator.')
    if (reason === null) return // cancelled

    setActionLoading((prev) => ({ ...prev, [orderId]: 'denying' }))
    try {
      await denyOrder(orderId, reason)
      setOrders((prev) => prev.filter((o) => o._id !== orderId))
      if (onOrderUpdated) onOrderUpdated()
    } catch (err: any) {
      alert(`Denial failed: ${err.message}`)
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Human-in-the-Loop Review Queue</h2>
          <p className="text-xs text-slate-400">
            Transactions between $100 and $500 are held in reserve pending store manager authorization.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadPending} loading={loading}>
          Refresh Queue
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2.5 py-20 text-sm text-slate-400">
          <Spinner size={16} /> Scanning pending approval queue...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && orders.length === 0 && (
        <Card className="text-center py-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-white">Review Queue is Clear</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            All autonomous transactions have been approved or processed. Trigger the "Approval Gate" scenario from the console to test this workflow.
          </p>
          {onNavigateConsole && (
            <div className="mt-6">
              <Button variant="secondary" size="sm" onClick={onNavigateConsole}>
                Open Agent Console
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Orders List */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((ord) => {
            const isApproving = actionLoading[ord._id] === 'approving'
            const isDenying = actionLoading[ord._id] === 'denying'
            const approvedLink = approvedLinks[ord._id]
            const product = ord.product

            return (
              <div
                key={ord._id}
                className="overflow-hidden rounded-xl border border-white/[0.09] bg-surface/90 p-5 shadow-xl backdrop-blur-md transition-all hover:border-amber-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2.5">
                    <Badge tone="warning">Pending Review</Badge>
                    <span className="font-mono text-xs text-slate-400">
                      Order: <span className="text-slate-200">{ord._id}</span>
                    </span>
                  </div>
                  <span className="font-mono text-xs text-amber-400">
                    Amount: ${ord.amount} {ord.currency || 'USD'}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    {product?.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="h-16 w-16 rounded-xl border border-white/[0.1] object-cover shadow-sm"
                      />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">{product?.name}</div>
                      <div className="font-mono text-xs text-slate-400">SKU: {product?.sku}</div>
                      <div className="mt-1 text-xs text-slate-300">
                        Shopper: <span className="font-semibold text-slate-100">{ord.actor}</span> · Qty: {ord.quantity}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
                      ⚠ {ord.guardrailReasoning || 'Exceeds auto-approval threshold ($100)'}
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono">
                      ✓ {ord.quantity} unit(s) held in atomic reserve
                    </div>
                  </div>
                </div>

                {/* Inline Approved Payment Link */}
                {approvedLink && (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-300">
                        ✓ Order Approved! PayPal link generated:
                      </span>
                      <a
                        href={approvedLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0070BA] px-3.5 py-1.5 font-mono text-xs font-semibold text-white hover:bg-[#003087]"
                      >
                        Open PayPal Sandbox Checkout →
                      </a>
                    </div>
                  </div>
                )}

                {/* Approval & Denial Controls */}
                {!approvedLink && (
                  <div className="mt-5 flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isApproving || isDenying}
                      loading={isDenying}
                      onClick={() => handleDeny(ord._id)}
                    >
                      Deny & Release Stock
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isApproving || isDenying}
                      loading={isApproving}
                      onClick={() => handleApprove(ord._id)}
                    >
                      Approve & Issue PayPal Link
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
