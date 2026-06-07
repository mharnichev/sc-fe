declare const process: {
  env: Record<string, string | undefined>
}

const siteUrl = process.env.NUXT_PUBLIC_BLOG_SITE_URL || process.env.NUXT_PUBLIC_SITE_URL || 'https://soulcuts.com.ua'
const isProduction = process.env.NODE_ENV === 'production'

const contentSecurityPolicy = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src ${[
    "'self'",
    ...(isProduction ? [] : ['http://localhost:*', 'http://127.0.0.1:*', 'ws://localhost:*', 'ws://127.0.0.1:*']),
  ].join(' ')}`,
  `media-src 'self' https:`,
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
].join('; ')

const securityHeaders = {
  'Content-Security-Policy': contentSecurityPolicy,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'autoplay=()',
    'camera=()',
    'display-capture=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
  ].join(', '),
}

export default defineNuxtConfig({
  devtools: { enabled: false },
  compatibilityDate: '2026-05-08',
  ssr: true,
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  runtimeConfig: {
    public: {
      siteUrl,
    },
  },
  routeRules: {
    '/**': {
      headers: securityHeaders,
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  app: {
    head: {
      titleTemplate: '%s | Soulcuts Journal',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
