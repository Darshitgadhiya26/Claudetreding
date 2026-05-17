'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { AlertTriangle, Target, ShieldAlert, Info } from 'lucide-react'
import { cn, formatCurrency, calculateRiskReward } from '@/lib/utils'
import { useTradeStore } from '@/store/tradeStore'
import { useMarketStore } from '@/store/marketStore'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid' // if available, else use Date.now()

const orderSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  orderType: z.enum(['MARKET', 'LIMIT', 'SL', 'SL-M']),
  price: z.number().optional(),
  stopLoss: z.number().optional(),
  target: z.number().optional(),
  productType: z.enum(['MIS', 'CNC', 'NRML']),
})

type OrderFormData = z.infer<typeof orderSchema>

export default function OrderPanel() {
  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY')
  const { selectedSymbol, quotes } = useMarketStore()
  const { paperBalance, addPaperOrder, addPaperPosition, setPaperBalance } = useTradeStore()

  const quote = quotes[selectedSymbol]

  const { register, handleSubmit, watch, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      symbol: selectedSymbol,
      quantity: 1,
      orderType: 'MARKET',
      productType: 'MIS',
    },
  })

  const watchedQty = watch('quantity') || 1
  const watchedPrice = watch('price') || quote?.ltp || 0
  const watchedSL = watch('stopLoss')
  const watchedTarget = watch('target')
  const orderType = watch('orderType')

  const effectivePrice = orderType === 'MARKET' ? (quote?.ltp || 0) : (watchedPrice || 0)
  const orderValue = effectivePrice * watchedQty

  const riskReward = watchedSL && watchedTarget && effectivePrice
    ? calculateRiskReward(effectivePrice, watchedSL, watchedTarget, transactionType)
    : null

  const onSubmit = (data: OrderFormData) => {
    const price = data.orderType === 'MARKET' ? (quote?.ltp || 0) : (data.price || 0)
    const totalCost = price * data.quantity

    if (transactionType === 'BUY' && totalCost > paperBalance) {
      toast.error('Insufficient paper trading balance')
      return
    }

    const orderId = `PT-${Date.now()}`
    const now = new Date().toISOString()

    addPaperOrder({
      id: orderId,
      symbol: data.symbol || selectedSymbol,
      exchange: 'NSE',
      transactionType,
      orderType: data.orderType,
      productType: data.productType,
      quantity: data.quantity,
      price: price,
      status: 'COMPLETE',
      filledQuantity: data.quantity,
      avgPrice: price,
      stopLoss: data.stopLoss,
      target: data.target,
      tag: 'PAPER',
      placedAt: now,
      updatedAt: now,
      isPaperTrade: true,
    })

    addPaperPosition({
      id: `POS-${Date.now()}`,
      symbol: data.symbol || selectedSymbol,
      exchange: 'NSE',
      productType: data.productType,
      transactionType,
      quantity: data.quantity,
      avgPrice: price,
      ltp: price,
      pnl: 0,
      pnlPercent: 0,
      dayPnl: 0,
      stopLoss: data.stopLoss,
      target: data.target,
      openedAt: now,
      isPaperTrade: true,
    })

    if (transactionType === 'BUY') {
      setPaperBalance(paperBalance - totalCost)
    } else {
      setPaperBalance(paperBalance + totalCost)
    }

    toast.success(`${transactionType} order placed for ${data.quantity} × ${data.symbol || selectedSymbol} @ ₹${price.toFixed(2)}`)
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* BUY/SELL tabs */}
      <div className="flex">
        <button
          onClick={() => setTransactionType('BUY')}
          className={cn(
            'flex-1 py-3 text-sm font-bold transition-all duration-200',
            transactionType === 'BUY'
              ? 'bg-success text-white shadow-glow-success'
              : 'bg-surface2 text-text-muted hover:text-success'
          )}
        >
          BUY
        </button>
        <button
          onClick={() => setTransactionType('SELL')}
          className={cn(
            'flex-1 py-3 text-sm font-bold transition-all duration-200',
            transactionType === 'SELL'
              ? 'bg-danger text-white shadow-glow-danger'
              : 'bg-surface2 text-text-muted hover:text-danger'
          )}
        >
          SELL
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
        {/* Symbol */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Symbol</label>
          <input
            {...register('symbol')}
            defaultValue={selectedSymbol}
            className="trading-input font-bold"
            placeholder="RELIANCE"
          />
        </div>

        {/* Product Type */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Product</label>
          <div className="grid grid-cols-3 gap-1">
            {(['MIS', 'CNC', 'NRML'] as const).map((type) => (
              <label key={type} className="relative cursor-pointer">
                <input type="radio" value={type} {...register('productType')} className="sr-only peer" />
                <div className={cn(
                  'text-center py-1.5 text-xs font-medium rounded border transition-colors',
                  'peer-checked:bg-primary/15 peer-checked:border-primary peer-checked:text-primary',
                  'border-border text-text-muted hover:border-border-light'
                )}>
                  {type}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Order Type */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Order Type</label>
          <select {...register('orderType')} className="trading-input">
            <option value="MARKET">Market</option>
            <option value="LIMIT">Limit</option>
            <option value="SL">SL</option>
            <option value="SL-M">SL-M</option>
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Quantity (Lots/Shares)</label>
          <input
            {...register('quantity', { valueAsNumber: true })}
            type="number"
            min="1"
            className="trading-input font-mono"
            placeholder="1"
          />
          {errors.quantity && (
            <p className="text-xs text-danger mt-0.5">{errors.quantity.message}</p>
          )}
        </div>

        {/* Price (for LIMIT/SL) */}
        {(orderType === 'LIMIT' || orderType === 'SL') && (
          <div>
            <label className="block text-xs text-text-muted mb-1">
              Price
              {quote && <span className="ml-2 text-primary">LTP: {quote.ltp}</span>}
            </label>
            <input
              {...register('price', { valueAsNumber: true })}
              type="number"
              step="0.05"
              className="trading-input font-mono"
              placeholder={quote?.ltp?.toString() || '0.00'}
            />
          </div>
        )}

        {/* SL and Target */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-danger" />
              Stop Loss
            </label>
            <input
              {...register('stopLoss', { valueAsNumber: true })}
              type="number"
              step="0.05"
              className="trading-input font-mono text-danger"
              placeholder="SL price"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
              <Target className="w-3 h-3 text-success" />
              Target
            </label>
            <input
              {...register('target', { valueAsNumber: true })}
              type="number"
              step="0.05"
              className="trading-input font-mono text-success"
              placeholder="Target price"
            />
          </div>
        </div>

        {/* Risk/Reward display */}
        {riskReward && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-surface2 rounded-lg p-3 border border-border"
          >
            <div className="text-xs text-text-muted mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Risk/Reward Analysis
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-text-muted">Risk</div>
                <div className="text-danger font-mono font-medium">₹{(riskReward.risk * watchedQty).toFixed(0)}</div>
              </div>
              <div>
                <div className="text-text-muted">Reward</div>
                <div className="text-success font-mono font-medium">₹{(riskReward.reward * watchedQty).toFixed(0)}</div>
              </div>
              <div>
                <div className="text-text-muted">R:R Ratio</div>
                <div className={cn(
                  'font-mono font-medium',
                  riskReward.ratio >= 2 ? 'text-success' : riskReward.ratio >= 1 ? 'text-warning' : 'text-danger'
                )}>
                  1:{riskReward.ratio.toFixed(1)}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Order summary */}
        <div className="bg-surface2 rounded-lg p-3 border border-border text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-text-muted">Order Value</span>
            <span className="font-mono text-text-primary font-medium">₹{orderValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Available Balance</span>
            <span className={cn(
              'font-mono font-medium',
              paperBalance < orderValue ? 'text-danger' : 'text-success'
            )}>
              {formatCurrency(paperBalance, true)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Mode</span>
            <span className="badge-warning">Paper Trade</span>
          </div>
        </div>

        {/* Warning for insufficient balance */}
        {transactionType === 'BUY' && orderValue > paperBalance && (
          <div className="flex items-center gap-2 text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 border border-danger/20">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Insufficient paper trading balance
          </div>
        )}

        {/* Submit button */}
        <motion.button
          type="submit"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            'w-full py-3 text-sm font-bold rounded-lg text-white transition-all duration-200',
            transactionType === 'BUY'
              ? 'btn-buy'
              : 'btn-sell'
          )}
          disabled={transactionType === 'BUY' && orderValue > paperBalance}
        >
          {transactionType === 'BUY' ? 'BUY' : 'SELL'} {selectedSymbol}
        </motion.button>
      </form>
    </div>
  )
}
