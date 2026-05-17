import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'TradeSense - Indian Stock Trading Platform',
    template: '%s | TradeSense',
  },
  description:
    'Advanced algorithmic trading platform for Indian stock markets. Real-time charts, option chain analysis, strategy backtesting, and AI-powered insights for NSE & BSE.',
  keywords: [
    'Indian stock market',
    'NSE',
    'BSE',
    'Nifty',
    'BankNifty',
    'algo trading',
    'options trading',
    'backtesting',
    'TradingView charts',
  ],
  authors: [{ name: 'TradeSense' }],
  creator: 'TradeSense',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://tradesense.in',
    title: 'TradeSense - Indian Stock Trading Platform',
    description: 'Advanced algorithmic trading platform for Indian stock markets',
    siteName: 'TradeSense',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradeSense',
    description: 'Advanced algorithmic trading platform for Indian stock markets',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  themeColor: '#0a0a0f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body className={`${inter.variable} font-sans bg-background text-text-primary antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
