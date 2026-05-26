declare const process: {
  env: Record<string, string | undefined>
}

const developmentApiBase = 'http://localhost:8000/api/v1'
const productionApiBase = 'https://api.soulcuts.com.ua/api/v1'
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://soulcuts.com.ua'
const isProduction = process.env.NODE_ENV === 'production'
const defaultApiBase = isProduction ? productionApiBase : developmentApiBase

const normalizeApiBase = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) return defaultApiBase

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) {
      throw new Error('NUXT_PUBLIC_API_BASE must not be a protocol-relative URL')
    }

    return trimmed.replace(/\/+$/, '') || '/'
  }

  const url = new URL(trimmed)

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('NUXT_PUBLIC_API_BASE must use http, https, or a same-origin path')
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('NUXT_PUBLIC_API_BASE must not include credentials, query, or hash')
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

const apiBase = normalizeApiBase(process.env.NUXT_PUBLIC_API_BASE || defaultApiBase)

const originFromUrl = (value: string) => {
  try {
    return new URL(value).origin
  }
  catch {
    return ''
  }
}

const apiOrigin = originFromUrl(apiBase)
const siteOrigin = originFromUrl(siteUrl)
const uniqueSources = (...sources: string[]) => [...new Set(sources.filter(Boolean))]

const contentSecurityPolicy = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src ${uniqueSources("'self'", 'data:', 'blob:', 'https:', apiOrigin).join(' ')}`,
  `font-src 'self' data:`,
  `connect-src ${uniqueSources(
    "'self'",
    apiOrigin,
    siteOrigin,
    ...(isProduction ? [] : ['http://localhost:*', 'http://127.0.0.1:*', 'ws://localhost:*', 'ws://127.0.0.1:*']),
  ).join(' ')}`,
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
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

export default defineNuxtConfig({
  devtools: { enabled: false },
  compatibilityDate: '2026-05-08',
  ssr: true,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  runtimeConfig: {
    public: {
      apiBase,
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
  imports: {
    dirs: ['composables', 'domain'],
  },
  alias: {
    '@shared-types': '../../packages/shared-types/src',
    '@shared-utils': '../../packages/shared-utils/src',
    '@shared-ui': '../../packages/shared-ui/src/index.ts',
  },
  build: {
    transpile: ['@shared-ui'],
  },
  app: {
    head: {
      titleTemplate: '%s | Barbershop',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'format-detection', content: 'telephone=yes' },
      ],
    },
  },
})
