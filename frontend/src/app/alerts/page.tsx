'use client'

import AppLayout from '@/components/layout/AppLayout'
import AlertPanel from '@/components/alerts/AlertPanel'

export default function AlertsPage() {
  return (
    <AppLayout title="Alerts">
      <div className="p-4 max-w-3xl mx-auto">
        <AlertPanel />
      </div>
    </AppLayout>
  )
}
