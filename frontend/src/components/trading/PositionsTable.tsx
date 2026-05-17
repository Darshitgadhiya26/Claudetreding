'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { cn, formatNumber, formatPercent, formatCurrency } from '@/lib/utils'
import { useTradeStore } from '@/store/tradeStore'
import { useMarketStore } from '@/store/marketStore'
import { Position } from '@/types/trade'
import toast from 'react-hot-toast'

interface PositionsTableProps {
  isPaperMode?: boolean
}

export default function PositionsTable({ isPaperMode = true }: PositionsTableProps) {
  const { paperPositions, positions, closePaperPosition, setPaperBalance, paperBalance } = useTradeStore()
  const { quotes } = useMarketStore()
  const [closingId, setClosingId] = useState<string | null>(null)

  const displayPositions = isPaperMode ? paperPositions : positions

  // Calculate live PnL using market quotes
  const positionsWithLivePnl = displayPositions.map((pos) => {
    const quote = quotes[pos.symbol]
    const ltp = quote?.ltp || pos.avgPrice
    const pnl = pos.transactionType === 'BUY'
      ? (ltp - pos.avgPrice) * pos.quantity
      : (pos.avgPrice - ltp) * pos.quantity
    const pnlPercent = ((ltp - pos.avgPrice) / pos.avgPrice) * 100 * (pos.transactionType === 'BUY' ? 1 : -1)
    return { ...pos, ltp, pnl, pnlPercent }
  })

  const totalPnl = positionsWithLivePnl.reduce((acc, p) => acc + p.pnl, 0)

  const handleClosePosition = async (position: Position) => {
    setClosingId(position.id)
    try {
      const quote = quotes[position.symbol]
      const exitPrice = quote?.ltp || position.avgPrice
      const pnl = position.transactionType === 'BUY'
        ? (exitPrice - position.avgPrice) * position.quantity
        : (position.avgPrice - exitPrice) * position.quantity

      if (isPaperMode) {
        const exitValue = exitPrice * position.quantity
        setPaperBalance(paperBalance + (position.transactionType === 'BUY' ? exitValue : -exitValue) + pnl)
        closePaperPosition(position.id)
        toast.success(`Position closed. PnL: ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`)
      }
    } finally {
      setClosingId(null)
    }
  }

  if (!displayPositions.length) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-text-primary">
            {isPaperMode ? 'Paper' : ''} Positions
          </span>
          {isPaperMode && <span className="badge-warning">Paper Mode</span>}
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <AlertCircle className="w-8 h-8 mb-3 opacity-40" />
          <p className="text-sm">No open positions</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-text-primary">
            {isPaperMode ? 'Paper' : 'Live'} Positions ({displayPositions.length})
          </span>
          {isPaperMode && <span className="badge-warning text-xs">Paper Mode</span>}
        </div>
        <div className={cn(
          'text-sm font-mono font-bold',
          totalPnl >= 0 ? 'text-success' : 'text-danger'
        )}>
          {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="trading-table">
          <thead>
            <tr>
              <th className="text-left">Symbol</th>
              <th>Qty</th>
              <th>Avg Price</th>
              <th>LTP</th>
              <th>P&L</th>
              <th>P&L%</th>
              <th>SL</th>
              <th>Target</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {positionsWithLivePnl.map((position) => {
                const isPositive = position.pnl >= 0
                return (
                  <motion.tr
                    key={position.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <td className="text-left">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'badge-primary text-xs',
                          position.transactionType === 'BUY' ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'
                        )}>
                          {position.transactionType}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-primary">{position.symbol}</div>
                          <div className="text-xs text-text-muted">{position.productType}</div>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono">{position.quantity}</td>
                    <td className="font-mono">{formatNumber(position.avgPrice)}</td>
                    <td className="font-mono">
                      <div className="flex items-center justify-end gap-1">
                        {isPositive
                          ? <TrendingUp className="w-3 h-3 text-success" />
                          : <TrendingDown className="w-3 h-3 text-danger" />
                        }
                        {formatNumber(position.ltp)}
                      </div>
                    </td>
                    <td>
                      <span className={cn('font-mono font-semibold', isPositive ? 'text-success' : 'text-danger')}>
                        {isPositive ? '+' : ''}{formatNumber(position.pnl)}
                      </span>
                    </td>
                    <td>
                      <span className={cn('font-mono text-xs', isPositive ? 'text-success' : 'text-danger')}>
                        {formatPercent(position.pnlPercent)}
                      </span>
                    </td>
                    <td className="text-danger font-mono text-xs">
                      {position.stopLoss ? formatNumber(position.stopLoss) : '--'}
                    </td>
                    <td className="text-success font-mono text-xs">
                      {position.target ? formatNumber(position.target) : '--'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleClosePosition(position)}
                        disabled={closingId === position.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-danger hover:bg-danger/10 rounded transition-colors border border-danger/30 hover:border-danger/60"
                      >
                        {closingId === position.id ? (
                          <div className="w-3 h-3 border border-danger/30 border-t-danger rounded-full animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        Exit
                      </button>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}
