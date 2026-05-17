'use client'

import AppLayout from '@/components/layout/AppLayout'
import { Settings, Users, Activity, Database, Shield, Cpu, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import StatCard from '@/components/ui/StatCard'

const TABS = ['Overview', 'Users', 'System', 'Logs'] as const
type Tab = typeof TABS[number]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const { user } = useAuthStore()

  if (user?.role !== 'ADMIN') {
    return (
      <AppLayout title="Admin">
        <div className="flex flex-col items-center justify-center h-64 text-text-muted">
          <Shield className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm font-medium">Access Restricted</p>
          <p className="text-xs mt-1">You need admin privileges to access this page.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Admin">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-text-primary">Administration</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Users" value="1,247" change={12.5} icon={Users} iconColor="text-primary" />
              <StatCard title="Active Sessions" value="89" change={5.2} icon={Activity} iconColor="text-success" />
              <StatCard title="API Calls Today" value="45.2K" change={-2.1} icon={Database} iconColor="text-warning" />
              <StatCard title="Strategies Running" value="34" change={8.4} icon={Cpu} iconColor="text-primary" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-4">System Health</h3>
                {[
                  { service: 'Market Data Feed', status: 'Operational', uptime: '99.9%', color: 'success' },
                  { service: 'WebSocket Server', status: 'Operational', uptime: '99.8%', color: 'success' },
                  { service: 'API Gateway', status: 'Operational', uptime: '100%', color: 'success' },
                  { service: 'Database', status: 'Operational', uptime: '99.9%', color: 'success' },
                  { service: 'AI Service', status: 'Degraded', uptime: '98.2%', color: 'warning' },
                ].map((service) => (
                  <div key={service.service} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        service.color === 'success' ? 'bg-success' : 'bg-warning'
                      )} />
                      <span className="text-sm text-text-secondary">{service.service}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-muted">{service.uptime}</span>
                      <span className={cn(
                        'badge-primary text-xs',
                        service.color === 'success' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                      )}>
                        {service.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-text-primary">Recent Activity</h3>
                  <button className="text-text-muted hover:text-primary transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { action: 'New user registered', user: 'rahul@example.com', time: '2m ago', type: 'user' },
                    { action: 'Strategy started', user: 'admin@tradesense.in', time: '5m ago', type: 'strategy' },
                    { action: 'API limit exceeded', user: 'demo@tradesense.in', time: '12m ago', type: 'warning' },
                    { action: 'Backtest completed', user: 'test@example.com', time: '18m ago', type: 'system' },
                    { action: 'Alert triggered', user: 'user@test.com', time: '25m ago', type: 'alert' },
                  ].map((log, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className={cn(
                        'w-2 h-2 rounded-full mt-1 flex-shrink-0',
                        log.type === 'warning' ? 'bg-warning' :
                        log.type === 'user' ? 'bg-primary' :
                        log.type === 'alert' ? 'bg-danger' : 'bg-success'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-text-primary">{log.action}</div>
                        <div className="text-text-muted">{log.user} • {log.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Users' && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="trading-table">
              <thead>
                <tr>
                  <th className="text-left">User</th>
                  <th className="text-left">Role</th>
                  <th>Joined</th>
                  <th>Last Active</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Demo User', email: 'demo@tradesense.in', role: 'USER', joined: '2024-01-15', lastActive: '2m ago', status: 'active' },
                  { name: 'Admin User', email: 'admin@tradesense.in', role: 'ADMIN', joined: '2023-12-01', lastActive: '5m ago', status: 'active' },
                  { name: 'Rahul Sharma', email: 'rahul@example.com', role: 'PREMIUM', joined: '2024-03-20', lastActive: '1h ago', status: 'active' },
                ].map((u) => (
                  <tr key={u.email}>
                    <td className="text-left">
                      <div className="text-sm font-medium text-text-primary">{u.name}</div>
                      <div className="text-xs text-text-muted">{u.email}</div>
                    </td>
                    <td className="text-left">
                      <span className={cn(
                        'badge-primary text-xs',
                        u.role === 'ADMIN' ? 'bg-danger/10 text-danger border-danger/30' :
                        u.role === 'PREMIUM' ? 'bg-warning/10 text-warning border-warning/30' : ''
                      )}>
                        {u.role}
                      </span>
                    </td>
                    <td className="text-xs">{u.joined}</td>
                    <td className="text-xs">{u.lastActive}</td>
                    <td>
                      <span className="badge-primary bg-success/10 text-success border-success/30 text-xs">
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <button className="text-xs text-primary hover:text-primary-light transition-colors">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(activeTab === 'System' || activeTab === 'Logs') && (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <Settings className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{activeTab} panel coming soon</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
