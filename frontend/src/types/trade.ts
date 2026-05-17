export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M'
export type TransactionType = 'BUY' | 'SELL'
export type ProductType = 'MIS' | 'CNC' | 'NRML'
export type OrderStatus = 'PENDING' | 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED'
export type PositionStatus = 'OPEN' | 'CLOSED'

export interface Order {
  id: string
  symbol: string
  exchange: string
  transactionType: TransactionType
  orderType: OrderType
  productType: ProductType
  quantity: number
  price: number
  triggerPrice?: number
  status: OrderStatus
  filledQuantity: number
  avgPrice: number
  stopLoss?: number
  target?: number
  tag?: string
  placedAt: string
  updatedAt: string
  isPaperTrade: boolean
}

export interface Position {
  id: string
  symbol: string
  exchange: string
  productType: ProductType
  transactionType: TransactionType
  quantity: number
  avgPrice: number
  ltp: number
  pnl: number
  pnlPercent: number
  dayPnl: number
  stopLoss?: number
  target?: number
  riskReward?: number
  openedAt: string
  isPaperTrade: boolean
}

export interface Trade {
  id: string
  symbol: string
  exchange: string
  transactionType: TransactionType
  productType: ProductType
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl: number
  pnlPercent: number
  charges: number
  netPnl: number
  entryTime: string
  exitTime: string
  duration: string
  isPaperTrade: boolean
  notes?: string
  tags?: string[]
}

export interface BacktestResult {
  id: string
  symbol: string
  strategy: string
  startDate: string
  endDate: string
  initialCapital: number
  finalCapital: number
  totalReturn: number
  totalReturnPercent: number
  cagr: number
  sharpeRatio: number
  maxDrawdown: number
  maxDrawdownPercent: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  expectancy: number
  equityCurve: { date: string; equity: number; drawdown: number }[]
  trades: BacktestTrade[]
  monthlyReturns: { month: string; return: number }[]
  createdAt: string
}

export interface BacktestTrade {
  id: number
  entryDate: string
  exitDate: string
  entryPrice: number
  exitPrice: number
  quantity: number
  pnl: number
  pnlPercent: number
  signal: string
}

export interface Strategy {
  id: string
  name: string
  description: string
  type: 'TREND' | 'MOMENTUM' | 'MEAN_REVERSION' | 'BREAKOUT' | 'CUSTOM'
  isActive: boolean
  params: Record<string, number | string | boolean>
  performance?: {
    totalReturn: number
    winRate: number
    sharpeRatio: number
    maxDrawdown: number
  }
  createdAt: string
  updatedAt: string
}

export interface Alert {
  id: string
  symbol: string
  exchange: string
  condition: AlertCondition
  value: number
  secondaryValue?: number
  isActive: boolean
  triggered: boolean
  triggeredAt?: string
  channels: AlertChannel[]
  message?: string
  createdAt: string
  expiresAt?: string
}

export type AlertCondition =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'PRICE_CROSSES'
  | 'RSI_ABOVE'
  | 'RSI_BELOW'
  | 'MACD_CROSSOVER'
  | 'VOLUME_SPIKE'
  | 'PERCENT_CHANGE'
  | 'ATH'
  | 'ATL'

export type AlertChannel = 'BROWSER' | 'TELEGRAM' | 'EMAIL' | 'SMS'

export interface JournalEntry {
  id: string
  tradeId?: string
  date: string
  symbol?: string
  title: string
  notes: string
  psychology: string
  mood: 'GREAT' | 'GOOD' | 'NEUTRAL' | 'BAD' | 'TERRIBLE'
  rating: number
  tags: string[]
  images?: string[]
  pnl?: number
  lessons: string
  mistakes: string
  improvements: string
  createdAt: string
  updatedAt: string
}
