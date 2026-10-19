import { useEffect, useState } from 'react'
import { captureOrder, getOrder, type CaptureOrderResponse } from '../api/client'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

interface CheckoutSuccessProps {
  onNavigateHome: () => void
  onViewAudit?: (orderId: string) => void
}

export function CheckoutSuccess({ onNavigateHome, onViewAudit }: CheckoutSuccessProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [captureData, setCaptureData] = useState<CaptureOrderResponse | null>(null)
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const referenceId = params.get('referenceId') || params.get('orderId')

    if (!referenceId) {
      setError('Missing order reference ID in URL parameters.')
      setLoading(false)
      return
    }

    async function executeCapture() {
      try {
        setLoading(true)
        const result = await captureOrder(referenceId!)
        setCaptureData(result)

        if (result.order) {
          setOrder(result.order)
        } else {
          // Fallback fetch if capture didn't embed order
          const fetched = await getOrder(referenceId!)
          setOrder(fetched.order)
        }
      } catch (err: any) {
        console.error('Capture error:', err)
        // If capture failed, try fetching the order to see if webhook already captured it
        try {
          const fallback = await getOrder(referenceId!)
          if (fallback.order?.status === 'paid') {
            setOrder(fallback.order)
            setCaptureData({
              status: 'paid',
              orderId: referenceId!,
              captureId: fallback.order?.paypal?.captureId,
              order: fallback.order,
            })
            return
          }
        } catch {
          // ignore fallback error
        }
        setError(err.message || 'Failed to capture PayPal order.')
      } finally {
        setLoading(false)
      }
    }

    executeCapture()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#0070BA]/30 bg-[#0070BA]/10 shadow-[0_0_30px_rgba(0,112,186,0.25)]">
          <Spinner size={28} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">
          Finalizing PayPal Sandbox Capture...
        </h2>
        <p className="max-w-md text-xs text-slate-400 font-mono">
          Authorizing payment capture with PayPal REST API v2 & updating immutable inventory ledger.
        </p>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-surface/90 p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-bold text-white">Payment Finalization Notice</h2>
        <p className="mt-2 text-xs text-slate-400">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={onNavigateHome}>
            Return to Agent Console
          </Button>
        </div>
      </div>
    )
  }

  const orderId = captureData?.orderId || order?._id
  const captureId = captureData?.captureId || order?.paypal?.captureId || 'PAYPAL-CAPTURED'
  const product = order?.product
  const amount = order?.amount ?? product?.unitPrice?.amount ?? 0
  const currency = order?.currency ?? 'USD'

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-surface/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#0070BA]/10 blur-3xl" />

        {/* Success Banner */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_35px_rgba(16,185,129,0.3)]">
            <svg
              className="h-8 w-8 text-emerald-400 animate-[bounce_1s_ease-out_1]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge tone="success">Payment Confirmed</Badge>
            <span className="font-mono text-xs text-slate-400">PayPal Sandbox v2</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Autonomous Order Complete!
          </h1>
          <p className="mt-1 max-w-md text-xs text-slate-300">
            Payment capture verified and permanently booked. Atomic inventory deduction confirmed.
          </p>
        </div>

        {/* Receipt & Item Summary Card */}
        {product && (
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center gap-4">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-16 w-16 rounded-xl border border-white/[0.1] object-cover shadow-sm"
                />
              )}
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{product.name}</div>
                <div className="font-mono text-xs text-slate-400">SKU: {product.sku}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-xs text-emerald-400 font-semibold">
                    ${amount.toFixed(2)} {currency}
                  </span>
                  <span className="text-[11px] text-slate-500">· Quantity: {order?.quantity || 1}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technical Audit Proof Details */}
        <div className="mt-6 space-y-2.5 rounded-xl border border-white/[0.08] bg-surface-raised/50 p-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
            <span className="text-slate-400">Store Order ID</span>
            <span className="text-slate-200 select-all">{orderId}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
            <span className="text-slate-400">PayPal Capture ID</span>
            <span className="text-[#00F2FE] select-all font-semibold">{captureId}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
            <span className="text-slate-400">Shopper Actor</span>
            <span className="text-slate-200">{order?.actor || 'gemini-buyer-agent'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Inventory Status</span>
            <span className="text-emerald-400">Claimed & Decremented</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="primary" size="lg" onClick={onNavigateHome}>
            Return to Agent Console
          </Button>
          {onViewAudit && orderId && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => onViewAudit(orderId)}
            >
              Inspect Order Audit Log
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
