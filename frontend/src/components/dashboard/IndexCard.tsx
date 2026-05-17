'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { MarketIndex } from '@/types/market'
import { useMarketStore } from '@/store/marketStore'

interface IndexCardProps {
  index: MarketIndex
}

export default function IndexCard({ index }: IndexCardProps) {
  const router = useRouter()
  const { setSelectedSymbol } = useMarketStore()
  const isPositive = index.change >= 0

  const sparklineData = index.sparkline?.map((v, i) => ({ i, v })) || []

  const handleClick = () => {
    setSelectedSymbol(index.symbol)
    router.push('/charts')
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, borderColor: isPositive ? '#22c55e40' : '#ef444440' }}
      onClick={handleClick}
      className={cn(
        'stat-card cursor-pointer transition-all duration-200 relative overflow-hidden group',
        isPositive ? 'hover:shadow-glow-success' : 'hover:shadow-glow-danger'
      )}
    >
      {/* Background glow */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          isPositive ? 'bg-success/3' : 'bg-danger/3'
        )}
      />

      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{index.name}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-text-primary font-mono">
              {formatNumber(index.ltp)}
            </span>
          </div>
        </div>
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold',
          isPositive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
        )}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {formatPercent(index.changePercent)}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className={cn(
            'text-sm font-medium',
            isPositive ? 'text-success' : 'text-danger'
          )}>
            {isPositive ? '+' : ''}{formatNumber(index.change)}
          </span>
          <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
            <span>H: {formatNumber(index.high)}</span>
            <span>L: {formatNumber(index.low)}</span>
          </div>
        </div>

        {/* Sparkline */}
        {sparklineData.length > 0 && (
          <div className="w-24 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={isPositive ? '#22c55e' : '#ef4444'}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  )
}
