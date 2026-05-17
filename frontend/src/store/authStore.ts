import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthToken } from '@/types/user'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (token: AuthToken, user: User) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: (token: AuthToken, user: User) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', token.accessToken)
          localStorage.setItem('refresh_token', token.refreshToken)
        }
        set({
          token: token.accessToken,
          refreshToken: token.refreshToken,
          user,
          isAuthenticated: true,
          error: null,
        })
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      updateUser: (userData: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      setLoading: (isLoading: boolean) => set({ isLoading }),

      setError: (error: string | null) => set({ error }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
