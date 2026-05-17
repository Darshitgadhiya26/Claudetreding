'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, User, ChevronDown, Settings, LogOut, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { cn, getMarketStatus } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useSymbolSearch } from '@/hooks/useMarketData'
import { useMarketStore } from '@/store/marketStore'

interface HeaderProps {
  title: string
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { setSelectedSymbol } = useMarketStore()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [marketStatus, setMarketStatus] = useState(getMarketStatus())
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)

  const { data: searchResults } = useSymbolSearch(searchQuery)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setCurrentTime(now)
      setMarketStatus(getMarketStatus())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol)
    setSearchQuery('')
    setShowSearchResults(false)
    router.push('/charts')
  }

  const mockNotifications = [
    { id: 1, title: 'Alert Triggered', message: 'RELIANCE crossed ₹2,500', time: '2m ago', type: 'alert' },
    { id: 2, title: 'Market Open', message: 'NSE market is now open', time: '30m ago', type: 'system' },
    { id: 3, title: 'Strategy Signal', message: 'EMA Crossover on HDFCBANK', time: '1h ago', type: 'trade' },
  ]

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 sticky top-0 z-30 gap-4">
      {/* Left: Title */}
      <h1 className="text-base font-semibold text-text-primary flex-shrink-0">{title}</h1>

      {/* Center: Search */}
      <div className="flex-1 max-w-md relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSearchResults(true)
            }}
            onFocus={() => setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            placeholder="Search symbol... (e.g. RELIANCE, NIFTY)"
            className="w-full pl-9 pr-4 py-1.5 bg-surface2 border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <AnimatePresence>
          {showSearchResults && searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute top-full mt-1 left-0 right-0 bg-surface2 border border-border rounded-lg shadow-card overflow-hidden z-50"
            >
              {searchResults.slice(0, 8).map((result: { symbol: string; exchange: string; name: string }) => (
                <button
                  key={result.symbol}
                  onClick={() => handleSymbolSelect(result.symbol)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface3 transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-text-primary">{result.symbol}</span>
                    <span className="text-xs text-text-muted ml-2">{result.name}</span>
                  </div>
                  <span className="badge-primary text-xs">{result.exchange}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Status + Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Market Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface2 rounded-lg border border-border">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              marketStatus.status === 'OPEN' ? 'bg-success animate-pulse' :
              marketStatus.status === 'PRE_OPEN' ? 'bg-warning animate-pulse' : 'bg-text-muted'
            )}
          />
          <span
            className={cn(
              'text-xs font-medium',
              marketStatus.status === 'OPEN' ? 'text-success' :
              marketStatus.status === 'PRE_OPEN' ? 'text-warning' : 'text-text-muted'
            )}
          >
            {marketStatus.label}
          </span>
        </div>

        {/* Time */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-text-muted">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{format(currentTime, 'HH:mm:ss')}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowUserMenu(false)
            }}
            className="relative w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface2 rounded-lg transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-danger rounded-full" />
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-80 bg-surface2 border border-border rounded-xl shadow-card z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">Notifications</span>
                  <button className="text-xs text-primary hover:text-primary-light">Mark all read</button>
                </div>
                <div className="divide-y divide-border max-h-80 overflow-y-auto">
                  {mockNotifications.map((notif) => (
                    <div key={notif.id} className="px-4 py-3 hover:bg-surface3 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                          notif.type === 'alert' ? 'bg-warning' :
                          notif.type === 'trade' ? 'bg-success' : 'bg-primary'
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-text-primary">{notif.title}</div>
                          <div className="text-xs text-text-secondary mt-0.5">{notif.message}</div>
                          <div className="text-xs text-text-muted mt-1">{notif.time}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu)
              setShowNotifications(false)
            }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-surface2 rounded-lg transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm text-text-primary hidden sm:block max-w-24 truncate">
              {user?.fullName?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-56 bg-surface2 border border-border rounded-xl shadow-card z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border">
                  <div className="text-sm font-medium text-text-primary">{user?.fullName}</div>
                  <div className="text-xs text-text-muted">{user?.email}</div>
                  <div className="mt-1">
                    <span className="badge-primary">{user?.role || 'USER'}</span>
                  </div>
                </div>
                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface3 transition-colors">
                    <User className="w-4 h-4" />
                    Profile
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface3 transition-colors">
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                </div>
                <div className="border-t border-border py-1">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
