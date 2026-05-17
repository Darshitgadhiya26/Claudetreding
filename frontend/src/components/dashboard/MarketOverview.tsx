'use client'

import { useIndices } from '@/hooks/useMarketData'
import IndexCard from './IndexCard'
import { Loader2 } from 'lucide-react'

export default function MarketOverview() {
  const { data: indices, isLoading } = useIndices()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-4 bg-surface3 rounded mb-2 w-20" />
            <div className="h-7 bg-surface3 rounded mb-2 w-28" />
            <div className="h-4 bg-surface3 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (!indices?.length) {
    return (
      <div className="flex items-center justify-center h-24 bg-surface rounded-xl border border-border">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {indices.slice(0, 5).map((index) => (
        <IndexCard key={index.symbol} index={index} />
      ))}
    </div>
  )
}
