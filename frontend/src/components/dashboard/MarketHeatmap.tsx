'use client'

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

const sectorData = [
  { name: 'Banking', size: 28, change: 0.56, color: '' },
  { name: 'IT', size: 22, change: 1.23, color: '' },
  { name: 'Auto', size: 10, change: -0.78, color: '' },
  { name: 'Pharma', size: 8, change: 0.34, color: '' },
  { name: 'Energy', size: 12, change: -1.12, color: '' },
  { name: 'FMCG', size: 7, change: 0.89, color: '' },
  { name: 'Metals', size: 5, change: -0.45, color: '' },
  { name: 'Realty', size: 4, change: 2.34, color: '' },
  { name: 'Media', size: 2, change: -0.23, color: '' },
  { name: 'Infra', size: 3, change: 0.67, color: '' },
]

interface CustomContentProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  value?: number
  change?: number
}

function CustomContent({ x = 0, y = 0, width = 0, height = 0, name = '', change = 0 }: CustomContentProps) {
  if (width < 20 || height < 20) return null

  const isPositive = change >= 0
  const intensity = Math.min(Math.abs(change) / 3, 1)
  const bgColor = isPositive
    ? `rgba(34, 197, 94, ${0.1 + intensity * 0.4})`
    : `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`
  const textColor = isPositive ? '#22c55e' : '#ef4444'
  const borderColor = isPositive ? '#22c55e40' : '#ef444440'

  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        style={{ fill: bgColor, stroke: borderColor, strokeWidth: 1, rx: 4 }}
      />
      {width > 40 && height > 30 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (height > 50 ? 8 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fill: '#e2e8f0', fontSize: Math.min(width / 8, 12), fontWeight: 600, fontFamily: 'Inter' }}
          >
            {name}
          </text>
          {height > 45 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fill: textColor, fontSize: Math.min(width / 10, 11), fontFamily: 'JetBrains Mono' }}
            >
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </text>
          )}
        </>
      )}
    </g>
  )
}

export default function MarketHeatmap() {
  const data = useMemo(() => sectorData.map((s) => ({ ...s, value: s.size })), [])

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-text-primary">Sector Heatmap</span>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-success/50" />
            <span>Gainers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-danger/50" />
            <span>Losers</span>
          </div>
        </div>
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="value"
            aspectRatio={4 / 3}
            content={<CustomContent />}
          >
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null
                const item = payload[0].payload
                return (
                  <div className="bg-surface2 border border-border rounded-lg px-3 py-2 text-xs shadow-card">
                    <div className="font-semibold text-text-primary">{item.name}</div>
                    <div className={cn(
                      'mt-1 font-medium',
                      item.change >= 0 ? 'text-success' : 'text-danger'
                    )}>
                      {item.change >= 0 ? '+' : ''}{item.change}%
                    </div>
                  </div>
                )
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
