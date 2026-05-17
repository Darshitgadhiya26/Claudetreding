'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Play, Calendar, DollarSign, Target } from 'lucide-react'
import { STRATEGIES } from '@/lib/constants'

const backtestSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  exchange: z.string().default('NSE'),
  strategy: z.string().min(1, 'Strategy is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  initialCapital: z.number().min(10000, 'Min capital ₹10,000'),
  timeframe: z.string().default('1d'),
})

type BacktestFormData = z.infer<typeof backtestSchema>

interface BacktestFormProps {
  onSubmit: (data: BacktestFormData) => void
  isLoading?: boolean
}

export default function BacktestForm({ onSubmit, isLoading }: BacktestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BacktestFormData>({
    resolver: zodResolver(backtestSchema),
    defaultValues: {
      symbol: 'NIFTY 50',
      exchange: 'NSE',
      strategy: 'EMA_CROSSOVER',
      startDate: '2022-01-01',
      endDate: new Date().toISOString().split('T')[0],
      initialCapital: 100000,
      timeframe: '1d',
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface border border-border rounded-xl p-6"
    >
      <h2 className="text-base font-semibold text-text-primary mb-6">Backtest Configuration</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Symbol & Exchange */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-text-muted mb-1.5">Symbol</label>
            <input
              {...register('symbol')}
              className="trading-input"
              placeholder="NIFTY 50"
            />
            {errors.symbol && <p className="text-xs text-danger mt-0.5">{errors.symbol.message}</p>}
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Exchange</label>
            <select {...register('exchange')} className="trading-input">
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
              <option value="NFO">NFO</option>
            </select>
          </div>
        </div>

        {/* Strategy */}
        <div>
          <label className="block text-xs text-text-muted mb-1.5">
            <Target className="inline w-3 h-3 mr-1" />
            Strategy
          </label>
          <select {...register('strategy')} className="trading-input">
            {STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {errors.strategy && <p className="text-xs text-danger mt-0.5">{errors.strategy.message}</p>}
        </div>

        {/* Timeframe */}
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Timeframe</label>
          <div className="grid grid-cols-6 gap-1">
            {['5m', '15m', '30m', '1h', '4h', '1d'].map((tf) => (
              <label key={tf} className="relative cursor-pointer">
                <input type="radio" value={tf} {...register('timeframe')} className="sr-only peer" defaultChecked={tf === '1d'} />
                <div className="text-center py-1.5 text-xs font-medium rounded border transition-colors peer-checked:bg-primary/15 peer-checked:border-primary peer-checked:text-primary border-border text-text-muted hover:border-border-light">
                  {tf}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              <Calendar className="inline w-3 h-3 mr-1" />
              Start Date
            </label>
            <input
              {...register('startDate')}
              type="date"
              className="trading-input"
              max={new Date().toISOString().split('T')[0]}
            />
            {errors.startDate && <p className="text-xs text-danger mt-0.5">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              <Calendar className="inline w-3 h-3 mr-1" />
              End Date
            </label>
            <input
              {...register('endDate')}
              type="date"
              className="trading-input"
              max={new Date().toISOString().split('T')[0]}
            />
            {errors.endDate && <p className="text-xs text-danger mt-0.5">{errors.endDate.message}</p>}
          </div>
        </div>

        {/* Initial Capital */}
        <div>
          <label className="block text-xs text-text-muted mb-1.5">
            <DollarSign className="inline w-3 h-3 mr-1" />
            Initial Capital (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
            <input
              {...register('initialCapital', { valueAsNumber: true })}
              type="number"
              step="10000"
              min="10000"
              className="trading-input pl-7 font-mono"
              placeholder="100000"
            />
          </div>
          {errors.initialCapital && <p className="text-xs text-danger mt-0.5">{errors.initialCapital.message}</p>}
          <div className="flex gap-2 mt-1.5">
            {[100000, 500000, 1000000].map((amt) => (
              <button
                key={amt}
                type="button"
                className="text-xs text-primary hover:text-primary-light"
              >
                ₹{(amt / 100000).toFixed(0)}L
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-60 mt-6"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Backtest
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  )
}
