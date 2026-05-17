'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import TradingChart from '@/components/charts/TradingChart'
import ChartToolbar from '@/components/charts/ChartToolbar'
import IndicatorSettings from '@/components/charts/IndicatorSettings'
import AIAssistant from '@/components/ai/AIAssistant'
import { useMarketStore } from '@/store/marketStore'
import { useCandles } from '@/hooks/useMarketData'
import { Timeframe } from '@/types/market'
import { cn } from '@/lib/utils'
import { Bot, Settings2, ChevronRight } from 'lucide-react'

type RightPanel = 'indicators' | 'ai' | null

export default function ChartsPage() {
  const { selectedSymbol, selectedTimeframe, setSelectedTimeframe, indicators } = useMarketStore()
  const [rightPanel, setRightPanel] = useState<RightPanel>('ai')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { data: candles = [], isLoading } = useCandles(selectedSymbol, selectedTimeframe)

  const handleTimeframeChange = (tf: Timeframe) => {
    setSelectedTimeframe(tf)
  }

  const toggleRightPanel = (panel: RightPanel) => {
    setRightPanel((prev) => (prev === panel ? null : panel))
  }

  return (
    <AppLayout title="Charts">
      <div className={cn(
        'flex flex-col h-[calc(100vh-3.5rem)]',
        isFullscreen && 'fixed inset-0 z-50 bg-background'
      )}>
        {/* Chart Toolbar */}
        <ChartToolbar
          symbol={selectedSymbol}
          timeframe={selectedTimeframe}
          onTimeframeChange={handleTimeframeChange}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />

        {/* Main chart area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chart */}
          <div className="flex-1 min-w-0 p-2">
            {isLoading ? (
              <div className="w-full h-full bg-surface rounded-lg flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-text-muted text-sm">Loading chart for {selectedSymbol}...</p>
                </div>
              </div>
            ) : (
              <TradingChart
                symbol={selectedSymbol}
                timeframe={selectedTimeframe}
                data={candles}
                indicators={indicators}
                height={rightPanel ? 500 : 580}
                showVolume={true}
              />
            )}
          </div>

          {/* Right panel toggle buttons */}
          <div className="flex flex-col border-l border-border bg-surface">
            <button
              onClick={() => toggleRightPanel('ai')}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-4 border-b border-border transition-colors',
                rightPanel === 'ai' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface2'
              )}
              title="AI Assistant"
            >
              <Bot className="w-4 h-4" />
              <span className="text-xs writing-vertical">AI</span>
            </button>
            <button
              onClick={() => toggleRightPanel('indicators')}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-4 border-b border-border transition-colors',
                rightPanel === 'indicators' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface2'
              )}
              title="Indicator Settings"
            >
              <Settings2 className="w-4 h-4" />
              <span className="text-xs">IND</span>
            </button>
            {rightPanel && (
              <button
                onClick={() => setRightPanel(null)}
                className="flex items-center justify-center px-3 py-2 text-text-muted hover:text-text-primary"
                title="Close panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right Panel Content */}
          {rightPanel && (
            <div className="w-80 border-l border-border bg-surface flex flex-col overflow-hidden">
              {rightPanel === 'ai' && <AIAssistant />}
              {rightPanel === 'indicators' && (
                <div className="overflow-y-auto">
                  <div className="px-4 py-3 border-b border-border">
                    <span className="text-sm font-semibold text-text-primary">Indicators</span>
                  </div>
                  <IndicatorSettings />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
