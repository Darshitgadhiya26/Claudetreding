'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useTradeStore } from '@/store/tradeStore'
import { Alert, AlertCondition, AlertChannel } from '@/types/trade'
import { ALERT_CONDITIONS } from '@/lib/constants'
import toast from 'react-hot-toast'

interface AlertFormData {
  symbol: string
  exchange: string
  condition: AlertCondition
  value: number
  channels: AlertChannel[]
  message: string
}

export default function AlertPanel() {
  const { alerts, addAlert, deleteAlert, toggleAlert } = useTradeStore()
  const [showForm, setShowForm] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState<AlertChannel[]>(['BROWSER'])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AlertFormData>()

  const onSubmit = (data: AlertFormData) => {
    const newAlert: Alert = {
      id: `ALERT-${Date.now()}`,
      symbol: data.symbol.toUpperCase(),
      exchange: data.exchange || 'NSE',
      condition: data.condition,
      value: data.value,
      isActive: true,
      triggered: false,
      channels: selectedChannels,
      message: data.message,
      createdAt: new Date().toISOString(),
    }
    addAlert(newAlert)
    reset()
    setShowForm(false)
    setSelectedChannels(['BROWSER'])
    toast.success(`Alert created for ${newAlert.symbol}`)
  }

  const handleDelete = (id: string) => {
    deleteAlert(id)
    toast.success('Alert deleted')
  }

  const CHANNELS: { value: AlertChannel; label: string; icon: string }[] = [
    { value: 'BROWSER', label: 'Browser', icon: '🔔' },
    { value: 'TELEGRAM', label: 'Telegram', icon: '📱' },
    { value: 'EMAIL', label: 'Email', icon: '📧' },
  ]

  const toggleChannel = (channel: AlertChannel) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    )
  }

  const activeAlerts = alerts.filter((a) => a.isActive && !a.triggered)
  const triggeredAlerts = alerts.filter((a) => a.triggered)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-text-primary">Price Alerts</h2>
          {activeAlerts.length > 0 && (
            <span className="badge-primary">{activeAlerts.length} active</span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {/* Create Alert Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Create New Alert</h3>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-text-muted mb-1">Symbol</label>
                    <input
                      {...register('symbol', { required: 'Symbol is required' })}
                      className="trading-input"
                      placeholder="RELIANCE"
                    />
                    {errors.symbol && <p className="text-xs text-danger mt-0.5">{errors.symbol.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Exchange</label>
                    <select {...register('exchange')} className="trading-input">
                      <option value="NSE">NSE</option>
                      <option value="BSE">BSE</option>
                      <option value="NFO">NFO</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Condition</label>
                    <select {...register('condition', { required: true })} className="trading-input">
                      {ALERT_CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Value</label>
                    <input
                      {...register('value', { required: 'Value is required', valueAsNumber: true })}
                      type="number"
                      step="0.05"
                      className="trading-input font-mono"
                      placeholder="0.00"
                    />
                    {errors.value && <p className="text-xs text-danger mt-0.5">{errors.value.message}</p>}
                  </div>
                </div>

                {/* Notification Channels */}
                <div>
                  <label className="block text-xs text-text-muted mb-2">Notify via</label>
                  <div className="flex gap-2">
                    {CHANNELS.map((channel) => (
                      <button
                        key={channel.value}
                        type="button"
                        onClick={() => toggleChannel(channel.value)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                          selectedChannels.includes(channel.value)
                            ? 'bg-primary/15 border-primary/40 text-primary'
                            : 'bg-surface2 border-border text-text-muted hover:border-border-light'
                        )}
                      >
                        <span>{channel.icon}</span>
                        {channel.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">Custom Message (optional)</label>
                  <input
                    {...register('message')}
                    className="trading-input"
                    placeholder="Alert message..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Create Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 bg-surface2 hover:bg-surface3 border border-border text-text-secondary text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Active Alerts</h3>
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onDelete={handleDelete}
                onToggle={toggleAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Triggered Alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Triggered</h3>
          <div className="space-y-2">
            {triggeredAlerts.slice(0, 5).map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onDelete={handleDelete}
                onToggle={toggleAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <Bell className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No alerts configured</p>
          <p className="text-xs mt-1">Create an alert to get notified of price movements</p>
        </div>
      )}
    </div>
  )
}

function AlertItem({
  alert,
  onDelete,
  onToggle,
}: {
  alert: Alert
  onDelete: (id: string) => void
  onToggle: (id: string) => void
}) {
  const conditionLabel = ALERT_CONDITIONS.find((c) => c.value === alert.condition)?.label || alert.condition

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        alert.triggered
          ? 'bg-success/5 border-success/20'
          : alert.isActive
          ? 'bg-surface border-border'
          : 'bg-surface/50 border-border/50 opacity-60'
      )}
    >
      {/* Status icon */}
      {alert.triggered
        ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
        : <AlertCircle className={cn('w-4 h-4 flex-shrink-0', alert.isActive ? 'text-warning' : 'text-text-muted')} />
      }

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-primary">{alert.symbol}</span>
          <span className="badge-primary text-xs">{alert.exchange}</span>
          <span className="text-xs text-text-secondary">{conditionLabel}</span>
          <span className="text-xs font-mono font-bold text-text-primary">₹{alert.value}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-text-muted">{formatDate(alert.createdAt)}</span>
          {alert.channels.map((c) => (
            <span key={c} className="text-xs text-text-muted">{c === 'BROWSER' ? '🔔' : c === 'TELEGRAM' ? '📱' : '📧'}</span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!alert.triggered && (
          <button
            onClick={() => onToggle(alert.id)}
            className="text-text-muted hover:text-primary transition-colors"
            title={alert.isActive ? 'Disable alert' : 'Enable alert'}
          >
            {alert.isActive
              ? <ToggleRight className="w-5 h-5 text-primary" />
              : <ToggleLeft className="w-5 h-5" />
            }
          </button>
        )}
        <button
          onClick={() => onDelete(alert.id)}
          className="text-text-muted hover:text-danger transition-colors p-1"
          title="Delete alert"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}
