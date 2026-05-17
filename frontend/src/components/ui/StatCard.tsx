'use client'

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn, formatPercent } from '@/lib/utils'
import { motion } from 'framer-motion'

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: LucideIcon
  iconColor?: string
  valueColor?: 'default' | 'success' | 'danger' | 'warning' | 'primary'
  subtitle?: string
  loading?: boolean
  onClick?: () => void
  className?: string
}

const valueColorClasses = {
  default: 'text-text-primary',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  primary: 'text-primary',
}

export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'text-primary',
  valueColor = 'default',
  subtitle,
  loading,
  onClick,
  className,
}: StatCardProps) {
  const isPositiveChange = (change ?? 0) >= 0

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.01 } : undefined}
      onClick={onClick}
      className={cn(
        'stat-card',
        onClick && 'cursor-pointer hover:border-border-light',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{title}</p>
        {Icon && (
          <div className={cn('p-1.5 rounded-lg', `bg-${iconColor.replace('text-', '')}/10`)}>
            <Icon className={cn('w-4 h-4', iconColor)} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 bg-surface3 rounded w-3/4" />
          <div className="h-4 bg-surface3 rounded w-1/2" />
        </div>
      ) : (
        <>
          <div className={cn('text-xl font-bold', valueColorClasses[valueColor])}>
            {value}
          </div>

          {(change !== undefined || subtitle) && (
            <div className="flex items-center gap-2 mt-2">
              {change !== undefined && (
                <div className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  isPositiveChange ? 'text-success' : 'text-danger'
                )}>
                  {isPositiveChange
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />
                  }
                  {formatPercent(change)}
                </div>
              )}
              {changeLabel && (
                <span className="text-xs text-text-muted">{changeLabel}</span>
              )}
              {subtitle && !changeLabel && (
                <span className="text-xs text-text-muted">{subtitle}</span>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
