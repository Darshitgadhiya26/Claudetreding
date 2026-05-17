'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  BarChart2,
  Cpu,
  FlaskConical,
  Grid3x3,
  Bell,
  BookOpen,
  PenLine,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  LogOut,
  User,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useMarketStore } from '@/store/marketStore'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/charts', label: 'Charts', icon: BarChart2 },
  { path: '/strategies', label: 'Strategies', icon: Cpu },
  { path: '/backtesting', label: 'Backtesting', icon: FlaskConical },
  { path: '/options', label: 'Options', icon: Grid3x3 },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/paper-trading', label: 'Paper Trading', icon: BookOpen },
  { path: '/journal', label: 'Journal', icon: PenLine },
]

const adminItems = [
  { path: '/admin', label: 'Admin', icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isConnected } = useMarketStore()

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col bg-surface border-r border-border h-screen sticky top-0 z-40 overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 border border-primary/30">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="text-base font-bold text-text-primary whitespace-nowrap"
              >
                TradeSense
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Connection status */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0',
        collapsed ? 'justify-center' : ''
      )}>
        <Circle
          className={cn('w-2 h-2 flex-shrink-0', isConnected ? 'text-success fill-success' : 'text-danger fill-danger')}
        />
        {!collapsed && (
          <span className={cn('text-xs', isConnected ? 'text-success' : 'text-danger')}>
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  'sidebar-item',
                  isActive && 'active',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="whitespace-nowrap text-sm"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          )
        })}

        {/* Divider */}
        <div className="my-2 border-t border-border" />

        {adminItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  'sidebar-item',
                  isActive && 'active',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap text-sm"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* User profile & collapse toggle */}
      <div className="flex-shrink-0 border-t border-border">
        {/* User info */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-3',
          collapsed && 'justify-center'
        )}>
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 border border-primary/30">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <div className="text-xs font-medium text-text-primary truncate">
                  {user?.fullName || 'Trader'}
                </div>
                <div className="text-xs text-text-muted truncate">{user?.email}</div>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button
              onClick={logout}
              className="text-text-muted hover:text-danger transition-colors p-1 rounded"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center justify-center h-9 text-text-muted hover:text-text-primary hover:bg-surface2 transition-colors border-t border-border',
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  )
}
