import { useState } from 'react'
import { runBuyerAgent } from '../api/client'
import type { BuyerAgentResult } from '../types'
import { Badge, type Tone } from './ui/Badge'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Spinner } from './ui/Spinner'

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

interface Step {
  key: string
  label: string
  status: StepStatus
}

interface DemoScenario {
  id: string
  label: string
  tag: string
  tone: 'success' | 'warning' | 'danger' | 'info'
  prompt: string
  customer: string
  desc: string
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'happy-path',
    label: 'Happy Path',
    tag: '$55 · Auto-Link',
    tone: 'success',
    prompt: 'Black hoodie under $60',
    customer: 'Alex Chen',
    desc: 'Auto-approves & generates PayPal checkout link',
  },
  {
    id: 'approval-gate',
    label: 'Approval Gate',
    tag: '$135 · Review Gate',
    tone: 'warning',
    prompt: 'Minimalist leather sneakers under $150',
    customer: 'Samantha Reed',
    desc: 'Hits $100 gate; holds for human admin review',
  },
  {
    id: 'hard-cap',
    label: 'Safety Cap Rejection',
    tag: '$600 · Hard Cap',
    tone: 'danger',
    prompt: 'Luxury designer suit under $650',
    customer: 'Marcus Vance',
    desc: 'Auto-rejects ($500 hard safety cap) & releases stock',
  },
  {
    id: 'stock-check',
    label: 'Zero-Stock Recovery',
    tag: 'Inventory Test',
    tone: 'info',
    prompt: 'Tan chore coat under $100',
    customer: 'Elena Rostova',
    desc: 'Tests optimistic lock when stock is decremented to 0',
  },
]

function computeSteps(result: BuyerAgentResult | null, isRunning: boolean): Step[] {
  const steps: Step[] = [
    { key: 'parse', label: '1. Parse Intent', status: 'pending' },
    { key: 'search', label: '2. Catalog Search', status: 'pending' },
    { key: 'pick', label: '3. Select Item', status: 'pending' },
    { key: 'checkout', label: '4. Guardrails & PayPal', status: 'pending' },
  ]
  if (isRunning && !result) {
    steps[0].status = 'running'
    return steps
  }
  if (!result) return steps

  steps[0].status = result.stoppedAt === 'parse_intent' ? 'error' : 'done'
  if (steps[0].status === 'error') {
    steps[1].status = steps[2].status = steps[3].status = 'skipped'
    return steps
  }

  if (result.stoppedAt === 'search' || result.stoppedAt === 'no_matches') {
    steps[1].status = 'error'
    steps[2].status = steps[3].status = 'skipped'
    return steps
  }
  steps[1].status = 'done'

  if (result.stoppedAt === 'pick_match') {
    steps[2].status = 'error'
    steps[3].status = 'skipped'
    return steps
  }
  steps[2].status = 'done'

  steps[3].status = result.checkout ? (result.checkout.status === 201 ? 'done' : 'error') : 'skipped'
  return steps
}

function checkoutOutcomeTone(status: number): Tone {
  if (status === 201) return 'success'
  if (status === 202) return 'warning'
  return 'danger'
}

function PayPalLogo() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <path
        d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.47a.641.641 0 0 1 .633-.541h7.828c3.966 0 6.643 1.94 6.223 5.76-.388 3.524-2.82 5.547-6.096 5.547H10.15a.641.641 0 0 0-.633.542l-1.077 6.843a.641.641 0 0 1-.634.542z"
        fill="#FFFFFF"
      />
      <path
        d="M10.15 13.236h3.383c3.276 0 5.708-2.023 6.096-5.547.42-3.82-2.257-5.76-6.223-5.76H5.577a.641.641 0 0 0-.633.541L2.47 20.597a.641.641 0 0 0 .633.74h4.606l1.077-6.843a.641.641 0 0 1 .634-.542l.73-4.716z"
        fill="#00F2FE"
        opacity="0.3"
      />
    </svg>
  )
}

export function BuyerAgentConsole({ onOrderCreated }: { onOrderCreated?: (orderId: string) => void }) {
  const [want, setWant] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BuyerAgentResult | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  async function executeRun(promptText: string, customerText: string) {
    if (!promptText.trim() || !customerText.trim() || running) return
    setRunning(true)
    setFatalError(null)
    setResult(null)
    try {
      const data = await runBuyerAgent(promptText.trim(), customerText.trim())
      setResult(data)
      const orderId = data.checkout?.body.orderId
      if (typeof orderId === 'string' && onOrderCreated) onOrderCreated(orderId)
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setRunning(false)
    }
  }

  function handleTriggerScenario(scenario: DemoScenario) {
    setWant(scenario.prompt)
    setCustomerName(scenario.customer)
    executeRun(scenario.prompt, scenario.customer)
  }

  const steps = computeSteps(result, running)
  const chosen = result?.offers?.find((o) => o.id === result.picked?.productId)

  return (
    <div className="space-y-6">
      {/* Quick Demo Scenario Chips */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-400">
            One-Click Demo Scenarios
          </span>
          <span className="text-[10px] text-slate-500">Click to autofill & run agent</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DEMO_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={running}
              onClick={() => handleTriggerScenario(s)}
              className="group relative flex flex-col items-start rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 text-left transition-all duration-200 hover:border-[#0070BA]/50 hover:bg-[#0070BA]/5 active:scale-[0.98] disabled:opacity-40"
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  {s.label}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    s.tone === 'success'
                      ? 'bg-emerald-400 shadow-[0_0_6px_#10B981]'
                      : s.tone === 'warning'
                        ? 'bg-amber-400 shadow-[0_0_6px_#F59E0B]'
                        : s.tone === 'danger'
                          ? 'bg-rose-400 shadow-[0_0_6px_#F43F5E]'
                          : 'bg-sky-400 shadow-[0_0_6px_#0284C7]'
                  }`}
                />
              </div>
              <span className="mt-1 font-mono text-[10px] text-slate-400">{s.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Natural Language Prompt Bar */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Input
              placeholder='e.g. "black hoodie under $60" or "minimalist leather sneakers"'
              value={want}
              onChange={(e) => setWant(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeRun(want, customerName)}
              disabled={running}
              className="pr-10"
            />
            {want && (
              <button
                type="button"
                onClick={() => setWant('')}
                className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>
          <Input
            placeholder="Shopper name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeRun(want, customerName)}
            disabled={running}
            className="sm:w-44"
          />
          <Button
            onClick={() => executeRun(want, customerName)}
            loading={running}
            disabled={!want.trim() || !customerName.trim()}
            className="sm:w-28"
          >
            Run Agent
          </Button>
        </div>
      </div>

      {/* Execution Step Pipeline Visualizer */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] p-3">
        <ol className="flex items-center gap-1.5">
          {steps.map((step, i) => (
            <li key={step.key} className="flex flex-1 items-center gap-1.5">
              <div
                className={`flex h-8 flex-1 items-center justify-center rounded-lg border px-1 text-center font-mono text-[10px] font-medium tracking-tight transition-all duration-200 ${
                  step.status === 'done'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : step.status === 'running'
                      ? 'border-[#0070BA] bg-[#0070BA]/20 text-[#00F2FE] shadow-[0_0_12px_rgba(0,112,186,0.3)] animate-pulse'
                      : step.status === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                        : step.status === 'skipped'
                          ? 'border-white/[0.04] bg-white/[0.01] text-slate-600'
                          : 'border-white/[0.06] bg-surface-raised/40 text-slate-400'
                }`}
              >
                {step.status === 'done' && <span className="mr-1 text-xs">✓</span>}
                {step.label}
              </div>
              {i < steps.length - 1 && <span className="text-slate-600">→</span>}
            </li>
          ))}
        </ol>
      </div>

      {/* Running Spinner Message */}
      {running && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[#0070BA]/30 bg-[#0070BA]/10 p-3.5 text-xs text-[#00F2FE]">
          <Spinner size={16} />
          <span>Gemini AI is analyzing purchase intent, executing catalog search, and locking inventory...</span>
        </div>
      )}

      {/* Fatal Error Notice */}
      {fatalError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-400">
          {fatalError}
        </div>
      )}

      {/* Agent Execution Results */}
      {result && (
        <div className="space-y-4">
          {/* Query Intent Metadata */}
          {result.intent && (
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-400">
              <span className="text-slate-500">Extracted Intent:</span>
              <span className="rounded bg-white/[0.04] px-2 py-0.5 text-slate-200 border border-white/[0.08]">
                query: "{result.intent.query}"
              </span>
              {result.intent.maxPrice !== undefined && (
                <span className="rounded bg-white/[0.04] px-2 py-0.5 text-emerald-400 border border-white/[0.08]">
                  budget: ≤ ${result.intent.maxPrice}
                </span>
              )}
              {result.offers && (
                <span className="text-slate-500">({result.offers.length} matches discovered)</span>
              )}
            </div>
          )}

          {result.error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-400">
              {result.error}
            </div>
          )}

          {/* Selected Product Card */}
          {chosen && result.picked && (
            <div className="rounded-xl border border-white/[0.1] bg-surface-raised/70 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-4">
                <img
                  src={chosen.imageUrl}
                  alt={chosen.name}
                  className="h-16 w-16 rounded-xl border border-white/[0.1] object-cover shadow-md"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{chosen.name}</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      ${chosen.price.amount} {chosen.price.currency}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-slate-400">SKU: {chosen.sku}</div>
                  <p className="mt-2 text-xs italic text-slate-300">
                    "{result.picked.reasoning}"
                  </p>
                </div>
              </div>
              {result.picked.fellBack && (
                <p className="mt-2 text-[11px] text-amber-400 font-mono">
                  ⚠ Exact match was out of stock; autonomously fell back to top candidate.
                </p>
              )}
            </div>
          )}

          {/* Checkout & Gate Outcome Card */}
          {result.checkout && (
            <div className="rounded-xl border border-white/[0.1] bg-surface/90 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <Badge tone={checkoutOutcomeTone(result.checkout.status)}>
                  HTTP {result.checkout.status}
                </Badge>
                {typeof result.checkout.body.orderId === 'string' && (
                  <span className="font-mono text-xs text-slate-400">
                    Order ID: <span className="text-slate-200">{result.checkout.body.orderId}</span>
                  </span>
                )}
              </div>

              {/* Success: 201 Created */}
              {result.checkout.status === 201 && (
                <div className="mt-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      PayPal Orders v2 generated for{' '}
                      <span className="font-bold text-emerald-400 font-mono">
                        ${String(result.checkout.body.amount ?? '')}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400">
                      Stock Reserved: 1 unit
                    </span>
                  </div>

                  {typeof result.checkout.body.paymentLink === 'string' && (
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
                      <a
                        href={result.checkout.body.paymentLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0070BA] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:bg-[#003087] hover:scale-[1.02] active:scale-[0.98] border border-blue-400/30"
                      >
                        <PayPalLogo />
                        <span>Pay with PayPal</span>
                      </a>
                      <a
                        href={result.checkout.body.paymentLink}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-xs text-[#00F2FE] hover:underline"
                        title={result.checkout.body.paymentLink}
                      >
                        {result.checkout.body.paymentLink}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Pending Approval: 202 Accepted */}
              {result.checkout.status === 202 && (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <div className="font-semibold">Held for Human Approval:</div>
                  <div className="mt-1">{String(result.checkout.body.message ?? '')}</div>
                  <div className="mt-2 text-[10px] text-slate-400 font-mono">
                    Stock is held safely in reserve while awaiting approval.
                  </div>
                </div>
              )}

              {/* Rejection / Failure: 4xx / 5xx */}
              {result.checkout.status !== 201 && result.checkout.status !== 202 && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <div className="font-semibold">Guardrail / Verification Rejection:</div>
                  <div className="mt-1">
                    {String(result.checkout.body.error ?? result.checkout.body.message ?? 'Order could not proceed')}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 font-mono">
                    Stock released atomically back to inventory.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
