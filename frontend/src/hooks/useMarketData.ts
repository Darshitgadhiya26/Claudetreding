'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { marketApi } from '@/lib/api'
import { useMarketStore } from '@/store/marketStore'
import { generateMockCandles } from '@/lib/utils'
import { OHLCV, Timeframe } from '@/types/market'

// Mock data for development
function generateMockQuote(symbol: string) {
  const basePrice = Math.random() * 3000 + 500
  const change = (Math.random() - 0.5) * basePrice * 0.05
  return {
    symbol,
    exchange: 'NSE',
    ltp: parseFloat(basePrice.toFixed(2)),
    open: parseFloat((basePrice * 0.99).toFixed(2)),
    high: parseFloat((basePrice * 1.02).toFixed(2)),
    low: parseFloat((basePrice * 0.97).toFixed(2)),
    close: parseFloat((basePrice - change).toFixed(2)),
    volume: Math.floor(Math.random() * 5000000 + 1000000),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(((change / basePrice) * 100).toFixed(2)),
    bid: parseFloat((basePrice - 0.5).toFixed(2)),
    ask: parseFloat((basePrice + 0.5).toFixed(2)),
    bidQty: Math.floor(Math.random() * 1000),
    askQty: Math.floor(Math.random() * 1000),
    totalBuyQty: Math.floor(Math.random() * 10000000),
    totalSellQty: Math.floor(Math.random() * 10000000),
    upperCircuit: parseFloat((basePrice * 1.2).toFixed(2)),
    lowerCircuit: parseFloat((basePrice * 0.8).toFixed(2)),
    weekHigh52: parseFloat((basePrice * 1.5).toFixed(2)),
    weekLow52: parseFloat((basePrice * 0.6).toFixed(2)),
    avgPrice: parseFloat(basePrice.toFixed(2)),
    timestamp: Date.now(),
  }
}

export function useQuote(symbol: string, exchange = 'NSE') {
  const { setQuote } = useMarketStore()

  return useQuery({
    queryKey: ['quote', symbol, exchange],
    queryFn: async () => {
      try {
        const response = await marketApi.getQuote(symbol, exchange)
        const quote = response.data
        setQuote(symbol, quote)
        return quote
      } catch {
        // Return mock data if API fails
        const mockQuote = generateMockQuote(symbol)
        setQuote(symbol, mockQuote)
        return mockQuote
      }
    },
    refetchInterval: 5000,
    staleTime: 3000,
  })
}

export function useMultipleQuotes(symbols: string[]) {
  const { setMultipleQuotes } = useMarketStore()

  return useQuery({
    queryKey: ['quotes', symbols],
    queryFn: async () => {
      try {
        const response = await marketApi.getMultipleQuotes(symbols)
        const quotes = response.data
        setMultipleQuotes(quotes)
        return quotes
      } catch {
        // Return mock data
        const mockQuotes: Record<string, ReturnType<typeof generateMockQuote>> = {}
        symbols.forEach((symbol) => {
          mockQuotes[symbol] = generateMockQuote(symbol)
        })
        setMultipleQuotes(mockQuotes)
        return mockQuotes
      }
    },
    enabled: symbols.length > 0,
    refetchInterval: 5000,
    staleTime: 3000,
  })
}

export function useCandles(symbol: string, timeframe: Timeframe, from?: number, to?: number) {
  const { setCandles } = useMarketStore()

  return useQuery({
    queryKey: ['candles', symbol, timeframe, from, to],
    queryFn: async (): Promise<OHLCV[]> => {
      try {
        const response = await marketApi.getCandles(symbol, timeframe, from, to)
        const candles = response.data
        setCandles(symbol, candles)
        return candles
      } catch {
        // Return mock data
        const mockCandles = generateMockCandles(
          Math.random() * 3000 + 500,
          200,
          timeframe
        )
        setCandles(symbol, mockCandles)
        return mockCandles
      }
    },
    enabled: !!symbol && !!timeframe,
    staleTime: 60000,
  })
}

export function useMarketBreadth() {
  return useQuery({
    queryKey: ['market-breadth'],
    queryFn: async () => {
      try {
        const response = await marketApi.getMarketBreadth()
        return response.data
      } catch {
        return {
          advances: Math.floor(Math.random() * 800 + 300),
          declines: Math.floor(Math.random() * 500 + 200),
          unchanged: Math.floor(Math.random() * 100 + 20),
          advanceDeclineRatio: 1.4,
          totalVolume: Math.floor(Math.random() * 1000000000),
          totalTurnover: Math.floor(Math.random() * 500000000000),
        }
      }
    },
    refetchInterval: 30000,
    staleTime: 15000,
  })
}

export function useTopMovers(type: 'gainers' | 'losers', exchange = 'NSE', limit = 10) {
  return useQuery({
    queryKey: ['top-movers', type, exchange, limit],
    queryFn: async () => {
      try {
        const response = await marketApi.getTopMovers(type, exchange, limit)
        return response.data
      } catch {
        const symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'LT', 'AXISBANK', 'KOTAKBANK', 'SBIN', 'BHARTIARTL']
        return symbols.slice(0, limit).map((symbol, i) => ({
          symbol,
          name: symbol,
          ltp: parseFloat((Math.random() * 3000 + 500).toFixed(2)),
          change: type === 'gainers' ? parseFloat((Math.random() * 50 + 10).toFixed(2)) : parseFloat(-(Math.random() * 50 + 10).toFixed(2)),
          changePercent: type === 'gainers' ? parseFloat((Math.random() * 10 + 2).toFixed(2)) : parseFloat(-(Math.random() * 10 + 2).toFixed(2)),
          volume: Math.floor(Math.random() * 5000000 + 1000000),
          rank: i + 1,
        }))
      }
    },
    refetchInterval: 30000,
    staleTime: 15000,
  })
}

export function useOptionChain(symbol: string, expiry?: string) {
  return useQuery({
    queryKey: ['option-chain', symbol, expiry],
    queryFn: async () => {
      try {
        const response = await marketApi.getOptionChain(symbol, expiry)
        return response.data
      } catch {
        return null
      }
    },
    enabled: !!symbol,
    refetchInterval: 10000,
    staleTime: 5000,
  })
}

export function useSymbolSearch(query: string) {
  return useQuery({
    queryKey: ['symbol-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      try {
        const response = await marketApi.searchSymbols(query)
        return response.data
      } catch {
        const symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'LT', 'AXISBANK', 'NIFTY', 'BANKNIFTY']
        return symbols
          .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
          .map((symbol) => ({ symbol, exchange: 'NSE', name: symbol }))
      }
    },
    enabled: query.length >= 2,
    staleTime: 30000,
  })
}

export function useIndices() {
  const { setIndices } = useMarketStore()

  return useQuery({
    queryKey: ['indices'],
    queryFn: async () => {
      try {
        const response = await marketApi.getIndices()
        const indices = response.data
        setIndices(indices)
        return indices
      } catch {
        const mockIndices = [
          { symbol: 'NIFTY 50', name: 'Nifty 50', ltp: 22543.85, change: 125.30, changePercent: 0.56, open: 22418.55, high: 22601.20, low: 22380.10, close: 22418.55, volume: 0 },
          { symbol: 'NIFTY BANK', name: 'Bank Nifty', ltp: 48234.60, change: -89.45, changePercent: -0.19, open: 48324.05, high: 48512.30, low: 48100.20, close: 48324.05, volume: 0 },
          { symbol: 'SENSEX', name: 'Sensex', ltp: 74205.40, change: 401.15, changePercent: 0.54, open: 73804.25, high: 74301.60, low: 73750.10, close: 73804.25, volume: 0 },
          { symbol: 'NIFTY IT', name: 'Nifty IT', ltp: 33456.80, change: 234.55, changePercent: 0.71, open: 33222.25, high: 33512.40, low: 33180.60, close: 33222.25, volume: 0 },
          { symbol: 'INDIA VIX', name: 'India VIX', ltp: 13.45, change: -0.82, changePercent: -5.74, open: 14.27, high: 14.52, low: 13.21, close: 14.27, volume: 0 },
        ]
        setIndices(mockIndices)
        return mockIndices
      }
    },
    refetchInterval: 5000,
    staleTime: 3000,
  })
}

export function useSearchSymbols() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (query: string) => {
      try {
        const response = await marketApi.searchSymbols(query)
        return response.data
      } catch {
        return []
      }
    },
    onSuccess: (data, query) => {
      queryClient.setQueryData(['symbol-search', query], data)
    },
  })
}
