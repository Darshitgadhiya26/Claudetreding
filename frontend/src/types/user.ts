export interface User {
  id: string
  email: string
  fullName: string
  phone?: string
  avatar?: string
  role: 'USER' | 'ADMIN' | 'PREMIUM'
  isActive: boolean
  isEmailVerified: boolean
  brokerConnected: boolean
  broker?: string
  paperBalance: number
  createdAt: string
  updatedAt: string
  preferences: UserPreferences
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system'
  defaultExchange: string
  defaultProductType: string
  chartType: 'candlestick' | 'bar' | 'line' | 'area'
  defaultTimeframe: string
  soundAlerts: boolean
  desktopNotifications: boolean
  telegramChatId?: string
  emailAlerts: boolean
  language: string
  timezone: string
}

export interface AuthToken {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  phone?: string
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordReset {
  token: string
  password: string
  confirmPassword: string
}

export interface BrokerCredentials {
  broker: string
  apiKey: string
  apiSecret: string
  userId?: string
  password?: string
  totpSecret?: string
}

export interface Notification {
  id: string
  type: 'ALERT' | 'TRADE' | 'SYSTEM' | 'NEWS'
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
}
