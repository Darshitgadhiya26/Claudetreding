import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)}Cr`
    }
    if (Math.abs(value) >= 100000) {
      return `₹${(value / 100000).toFixed(2)}L`
    }
    if (Math.abs(value) >= 1000) {
      return `₹${(value / 1000).toFixed(2)}K`
    }
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 10000000) {
    return `${(value / 10000000).toFixed(2)}Cr`
  }
  if (Math.abs(value) >= 100000) {
    return `${(value / 100000).toFixed(2)}L`
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(2)}K`
  }
  return formatNumber(value, 0)
}

export function formatPercent(value: number, showSign = true): string {
  const formatted = `${Math.abs(value).toFixed(2)}%`
  if (showSign) {
    return value >= 0 ? `+${formatted}` : `-${formatted}`
  }
  return formatted
}

export function formatChange(value: number): string {
  return value >= 0 ? `+${formatNumber(value)}` : formatNumber(value)
}

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return `Today, ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Yesterday, ${format(d, 'HH:mm')}`
  return format(d, fmt)
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'HH:mm:ss')
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function getChangeColor(value: number): string {
  if (value > 0) return 'text-success'
  if (value < 0) return 'text-danger'
  return 'text-text-secondary'
}

export function getChangeBgColor(value: number): string {
  if (value > 0) return 'bg-success/10 text-success'
  if (value < 0) return 'bg-danger/10 text-danger'
  return 'bg-muted/10 text-muted-foreground'
}

export function isMarketOpen(): boolean {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const time = hours * 60 + minutes
  const marketOpen = 9 * 60 + 15
  const marketClose = 15 * 60 + 30
  return time >= marketOpen && time <= marketClose
}

export function getMarketStatus(): { status: 'OPEN' | 'CLOSED' | 'PRE_OPEN'; label: string } {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) {
    return { status: 'CLOSED', label: 'Market Closed' }
  }
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const time = hours * 60 + minutes
  const preOpen = 9 * 60
  const marketOpen = 9 * 60 + 15
  const marketClose = 15 * 60 + 30
  if (time >= preOpen && time < marketOpen) {
    return { status: 'PRE_OPEN', label: 'Pre-Open' }
  }
  if (time >= marketOpen && time <= marketClose) {
    return { status: 'OPEN', label: 'Market Open' }
  }
  return { status: 'CLOSED', label: 'Market Closed' }
}

export function generateMockCandles(
  basePrice: number,
  count: number,
  timeframe = '1d'
): { time: number; open: number; high: number; low: number; close: number; volume: number }[] {
  const candles = []
  let price = basePrice
  const now = Math.floor(Date.now() / 1000)
  const timeframeSeconds: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
    '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800,
  }
  const interval = timeframeSeconds[timeframe] || 86400

  for (let i = count; i >= 0; i--) {
    const open = price
    const change = (Math.random() - 0.48) * price * 0.02
    const close = price + change
    const high = Math.max(open, close) * (1 + Math.random() * 0.01)
    const low = Math.min(open, close) * (1 - Math.random() * 0.01)
    const volume = Math.floor(Math.random() * 1000000 + 500000)
    candles.push({
      time: now - i * interval,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    })
    price = close
  }
  return candles
}

export function calculateRiskReward(
  entryPrice: number,
  stopLoss: number,
  target: number,
  transactionType: 'BUY' | 'SELL'
): { risk: number; reward: number; ratio: number } {
  const risk = transactionType === 'BUY'
    ? entryPrice - stopLoss
    : stopLoss - entryPrice
  const reward = transactionType === 'BUY'
    ? target - entryPrice
    : entryPrice - target
  return {
    risk: Math.abs(risk),
    reward: Math.abs(reward),
    ratio: Math.abs(reward / risk),
  }
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
