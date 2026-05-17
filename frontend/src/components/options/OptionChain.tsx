'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn, formatNumber, formatLargeNumber } from '@/lib/utils'

interface OptionData {
  oi: number
  oiChange: number
  iv: number
  ltp: number
  change: number
  volume: number
  delta?: number
}

interface OptionChainRow {
  strikePrice: number
  ce: OptionData | null
  pe: OptionData | null
  isATM: boolean
}

interface OptionChainProps {
  symbol: string
  expiry: string
  underlyingValue: number
  maxPain: number
  pcr: number
  rows: OptionChainRow[]
  onStrikeSelect?: (strike: number, optionType: 'CE' | 'PE') => void
}

function generateMockOptionChain(symbol: string, spot: number): OptionChainRow[] {
  const atm = Math.round(spot / 50) * 50
  const strikes: number[] = []
  for (let i = -10; i <= 10; i++) {
    strikes.push(atm + i * 50)
  }
  return strikes.map((strike) => {
    const diff = spot - strike
    const isATM = Math.abs(diff) < 25
    const moneyness = Math.abs(diff) / spot
    const iv = 12 + moneyness * 50 + Math.random() * 3

    const ceITM = diff > 0
    const ceOI = ceITM ? Math.floor(Math.random() * 5000000 + 2000000) : Math.floor(Math.random() * 2000000 + 500000)
    const peOI = !ceITM ? Math.floor(Math.random() * 5000000 + 2000000) : Math.floor(Math.random() * 2000000 + 500000)

    const intrinsicCE = Math.max(0, spot - strike)
    const intrinsicPE = Math.max(0, strike - spot)
    const timeValue = Math.max(0.05, Math.exp(-moneyness * 5) * 50 * (iv / 100))

    return {
      strikePrice: strike,
      isATM,
      ce: {
        oi: ceOI,
        oiChange: Math.floor((Math.random() - 0.4) * ceOI * 0.15),
        iv: parseFloat((iv + (ceITM ? -2 : 2)).toFixed(2)),
        ltp: parseFloat((intrinsicCE + timeValue).toFixed(2)),
        change: parseFloat((Math.random() - 0.4) * 20).toFixed(2) as unknown as number,
        volume: Math.floor(Math.random() * 100000 + 10000),
        delta: parseFloat((0.5 + (diff / (spot * 0.1)) * 0.3).toFixed(2)),
      },
      pe: {
        oi: peOI,
        oiChange: Math.floor((Math.random() - 0.4) * peOI * 0.15),
        iv: parseFloat((iv + (!ceITM ? -2 : 2)).toFixed(2)),
        ltp: parseFloat((intrinsicPE + timeValue).toFixed(2)),
        change: parseFloat((Math.random() - 0.4) * 20).toFixed(2) as unknown as number,
        volume: Math.floor(Math.random() * 100000 + 10000),
        delta: parseFloat((-0.5 - (diff / (spot * 0.1)) * 0.3).toFixed(2)),
      },
    }
  })
}

function OIBar({ value, maxOI }: { value: number; maxOI: number }) {
  const pct = maxOI > 0 ? (value / maxOI) * 100 : 0
  return (
    <div className="w-full h-1 bg-surface3 rounded-full overflow-hidden mt-0.5">
      <div
        className="h-full bg-primary/50 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function OptionChain({
  symbol,
  expiry,
  underlyingValue,
  maxPain,
  pcr,
  rows: propRows,
  onStrikeSelect,
}: Partial<OptionChainProps> & { symbol: string; underlyingValue?: number }) {
  const [selectedStrike, setSelectedStrike] = useState<{ strike: number; type: 'CE' | 'PE' } | null>(null)
  const spot = underlyingValue || 22500

  const rows = useMemo(() => propRows || generateMockOptionChain(symbol, spot), [propRows, symbol, spot])

  const maxOI = useMemo(() => {
    let max = 0
    rows.forEach((row) => {
      if (row.ce) max = Math.max(max, row.ce.oi)
      if (row.pe) max = Math.max(max, row.pe.oi)
    })
    return max
  }, [rows])

  const mockMaxPain = maxPain || (Math.round(spot / 50) * 50 - 50)
  const mockPcr = pcr || 1.18

  const handleStrikeClick = (strike: number, type: 'CE' | 'PE') => {
    setSelectedStrike({ strike, type })
    onStrikeSelect?.(strike, type)
  }

  return (
    <div className="h-full flex flex-col bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-text-primary">{symbol} Option Chain</span>
          <span className="badge-primary">{expiry || 'Current Expiry'}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-text-muted">Spot: </span>
            <span className="font-mono font-bold text-text-primary">{formatNumber(spot)}</span>
          </div>
          <div>
            <span className="text-text-muted">Max Pain: </span>
            <span className="font-mono font-bold text-warning">{formatNumber(mockMaxPain)}</span>
          </div>
          <div>
            <span className="text-text-muted">PCR: </span>
            <span className={cn('font-mono font-bold', mockPcr > 1 ? 'text-success' : 'text-danger')}>
              {mockPcr.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface border-b border-border">
              {/* CE headers */}
              <th className="px-2 py-2 text-right text-text-muted font-medium w-16">OI</th>
              <th className="px-2 py-2 text-right text-text-muted font-medium w-16">ChgOI</th>
              <th className="px-2 py-2 text-right text-text-muted font-medium w-12">IV</th>
              <th className="px-2 py-2 text-right text-success font-semibold w-16">CE LTP</th>
              <th className="px-2 py-2 text-right text-success font-semibold w-16">Chg</th>
              {/* Strike */}
              <th className="px-3 py-2 text-center text-warning font-bold w-24 bg-surface2 border-x border-border">Strike</th>
              {/* PE headers */}
              <th className="px-2 py-2 text-left text-danger font-semibold w-16">PE LTP</th>
              <th className="px-2 py-2 text-left text-danger font-semibold w-16">Chg</th>
              <th className="px-2 py-2 text-left text-text-muted font-medium w-12">IV</th>
              <th className="px-2 py-2 text-left text-text-muted font-medium w-16">ChgOI</th>
              <th className="px-2 py-2 text-left text-text-muted font-medium w-16">OI</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isITM_CE = spot > row.strikePrice
              const isITM_PE = spot < row.strikePrice
              const isCESelected = selectedStrike?.strike === row.strikePrice && selectedStrike.type === 'CE'
              const isPESelected = selectedStrike?.strike === row.strikePrice && selectedStrike.type === 'PE'

              return (
                <motion.tr
                  key={row.strikePrice}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    row.isATM && 'bg-warning/5'
                  )}
                >
                  {/* CE Side */}
                  {row.ce ? (
                    <>
                      <td className={cn(
                        'px-2 py-1.5 text-right',
                        isITM_CE ? 'bg-success/5' : 'bg-transparent'
                      )}>
                        <div className="font-mono">{formatLargeNumber(row.ce.oi)}</div>
                        <OIBar value={row.ce.oi} maxOI={maxOI} />
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', isITM_CE ? 'bg-success/5' : '')}>
                        <span className={cn('font-mono text-xs', row.ce.oiChange >= 0 ? 'text-success' : 'text-danger')}>
                          {row.ce.oiChange >= 0 ? '+' : ''}{formatLargeNumber(row.ce.oiChange)}
                        </span>
                      </td>
                      <td className={cn('px-2 py-1.5 text-right text-text-muted font-mono', isITM_CE ? 'bg-success/5' : '')}>
                        {row.ce.iv}%
                      </td>
                      <td
                        onClick={() => handleStrikeClick(row.strikePrice, 'CE')}
                        className={cn(
                          'px-2 py-1.5 text-right font-mono font-semibold cursor-pointer transition-colors',
                          isITM_CE ? 'bg-success/5' : '',
                          isCESelected ? 'bg-success/20 text-success' : 'text-text-primary hover:bg-success/10'
                        )}
                      >
                        {formatNumber(row.ce.ltp)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', isITM_CE ? 'bg-success/5' : '')}>
                        <span className={cn('font-mono text-xs', row.ce.change >= 0 ? 'text-success' : 'text-danger')}>
                          {row.ce.change >= 0 ? '+' : ''}{formatNumber(row.ce.change)}
                        </span>
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} />
                  )}

                  {/* Strike Price */}
                  <td className={cn(
                    'px-3 py-2 text-center font-bold border-x border-border',
                    row.isATM
                      ? 'bg-warning/10 text-warning'
                      : 'bg-surface2 text-text-primary'
                  )}>
                    {row.strikePrice.toLocaleString('en-IN')}
                    {row.isATM && <div className="text-xs font-normal text-warning/70">ATM</div>}
                    {row.strikePrice === mockMaxPain && <div className="text-xs font-normal text-primary/70">MaxPain</div>}
                  </td>

                  {/* PE Side */}
                  {row.pe ? (
                    <>
                      <td
                        onClick={() => handleStrikeClick(row.strikePrice, 'PE')}
                        className={cn(
                          'px-2 py-1.5 text-left font-mono font-semibold cursor-pointer transition-colors',
                          isITM_PE ? 'bg-danger/5' : '',
                          isPESelected ? 'bg-danger/20 text-danger' : 'text-text-primary hover:bg-danger/10'
                        )}
                      >
                        {formatNumber(row.pe.ltp)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-left', isITM_PE ? 'bg-danger/5' : '')}>
                        <span className={cn('font-mono text-xs', row.pe.change >= 0 ? 'text-success' : 'text-danger')}>
                          {row.pe.change >= 0 ? '+' : ''}{formatNumber(row.pe.change)}
                        </span>
                      </td>
                      <td className={cn('px-2 py-1.5 text-left text-text-muted font-mono', isITM_PE ? 'bg-danger/5' : '')}>
                        {row.pe.iv}%
                      </td>
                      <td className={cn('px-2 py-1.5 text-left', isITM_PE ? 'bg-danger/5' : '')}>
                        <span className={cn('font-mono text-xs', row.pe.oiChange >= 0 ? 'text-success' : 'text-danger')}>
                          {row.pe.oiChange >= 0 ? '+' : ''}{formatLargeNumber(row.pe.oiChange)}
                        </span>
                      </td>
                      <td className={cn('px-2 py-1.5 text-left', isITM_PE ? 'bg-danger/5' : '')}>
                        <div className="font-mono">{formatLargeNumber(row.pe.oi)}</div>
                        <OIBar value={row.pe.oi} maxOI={maxOI} />
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} />
                  )}
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
