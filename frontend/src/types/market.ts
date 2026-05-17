export interface Quote {
  symbol: string
  exchange: string
  ltp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  change: number
  changePercent: number
  bid: number
  ask: number
  bidQty: number
  askQty: number
  totalBuyQty: number
  totalSellQty: number
  upperCircuit: number
  lowerCircuit: number
  weekHigh52: number
  weekLow52: number
  avgPrice: number
  oi?: number
  oiChange?: number
  timestamp: number
}

export interface OHLCV {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketBreadth {
  advances: number
  declines: number
  unchanged: number
  advanceDeclineRatio: number
  totalVolume: number
  totalTurnover: number
}

export interface MarketIndex {
  symbol: string
  name: string
  ltp: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  sparkline?: number[]
}

export interface OptionData {
  strikePrice: number
  expiryDate: string
  optionType: 'CE' | 'PE'
  ltp: number
  change: number
  changePercent: number
  oi: number
  oiChange: number
  oiChangePercent: number
  volume: number
  iv: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  bid: number
  ask: number
}

export interface OptionChainRow {
  strikePrice: number
  ce: OptionData | null
  pe: OptionData | null
  isITM: boolean
  isATM: boolean
}

export interface OptionChainData {
  symbol: string
  expiry: string
  underlyingValue: number
  maxPain: number
  pcr: number
  rows: OptionChainRow[]
  expiryDates: string[]
}

export interface Greeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  iv: number
}

export interface WatchlistItem {
  symbol: string
  exchange: string
  name: string
}

export interface Watchlist {
  id: string
  name: string
  items: WatchlistItem[]
}

export interface TopMover {
  symbol: string
  name: string
  ltp: number
  change: number
  changePercent: number
  volume: number
}

export interface SectorData {
  name: string
  change: number
  marketCap: number
  volume: number
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M'

export type Exchange = 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX'

export type IndicatorType =
  | 'EMA'
  | 'SMA'
  | 'RSI'
  | 'MACD'
  | 'VWAP'
  | 'BollingerBands'
  | 'Supertrend'
  | 'ATR'
  | 'Volume'
  | 'Stochastic'

export interface IndicatorConfig {
  type: IndicatorType
  enabled: boolean
  params: Record<string, number>
  color?: string
}
