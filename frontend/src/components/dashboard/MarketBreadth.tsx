'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import { formatLargeNumber } from '@/lib/utils'
import { useMarketBreadth } from '@/hooks/useMarketData'

export default function MarketBreadth() {
  const { data: breadth, isLoading } = useMarketBreadth()

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-surface3 rounded w-32 mb-4" />
        <div className="h-8 bg-surface3 rounded mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-surface3 rounded" />)}
        </div>
      </div>
    )
  }

  if (!breadth) return null

  const total = breadth.advances + breadth.declines + breadth.unchanged
  const advancePct = (breadth.advances / total) * 100
  const declinePct = (breadth.declines / total) * 100
  const unchangedPct = (breadth.unchanged / total) * 100

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-text-primary">Market Breadth</span>
        </div>
        <div className="text-xs text-text-muted">NSE • {total} Stocks</div>
      </div>

      {/* Breadth bar */}
      <div className="flex rounded-full overflow-hidden h-3 mb-4 gap-px">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${advancePct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="bg-success rounded-l-full"
          title={`Advances: ${breadth.advances}`}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${unchangedPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          className="bg-text-muted"
          title={`Unchanged: ${breadth.unchanged}`}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${declinePct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className="bg-danger rounded-r-full"
          title={`Declines: ${breadth.declines}`}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
            <span className="text-xs text-success font-medium">Advances</span>
          </div>
          <div className="text-xl font-bold text-success">{breadth.advances.toLocaleString('en-IN')}</div>
          <div className="text-xs text-success/60 mt-0.5">{advancePct.toFixed(1)}%</div>
        </div>

        <div className="bg-surface2 border border-border rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Minus className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted font-medium">Unchanged</span>
          </div>
          <div className="text-xl font-bold text-text-secondary">{breadth.unchanged.toLocaleString('en-IN')}</div>
          <div className="text-xs text-text-muted mt-0.5">{unchangedPct.toFixed(1)}%</div>
        </div>

        <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-danger" />
            <span className="text-xs text-danger font-medium">Declines</span>
          </div>
          <div className="text-xl font-bold text-danger">{breadth.declines.toLocaleString('en-IN')}</div>
          <div className="text-xs text-danger/60 mt-0.5">{declinePct.toFixed(1)}%</div>
        </div>
      </div>

      {/* A/D Ratio and volume */}
      <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
        <span>A/D Ratio: <span className={breadth.advanceDeclineRatio >= 1 ? 'text-success font-medium' : 'text-danger font-medium'}>{breadth.advanceDeclineRatio.toFixed(2)}</span></span>
        <span>Volume: <span className="text-text-secondary">{formatLargeNumber(breadth.totalVolume)}</span></span>
        <span>Turnover: <span className="text-text-secondary">₹{formatLargeNumber(breadth.totalTurnover)}</span></span>
      </div>
    </div>
  )
}
