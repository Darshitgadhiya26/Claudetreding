'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, TrendingUp, AlertCircle, ArrowRight, User, Mail, Phone, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(50, 'Full name too long'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number').optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { register: registerUser, isRegistering } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = (data: RegisterForm) => {
    registerUser({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
      phone: data.phone || undefined,
    })
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-surface via-surface2 to-background flex-col justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-success/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-text-primary">TradeSense</span>
          </div>
          <h2 className="text-3xl font-bold text-text-primary mb-4">
            Start Your Trading Journey
          </h2>
          <p className="text-text-secondary leading-relaxed mb-8">
            Join thousands of traders using TradeSense to make informed decisions in the Indian stock market.
          </p>
          <div className="space-y-3">
            {[
              { icon: '📊', text: 'Free paper trading account with ₹10L virtual capital' },
              { icon: '🤖', text: 'AI-powered market analysis and signals' },
              { icon: '📈', text: 'Backtest strategies on 5+ years of historical data' },
              { icon: '🔔', text: 'Price and indicator-based alerts' },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3 p-3 rounded-lg bg-surface2/50 border border-border">
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm text-text-secondary">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Register form */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md py-8"
        >
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-bold">TradeSense</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary mb-2">Create your account</h2>
            <p className="text-text-secondary text-sm">
              Get started with free paper trading
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  {...register('fullName')}
                  type="text"
                  className="trading-input pl-9"
                  placeholder="Rahul Sharma"
                  autoComplete="name"
                />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  {...register('email')}
                  type="email"
                  className="trading-input pl-9"
                  placeholder="rahul@example.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Mobile Number <span className="text-text-muted">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <div className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-text-muted pr-2 border-r border-border">
                  +91
                </div>
                <input
                  {...register('phone')}
                  type="tel"
                  className="trading-input pl-20"
                  placeholder="9876543210"
                  autoComplete="tel"
                />
              </div>
              {errors.phone && (
                <p className="mt-1 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="trading-input pl-9 pr-10"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
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

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="trading-input pl-9 pr-10"
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isRegistering}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-glow-primary mt-6"
            >
              {isRegistering ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:text-primary-light font-medium transition-colors">
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-text-muted">
            By creating an account, you agree to our{' '}
            <a href="#" className="underline hover:text-text-secondary">Terms</a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-text-secondary">Privacy Policy</a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
