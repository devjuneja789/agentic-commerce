import { useState } from 'react'
import { BuyerAgentConsole } from '../components/BuyerAgentConsole'
import { AuditTrail } from '../components/AuditTrail'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function Dashboard({
  initialOrderId,
  onOrderCreated,
}: {
  initialOrderId?: string
  onOrderCreated?: (orderId: string) => void
} = {}) {
  const [orderId, setOrderId] = useState<string | undefined>(initialOrderId)

  function handleOrderCreated(id: string) {
    setOrderId(id)
    if (onOrderCreated) onOrderCreated(id)
  }

  return (
    <div className="space-y-6">
      {/* Top Architecture Metric Pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.07] bg-surface/80 p-3.5 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            AI Buyer Model
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-slate-200">
            <span className="h-2 w-2 rounded-full bg-[#00F2FE] shadow-[0_0_8px_#00F2FE]" />
            Gemini 2.5 Flash
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-surface/80 p-3.5 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Payment Gateway
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-[#0070BA]">
            <span className="h-2 w-2 rounded-full bg-[#0070BA] shadow-[0_0_8px_#0070BA]" />
            PayPal Orders v2
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-surface/80 p-3.5 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Guardrail Threshold
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
            $100 Gate / $500 Max
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-surface/80 p-3.5 backdrop-blur-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Stock Concurrency
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
            Atomic MongoDB Locks
          </div>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Buyer Agent Console (7 cols) */}
        <div className="lg:col-span-7">
          <Card
            title={
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#0070BA] shadow-[0_0_6px_#0070BA]" />
                <span>Autonomous Shopping Agent</span>
              </div>
            }
          >
            <BuyerAgentConsole onOrderCreated={handleOrderCreated} />
          </Card>
        </div>

        {/* Right Column: Live Decision Audit Trail (5 cols) */}
        <div className="lg:col-span-5">
          <Card
            title={
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981] animate-pulse" />
                <span>Real-Time Audit Stream</span>
              </div>
            }
            action={
              orderId ? (
                <Button variant="ghost" size="sm" onClick={() => setOrderId(undefined)}>
                  Clear order filter
                </Button>
              ) : undefined
            }
          >
            {orderId && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-[#0070BA]/30 bg-[#0070BA]/10 px-3 py-1.5 font-mono text-xs text-[#00F2FE]">
                <span>Filter: Order {orderId}</span>
                <span className="text-[10px] text-slate-400">showing targeted trail</span>
              </div>
            )}
            <AuditTrail orderId={orderId} />
          </Card>
        </div>
      </div>
    </div>
  )
}
