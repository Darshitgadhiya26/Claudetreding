'use client'

import { motion } from 'framer-motion'
import { cn, formatNumber } from '@/lib/utils'

interface GreeksPanelProps {
  symbol?: string
  strikePrice?: number
  optionType?: 'CE' | 'PE'
  expiry?: string
  ltp?: number
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
  rho?: number
  iv?: number
}

interface GreekItemProps {
  label: string
  value: number
  description: string
  color: string
  format?: 'decimal' | 'percent' | 'currency'
}

function GreekItem({ label, value, description, color, format = 'decimal' }: GreekItemProps) {
  const formattedValue = format === 'percent'
    ? `${value.toFixed(2)}%`
    : format === 'currency'
    ? `₹${value.toFixed(2)}`
    : value.toFixed(4)

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-surface2 border border-border rounded-lg p-3"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className={cn('text-lg font-bold', color)}>{label}</span>
          <div className="text-xs text-text-muted mt-0.5">{description}</div>
        </div>
        <span className={cn('text-base font-mono font-bold', color)}>{formattedValue}</span>
      </div>
      <div className="w-full h-1 bg-surface3 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.abs(value) * 100, 100)}%` }}
          className={cn('h-full rounded-full', color.replace('text-', 'bg-').replace('/70', ''))}
          style={{ opacity: 0.6 }}
        />
      </div>
    </motion.div>
  )
}

export default function GreeksPanel({
  symbol = 'NIFTY',
  strikePrice = 22500,
  optionType = 'CE',
  expiry = '27 Jun 2024',
  ltp = 125.50,
  delta = 0.4823,
  gamma = 0.0023,
  theta = -15.34,
  vega = 48.92,
  rho = 5.23,
  iv = 13.45,
}: GreeksPanelProps) {
  const isCall = optionType === 'CE'

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text-primary">{symbol}</span>
            <span className="text-sm text-text-secondary">{strikePrice}</span>
            <span className={cn(
              'badge-primary text-xs',
              isCall ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'
            )}>
              {optionType}
            </span>
          </div>
          <div className="text-xs text-text-muted mt-0.5">{expiry}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-text-primary">₹{formatNumber(ltp)}</div>
          <div className="text-xs text-text-muted">LTP</div>
        </div>
      </div>

      {/* IV prominently displayed */}
      <div className={cn(
        'rounded-lg p-3 mb-4 text-center border',
        isCall ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'
      )}>
        <div className="text-xs text-text-muted mb-1">Implied Volatility</div>
        <div className={cn(
          'text-2xl font-bold font-mono',
          isCall ? 'text-success' : 'text-danger'
        )}>
          {iv}%
        </div>
      </div>

      {/* Greeks grid */}
      <div className="grid grid-cols-2 gap-2">
        <GreekItem
          label="Δ Delta"
          value={delta}
          description="Price sensitivity"
          color={isCall ? 'text-success/90' : 'text-danger/90'}
        />
        <GreekItem
          label="Γ Gamma"
          value={gamma}
          description="Delta rate of change"
          color="text-primary/90"
        />
        <GreekItem
          label="Θ Theta"
          value={theta}
          description="Time decay / day"
          color="text-warning/90"
          format="currency"
        />
        <GreekItem
          label="V Vega"
          value={vega}
          description="IV sensitivity"
          color="text-text-secondary"
          format="currency"
        />
      </div>

      {/* Rho */}
      <div className="mt-2">
        <GreekItem
          label="ρ Rho"
          value={rho}
          description="Interest rate sensitivity"
          color="text-muted-foreground/70"
          format="currency"
        />
      </div>

      {/* Quick interpretation */}
      <div className="mt-4 p-3 bg-surface2 rounded-lg border border-border">
        <div className="text-xs font-medium text-text-secondary mb-2">Quick Interpretation</div>
        <div className="space-y-1.5 text-xs text-text-muted">
          <p>• If {symbol} moves ₹1, this option moves ~₹{Math.abs(delta).toFixed(2)}</p>
          <p>• Losing ~₹{Math.abs(theta).toFixed(2)} per day due to time decay</p>
          <p>• 1% change in IV = {vega > 0 ? '+' : ''}₹{Math.abs(vega * 0.01).toFixed(2)} change</p>
        </div>
      </div>
    </div>
  )
}
