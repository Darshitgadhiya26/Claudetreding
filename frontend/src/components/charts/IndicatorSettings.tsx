'use client'

import { useState } from 'react'
import { Settings, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMarketStore } from '@/store/marketStore'

export default function IndicatorSettings() {
  const { indicators, updateIndicator, toggleIndicator, removeIndicator } = useMarketStore()
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null)

  if (!indicators.length) {
    return (
      <div className="p-4 text-center">
        <Settings className="w-8 h-8 text-text-muted mx-auto mb-2" />
        <p className="text-sm text-text-muted">No indicators added</p>
        <p className="text-xs text-text-muted mt-1">Use the toolbar to add indicators</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
        Active Indicators
      </h3>
      {indicators.map((indicator) => (
        <div
          key={indicator.type}
          className={cn(
            'border rounded-lg overflow-hidden transition-colors',
            indicator.enabled ? 'border-border' : 'border-border/50 opacity-60'
          )}
        >
          <div
            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface2/50"
            onClick={() => setExpandedIndicator(
              expandedIndicator === indicator.type ? null : indicator.type
            )}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleIndicator(indicator.type)
                }}
                className={cn(
                  'w-4 h-4 rounded-full border-2 transition-colors flex-shrink-0',
                  indicator.enabled
                    ? 'bg-primary border-primary'
                    : 'border-border bg-transparent'
                )}
              />
              <span className="text-sm font-medium text-text-primary">{indicator.type}</span>
              {indicator.params.period && (
                <span className="text-xs text-text-muted">({indicator.params.period})</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Settings className="w-3.5 h-3.5 text-text-muted" />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeIndicator(indicator.type)
                }}
                className="text-text-muted hover:text-danger transition-colors p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {expandedIndicator === indicator.type && Object.keys(indicator.params).length > 0 && (
            <div className="px-3 pb-3 border-t border-border bg-surface2/30">
              <div className="pt-2 space-y-2">
                {Object.entries(indicator.params).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <label className="text-xs text-text-secondary capitalize">{key}</label>
                    <input
                      type="number"
                      defaultValue={value as number}
                      onChange={(e) => {
                        updateIndicator(indicator.type, {
                          ...indicator.params,
                          [key]: parseFloat(e.target.value),
                        })
                      }}
                      className="w-20 px-2 py-1 bg-surface border border-border rounded text-xs text-text-primary text-right focus:outline-none focus:border-primary/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
