'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Plus, ToggleLeft, ToggleRight, ChevronRight, TrendingUp, Target, Activity } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { useTradeStore } from '@/store/tradeStore'
import { Strategy } from '@/types/trade'
import { cn, formatPercent } from '@/lib/utils'
import { STRATEGIES } from '@/lib/constants'

const defaultStrategies: Strategy[] = STRATEGIES.map((s, i) => ({
  id: s.id,
  name: s.label,
  description: s.description,
  type: 'TREND' as const,
  isActive: i < 2,
  params: {},
  performance: {
    totalReturn: (Math.random() - 0.3) * 80,
    winRate: 40 + Math.random() * 35,
    sharpeRatio: 0.5 + Math.random() * 2,
    maxDrawdown: -(5 + Math.random() * 20),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}))

export default function StrategiesPage() {
  const { strategies, setStrategies, toggleStrategy } = useTradeStore()
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)

  // Initialize with defaults if empty
  const displayStrategies = strategies.length > 0 ? strategies : defaultStrategies

  if (strategies.length === 0) {
    setStrategies(defaultStrategies)
  }

  return (
    <AppLayout title="Strategies">
      <div className="p-4 h-[calc(100vh-3.5rem)] flex gap-4">
        {/* Strategy list */}
        <div className="w-80 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              My Strategies
            </h2>
            <button className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>

          <div className="space-y-2">
            {displayStrategies.map((strategy) => (
              <motion.div
                key={strategy.id}
                whileHover={{ x: 2 }}
                onClick={() => setSelectedStrategy(strategy)}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all duration-150',
                  selectedStrategy?.id === strategy.id
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-surface hover:border-border-light'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-text-primary">{strategy.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleStrategy(strategy.id)
                      }}
                      className="text-text-muted hover:text-primary transition-colors"
                    >
                      {strategy.isActive
                        ? <ToggleRight className="w-5 h-5 text-success" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
                <p className="text-xs text-text-muted mb-3 line-clamp-2">{strategy.description}</p>

                {strategy.performance && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center bg-surface2 rounded-lg p-2">
                      <div className={cn(
                        'text-sm font-bold font-mono',
                        strategy.performance.totalReturn >= 0 ? 'text-success' : 'text-danger'
                      )}>
                        {formatPercent(strategy.performance.totalReturn)}
                      </div>
                      <div className="text-xs text-text-muted">Return</div>
                    </div>
                    <div className="text-center bg-surface2 rounded-lg p-2">
                      <div className="text-sm font-bold font-mono text-text-primary">
                        {strategy.performance.winRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-text-muted">Win Rate</div>
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    strategy.isActive
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-surface3 text-text-muted border border-border'
                  )}>
                    {strategy.isActive ? '● Active' : '○ Inactive'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Strategy details */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedStrategy ? (
              <motion.div
                key={selectedStrategy.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">{selectedStrategy.name}</h2>
                    <p className="text-sm text-text-secondary mt-1">{selectedStrategy.description}</p>
                  </div>
                  <button
                    onClick={() => toggleStrategy(selectedStrategy.id)}
                    className={cn(
                      'px-4 py-2 rounded-lg font-semibold text-sm transition-colors',
                      selectedStrategy.isActive
                        ? 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20'
                        : 'bg-success/10 text-success border border-success/30 hover:bg-success/20'
                    )}
                  >
                    {selectedStrategy.isActive ? 'Disable' : 'Enable'} Strategy
                  </button>
                </div>

                {/* Performance metrics */}
                {selectedStrategy.performance && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Return', value: formatPercent(selectedStrategy.performance.totalReturn), icon: TrendingUp, isPositive: selectedStrategy.performance.totalReturn >= 0 },
                      { label: 'Win Rate', value: `${selectedStrategy.performance.winRate.toFixed(1)}%`, icon: Target, isPositive: selectedStrategy.performance.winRate >= 50 },
                      { label: 'Sharpe Ratio', value: selectedStrategy.performance.sharpeRatio.toFixed(2), icon: Activity, isPositive: selectedStrategy.performance.sharpeRatio >= 1 },
                      { label: 'Max Drawdown', value: formatPercent(selectedStrategy.performance.maxDrawdown), icon: TrendingUp, isPositive: false },
                    ].map((metric) => {
                      const Icon = metric.icon
                      return (
                        <div key={metric.label} className="stat-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-text-muted uppercase tracking-wide">{metric.label}</span>
                            <Icon className={cn('w-4 h-4', metric.isPositive ? 'text-success' : 'text-danger')} />
                          </div>
                          <div className={cn(
                            'text-xl font-bold font-mono',
                            metric.isPositive ? 'text-success' : 'text-danger'
                          )}>
                            {metric.value}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Strategy Parameters (placeholder) */}
                <div className="bg-surface border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-4">Strategy Parameters</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedStrategy.id === 'EMA_CROSSOVER' && (
                      <>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Fast EMA Period</label>
                          <input type="number" defaultValue={9} className="trading-input" />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Slow EMA Period</label>
                          <input type="number" defaultValue={21} className="trading-input" />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Stop Loss %</label>
                          <input type="number" defaultValue={1.5} step="0.1" className="trading-input" />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Target %</label>
                          <input type="number" defaultValue={3} step="0.1" className="trading-input" />
                        </div>
                      </>
                    )}
                    {selectedStrategy.id !== 'EMA_CROSSOVER' && (
                      <div className="col-span-2 text-sm text-text-muted text-center py-4">
                        Select a strategy to configure parameters
                      </div>
                    )}
                  </div>
                  <button className="mt-4 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg transition-colors">
                    Save Parameters
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-64 text-text-muted"
              >
                <Cpu className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">Select a strategy to view details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  )
}
