'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import BacktestForm from '@/components/backtesting/BacktestForm'
import BacktestResults from '@/components/backtesting/BacktestResults'
import { BacktestResult } from '@/types/trade'
import { FlaskConical } from 'lucide-react'

function generateMockBacktestResult(data: { symbol: string; strategy: string; startDate: string; endDate: string; initialCapital: number }): BacktestResult {
  const totalTrades = Math.floor(Math.random() * 80 + 30)
  const winRate = 45 + Math.random() * 25
  const winningTrades = Math.floor(totalTrades * (winRate / 100))
  const losingTrades = totalTrades - winningTrades
  const avgWin = Math.random() * 8000 + 2000
  const avgLoss = Math.random() * 4000 + 1000
  const totalReturn = (winningTrades * avgWin) - (losingTrades * avgLoss)
  const totalReturnPercent = (totalReturn / data.initialCapital) * 100

  // Generate equity curve
  let equity = data.initialCapital
  const equityCurve = []
  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  let maxEquity = equity
  let maxDrawdownPct = 0

  for (let i = 0; i <= Math.min(daysDiff, 300); i += Math.floor(daysDiff / 100) || 1) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const change = (Math.random() - 0.45) * equity * 0.02
    equity += change
    maxEquity = Math.max(maxEquity, equity)
    const drawdown = ((maxEquity - equity) / maxEquity) * 100
    maxDrawdownPct = Math.max(maxDrawdownPct, drawdown)
    equityCurve.push({
      date: d.toISOString().split('T')[0],
      equity: Math.max(equity, data.initialCapital * 0.5),
      drawdown: -drawdown,
    })
  }

  // Generate trades
  const trades = []
  for (let i = 1; i <= Math.min(totalTrades, 30); i++) {
    const isWin = Math.random() < (winRate / 100)
    const pnl = isWin ? avgWin * (0.5 + Math.random()) : -avgLoss * (0.5 + Math.random())
    const entryDate = new Date(startDate)
    entryDate.setDate(entryDate.getDate() + Math.floor((daysDiff / totalTrades) * i))
    const exitDate = new Date(entryDate)
    exitDate.setDate(exitDate.getDate() + Math.floor(Math.random() * 5 + 1))
    const entryPrice = 18000 + Math.random() * 5000
    const exitPrice = entryPrice + (pnl / 50)
    trades.push({
      id: i,
      entryDate: entryDate.toISOString(),
      exitDate: exitDate.toISOString(),
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      exitPrice: parseFloat(exitPrice.toFixed(2)),
      quantity: 50,
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPercent: parseFloat(((pnl / (entryPrice * 50)) * 100).toFixed(2)),
      signal: isWin ? 'BUY Signal' : 'SELL Signal',
    })
  }

  // Monthly returns
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthlyReturns = months.slice(0, 12).map((m) => ({
    month: m,
    return: parseFloat(((Math.random() - 0.4) * 12).toFixed(2)),
  }))

  const years = Math.max(1, daysDiff / 365)
  const cagr = ((Math.pow((data.initialCapital + totalReturn) / data.initialCapital, 1 / years) - 1) * 100)

  return {
    id: `BT-${Date.now()}`,
    symbol: data.symbol,
    strategy: data.strategy,
    startDate: data.startDate,
    endDate: data.endDate,
    initialCapital: data.initialCapital,
    finalCapital: data.initialCapital + totalReturn,
    totalReturn,
    totalReturnPercent,
    cagr: parseFloat(cagr.toFixed(2)),
    sharpeRatio: parseFloat((0.5 + Math.random() * 2).toFixed(2)),
    maxDrawdown: -(maxDrawdownPct / 100 * data.initialCapital),
    maxDrawdownPercent: parseFloat((-maxDrawdownPct).toFixed(2)),
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: parseFloat(winRate.toFixed(1)),
    avgWin,
    avgLoss,
    profitFactor: parseFloat(((winningTrades * avgWin) / (losingTrades * avgLoss)).toFixed(2)),
    expectancy: parseFloat(((winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss)).toFixed(2)),
    equityCurve,
    trades,
    monthlyReturns,
    createdAt: new Date().toISOString(),
  }
}

export default function BacktestingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)

  const handleSubmit = async (data: { symbol: string; strategy: string; startDate: string; endDate: string; initialCapital: number }) => {
    setIsLoading(true)
    setResult(null)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const mockResult = generateMockBacktestResult(data)
    setResult(mockResult)
    setIsLoading(false)
  }

  return (
    <AppLayout title="Backtesting">
      <div className="p-4 h-[calc(100vh-3.5rem)] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-text-primary">Strategy Backtesting</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Form */}
          <div className="lg:col-span-1">
            <BacktestForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 bg-surface border border-border rounded-xl">
                <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-text-secondary">Running backtest...</p>
                <p className="text-text-muted text-sm mt-1">Analyzing historical data</p>
              </div>
            ) : result ? (
              <BacktestResults result={result} />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-surface border border-border rounded-xl text-text-muted">
                <FlaskConical className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Configure and run a backtest</p>
                <p className="text-xs mt-1">Results will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
