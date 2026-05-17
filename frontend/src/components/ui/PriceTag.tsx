'use client'

import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface PriceTagProps {
  value: number
  change?: number
  changePercent?: number
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  showChange?: boolean
  className?: string
}

export default function PriceTag({
  value,
  change,
  changePercent,
  showIcon = false,
  size = 'md',
  showChange = true,
  className,
}: PriceTagProps) {
  const isPositive = (change ?? changePercent ?? 0) >= 0

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {showIcon && (
        isPositive
          ? <TrendingUp className={cn('flex-shrink-0', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4', 'text-success')} />
          : <TrendingDown className={cn('flex-shrink-0', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4', 'text-danger')} />
      )}
      <span className={cn(
        'font-mono font-semibold',
        sizeClasses[size],
        isPositive ? 'text-success' : 'text-danger'
      )}>
        {formatNumber(value)}
      </span>
      {showChange && (change !== undefined || changePercent !== undefined) && (
        <span className={cn(
          'font-mono',
          size === 'sm' ? 'text-xs' : 'text-xs',
          isPositive ? 'text-success/80' : 'text-danger/80'
        )}>
          {change !== undefined && `${isPositive ? '+' : ''}${formatNumber(change)}`}
          {changePercent !== undefined && ` (${formatPercent(changePercent)})`}
        </span>
      )}
    </span>
  )
}
