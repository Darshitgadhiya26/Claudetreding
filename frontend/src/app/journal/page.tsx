'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { PenLine, Plus, Star, TrendingUp, TrendingDown, BookOpen, X } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { useTradeStore } from '@/store/tradeStore'
import { JournalEntry } from '@/types/trade'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

const MOODS = [
  { value: 'GREAT', label: '😄 Great', color: 'text-success' },
  { value: 'GOOD', label: '🙂 Good', color: 'text-success/70' },
  { value: 'NEUTRAL', label: '😐 Neutral', color: 'text-text-muted' },
  { value: 'BAD', label: '😟 Bad', color: 'text-danger/70' },
  { value: 'TERRIBLE', label: '😰 Terrible', color: 'text-danger' },
] as const

interface JournalFormData {
  title: string
  symbol?: string
  notes: string
  psychology: string
  mood: 'GREAT' | 'GOOD' | 'NEUTRAL' | 'BAD' | 'TERRIBLE'
  rating: number
  lessons: string
  mistakes: string
  improvements: string
  tags: string
}

export default function JournalPage() {
  const { journalEntries, addJournalEntry, deleteJournalEntry } = useTradeStore()
  const [showForm, setShowForm] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [rating, setRating] = useState(3)
  const [mood, setMood] = useState<'GREAT' | 'GOOD' | 'NEUTRAL' | 'BAD' | 'TERRIBLE'>('NEUTRAL')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<JournalFormData>()

  const onSubmit = (data: JournalFormData) => {
    const entry: JournalEntry = {
      id: `JE-${Date.now()}`,
      date: new Date().toISOString(),
      title: data.title,
      symbol: data.symbol || undefined,
      notes: data.notes,
      psychology: data.psychology,
      mood,
      rating,
      tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      lessons: data.lessons,
      mistakes: data.mistakes,
      improvements: data.improvements,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    addJournalEntry(entry)
    reset()
    setShowForm(false)
    setRating(3)
    setMood('NEUTRAL')
    toast.success('Journal entry added!')
  }

  // Sample entries for demo
  const displayEntries = journalEntries.length > 0 ? journalEntries : [
    {
      id: 'sample-1',
      date: new Date(Date.now() - 86400000).toISOString(),
      title: 'NIFTY EMA Crossover Trade',
      symbol: 'NIFTY',
      notes: 'Traded the EMA crossover on NIFTY. 9 EMA crossed above 21 EMA on the 15-min chart. Good entry near 22,300.',
      psychology: 'Felt confident but slightly anxious about the position size.',
      mood: 'GOOD' as const,
      rating: 4,
      tags: ['EMA', 'NIFTY', 'Trend'],
      lessons: 'Wait for the EMA to clearly cross before entering.',
      mistakes: 'Entered slightly early, got stopped out initially.',
      improvements: 'Use ATR-based stop loss instead of fixed percentage.',
      pnl: 4500,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'sample-2',
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
      title: 'BANKNIFTY Options - Iron Condor',
      symbol: 'BANKNIFTY',
      notes: 'Set up an Iron Condor expecting range-bound movement. PCR was 1.2, VIX was elevated.',
      psychology: 'Overconfident. Did not account for FII activity.',
      mood: 'BAD' as const,
      rating: 2,
      tags: ['Options', 'BankNifty', 'Iron Condor'],
      lessons: 'Always check macro events before options strategies.',
      mistakes: 'Did not set up exit rules for when the position goes against.',
      improvements: 'Define max loss before entering any options strategy.',
      pnl: -2300,
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ]

  const avgRating = displayEntries.reduce((acc, e) => acc + e.rating, 0) / displayEntries.length
  const totalPnL = displayEntries.reduce((acc, e) => acc + (e.pnl || 0), 0)

  return (
    <AppLayout title="Trading Journal">
      <div className="p-4 h-[calc(100vh-3.5rem)] flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <PenLine className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-text-primary">Trading Journal</h1>
            <span className="badge-primary">{displayEntries.length} entries</span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 flex-shrink-0">
          <div className="stat-card">
            <div className="text-xs text-text-muted mb-1">Total Entries</div>
            <div className="text-xl font-bold text-text-primary">{displayEntries.length}</div>
          </div>
          <div className="stat-card">
            <div className="text-xs text-text-muted mb-1">Avg Rating</div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={cn('w-4 h-4', i < Math.round(avgRating || 0) ? 'text-warning fill-warning' : 'text-border')} />
              ))}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-xs text-text-muted mb-1">Recorded P&L</div>
            <div className={cn('text-xl font-bold font-mono', totalPnL >= 0 ? 'text-success' : 'text-danger')}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL, true)}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Entries list */}
          <div className="w-80 overflow-y-auto space-y-3 flex-shrink-0">
            {displayEntries.map((entry) => {
              const moodConfig = MOODS.find((m) => m.value === entry.mood)
              return (
                <motion.div
                  key={entry.id}
                  whileHover={{ x: 2 }}
                  onClick={() => setSelectedEntry(entry)}
                  className={cn(
                    'p-4 bg-surface border rounded-xl cursor-pointer transition-all',
                    selectedEntry?.id === entry.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-border-light'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary line-clamp-1">{entry.title}</h3>
                      {entry.symbol && (
                        <span className="text-xs text-primary">{entry.symbol}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={cn('w-3 h-3', i < entry.rating ? 'text-warning fill-warning' : 'text-border')} />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-text-muted line-clamp-2 mb-2">{entry.notes}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{moodConfig?.label}</span>
                      {entry.pnl !== undefined && (
                        <span className={cn(
                          'text-xs font-mono font-medium',
                          entry.pnl >= 0 ? 'text-success' : 'text-danger'
                        )}>
                          {entry.pnl >= 0 ? '+' : ''}{formatCurrency(entry.pnl, true)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">{formatDate(entry.date)}</span>
                  </div>

                  {entry.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-surface2 border border-border rounded text-text-muted">{tag}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Entry detail */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {selectedEntry ? (
                <motion.div
                  key={selectedEntry.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-surface border border-border rounded-xl p-6 space-y-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-text-primary">{selectedEntry.title}</h2>
                      <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
                        {selectedEntry.symbol && <span className="text-primary font-medium">{selectedEntry.symbol}</span>}
                        <span>{formatDate(selectedEntry.date)}</span>
                        <span>{MOODS.find((m) => m.value === selectedEntry.mood)?.label}</span>
                      </div>
                    </div>
                    {selectedEntry.pnl !== undefined && (
                      <div className={cn('text-xl font-bold font-mono', selectedEntry.pnl >= 0 ? 'text-success' : 'text-danger')}>
                        {selectedEntry.pnl >= 0 ? <TrendingUp className="inline w-5 h-5 mr-1" /> : <TrendingDown className="inline w-5 h-5 mr-1" />}
                        {selectedEntry.pnl >= 0 ? '+' : ''}{formatCurrency(selectedEntry.pnl)}
                      </div>
                    )}
                  </div>

                  {[
                    { label: 'Trade Notes', content: selectedEntry.notes },
                    { label: 'Psychology', content: selectedEntry.psychology },
                    { label: 'Lessons Learned', content: selectedEntry.lessons },
                    { label: 'Mistakes Made', content: selectedEntry.mistakes },
                    { label: 'Areas to Improve', content: selectedEntry.improvements },
                  ].filter(s => s.content).map((section) => (
                    <div key={section.label}>
                      <h3 className="text-sm font-semibold text-text-secondary mb-2">{section.label}</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">{section.content}</p>
                    </div>
                  ))}

                  {selectedEntry.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-text-secondary mb-2">Tags</h3>
                      <div className="flex gap-2 flex-wrap">
                        {selectedEntry.tags.map((tag) => (
                          <span key={tag} className="badge-primary text-xs">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      deleteJournalEntry(selectedEntry.id)
                      setSelectedEntry(null)
                    }}
                    className="text-xs text-danger hover:text-danger/80 transition-colors"
                  >
                    Delete Entry
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-64 text-text-muted"
                >
                  <BookOpen className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Select an entry to view details</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Add Entry Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-semibold text-text-primary">New Journal Entry</h2>
                  <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text-primary">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-text-muted mb-1">Title *</label>
                      <input {...register('title', { required: true })} className="trading-input" placeholder="Trade title or summary" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Symbol (optional)</label>
                      <input {...register('symbol')} className="trading-input" placeholder="RELIANCE" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Tags (comma separated)</label>
                      <input {...register('tags')} className="trading-input" placeholder="EMA, Trend, NSE" />
                    </div>
                  </div>

                  {/* Mood */}
                  <div>
                    <label className="block text-xs text-text-muted mb-2">Trading Mood</label>
                    <div className="flex gap-2 flex-wrap">
                      {MOODS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMood(m.value)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg border text-sm transition-colors',
                            mood === m.value
                              ? 'bg-primary/15 border-primary/40 text-primary'
                              : 'bg-surface2 border-border text-text-muted hover:border-border-light'
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="block text-xs text-text-muted mb-2">Trade Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRating(r)}
                          className="p-1"
                        >
                          <Star className={cn('w-6 h-6 transition-colors', r <= rating ? 'text-warning fill-warning' : 'text-border hover:text-warning/50')} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {[
                    { name: 'notes' as const, label: 'Trade Notes *', placeholder: 'Describe your trade setup, entry, exit...' },
                    { name: 'psychology' as const, label: 'Psychology', placeholder: 'How did you feel? Were you confident, fearful, greedy?' },
                    { name: 'lessons' as const, label: 'Lessons Learned', placeholder: 'What did you learn from this trade?' },
                    { name: 'mistakes' as const, label: 'Mistakes Made', placeholder: 'What mistakes did you make?' },
                    { name: 'improvements' as const, label: 'Areas to Improve', placeholder: 'What will you do differently next time?' },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-xs text-text-muted mb-1">{field.label}</label>
                      <textarea
                        {...register(field.name, field.name === 'notes' ? { required: true } : undefined)}
                        rows={3}
                        className="trading-input resize-none"
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg text-sm transition-colors"
                    >
                      Save Entry
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-6 py-2.5 bg-surface2 border border-border text-text-secondary rounded-lg text-sm hover:bg-surface3 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  )
}
