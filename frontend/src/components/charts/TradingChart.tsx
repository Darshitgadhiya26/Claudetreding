'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  type Time,
} from 'lightweight-charts'
import { OHLCV, IndicatorConfig } from '@/types/market'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface TradingChartProps {
  symbol: string
  timeframe: string
  data: OHLCV[]
  indicators?: IndicatorConfig[]
  height?: number
  showVolume?: boolean
}

interface OHLCVLegend {
  open: number
  high: number
  low: number
  close: number
  volume: number
  change: number
  changePercent: number
}

export default function TradingChart({
  symbol,
  timeframe,
  data,
  indicators = [],
  height = 500,
  showVolume = true,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lineSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [legend, setLegend] = useState<OHLCVLegend | null>(null)

  const initChart = useCallback(() => {
    if (!containerRef.current) return

    // Cleanup existing chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111118' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: '#1e1e2a', style: 1 },
        horzLines: { color: '#1e1e2a', style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#4a4a6a',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1a1a24',
        },
        horzLine: {
          color: '#4a4a6a',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1a1a24',
        },
      },
      rightPriceScale: {
        borderColor: '#2a2a3a',
        textColor: '#94a3b8',
        scaleMargins: showVolume
          ? { top: 0.05, bottom: 0.25 }
          : { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: '#2a2a3a',
        textColor: '#94a3b8',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    chartRef.current = chart

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    // Volume series
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#6366f130',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      volumeSeriesRef.current = volumeSeries
    }

    // Subscribe to crosshair move for legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !candleSeriesRef.current) {
        setLegend(null)
        return
      }
      const candle = param.seriesData.get(candleSeriesRef.current) as { open: number; high: number; low: number; close: number } | undefined
      if (candle) {
        const prevCandle = data[data.length - 2]
        const change = candle.close - (prevCandle?.close || candle.open)
        const changePercent = prevCandle?.close ? (change / prevCandle.close) * 100 : 0
        const vol = volumeSeriesRef.current ? (param.seriesData.get(volumeSeriesRef.current) as { value?: number } | undefined)?.value || 0 : 0
        setLegend({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: vol,
          change,
          changePercent,
        })
      }
    })

    // Resize observer
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        chart.applyOptions({ width, height })
      }
    })
    resizeObserverRef.current.observe(containerRef.current)

    return chart
  }, [showVolume, data])

  // Initialize chart on mount
  useEffect(() => {
    initChart()
    return () => {
      resizeObserverRef.current?.disconnect()
      chartRef.current?.remove()
      chartRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update data when it changes
  useEffect(() => {
    if (!candleSeriesRef.current || !data.length) return

    const candleData = data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))
    candleSeriesRef.current.setData(candleData)

    if (volumeSeriesRef.current) {
      const volumeData = data.map((d) => ({
        time: d.time as Time,
        value: d.volume,
        color: d.close >= d.open ? '#22c55e30' : '#ef444430',
      }))
      volumeSeriesRef.current.setData(volumeData)
    }

    // Fit content
    chartRef.current?.timeScale().fitContent()

    // Set legend to last candle
    const last = data[data.length - 1]
    const prev = data[data.length - 2]
    if (last) {
      const change = last.close - (prev?.close || last.open)
      const changePercent = prev?.close ? (change / prev.close) * 100 : 0
      setLegend({
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        volume: last.volume,
        change,
        changePercent,
      })
    }
  }, [data])

  // Handle indicator overlays
  useEffect(() => {
    if (!chartRef.current || !data.length) return

    // Clear existing line series
    lineSeriesRefs.current.forEach((series) => {
      chartRef.current?.removeSeries(series)
    })
    lineSeriesRefs.current.clear()

    // Add enabled indicators
    const enabledOverlays = indicators.filter(
      (ind) => ind.enabled && ['EMA', 'SMA', 'VWAP'].includes(ind.type)
    )

    enabledOverlays.forEach((indicator) => {
      if (!chartRef.current) return

      const colors: Record<string, string> = {
        EMA: '#6366f1',
        SMA: '#f59e0b',
        VWAP: '#22c55e',
      }

      const series = chartRef.current.addSeries(LineSeries, {
        color: indicator.color || colors[indicator.type] || '#6366f1',
        lineWidth: 1.5,
        priceLineVisible: false,
        lastValueVisible: true,
      })

      // Calculate simple indicator data (in real app, use backend computed values)
      const period = indicator.params.period as number || 20
      const lineData = calculateIndicatorData(data, indicator.type, period)
      series.setData(lineData)

      lineSeriesRefs.current.set(indicator.type, series)
    })
  }, [indicators, data])

  return (
    <div className="relative w-full h-full bg-surface rounded-lg overflow-hidden">
      {/* OHLCV Legend */}
      {legend && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-3 bg-surface2/90 rounded-lg px-3 py-2 text-xs border border-border backdrop-blur-sm">
          <span className="font-bold text-text-primary">{symbol}</span>
          <span className="text-text-muted">{timeframe}</span>
          <span className="text-text-secondary">O <span className="text-text-primary font-mono">{formatNumber(legend.open)}</span></span>
          <span className="text-text-secondary">H <span className="text-success font-mono">{formatNumber(legend.high)}</span></span>
          <span className="text-text-secondary">L <span className="text-danger font-mono">{formatNumber(legend.low)}</span></span>
          <span className="text-text-secondary">C <span className={`font-mono font-bold ${legend.change >= 0 ? 'text-success' : 'text-danger'}`}>{formatNumber(legend.close)}</span></span>
          <span className={`font-mono ${legend.change >= 0 ? 'text-success' : 'text-danger'}`}>
            {legend.change >= 0 ? '+' : ''}{formatNumber(legend.change)} ({legend.changePercent >= 0 ? '+' : ''}{legend.changePercent.toFixed(2)}%)
          </span>
          {legend.volume > 0 && (
            <span className="text-text-muted">V <span className="text-text-secondary">{formatCurrency(legend.volume, true).replace('₹', '')}</span></span>
          )}
        </div>
      )}

      {/* Chart container */}
      <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />

      {/* No data state */}
      {!data.length && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-text-muted text-sm">Loading chart data...</p>
          </div>
        </div>
      )}
    </div>
  )
}

function calculateIndicatorData(
  data: OHLCV[],
  type: string,
  period: number
): { time: Time; value: number }[] {
  if (type === 'EMA' || type === 'SMA') {
    const result: { time: Time; value: number }[] = []
    let sum = 0
    const k = 2 / (period + 1)
    let ema = 0

    data.forEach((candle, i) => {
      if (type === 'SMA') {
        sum += candle.close
        if (i >= period - 1) {
          if (i > period - 1) sum -= data[i - period].close
          result.push({ time: candle.time as Time, value: sum / period })
        }
      } else {
        if (i === 0) {
          ema = candle.close
        } else {
          ema = candle.close * k + ema * (1 - k)
        }
        if (i >= period - 1) {
          result.push({ time: candle.time as Time, value: parseFloat(ema.toFixed(2)) })
        }
      }
    })
    return result
  }

  if (type === 'VWAP') {
    let cumulativeTPV = 0
    let cumulativeVolume = 0
    return data.map((candle) => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3
      cumulativeTPV += typicalPrice * candle.volume
      cumulativeVolume += candle.volume
      return {
        time: candle.time as Time,
        value: parseFloat((cumulativeTPV / cumulativeVolume).toFixed(2)),
      }
    })
  }

  return []
}
