'use client'

import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts'
import { TrendingUp, TrendingDown, Target, Activity, BarChart3, Award } from 'lucide-react'
import { cn, formatCurrency, formatPercent, formatDate } from '@/lib/utils'
import { BacktestResult } from '@/types/trade'

interface BacktestResultsProps {
  result: BacktestResult
}

interface StatItemProps {
  label: string
  value: string
  subValue?: string
  isPositive?: boolean | null
  icon?: React.ReactNode
}

function StatItem({ label, value, subValue, isPositive, icon }: StatItemProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className={cn(
        'text-xl font-bold font-mono',
        isPositive === null ? 'text-text-primary' :
        isPositive ? 'text-success' : 'text-danger'
      )}>
        {value}
      </div>
      {subValue && <div className="text-xs text-text-muted mt-1">{subValue}</div>}
    </div>
  )
}

export default function BacktestResults({ result }: BacktestResultsProps) {
  const isProfit = result.totalReturn >= 0

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface2 border border-border rounded-lg px-3 py-2 text-xs shadow-card">
        <div className="text-text-muted mb-1">{label}</div>
        <div className={cn('font-mono font-bold', payload[0].value >= (result.initialCapital) ? 'text-success' : 'text-danger')}>
          {formatCurrency(payload[0].value)}
        </div>
        {payload[1] && (
          <div className="text-danger font-mono">DD: {payload[1].value.toFixed(2)}%</div>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Summary header */}
      <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-text-primary">{result.symbol}</span>
            <span className="badge-primary">{result.strategy}</span>
          </div>
          <div className="text-xs text-text-muted">
            {formatDate(result.startDate, 'dd MMM yyyy')} → {formatDate(result.endDate, 'dd MMM yyyy')}
          </div>
        </div>
        <div className="text-right">
          <div className={cn(
            'text-2xl font-bold font-mono',
            isProfit ? 'text-success' : 'text-danger'
          )}>
            {isProfit ? '+' : ''}{formatCurrency(result.totalReturn)}
          </div>
          <div className={cn(
            'text-sm font-medium',
            isProfit ? 'text-success' : 'text-danger'
          )}>
            {formatPercent(result.totalReturnPercent)} total return
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatItem
          label="Total Trades"
          value={result.totalTrades.toString()}
          subValue={`${result.winningTrades}W / ${result.losingTrades}L`}
          isPositive={null}
          icon={<Activity className="w-4 h-4 text-primary" />}
        />
        <StatItem
          label="Win Rate"
          value={formatPercent(result.winRate, false)}
          subValue="of all trades"
          isPositive={result.winRate >= 50}
          icon={<Target className="w-4 h-4 text-success" />}
        />
        <StatItem
          label="CAGR"
          value={formatPercent(result.cagr)}
          subValue="annualized"
          isPositive={result.cagr >= 0}
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
        />
        <StatItem
          label="Sharpe Ratio"
          value={result.sharpeRatio.toFixed(2)}
          subValue={result.sharpeRatio >= 1 ? 'Good' : 'Below average'}
          isPositive={result.sharpeRatio >= 1}
          icon={<BarChart3 className="w-4 h-4 text-warning" />}
        />
        <StatItem
          label="Max Drawdown"
          value={formatPercent(result.maxDrawdownPercent, false)}
          subValue={formatCurrency(result.maxDrawdown)}
          isPositive={false}
          icon={<TrendingDown className="w-4 h-4 text-danger" />}
        />
        <StatItem
          label="Profit Factor"
          value={result.profitFactor.toFixed(2)}
          subValue={result.profitFactor >= 1.5 ? 'Excellent' : 'Poor'}
          isPositive={result.profitFactor >= 1}
          icon={<Award className="w-4 h-4 text-success" />}
        />
      </div>

      {/* Equity Curve */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Equity Curve</h3>
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.equityCurve} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isProfit ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isProfit ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={result.initialCapital}
                stroke="#4a4a6a"
                strokeDasharray="4 4"
                label={{ value: 'Capital', fill: '#64748b', fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={isProfit ? '#22c55e' : '#ef4444'}
                strokeWidth={2}
                fill="url(#equityGradient)"
                dot={false}
                activeDot={{ r: 4, fill: isProfit ? '#22c55e' : '#ef4444' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Returns */}
      {result.monthlyReturns && result.monthlyReturns.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Monthly Returns</h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {result.monthlyReturns.map((mr) => (
              <div
                key={mr.month}
                className={cn(
                  'rounded-lg p-2 text-center border',
                  mr.return >= 0
                    ? 'bg-success/10 border-success/20'
                    : 'bg-danger/10 border-danger/20'
                )}
              >
                <div className="text-xs text-text-muted">{mr.month}</div>
                <div className={cn(
                  'text-sm font-mono font-bold mt-0.5',
                  mr.return >= 0 ? 'text-success' : 'text-danger'
                )}>
                  {formatPercent(mr.return)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Log */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Trade Log</h3>
          <span className="text-xs text-text-muted">{result.trades.length} trades</span>
        </div>
        <div className="overflow-x-auto max-h-80">
          <table className="trading-table">
            <thead>
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">Entry Date</th>
                <th className="text-left">Exit Date</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Qty</th>
                <th>P&L</th>
                <th>P&L%</th>
                <th className="text-left">Signal</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.map((trade) => {
                const isWin = trade.pnl >= 0
                return (
                  <tr key={trade.id}>
                    <td className="text-left text-text-muted">{trade.id}</td>
                    <td className="text-left text-xs">{formatDate(trade.entryDate, 'dd MMM yy HH:mm')}</td>
                    <td className="text-left text-xs">{formatDate(trade.exitDate, 'dd MMM yy HH:mm')}</td>
                    <td className="font-mono">{trade.entryPrice.toFixed(2)}</td>
                    <td className="font-mono">{trade.exitPrice.toFixed(2)}</td>
                    <td className="font-mono">{trade.quantity}</td>
                    <td className={cn('font-mono font-semibold', isWin ? 'text-success' : 'text-danger')}>
                      {isWin ? '+' : ''}{formatCurrency(trade.pnl)}
                    </td>
                    <td className={cn('font-mono text-xs', isWin ? 'text-success' : 'text-danger')}>
                      {formatPercent(trade.pnlPercent)}
                    </td>
                    <td className="text-left">
                      <span className={cn(
                        'badge-primary text-xs',
                        trade.signal?.includes('BUY') ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'
                      )}>
                        {trade.signal}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
