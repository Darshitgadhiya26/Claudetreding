export const NIFTY50_SYMBOLS = [
  'ADANIENT',
  'ADANIPORTS',
  'APOLLOHOSP',
  'ASIANPAINT',
  'AXISBANK',
  'BAJAJ-AUTO',
  'BAJFINANCE',
  'BAJAJFINSV',
  'BPCL',
  'BHARTIARTL',
  'BRITANNIA',
  'CIPLA',
  'COALINDIA',
  'DIVISLAB',
  'DRREDDY',
  'EICHERMOT',
  'GRASIM',
  'HCLTECH',
  'HDFCBANK',
  'HDFCLIFE',
  'HEROMOTOCO',
  'HINDALCO',
  'HINDUNILVR',
  'ICICIBANK',
  'ITC',
  'INDUSINDBK',
  'INFY',
  'JSWSTEEL',
  'KOTAKBANK',
  'LT',
  'M&M',
  'MARUTI',
  'NTPC',
  'NESTLEIND',
  'ONGC',
  'POWERGRID',
  'RELIANCE',
  'SBILIFE',
  'SBIN',
  'SUNPHARMA',
  'TCS',
  'TATACONSUM',
  'TATAMOTORS',
  'TATASTEEL',
  'TECHM',
  'TITAN',
  'ULTRACEMCO',
  'UPL',
  'WIPRO',
  'ZOMATO',
]

export const BANKNIFTY_SYMBOLS = [
  'HDFCBANK',
  'ICICIBANK',
  'KOTAKBANK',
  'AXISBANK',
  'SBIN',
  'INDUSINDBK',
  'AUBANK',
  'BANKBARODA',
  'FEDERALBNK',
  'IDFCFIRSTB',
  'PNB',
  'BANDHANBNK',
]

export const TIMEFRAMES = [
  { label: '1m', value: '1m', seconds: 60 },
  { label: '5m', value: '5m', seconds: 300 },
  { label: '15m', value: '15m', seconds: 900 },
  { label: '30m', value: '30m', seconds: 1800 },
  { label: '1h', value: '1h', seconds: 3600 },
  { label: '4h', value: '4h', seconds: 14400 },
  { label: '1D', value: '1d', seconds: 86400 },
  { label: '1W', value: '1w', seconds: 604800 },
  { label: '1M', value: '1M', seconds: 2592000 },
]

export const EXCHANGES = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'] as const

export const INDICATOR_LIST = [
  { id: 'EMA', label: 'EMA (Exponential Moving Average)', category: 'Trend', defaultParams: { period: 20 } },
  { id: 'SMA', label: 'SMA (Simple Moving Average)', category: 'Trend', defaultParams: { period: 20 } },
  { id: 'VWAP', label: 'VWAP (Volume Weighted Avg Price)', category: 'Trend', defaultParams: {} },
  { id: 'BollingerBands', label: 'Bollinger Bands', category: 'Volatility', defaultParams: { period: 20, stdDev: 2 } },
  { id: 'Supertrend', label: 'Supertrend', category: 'Trend', defaultParams: { period: 10, multiplier: 3 } },
  { id: 'RSI', label: 'RSI (Relative Strength Index)', category: 'Momentum', defaultParams: { period: 14 } },
  { id: 'MACD', label: 'MACD', category: 'Momentum', defaultParams: { fast: 12, slow: 26, signal: 9 } },
  { id: 'ATR', label: 'ATR (Average True Range)', category: 'Volatility', defaultParams: { period: 14 } },
  { id: 'Stochastic', label: 'Stochastic Oscillator', category: 'Momentum', defaultParams: { k: 14, d: 3 } },
  { id: 'Volume', label: 'Volume', category: 'Volume', defaultParams: {} },
]

export const STRATEGIES = [
  { id: 'EMA_CROSSOVER', label: 'EMA Crossover', description: 'Buy when short EMA crosses above long EMA' },
  { id: 'RSI_DIVERGENCE', label: 'RSI Divergence', description: 'Trade on RSI divergence signals' },
  { id: 'MACD_SIGNAL', label: 'MACD Signal Cross', description: 'Trade on MACD and signal line crossover' },
  { id: 'SUPERTREND', label: 'Supertrend', description: 'Follow Supertrend direction for entries' },
  { id: 'BOLLINGER_BREAKOUT', label: 'Bollinger Breakout', description: 'Trade breakouts from Bollinger Bands' },
  { id: 'VWAP_REVERSION', label: 'VWAP Reversion', description: 'Mean reversion to VWAP' },
  { id: 'OPENING_RANGE', label: 'Opening Range Breakout', description: 'Trade breakouts of 15-min opening range' },
]

export const MARKET_HOURS = {
  NSE: { open: '09:15', close: '15:30', preOpen: '09:00', postClose: '16:00' },
  BSE: { open: '09:15', close: '15:30', preOpen: '09:00', postClose: '16:00' },
  MCX: { open: '09:00', close: '23:30' },
}

export const INDICES = [
  { symbol: 'NIFTY 50', exchange: 'NSE', displayName: 'Nifty 50' },
  { symbol: 'NIFTY BANK', exchange: 'NSE', displayName: 'Bank Nifty' },
  { symbol: 'SENSEX', exchange: 'BSE', displayName: 'Sensex' },
  { symbol: 'NIFTY IT', exchange: 'NSE', displayName: 'Nifty IT' },
  { symbol: 'NIFTY MIDCAP 100', exchange: 'NSE', displayName: 'Nifty Midcap' },
  { symbol: 'INDIA VIX', exchange: 'NSE', displayName: 'India VIX' },
]

export const ALERT_CONDITIONS = [
  { value: 'PRICE_ABOVE', label: 'Price Crosses Above' },
  { value: 'PRICE_BELOW', label: 'Price Crosses Below' },
  { value: 'RSI_ABOVE', label: 'RSI Above' },
  { value: 'RSI_BELOW', label: 'RSI Below' },
  { value: 'MACD_CROSSOVER', label: 'MACD Crossover' },
  { value: 'VOLUME_SPIKE', label: 'Volume Spike' },
  { value: 'PERCENT_CHANGE', label: '% Change' },
]

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/charts', label: 'Charts', icon: 'BarChart2' },
  { path: '/strategies', label: 'Strategies', icon: 'Cpu' },
  { path: '/backtesting', label: 'Backtesting', icon: 'FlaskConical' },
  { path: '/options', label: 'Options', icon: 'Grid3x3' },
  { path: '/alerts', label: 'Alerts', icon: 'Bell' },
  { path: '/paper-trading', label: 'Paper Trading', icon: 'BookOpen' },
  { path: '/journal', label: 'Journal', icon: 'PenLine' },
  { path: '/admin', label: 'Admin', icon: 'Settings' },
]
