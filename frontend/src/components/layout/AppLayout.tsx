'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAuthStore } from '@/store/authStore'
import { useWebSocket } from '@/hooks/useWebSocket'

interface AppLayoutProps {
  children: React.ReactNode
  title: string
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Initialize WebSocket connection
  useWebSocket()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Authenticating...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
