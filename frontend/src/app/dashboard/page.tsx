'use client'

import AppLayout from '@/components/layout/AppLayout'
import MarketOverview from '@/components/dashboard/MarketOverview'
import Watchlist from '@/components/dashboard/Watchlist'
import TopGainersLosers from '@/components/dashboard/TopGainersLosers'
import MarketBreadth from '@/components/dashboard/MarketBreadth'
import MarketHeatmap from '@/components/dashboard/MarketHeatmap'
import { useTradeStore } from '@/store/tradeStore'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const { paperBalance, paperPositions, getPaperPnl } = useTradeStore()
  const paperPnl = getPaperPnl()

  return (
    <AppLayout title="Dashboard">
      <div className="p-4 space-y-4">
        {/* Market Indices */}
        <section>
          <MarketOverview />
        </section>

        {/* Paper Trading Summary Bar */}
        <div className="flex items-center gap-6 p-3 bg-surface border border-warning/20 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Paper Balance:</span>
            <span className="font-mono font-bold text-warning">{formatCurrency(paperBalance, true)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Open Positions:</span>
            <span className="font-mono font-bold text-text-primary">{paperPositions.length}</span>
          </div>
          {paperPositions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Day P&L:</span>
              <span className={cn(
                'font-mono font-bold',
                paperPnl >= 0 ? 'text-success' : 'text-danger'
              )}>
                {paperPnl >= 0 ? '+' : ''}{formatCurrency(paperPnl)}
              </span>
            </div>
          )}
          <div className="ml-auto">
            <span className="badge-warning">Paper Mode</span>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Watchlist */}
          <div className="lg:col-span-4 xl:col-span-3" style={{ height: '520px' }}>
            <Watchlist />
          </div>

          {/* Center: Market Breadth + Heatmap */}
          <div className="lg:col-span-4 xl:col-span-5 space-y-4">
            <MarketBreadth />
            <MarketHeatmap />
          </div>

          {/* Right: Top Gainers/Losers */}
          <div className="lg:col-span-4 xl:col-span-4" style={{ height: '520px' }}>
            <TopGainersLosers />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
