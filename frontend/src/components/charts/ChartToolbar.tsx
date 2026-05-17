'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, ChevronDown, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Timeframe, IndicatorConfig } from '@/types/market'
import { INDICATOR_LIST, TIMEFRAMES } from '@/lib/constants'
import { useMarketStore } from '@/store/marketStore'

interface ChartToolbarProps {
  symbol: string
  timeframe: Timeframe
  onTimeframeChange: (tf: Timeframe) => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

const DISPLAY_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

export default function ChartToolbar({
  symbol,
  timeframe,
  onTimeframeChange,
  isFullscreen,
  onToggleFullscreen,
}: ChartToolbarProps) {
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false)
  const { indicators, addIndicator, removeIndicator, toggleIndicator } = useMarketStore()

  const handleIndicatorToggle = (indicatorId: string) => {
    const existing = indicators.find((i) => i.type === indicatorId)
    if (existing) {
      toggleIndicator(indicatorId)
    } else {
      const indConfig = INDICATOR_LIST.find((i) => i.id === indicatorId)
      if (indConfig) {
        addIndicator({
          type: indicatorId as IndicatorConfig['type'],
          enabled: true,
          params: indConfig.defaultParams,
        })
      }
    }
  }

  const activeIndicators = indicators.filter((i) => i.enabled)

  const groupedIndicators = INDICATOR_LIST.reduce(
    (acc, ind) => {
      if (!acc[ind.category]) acc[ind.category] = []
      acc[ind.category].push(ind)
      return acc
    },
    {} as Record<string, typeof INDICATOR_LIST>
  )

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border flex-wrap">
      {/* Symbol */}
      <div className="flex items-center gap-2 pr-3 border-r border-border">
        <span className="text-sm font-bold text-text-primary">{symbol}</span>
        <span className="text-xs text-text-muted">NSE</span>
      </div>

      {/* Timeframes */}
      <div className="flex items-center gap-0.5">
        {DISPLAY_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf as Timeframe)}
            className={cn(
              'px-2.5 py-1 text-xs rounded font-medium transition-all duration-150',
              timeframe === tf
                ? 'bg-primary text-white shadow-glow-primary'
                : 'text-text-muted hover:text-text-primary hover:bg-surface2'
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* Indicators dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition-colors',
            showIndicatorMenu
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface2 border border-transparent'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Indicators
          {activeIndicators.length > 0 && (
            <span className="bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {activeIndicators.length}
            </span>
          )}
          <ChevronDown className="w-3 h-3" />
        </button>

        <AnimatePresence>
          {showIndicatorMenu && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute left-0 top-full mt-1 w-72 bg-surface2 border border-border rounded-xl shadow-card z-50 overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold text-text-primary">Add Indicator</span>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {Object.entries(groupedIndicators).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wide">
                      {category}
                    </div>
                    {items.map((item) => {
                      const isActive = indicators.find((i) => i.type === item.id)?.enabled
                      const isAdded = !!indicators.find((i) => i.type === item.id)
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleIndicatorToggle(item.id)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface3 transition-colors"
                        >
                          <span className="text-sm text-text-secondary">{item.label}</span>
                          <div
                            className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                              isActive
                                ? 'bg-primary border-primary'
                                : isAdded
                                ? 'bg-surface border-border'
                                : 'border-border'
                            )}
                          >
                            {isActive && (
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M10 3L5 8 2 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              {activeIndicators.length > 0 && (
                <div className="px-3 py-2 border-t border-border">
                  <button
                    onClick={() => activeIndicators.forEach((i) => removeIndicator(i.type))}
                    className="text-xs text-danger hover:text-danger/80 transition-colors"
                  >
                    Clear all indicators
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active indicator pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {activeIndicators.map((ind) => (
          <div key={ind.type} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-xs text-primary">
            {ind.type}
            <button
              onClick={() => removeIndicator(ind.type)}
              className="text-primary/60 hover:text-danger transition-colors ml-0.5"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Fullscreen toggle */}
      {onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface2 rounded transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}
