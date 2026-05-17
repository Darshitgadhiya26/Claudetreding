'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, TrendingUp, AlertCircle, ArrowRight, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

const features = [
  'Real-time NSE & BSE market data',
  'Advanced charting with 20+ indicators',
  'Options chain & Greeks analysis',
  'AI-powered trading insights',
  'Strategy backtesting engine',
]

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoggingIn, loginWithDemo } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginForm) => {
    login(data)
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-surface via-surface2 to-background flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-success/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-text-primary">TradeSense</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold text-text-primary mb-4 leading-tight">
              Trade Smarter with{' '}
              <span className="text-primary">AI-Powered</span>{' '}
              Insights
            </h1>
            <p className="text-text-secondary text-lg mb-10">
              Professional-grade tools for Indian stock market traders. From Nifty to BankNifty, we have got you covered.
            </p>

            <div className="space-y-4">
              {features.map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-success" />
                  </div>
                  <span className="text-text-secondary text-sm">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-10 grid grid-cols-3 gap-4"
        >
          {[
            { label: 'Active Traders', value: '12,500+' },
            { label: 'Daily Volume', value: '₹450Cr+' },
            { label: 'Win Rate', value: '68%' },
          ].map((stat) => (
            <div key={stat.label} className="stat-card text-center">
              <div className="text-xl font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-text-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-bold">TradeSense</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome back</h2>
            <p className="text-text-secondary text-sm">
              Sign in to your trading account
            </p>
          </div>

          {/* Demo login button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={loginWithDemo}
            className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-primary text-sm font-medium transition-all duration-200"
          >
            <Zap className="w-4 h-4" />
            Try Demo Account
          </motion.button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-background text-text-muted">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                className="trading-input"
                placeholder="you@example.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-secondary">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:text-primary-light transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="trading-input pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isLoggingIn}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-glow-primary"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:text-primary-light font-medium transition-colors">
              Create account
            </Link>
          </p>

          <p className="mt-6 text-center text-xs text-text-muted">
            By signing in, you agree to our{' '}
            <a href="#" className="underline hover:text-text-secondary">Terms of Service</a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-text-secondary">Privacy Policy</a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
