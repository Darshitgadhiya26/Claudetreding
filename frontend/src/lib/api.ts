import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - attach JWT
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          })
          const { access_token } = response.data
          localStorage.setItem('access_token', access_token)
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        }
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { fullName: string; email: string; password: string; phone?: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
}

// Market Data API
export const marketApi = {
  getQuote: (symbol: string, exchange = 'NSE') =>
    api.get(`/market/quote/${symbol}?exchange=${exchange}`),
  getMultipleQuotes: (symbols: string[]) =>
    api.post('/market/quotes', { symbols }),
  getCandles: (symbol: string, timeframe: string, from?: number, to?: number) =>
    api.get(`/market/candles/${symbol}?timeframe=${timeframe}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`),
  getMarketBreadth: () =>
    api.get('/market/breadth'),
  getTopMovers: (type: 'gainers' | 'losers', exchange = 'NSE', limit = 10) =>
    api.get(`/market/movers?type=${type}&exchange=${exchange}&limit=${limit}`),
  getOptionChain: (symbol: string, expiry?: string) =>
    api.get(`/market/option-chain/${symbol}${expiry ? `?expiry=${expiry}` : ''}`),
  searchSymbols: (query: string, exchange?: string) =>
    api.get(`/market/search?q=${query}${exchange ? `&exchange=${exchange}` : ''}`),
  getIndices: () =>
    api.get('/market/indices'),
  getSectors: () =>
    api.get('/market/sectors'),
}

// Trading API
export const tradingApi = {
  placeOrder: (order: Record<string, unknown>) =>
    api.post('/trading/orders', order),
  getOrders: (params?: Record<string, unknown>) =>
    api.get('/trading/orders', { params }),
  cancelOrder: (orderId: string) =>
    api.delete(`/trading/orders/${orderId}`),
  getPositions: () =>
    api.get('/trading/positions'),
  closePosition: (positionId: string) =>
    api.post(`/trading/positions/${positionId}/close`),
  getTrades: (params?: Record<string, unknown>) =>
    api.get('/trading/trades', { params }),
  getPnl: () =>
    api.get('/trading/pnl'),
}

// Paper Trading API
export const paperTradingApi = {
  getBalance: () =>
    api.get('/paper-trading/balance'),
  placeOrder: (order: Record<string, unknown>) =>
    api.post('/paper-trading/orders', order),
  getOrders: () =>
    api.get('/paper-trading/orders'),
  getPositions: () =>
    api.get('/paper-trading/positions'),
  closePosition: (positionId: string) =>
    api.post(`/paper-trading/positions/${positionId}/close`),
  resetAccount: () =>
    api.post('/paper-trading/reset'),
}

// Strategy API
export const strategyApi = {
  getStrategies: () =>
    api.get('/strategies'),
  getStrategy: (id: string) =>
    api.get(`/strategies/${id}`),
  createStrategy: (data: Record<string, unknown>) =>
    api.post('/strategies', data),
  updateStrategy: (id: string, data: Record<string, unknown>) =>
    api.put(`/strategies/${id}`, data),
  deleteStrategy: (id: string) =>
    api.delete(`/strategies/${id}`),
  toggleStrategy: (id: string, isActive: boolean) =>
    api.patch(`/strategies/${id}/toggle`, { is_active: isActive }),
}

// Backtesting API
export const backtestApi = {
  runBacktest: (data: Record<string, unknown>) =>
    api.post('/backtesting/run', data),
  getResults: (id: string) =>
    api.get(`/backtesting/results/${id}`),
  getHistory: () =>
    api.get('/backtesting/history'),
  deleteResult: (id: string) =>
    api.delete(`/backtesting/results/${id}`),
}

// Alert API
export const alertApi = {
  getAlerts: () =>
    api.get('/alerts'),
  createAlert: (data: Record<string, unknown>) =>
    api.post('/alerts', data),
  updateAlert: (id: string, data: Record<string, unknown>) =>
    api.put(`/alerts/${id}`, data),
  deleteAlert: (id: string) =>
    api.delete(`/alerts/${id}`),
  toggleAlert: (id: string, isActive: boolean) =>
    api.patch(`/alerts/${id}/toggle`, { is_active: isActive }),
}

// Journal API
export const journalApi = {
  getEntries: () =>
    api.get('/journal'),
  getEntry: (id: string) =>
    api.get(`/journal/${id}`),
  createEntry: (data: Record<string, unknown>) =>
    api.post('/journal', data),
  updateEntry: (id: string, data: Record<string, unknown>) =>
    api.put(`/journal/${id}`, data),
  deleteEntry: (id: string) =>
    api.delete(`/journal/${id}`),
}

// AI API
export const aiApi = {
  chat: (message: string, context?: Record<string, unknown>) =>
    api.post('/ai/chat', { message, context }),
  analyzeSymbol: (symbol: string) =>
    api.post('/ai/analyze', { symbol }),
  getInsights: () =>
    api.get('/ai/insights'),
}

export default api
