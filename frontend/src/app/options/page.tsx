'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import OptionChain from '@/components/options/OptionChain'
import GreeksPanel from '@/components/options/GreeksPanel'
import { Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const INDICES = [
  { symbol: 'NIFTY', displayName: 'NIFTY 50', spot: 22543.85 },
  { symbol: 'BANKNIFTY', displayName: 'BANK NIFTY', spot: 48234.60 },
  { symbol: 'FINNIFTY', displayName: 'FIN NIFTY', spot: 21456.30 },
  { symbol: 'MIDCAPNIFTY', displayName: 'MIDCAP NIFTY', spot: 10234.55 },
]

const EXPIRY_DATES = [
  '27 Jun 2024',
  '04 Jul 2024',
  '11 Jul 2024',
  '25 Jul 2024',
  '29 Aug 2024',
]

export default function OptionsPage() {
  const [selectedIndex, setSelectedIndex] = useState(INDICES[0])
  const [selectedExpiry, setSelectedExpiry] = useState(EXPIRY_DATES[0])
  const [selectedOption, setSelectedOption] = useState<{
    strike: number
    type: 'CE' | 'PE'
    ltp?: number
    iv?: number
    delta?: number
    gamma?: number
    theta?: number
    vega?: number
  } | null>(null)

  const handleStrikeSelect = (strike: number, type: 'CE' | 'PE') => {
    setSelectedOption({
      strike,
      type,
      ltp: 125.50 + Math.random() * 50,
      iv: 13 + Math.random() * 5,
      delta: type === 'CE' ? 0.45 + Math.random() * 0.1 : -(0.45 + Math.random() * 0.1),
      gamma: 0.002 + Math.random() * 0.001,
      theta: -(10 + Math.random() * 10),
      vega: 40 + Math.random() * 20,
    })
  }

  return (
    <AppLayout title="Options">
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Options Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-surface flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-text-primary">Option Chain</span>
          </div>

          {/* Index selector */}
          <div className="flex items-center gap-1">
            {INDICES.map((idx) => (
              <button
                key={idx.symbol}
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                  selectedIndex.symbol === idx.symbol
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface2'
                )}
              >
                {idx.symbol}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border" />

          {/* Expiry selector */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {EXPIRY_DATES.map((expiry) => (
              <button
                key={expiry}
                onClick={() => setSelectedExpiry(expiry)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap',
                  selectedExpiry === expiry
                    ? 'bg-surface2 text-text-primary border border-border-light'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {expiry}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs text-text-muted">
            <div>Spot: <span className="text-text-primary font-mono font-bold">{selectedIndex.spot.toLocaleString('en-IN')}</span></div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Option Chain */}
          <div className="flex-1 overflow-hidden p-3">
            <OptionChain
              symbol={selectedIndex.displayName}
              expiry={selectedExpiry}
              underlyingValue={selectedIndex.spot}
              onStrikeSelect={handleStrikeSelect}
            />
          </div>

          {/* Greeks Panel */}
          {selectedOption && (
            <div className="w-72 border-l border-border p-3 overflow-y-auto flex-shrink-0">
              <GreeksPanel
                symbol={selectedIndex.symbol}
                strikePrice={selectedOption.strike}
                optionType={selectedOption.type}
                expiry={selectedExpiry}
                ltp={selectedOption.ltp}
                iv={selectedOption.iv}
                delta={selectedOption.delta}
                gamma={selectedOption.gamma}
                theta={selectedOption.theta}
                vega={selectedOption.vega}
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
