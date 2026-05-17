import { create } from 'zustand'
import { Quote, Watchlist, MarketIndex, Timeframe, IndicatorConfig, OHLCV } from '@/types/market'

interface MarketState {
  quotes: Record<string, Quote>
  watchlists: Watchlist[]
  activeWatchlistId: string | null
  selectedSymbol: string
  selectedTimeframe: Timeframe
  selectedExchange: string
  candles: Record<string, OHLCV[]>
  indices: MarketIndex[]
  indicators: IndicatorConfig[]
  isConnected: boolean
  subscribedSymbols: string[]

  // Actions
  setQuote: (symbol: string, quote: Quote) => void
  setMultipleQuotes: (quotes: Record<string, Quote>) => void
  setWatchlists: (watchlists: Watchlist[]) => void
  addWatchlist: (watchlist: Watchlist) => void
  removeWatchlist: (id: string) => void
  setActiveWatchlist: (id: string) => void
  addToWatchlist: (watchlistId: string, symbol: string, exchange: string, name: string) => void
  removeFromWatchlist: (watchlistId: string, symbol: string) => void
  setSelectedSymbol: (symbol: string) => void
  setSelectedTimeframe: (timeframe: Timeframe) => void
  setSelectedExchange: (exchange: string) => void
  setCandles: (symbol: string, candles: OHLCV[]) => void
  appendCandle: (symbol: string, candle: OHLCV) => void
  setIndices: (indices: MarketIndex[]) => void
  updateIndex: (symbol: string, data: Partial<MarketIndex>) => void
  addIndicator: (indicator: IndicatorConfig) => void
  removeIndicator: (type: string) => void
  updateIndicator: (type: string, params: Record<string, number>) => void
  toggleIndicator: (type: string) => void
  setConnected: (connected: boolean) => void
  addSubscribedSymbol: (symbol: string) => void
  removeSubscribedSymbol: (symbol: string) => void
}

const defaultWatchlists: Watchlist[] = [
  {
    id: 'indices',
    name: 'Indices',
    items: [
      { symbol: 'NIFTY 50', exchange: 'NSE', name: 'Nifty 50' },
      { symbol: 'NIFTY BANK', exchange: 'NSE', name: 'Bank Nifty' },
      { symbol: 'SENSEX', exchange: 'BSE', name: 'Sensex' },
      { symbol: 'INDIA VIX', exchange: 'NSE', name: 'India VIX' },
    ],
  },
  {
    id: 'my-stocks',
    name: 'My Stocks',
    items: [
      { symbol: 'RELIANCE', exchange: 'NSE', name: 'Reliance Industries' },
      { symbol: 'TCS', exchange: 'NSE', name: 'Tata Consultancy' },
      { symbol: 'HDFCBANK', exchange: 'NSE', name: 'HDFC Bank' },
      { symbol: 'INFY', exchange: 'NSE', name: 'Infosys' },
      { symbol: 'ICICIBANK', exchange: 'NSE', name: 'ICICI Bank' },
    ],
  },
  {
    id: 'fo',
    name: 'F&O',
    items: [
      { symbol: 'NIFTY', exchange: 'NFO', name: 'Nifty Futures' },
      { symbol: 'BANKNIFTY', exchange: 'NFO', name: 'Bank Nifty Futures' },
      { symbol: 'RELIANCE', exchange: 'NFO', name: 'Reliance Futures' },
    ],
  },
]

export const useMarketStore = create<MarketState>()((set, get) => ({
  quotes: {},
  watchlists: defaultWatchlists,
  activeWatchlistId: 'my-stocks',
  selectedSymbol: 'NIFTY 50',
  selectedTimeframe: '1d',
  selectedExchange: 'NSE',
  candles: {},
  indices: [],
  indicators: [
    { type: 'Volume', enabled: true, params: {} },
  ],
  isConnected: false,
  subscribedSymbols: [],

  setQuote: (symbol, quote) =>
    set((state) => ({
      quotes: { ...state.quotes, [symbol]: quote },
    })),

  setMultipleQuotes: (quotes) =>
    set((state) => ({
      quotes: { ...state.quotes, ...quotes },
    })),

  setWatchlists: (watchlists) => set({ watchlists }),

  addWatchlist: (watchlist) =>
    set((state) => ({
      watchlists: [...state.watchlists, watchlist],
    })),

  removeWatchlist: (id) =>
    set((state) => ({
      watchlists: state.watchlists.filter((w) => w.id !== id),
    })),

  setActiveWatchlist: (id) => set({ activeWatchlistId: id }),

  addToWatchlist: (watchlistId, symbol, exchange, name) =>
    set((state) => ({
      watchlists: state.watchlists.map((w) =>
        w.id === watchlistId
          ? { ...w, items: [...w.items, { symbol, exchange, name }] }
          : w
      ),
    })),

  removeFromWatchlist: (watchlistId, symbol) =>
    set((state) => ({
      watchlists: state.watchlists.map((w) =>
        w.id === watchlistId
          ? { ...w, items: w.items.filter((i) => i.symbol !== symbol) }
          : w
      ),
    })),

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

  setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),

  setSelectedExchange: (exchange) => set({ selectedExchange: exchange }),

  setCandles: (symbol, candles) =>
    set((state) => ({
      candles: { ...state.candles, [symbol]: candles },
    })),

  appendCandle: (symbol, candle) =>
    set((state) => {
      const existing = state.candles[symbol] || []
      const last = existing[existing.length - 1]
      if (last && last.time === candle.time) {
        return {
          candles: {
            ...state.candles,
            [symbol]: [...existing.slice(0, -1), candle],
          },
        }
      }
      return {
        candles: {
          ...state.candles,
          [symbol]: [...existing, candle],
        },
      }
    }),

  setIndices: (indices) => set({ indices }),

  updateIndex: (symbol, data) =>
    set((state) => ({
      indices: state.indices.map((idx) =>
        idx.symbol === symbol ? { ...idx, ...data } : idx
      ),
    })),

  addIndicator: (indicator) =>
    set((state) => {
      const exists = state.indicators.find((i) => i.type === indicator.type)
      if (exists) return state
      return { indicators: [...state.indicators, indicator] }
    }),

  removeIndicator: (type) =>
    set((state) => ({
      indicators: state.indicators.filter((i) => i.type !== type),
    })),

  updateIndicator: (type, params) =>
    set((state) => ({
      indicators: state.indicators.map((i) =>
        i.type === type ? { ...i, params: { ...i.params, ...params } } : i
      ),
    })),

  toggleIndicator: (type) =>
    set((state) => ({
      indicators: state.indicators.map((i) =>
        i.type === type ? { ...i, enabled: !i.enabled } : i
      ),
    })),

  setConnected: (connected) => set({ isConnected: connected }),

  addSubscribedSymbol: (symbol) =>
    set((state) => ({
      subscribedSymbols: state.subscribedSymbols.includes(symbol)
        ? state.subscribedSymbols
        : [...state.subscribedSymbols, symbol],
    })),

  removeSubscribedSymbol: (symbol) =>
    set((state) => ({
      subscribedSymbols: state.subscribedSymbols.filter((s) => s !== symbol),
    })),
}))
