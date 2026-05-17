'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api'
import { LoginCredentials, RegisterData } from '@/types/user'

export function useAuth() {
  const router = useRouter()
  const { user, token, isAuthenticated, login, logout: storeLogout, setLoading, setError } = useAuthStore()

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await authApi.login(credentials.email, credentials.password)
      return response.data
    },
    onSuccess: (data) => {
      const { access_token, refresh_token, user: userData } = data
      login(
        {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenType: 'Bearer',
          expiresIn: 3600,
        },
        userData
      )
      toast.success(`Welcome back, ${userData.fullName || userData.email}!`)
      router.push('/dashboard')
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const message = error?.response?.data?.detail || 'Login failed. Please check your credentials.'
      setError(message)
      toast.error(message)
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await authApi.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        phone: data.phone,
      })
      return response.data
    },
    onSuccess: (data) => {
      const { access_token, refresh_token, user: userData } = data
      login(
        {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenType: 'Bearer',
          expiresIn: 3600,
        },
        userData
      )
      toast.success('Account created successfully!')
      router.push('/dashboard')
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const message = error?.response?.data?.detail || 'Registration failed. Please try again.'
      setError(message)
      toast.error(message)
    },
  })

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout errors
    } finally {
      storeLogout()
      router.push('/login')
      toast.success('Logged out successfully')
    }
  }, [storeLogout, router])

  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await authApi.me()
      return response.data
    },
    enabled: !!token && isAuthenticated,
    retry: false,
    staleTime: 300000, // 5 minutes
  })

  const loginWithDemo = useCallback(() => {
    // Demo login for development
    login(
      {
        accessToken: 'demo-token',
        refreshToken: 'demo-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      },
      {
        id: 'demo-user',
        email: 'demo@tradesense.in',
        fullName: 'Demo User',
        role: 'USER',
        isActive: true,
        isEmailVerified: true,
        brokerConnected: false,
        paperBalance: 1000000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        preferences: {
          theme: 'dark',
          defaultExchange: 'NSE',
          defaultProductType: 'MIS',
          chartType: 'candlestick',
          defaultTimeframe: '1d',
          soundAlerts: true,
          desktopNotifications: true,
          emailAlerts: false,
          language: 'en',
          timezone: 'Asia/Kolkata',
        },
      }
    )
    router.push('/dashboard')
    toast.success('Demo mode activated!')
  }, [login, router])

  return {
    user: currentUser || user,
    token,
    isAuthenticated,
    isLoadingUser,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    logout,
    loginWithDemo,
    setLoading,
    setError,
  }
}
