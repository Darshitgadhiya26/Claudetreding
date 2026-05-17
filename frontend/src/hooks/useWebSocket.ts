'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useMarketStore } from '@/store/marketStore'
import { Quote } from '@/types/market'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 10

interface WebSocketMessage {
  type: 'quote' | 'candle' | 'alert' | 'order_update' | 'pong' | 'subscribe_ack'
  data: unknown
  symbol?: string
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)
  const pingInterval = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { setQuote, appendCandle, setConnected, subscribedSymbols } = useMarketStore()

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)

        switch (message.type) {
          case 'quote': {
            const quote = message.data as Quote
            if (quote && quote.symbol) {
              setQuote(quote.symbol, quote)
            }
            break
          }
          case 'candle': {
            const { symbol, candle } = message.data as { symbol: string; candle: { time: number; open: number; high: number; low: number; close: number; volume: number } }
            if (symbol && candle) {
              appendCandle(symbol, candle)
            }
            break
          }
          case 'pong':
            break
          default:
            break
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err)
      }
    },
    [setQuote, appendCandle]
  )

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      const url = token ? `${WS_URL}/ws?token=${token}` : `${WS_URL}/ws`
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0

        // Resubscribe to symbols
        if (subscribedSymbols.length > 0) {
          ws.current?.send(
            JSON.stringify({ type: 'subscribe', symbols: subscribedSymbols })
          )
        }

        // Start ping interval
        pingInterval.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.current.onmessage = handleMessage

      ws.current.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        setConnected(false)

        if (pingInterval.current) {
          clearInterval(pingInterval.current)
        }

        // Reconnect with exponential backoff
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts.current)
          reconnectAttempts.current++
          reconnectTimeout.current = setTimeout(connect, delay)
        } else {
          setError('WebSocket connection failed. Please refresh the page.')
        }
      }

      ws.current.onerror = () => {
        setError('WebSocket error occurred')
      }
    } catch (err) {
      console.error('WebSocket connection error:', err)
      setError('Failed to connect to market data server')
    }
  }, [handleMessage, setConnected, subscribedSymbols])

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
    }
    if (pingInterval.current) {
      clearInterval(pingInterval.current)
    }
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }
    setIsConnected(false)
    setConnected(false)
  }, [setConnected])

  const subscribe = useCallback((symbols: string[]) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'subscribe', symbols }))
    }
  }, [])

  const unsubscribe = useCallback((symbols: string[]) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'unsubscribe', symbols }))
    }
  }, [])

  const sendMessage = useCallback((data: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    error,
    subscribe,
    unsubscribe,
    sendMessage,
    connect,
    disconnect,
  }
}
