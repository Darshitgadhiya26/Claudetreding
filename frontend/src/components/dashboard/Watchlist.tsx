'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, X, Star, TrendingUp, TrendingDown } from 'lucide-react'
import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { useMarketStore } from '@/store/marketStore'
import { useMultipleQuotes } from '@/hooks/useMarketData'

export default function Watchlist() {
  const router = useRouter()
  const { watchlists, activeWatchlistId, setActiveWatchlist, setSelectedSymbol, removeFromWatchlist } = useMarketStore()
  const [showAddSymbol, setShowAddSymbol] = useState(false)
  const [newSymbol, setNewSymbol] = useState('')
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId)
  const symbols = activeWatchlist?.items.map((i) => i.symbol) || []

  const { data: quotes } = useMultipleQuotes(symbols)

  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbol(symbol)
    router.push('/charts')
  }

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-warning" />
          <span className="text-sm font-semibold text-text-primary">Watchlist</span>
        </div>
        <button
          onClick={() => setShowAddSymbol(!showAddSymbol)}
          className="p-1 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
          title="Add symbol"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Watchlist tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto">
        {watchlists.map((wl) => (
          <button
            key={wl.id}
            onClick={() => setActiveWatchlist(wl.id)}
            className={cn(
              'px-3 py-1 text-xs rounded font-medium whitespace-nowrap transition-colors',
              activeWatchlistId === wl.id
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-text-muted hover:text-text-primary hover:bg-surface2'
            )}
          >
            {wl.name}
            <span className="ml-1.5 text-text-muted">({wl.items.length})</span>
          </button>
        ))}
      </div>

      {/* Add symbol input */}
      <AnimatePresence>
        {showAddSymbol && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border overflow-hidden"
          >
            <div className="px-3 py-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
              <input
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                placeholder="Search symbol to add..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
                autoFocus
              />
              <button onClick={() => setShowAddSymbol(false)}>
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table header */}
      <div className="grid grid-cols-12 px-4 py-2 border-b border-border">
        <div className="col-span-5 text-xs text-text-muted font-medium uppercase tracking-wide">Symbol</div>
        <div className="col-span-3 text-xs text-text-muted font-medium uppercase tracking-wide text-right">LTP</div>
        <div className="col-span-4 text-xs text-text-muted font-medium uppercase tracking-wide text-right">Change</div>
      </div>

      {/* Watchlist items */}
      <div className="flex-1 overflow-y-auto">
        {!activeWatchlist?.items.length ? (
          <div className="flex flex-col items-center justify-center h-32 text-text-muted">
            <Star className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Watchlist is empty</p>
            <p className="text-xs mt-1">Click + to add symbols</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {activeWatchlist.items.map((item) => {
              const quote = quotes?.[item.symbol]
              const isPositive = (quote?.change ?? 0) >= 0
              return (
                <motion.div
                  key={item.symbol}
                  onMouseEnter={() => setHoveredSymbol(item.symbol)}
                  onMouseLeave={() => setHoveredSymbol(null)}
                  onClick={() => handleSymbolClick(item.symbol)}
                  className="grid grid-cols-12 px-4 py-2.5 hover:bg-surface2 cursor-pointer transition-colors items-center"
                >
                  {/* Symbol */}
                  <div className="col-span-5 flex items-center gap-2">
                    <div className={cn(
                      'w-1.5 h-6 rounded-full flex-shrink-0',
                      isPositive ? 'bg-success/40' : 'bg-danger/40'
                    )} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">{item.symbol}</div>
                      <div className="text-xs text-text-muted">{item.exchange}</div>
                    </div>
                  </div>

                  {/* LTP */}
                  <div className="col-span-3 text-right">
                    {quote ? (
                      <span className="text-sm font-mono font-medium text-text-primary">
                        {formatNumber(quote.ltp)}
                      </span>
                    ) : (
                      <div className="h-4 bg-surface3 rounded animate-pulse ml-auto w-16" />
                    )}
                  </div>

                  {/* Change */}
                  <div className="col-span-4 flex flex-col items-end">
                    {quote ? (
                      <>
                        <span className={cn(
                          'text-xs font-medium',
                          isPositive ? 'text-success' : 'text-danger'
                        )}>
                          {formatPercent(quote.changePercent)}
                        </span>
                        <span className={cn(
                          'text-xs',
                          isPositive ? 'text-success/70' : 'text-danger/70'
                        )}>
                          {isPositive ? '+' : ''}{formatNumber(quote.change)}
                        </span>
                      </>
                    ) : (
                      <div className="h-8 flex flex-col gap-1 items-end">
                        <div className="h-3 bg-surface3 rounded animate-pulse w-12" />
                        <div className="h-3 bg-surface3 rounded animate-pulse w-10" />
                      </div>
                    )}
                  </div>

                  {/* Action on hover */}
                  {hoveredSymbol === item.symbol && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-12 flex items-center justify-between mt-1 px-2"
                    >
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3 text-success" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-danger" />
                        )}
                        Vol: {quote?.volume ? (quote.volume / 1000000).toFixed(2) + 'M' : '--'}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (activeWatchlistId) {
                            removeFromWatchlist(activeWatchlistId, item.symbol)
                          }
                        }}
                        className="text-xs text-text-muted hover:text-danger transition-colors"
                      >
                        Remove
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
