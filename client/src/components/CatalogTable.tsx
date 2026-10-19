import { useEffect, useMemo, useState } from 'react'
import { getCatalog, updateProduct } from '../api/client'
import type { ProductOffer } from '../types'
import { Badge, availabilityTone } from './ui/Badge'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Spinner } from './ui/Spinner'

export function CatalogTable() {
  const [products, setProducts] = useState<ProductOffer[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [query, setQuery] = useState('')

  async function load() {
    setStatus('loading')
    try {
      const data = await getCatalog()
      setProducts(data.products)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q),
    )
  }, [products, query])

  function handleUpdated(updated: ProductOffer) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search catalog by name, category, or SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-72"
          />
          <Button variant="secondary" size="sm" onClick={load}>
            Refresh
          </Button>
        </div>
        {status === 'ready' && (
          <span className="font-mono text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-200">{filtered.length}</span> of {products.length} products
          </span>
        )}
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2.5 py-20 text-sm text-slate-400">
          <Spinner size={16} /> Loading catalog inventory...
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 py-12 text-center text-sm text-rose-400">
          Failed to load catalog. Ensure the server is running on port 5000.
        </div>
      )}

      {status === 'ready' && filtered.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] py-16 text-center text-sm text-slate-400">
          No catalog items matched "{query}".
        </div>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-surface/80 backdrop-blur-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] font-mono text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5 font-medium">Product / SKU</th>
                <th className="px-5 py-3.5 font-medium">Category</th>
                <th className="px-5 py-3.5 font-medium">Price ($)</th>
                <th className="px-5 py-3.5 font-medium">Live Stock</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map((p) => (
                <ProductRow key={p.id} product={p} onUpdated={handleUpdated} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProductRow({ product, onUpdated }: { product: ProductOffer; onUpdated: (p: ProductOffer) => void }) {
  const [price, setPrice] = useState(String(product.price.amount))
  const [stock, setStock] = useState(String(product.stock))
  const [saving, setSaving] = useState<'price' | 'stock' | null>(null)
  const [justSaved, setJustSaved] = useState<'price' | 'stock' | null>(null)

  useEffect(() => {
    setPrice(String(product.price.amount))
    setStock(String(product.stock))
  }, [product.price.amount, product.stock])

  async function commitValue(field: 'price' | 'stock', num: number) {
    setSaving(field)
    try {
      const updated = await updateProduct(product.id, field === 'price' ? { price: num } : { stock: num })
      onUpdated(updated)
      setJustSaved(field)
      setTimeout(() => setJustSaved(null), 1200)
    } catch {
      if (field === 'price') setPrice(String(product.price.amount))
      else setStock(String(product.stock))
    } finally {
      setSaving(null)
    }
  }

  function handleBlur(field: 'price' | 'stock') {
    const raw = field === 'price' ? price : stock
    const num = Number(raw)
    const current = field === 'price' ? product.price.amount : product.stock

    if (!Number.isFinite(num) || num < 0) {
      if (field === 'price') setPrice(String(product.price.amount))
      else setStock(String(product.stock))
      return
    }
    if (num === current) return
    commitValue(field, num)
  }

  const isOutOfStock = product.availability === 'out_of_stock'

  return (
    <tr
      className={`transition-colors duration-150 hover:bg-white/[0.02] ${
        isOutOfStock ? 'bg-rose-500/[0.02]' : ''
      }`}
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3.5">
          <img
            src={product.imageUrl}
            alt=""
            className="h-12 w-12 rounded-lg border border-white/[0.1] bg-surface-raised object-cover shadow-sm"
          />
          <div>
            <div className="font-medium text-slate-100">{product.name}</div>
            <div className="font-mono text-xs text-slate-400">{product.sku}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 font-mono text-xs text-slate-300">
        <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1">
          {product.category}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 font-mono">
          <span className="text-slate-400">$</span>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => handleBlur('price')}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="focus-thread w-20 rounded-md border border-white/[0.08] bg-surface-raised/90 px-2.5 py-1 text-xs text-slate-100 transition-colors focus:border-[#0070BA]"
          />
          {saving === 'price' && <Spinner size={12} />}
          {justSaved === 'price' && <span className="font-mono text-[10px] text-emerald-400">saved</span>}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 font-mono">
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            onBlur={() => handleBlur('stock')}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="focus-thread w-20 rounded-md border border-white/[0.08] bg-surface-raised/90 px-2.5 py-1 text-xs text-slate-100 transition-colors focus:border-[#0070BA]"
          />
          <button
            type="button"
            title="Set stock to 0 to simulate OUT_OF_STOCK test"
            onClick={() => {
              setStock('0')
              commitValue('stock', 0)
            }}
            className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-400"
          >
            Zero
          </button>
          {saving === 'stock' && <Spinner size={12} />}
          {justSaved === 'stock' && <span className="font-mono text-[10px] text-emerald-400">saved</span>}
        </div>
      </td>
      <td className="px-5 py-4">
        <Badge tone={availabilityTone(product.availability)}>
          {product.availability.replace(/_/g, ' ')}
        </Badge>
      </td>
    </tr>
  )
}
