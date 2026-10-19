import { useEffect, useState, type ReactNode } from 'react'
import { getHealth, getPendingOrders } from './api/client'
import { Dashboard } from './pages/Dashboard'
import { CatalogAdmin } from './pages/CatalogAdmin'
import { CheckoutSuccess } from './pages/CheckoutSuccess'
import { CheckoutCancel } from './pages/CheckoutCancel'
import { PendingApprovals } from './pages/PendingApprovals'
import { McpDocs } from './pages/McpDocs'

type Page = 'dashboard' | 'catalog' | 'approvals' | 'mcp'
type HealthStatus = 'checking' | 'ok' | 'error'

function NavTab({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean
  onClick: () => void
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-thread relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ${
        active
          ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.12]'
          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'
      }`}
    >
      {children}
      {badge}
    </button>
  )
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [health, setHealth] = useState<HealthStatus>('checking')
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [selectedAuditOrderId, setSelectedAuditOrderId] = useState<string | undefined>(undefined)
  const [pendingCount, setPendingCount] = useState<number>(0)

  function refreshPendingCount() {
    getPendingOrders()
      .then((data) => setPendingCount(data.count))
      .catch(() => {})
  }

  useEffect(() => {
    getHealth()
      .then(() => setHealth('ok'))
      .catch(() => setHealth('error'))

    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 8000)

    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      clearInterval(interval)
    }
  }, [])

  function navigateTo(path: string, newPage?: Page) {
    window.history.pushState({}, '', path)
    setCurrentPath(path)
    if (newPage) setPage(newPage)
  }

  function handleNavigateHome() {
    navigateTo('/', 'dashboard')
    setSelectedAuditOrderId(undefined)
  }

  function handleViewAudit(orderId: string) {
    setSelectedAuditOrderId(orderId)
    navigateTo('/', 'dashboard')
  }

  const isCheckoutSuccess = currentPath.startsWith('/checkout/success')
  const isCheckoutCancel = currentPath.startsWith('/checkout/cancel')

  return (
    <div className="min-h-screen bg-[#08090C] bg-tech-grid text-slate-100">
      {/* Top Glassmorphic Command Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#08090C]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Tag */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={handleNavigateHome}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0070BA] to-[#003087] font-mono text-sm font-bold text-white shadow-lg shadow-blue-500/20 border border-white/[0.15]">
              SL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-white">Studio Loom</span>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-400 border border-white/[0.08]">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Autonomous Commerce Engine</p>
            </div>
          </div>

          {/* Navigation Pill Tabs */}
          <nav className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-surface/70 p-1 backdrop-blur-md">
            <NavTab
              active={!isCheckoutSuccess && !isCheckoutCancel && page === 'dashboard'}
              onClick={() => {
                if (isCheckoutSuccess || isCheckoutCancel) navigateTo('/', 'dashboard')
                else setPage('dashboard')
              }}
            >
              Agent Console
            </NavTab>
            <NavTab
              active={!isCheckoutSuccess && !isCheckoutCancel && page === 'catalog'}
              onClick={() => {
                if (isCheckoutSuccess || isCheckoutCancel) navigateTo('/', 'catalog')
                else setPage('catalog')
              }}
            >
              Catalog Inventory
            </NavTab>
            <NavTab
              active={!isCheckoutSuccess && !isCheckoutCancel && page === 'approvals'}
              onClick={() => {
                if (isCheckoutSuccess || isCheckoutCancel) navigateTo('/', 'approvals')
                else setPage('approvals')
              }}
              badge={
                pendingCount > 0 ? (
                  <span className="flex items-center justify-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/40">
                    {pendingCount}
                  </span>
                ) : undefined
              }
            >
              Approvals Queue
            </NavTab>
            <NavTab
              active={!isCheckoutSuccess && !isCheckoutCancel && page === 'mcp'}
              onClick={() => {
                if (isCheckoutSuccess || isCheckoutCancel) navigateTo('/', 'mcp')
                else setPage('mcp')
              }}
              badge={
                <span className="rounded bg-[#00F2FE]/10 px-1.5 py-0.2 font-mono text-[10px] font-medium text-[#00F2FE] border border-[#00F2FE]/20">
                  MCP
                </span>
              }
            >
              MCP Protocol
            </NavTab>
          </nav>

          {/* Real-time System Status Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 font-mono text-xs text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  health === 'ok'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]'
                    : health === 'error'
                      ? 'bg-rose-400 shadow-[0_0_8px_#F43F5E]'
                      : 'animate-pulse bg-amber-400 shadow-[0_0_8px_#F59E0B]'
                }`}
              />
              <span className="hidden sm:inline">
                {health === 'ok'
                  ? 'PayPal Sandbox Connected'
                  : health === 'error'
                    ? 'Server Offline'
                    : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isCheckoutSuccess ? (
          <CheckoutSuccess
            onNavigateHome={handleNavigateHome}
            onViewAudit={handleViewAudit}
          />
        ) : isCheckoutCancel ? (
          <CheckoutCancel
            onNavigateHome={handleNavigateHome}
            onNavigateCatalog={() => {
              navigateTo('/', 'catalog')
            }}
          />
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {page === 'dashboard'
                  ? 'Autonomous Agent Console'
                  : page === 'catalog'
                    ? 'Catalog Inventory & Stock Control'
                    : page === 'approvals'
                      ? 'Human-in-the-Loop Review Queue'
                      : 'Model Context Protocol (MCP) Hub'}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {page === 'dashboard'
                  ? 'Conversational purchasing powered by Gemini AI, atomic stock locks, spending guardrails, and PayPal Orders v2.'
                  : page === 'catalog'
                    ? 'Real-time catalog pricing and inventory levers for testing stock reservations and out-of-stock scenarios.'
                    : page === 'approvals'
                      ? 'Store manager authorization portal for transactions flagged by autonomous spending guardrails.'
                      : 'Standardized tool manifest and sandbox for external AI agents (Claude Desktop, Cursor, external LLMs) to search catalog and trigger safe PayPal checkouts.'}
              </p>
            </div>

            {page === 'dashboard' && (
              <Dashboard
                initialOrderId={selectedAuditOrderId}
                onOrderCreated={refreshPendingCount}
              />
            )}
            {page === 'catalog' && <CatalogAdmin />}
            {page === 'approvals' && (
              <PendingApprovals
                onOrderUpdated={refreshPendingCount}
                onNavigateConsole={() => {
                  setPage('dashboard')
                  navigateTo('/', 'dashboard')
                }}
              />
            )}
            {page === 'mcp' && <McpDocs />}
          </>
        )}
      </main>
    </div>
  )
}

export default App
