'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a24',
              color: '#e2e8f0',
              border: '1px solid #2a2a3a',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#1a1a24',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#1a1a24',
              },
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
