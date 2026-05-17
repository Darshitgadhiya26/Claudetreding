'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn, formatNumber, formatPercent, formatLargeNumber } from '@/lib/utils'
import { useTopMovers } from '@/hooks/useMarketData'
import { useMarketStore } from '@/store/marketStore'

export default function TopGainersLosers() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers')
  const { setSelectedSymbol } = useMarketStore()

  const { data: gainers, isLoading: loadingGainers } = useTopMovers('gainers', 'NSE', 10)
  const { data: losers, isLoading: loadingLosers } = useTopMovers('losers', 'NSE', 10)

  const isLoading = activeTab === 'gainers' ? loadingGainers : loadingLosers
  const data = activeTab === 'gainers' ? gainers : losers

  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbol(symbol)
    router.push('/charts')
  }

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('gainers')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            activeTab === 'gainers'
              ? 'text-success border-b-2 border-success bg-success/5'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <TrendingUp className="w-4 h-4" />
          Top Gainers
        </button>
        <button
          onClick={() => setActiveTab('losers')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            activeTab === 'losers'
              ? 'text-danger border-b-2 border-danger bg-danger/5'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <TrendingDown className="w-4 h-4" />
          Top Losers
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-12 px-4 py-2 border-b border-border">
        <div className="col-span-4 text-xs text-text-muted font-medium uppercase tracking-wide">#  Symbol</div>
        <div className="col-span-4 text-xs text-text-muted font-medium uppercase tracking-wide text-right">LTP</div>
        <div className="col-span-4 text-xs text-text-muted font-medium uppercase tracking-wide text-right">Change%</div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="grid grid-cols-12 px-4 py-3 border-b border-border/50 animate-pulse">
                <div className="col-span-4 h-4 bg-surface3 rounded" />
                <div className="col-span-4 flex justify-end"><div className="h-4 bg-surface3 rounded w-16" /></div>
                <div className="col-span-4 flex justify-end"><div className="h-4 bg-surface3 rounded w-12" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {data?.map((stock: { symbol: string; ltp: number; change: number; changePercent: number; volume: number }, index: number) => {
              const isPositive = activeTab === 'gainers'
              return (
                <motion.div
                  key={stock.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleSymbolClick(stock.symbol)}
                  className="grid grid-cols-12 px-4 py-2.5 hover:bg-surface2 cursor-pointer transition-colors items-center"
                >
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="text-xs text-text-muted w-4">{index + 1}</span>
                    <span className="text-sm font-medium text-text-primary truncate">{stock.symbol}</span>
                  </div>
                  <div className="col-span-4 text-right">
                    <span className="text-sm font-mono text-text-primary">{formatNumber(stock.ltp)}</span>
                    <div className="text-xs text-text-muted">{formatLargeNumber(stock.volume)}</div>
                  </div>
                  <div className="col-span-4 flex flex-col items-end">
                    <span className={cn(
                      'text-sm font-semibold',
                      isPositive ? 'text-success' : 'text-danger'
                    )}>
                      {formatPercent(stock.changePercent)}
                    </span>
                    <span className={cn(
                      'text-xs',
                      isPositive ? 'text-success/70' : 'text-danger/70'
                    )}>
                      {isPositive ? '+' : ''}{formatNumber(stock.change)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
