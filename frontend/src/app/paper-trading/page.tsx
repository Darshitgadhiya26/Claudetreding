'use client'

import AppLayout from '@/components/layout/AppLayout'
import OrderPanel from '@/components/trading/OrderPanel'
import PositionsTable from '@/components/trading/PositionsTable'
import { useTradeStore } from '@/store/tradeStore'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import { BookOpen, Wallet, TrendingUp, Activity, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PaperTradingPage() {
  const { paperBalance, paperPositions, paperTrades, setPaperBalance, getPaperPnl } = useTradeStore()
  const paperPnl = getPaperPnl()
  const initialBalance = 1000000

  const handleReset = () => {
    if (confirm('Reset paper trading account? This will close all positions and reset balance to ₹10 Lakhs.')) {
      setPaperBalance(initialBalance)
      toast.success('Paper trading account reset!')
    }
  }

  const totalTrades = paperTrades.length
  const winTrades = paperTrades.filter((t) => t.pnl > 0).length
  const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0
  const totalPnL = paperTrades.reduce((acc, t) => acc + t.pnl, 0)

  return (
    <AppLayout title="Paper Trading">
      <div className="p-4 space-y-4">
        {/* Account Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-warning" />
              <span className="text-xs text-text-muted uppercase tracking-wide">Available Balance</span>
            </div>
            <div className="text-xl font-bold font-mono text-warning">
              {formatCurrency(paperBalance, true)}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {formatPercent((paperBalance / initialBalance - 1) * 100)} of initial
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={cn('w-4 h-4', paperPnl >= 0 ? 'text-success' : 'text-danger')} />
              <span className="text-xs text-text-muted uppercase tracking-wide">Open P&L</span>
            </div>
            <div className={cn('text-xl font-bold font-mono', paperPnl >= 0 ? 'text-success' : 'text-danger')}>
              {paperPnl >= 0 ? '+' : ''}{formatCurrency(paperPnl)}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {paperPositions.length} open positions
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-xs text-text-muted uppercase tracking-wide">Total P&L</span>
            </div>
            <div className={cn('text-xl font-bold font-mono', totalPnL >= 0 ? 'text-success' : 'text-danger')}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </div>
            <div className="text-xs text-text-muted mt-1">{totalTrades} completed trades</div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-text-secondary" />
              <span className="text-xs text-text-muted uppercase tracking-wide">Win Rate</span>
            </div>
            <div className={cn('text-xl font-bold font-mono', winRate >= 50 ? 'text-success' : 'text-danger')}>
              {totalTrades > 0 ? winRate.toFixed(1) : '--'}%
            </div>
            <div className="text-xs text-text-muted mt-1">{winTrades}W / {totalTrades - winTrades}L</div>
          </div>
        </div>

        {/* Main trading area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Order panel */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary">Place Order</h2>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-danger transition-colors"
                title="Reset paper account"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Account
              </button>
            </div>
            <OrderPanel />
          </div>

          {/* Positions */}
          <div className="lg:col-span-9">
            <PositionsTable isPaperMode={true} />

            {/* Trade History */}
            {paperTrades.length > 0 && (
              <div className="mt-4 bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-text-primary">Trade History</span>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="trading-table">
                    <thead>
                      <tr>
                        <th className="text-left">Symbol</th>
                        <th className="text-left">Type</th>
                        <th>Qty</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>P&L</th>
                        <th>P&L%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paperTrades.slice(0, 20).map((trade) => (
                        <tr key={trade.id}>
                          <td className="text-left font-medium">{trade.symbol}</td>
                          <td className="text-left">
                            <span className={cn(
                              'badge-primary text-xs',
                              trade.transactionType === 'BUY'
                                ? 'bg-success/10 text-success border-success/30'
                                : 'bg-danger/10 text-danger border-danger/30'
                            )}>
                              {trade.transactionType}
                            </span>
                          </td>
                          <td className="font-mono">{trade.quantity}</td>
                          <td className="font-mono">{trade.entryPrice.toFixed(2)}</td>
                          <td className="font-mono">{trade.exitPrice.toFixed(2)}</td>
                          <td className={cn('font-mono font-semibold', trade.pnl >= 0 ? 'text-success' : 'text-danger')}>
                            {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                          </td>
                          <td className={cn('font-mono text-xs', trade.pnlPercent >= 0 ? 'text-success' : 'text-danger')}>
                            {formatPercent(trade.pnlPercent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
