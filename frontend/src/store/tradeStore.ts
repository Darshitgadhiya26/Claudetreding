import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Order, Position, Trade, Alert, JournalEntry, Strategy } from '@/types/trade'

interface TradeState {
  // Paper Trading
  paperBalance: number
  paperPositions: Position[]
  paperOrders: Order[]
  paperTrades: Trade[]

  // Real Trading
  positions: Position[]
  orders: Order[]
  trades: Trade[]

  // Strategies
  strategies: Strategy[]

  // Alerts
  alerts: Alert[]

  // Journal
  journalEntries: JournalEntry[]

  // Paper Trading Actions
  setPaperBalance: (balance: number) => void
  addPaperOrder: (order: Order) => void
  updatePaperOrder: (id: string, data: Partial<Order>) => void
  addPaperPosition: (position: Position) => void
  updatePaperPosition: (id: string, data: Partial<Position>) => void
  closePaperPosition: (id: string) => void
  addPaperTrade: (trade: Trade) => void

  // Real Trading Actions
  setPositions: (positions: Position[]) => void
  setOrders: (orders: Order[]) => void
  setTrades: (trades: Trade[]) => void
  updatePosition: (id: string, data: Partial<Position>) => void
  addOrder: (order: Order) => void
  updateOrder: (id: string, data: Partial<Order>) => void

  // Strategy Actions
  setStrategies: (strategies: Strategy[]) => void
  addStrategy: (strategy: Strategy) => void
  updateStrategy: (id: string, data: Partial<Strategy>) => void
  deleteStrategy: (id: string) => void
  toggleStrategy: (id: string) => void

  // Alert Actions
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  updateAlert: (id: string, data: Partial<Alert>) => void
  deleteAlert: (id: string) => void
  toggleAlert: (id: string) => void

  // Journal Actions
  setJournalEntries: (entries: JournalEntry[]) => void
  addJournalEntry: (entry: JournalEntry) => void
  updateJournalEntry: (id: string, data: Partial<JournalEntry>) => void
  deleteJournalEntry: (id: string) => void

  // Computed
  getTotalPnl: () => number
  getPaperPnl: () => number
}

export const useTradeStore = create<TradeState>()(
  persist(
    (set, get) => ({
      paperBalance: 1000000, // 10 Lakhs default
      paperPositions: [],
      paperOrders: [],
      paperTrades: [],
      positions: [],
      orders: [],
      trades: [],
      strategies: [],
      alerts: [],
      journalEntries: [],

      // Paper Trading
      setPaperBalance: (balance) => set({ paperBalance: balance }),

      addPaperOrder: (order) =>
        set((state) => ({ paperOrders: [order, ...state.paperOrders] })),

      updatePaperOrder: (id, data) =>
        set((state) => ({
          paperOrders: state.paperOrders.map((o) =>
            o.id === id ? { ...o, ...data } : o
          ),
        })),

      addPaperPosition: (position) =>
        set((state) => ({ paperPositions: [position, ...state.paperPositions] })),

      updatePaperPosition: (id, data) =>
        set((state) => ({
          paperPositions: state.paperPositions.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        })),

      closePaperPosition: (id) =>
        set((state) => ({
          paperPositions: state.paperPositions.filter((p) => p.id !== id),
        })),

      addPaperTrade: (trade) =>
        set((state) => ({ paperTrades: [trade, ...state.paperTrades] })),

      // Real Trading
      setPositions: (positions) => set({ positions }),

      setOrders: (orders) => set({ orders }),

      setTrades: (trades) => set({ trades }),

      updatePosition: (id, data) =>
        set((state) => ({
          positions: state.positions.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        })),

      addOrder: (order) =>
        set((state) => ({ orders: [order, ...state.orders] })),

      updateOrder: (id, data) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, ...data } : o
          ),
        })),

      // Strategies
      setStrategies: (strategies) => set({ strategies }),

      addStrategy: (strategy) =>
        set((state) => ({ strategies: [strategy, ...state.strategies] })),

      updateStrategy: (id, data) =>
        set((state) => ({
          strategies: state.strategies.map((s) =>
            s.id === id ? { ...s, ...data } : s
          ),
        })),

      deleteStrategy: (id) =>
        set((state) => ({
          strategies: state.strategies.filter((s) => s.id !== id),
        })),

      toggleStrategy: (id) =>
        set((state) => ({
          strategies: state.strategies.map((s) =>
            s.id === id ? { ...s, isActive: !s.isActive } : s
          ),
        })),

      // Alerts
      setAlerts: (alerts) => set({ alerts }),

      addAlert: (alert) =>
        set((state) => ({ alerts: [alert, ...state.alerts] })),

      updateAlert: (id, data) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, ...data } : a
          ),
        })),

      deleteAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        })),

      toggleAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive } : a
          ),
        })),

      // Journal
      setJournalEntries: (entries) => set({ journalEntries: entries }),

      addJournalEntry: (entry) =>
        set((state) => ({ journalEntries: [entry, ...state.journalEntries] })),

      updateJournalEntry: (id, data) =>
        set((state) => ({
          journalEntries: state.journalEntries.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        })),

      deleteJournalEntry: (id) =>
        set((state) => ({
          journalEntries: state.journalEntries.filter((e) => e.id !== id),
        })),

      // Computed
      getTotalPnl: () => {
        const { positions } = get()
        return positions.reduce((acc, pos) => acc + pos.pnl, 0)
      },

      getPaperPnl: () => {
        const { paperPositions } = get()
        return paperPositions.reduce((acc, pos) => acc + pos.pnl, 0)
      },
    }),
    {
      name: 'trade-store',
      partialize: (state) => ({
        paperBalance: state.paperBalance,
        paperPositions: state.paperPositions,
        paperOrders: state.paperOrders,
        paperTrades: state.paperTrades,
        strategies: state.strategies,
        alerts: state.alerts,
        journalEntries: state.journalEntries,
      }),
    }
  )
)
