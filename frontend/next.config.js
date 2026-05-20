/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' for Docker; Vercel ignores this and uses its own output
  output: process.env.NEXT_OUTPUT_MODE || 'standalone',

  images: {
    domains: ['localhost', 'tradesense-backend.onrender.com'],
    remotePatterns: [{ protocol: 'https', hostname: '**.onrender.com' }],
  },

  // Proxy /api/* and /ws-proxy/* to the backend so the browser never hits a
  // cross-origin URL (no CORS headache on Vercel).
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // HTTP long-poll fallback for environments where raw WebSocket is blocked
      {
        source: '/ws-proxy/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
