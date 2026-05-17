'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Loader2, Sparkles, TrendingUp, Search, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { aiApi } from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: 'Analyze Nifty trend', prompt: 'Analyze the current Nifty 50 trend and key support/resistance levels' },
  { icon: Search, label: 'Bullish stocks', prompt: 'Find top bullish stocks in Nifty 50 for today based on technical analysis' },
  { icon: BarChart2, label: 'BankNifty view', prompt: 'What is your view on BankNifty for this week? Key levels to watch.' },
  { icon: Sparkles, label: 'Market sentiment', prompt: 'Analyze overall market sentiment based on FII/DII activity and VIX' },
]

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content: `Namaste! I'm TradeSense AI, your trading assistant for Indian markets. I can help you with:

**Technical Analysis** - Chart patterns, indicators, support/resistance
**Option Strategies** - Iron condors, spreads, hedging strategies
**Market Insights** - Sector rotation, FII/DII data, macro trends
**Risk Management** - Position sizing, stop-loss placement

What would you like to know today?`,
  timestamp: new Date(),
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
        isUser ? 'bg-primary/20 border border-primary/30' : 'bg-surface3 border border-border'
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-primary" />
          : <Bot className="w-3.5 h-3.5 text-success" />
        }
      </div>

      {/* Message */}
      <div className={cn(
        'max-w-[85%] rounded-xl px-4 py-3 text-sm',
        isUser
          ? 'bg-primary/15 border border-primary/20 text-text-primary ml-auto'
          : 'bg-surface2 border border-border text-text-secondary'
      )}>
        {message.isLoading ? (
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Analyzing markets...</span>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            {message.content.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-text-primary mb-1">{line.replace(/\*\*/g, '')}</p>
              }
              if (line.startsWith('•') || line.startsWith('-')) {
                return <p key={i} className="ml-2 text-text-secondary mb-0.5">{line}</p>
              }
              if (line === '') return <br key={i} />
              return <p key={i} className="mb-1">{line}</p>
            })}
          </div>
        )}
        <div className="text-xs text-text-muted mt-2">
          {message.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  )
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await aiApi.chat(content.trim())
      const aiContent = response.data.message || response.data.response

      setMessages((prev) => [
        ...prev.filter((m) => !m.isLoading),
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiContent,
          timestamp: new Date(),
        },
      ])
    } catch {
      // Mock AI response for demo
      const mockResponses = [
        `Based on the current technical setup:

**Nifty 50 Analysis:**
- Current trend: Sideways with bullish bias
- Key support: 22,200 - 22,300 zone
- Key resistance: 22,600 - 22,700 zone
- RSI (14): 58 - Mildly bullish
- MACD: Positive crossover on daily chart

**Recommendation:** Wait for breakout above 22,700 with volume confirmation before taking fresh longs. SL below 22,200.`,
        `**Top Bullish Setups Today:**

- **RELIANCE** - Cup & Handle pattern, target 2,650
- **HDFCBANK** - EMA crossover on daily, target 1,780
- **TCS** - Strong momentum, near 52-week high area
- **INFY** - FII buying visible in option chain data

Risk management: Keep position size ≤2% of capital per trade.`,
        `**BankNifty Weekly View:**

- Range: 47,500 - 49,000
- Bias: Mildly bullish if above 48,000
- PCR: 1.15 (Bullish sentiment)
- Max Pain: 48,200

**Option Strategy:** Bull Call Spread
- Buy 48,200 CE, Sell 48,700 CE
- Max profit: ₹500 × lot size
- Breakeven: 48,450`,
      ]

      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)]

      setMessages((prev) => [
        ...prev.filter((m) => !m.isLoading),
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: randomResponse,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold text-text-primary">TradeSense AI</div>
          <div className="text-xs text-success flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            Online
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 py-2 border-t border-border flex gap-2 overflow-x-auto flex-shrink-0">
        {QUICK_PROMPTS.map((prompt) => {
          const Icon = prompt.icon
          return (
            <button
              key={prompt.label}
              onClick={() => sendMessage(prompt.prompt)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface2 hover:bg-surface3 border border-border rounded-full text-xs text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Icon className="w-3 h-3" />
              {prompt.label}
            </button>
          )
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-2 bg-surface2 border border-border rounded-xl px-4 py-2 focus-within:border-primary/50 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about markets, strategies, analysis..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-7 h-7 flex items-center justify-center bg-primary hover:bg-primary-hover rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </form>
    </div>
  )
}
