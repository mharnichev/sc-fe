declare const process: {
  env: Record<string, string | undefined>
}

const developmentApiBase = 'http://localhost:8000/api/v1'
const productionApiUpstreamBase = 'https://api.soulcuts.com.ua/api/v1'
const productionApiBase = '/api/v1'
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
const sharedBrandLogosPath = new URL('../../packages/shared-assets/brand-logos', import.meta.url).pathname
const sharedUtilsPath = new URL('../../packages/shared-utils/src/index.ts', import.meta.url).pathname

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
const googleScriptSources = [
  'https://www.googletagmanager.com',
  'https://googletagmanager.com',
  'https://tagmanager.google.com',
  'https://www.google-analytics.com',
  'https://ssl.google-analytics.com',
  'https://tagassistant.google.com',
]
const googleImageSources = [
  'https://www.googletagmanager.com',
  'https://googletagmanager.com',
  'https://tagmanager.google.com',
  'https://www.google-analytics.com',
  'https://ssl.google-analytics.com',
  'https://stats.g.doubleclick.net',
]
const googleConnectSources = [
  'https://www.googletagmanager.com',
  'https://googletagmanager.com',
  'https://tagmanager.google.com',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://ssl.google-analytics.com',
  'https://analytics.google.com',
  'https://www.google.com',
  'https://stats.g.doubleclick.net',
  'https://tagassistant.google.com',
]

const contentSecurityPolicy = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `script-src ${uniqueSources("'self'", "'unsafe-inline'", ...googleScriptSources, 'https://static.hotjar.com', 'https://script.hotjar.com').join(' ')}`,
  `script-src-elem ${uniqueSources("'self'", "'unsafe-inline'", ...googleScriptSources, 'https://static.hotjar.com', 'https://script.hotjar.com').join(' ')}`,
  `style-src ${uniqueSources("'self'", "'unsafe-inline'", 'https://static.hotjar.com', 'https://script.hotjar.com').join(' ')}`,
  `img-src ${uniqueSources("'self'", 'data:', 'blob:', 'https:', apiOrigin, ...googleImageSources, 'https://static.hotjar.com', 'https://script.hotjar.com', 'https://survey-images.hotjar.com').join(' ')}`,
  `font-src ${uniqueSources("'self'", 'data:', 'https://script.hotjar.com').join(' ')}`,
  `connect-src ${uniqueSources(
    "'self'",
    apiOrigin,
    siteOrigin,
    ...googleConnectSources,
    'https://*.hotjar.com',
    'https://*.hotjar.io',
    'wss://*.hotjar.com',
    ...(isProduction ? [] : ['http://localhost:*', 'http://127.0.0.1:*', 'ws://localhost:*', 'ws://127.0.0.1:*']),
  ).join(' ')}`,
  `media-src 'self' https:`,
  `frame-src https://tagassistant.google.com`,
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

const immutableAssetHeaders = {
  ...securityHeaders,
  'Cache-Control': 'public, max-age=31536000, immutable',
}

const staticAssetHeaders = {
  ...securityHeaders,
  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
}

export default defineNuxtConfig({
  devtools: { enabled: false },
  compatibilityDate: '2026-05-08',
  ssr: true,
  experimental: {
    viteEnvironmentApi: true,
  },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css', '~/assets/css/typography.css'],
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  runtimeConfig: {
    apiUpstreamBase: normalizeApiBase(process.env.NUXT_API_UPSTREAM_BASE || productionApiUpstreamBase),
    public: {
      apiBase,
      siteUrl,
    },
  },
  nitro: {
    publicAssets: [
      {
        dir: sharedBrandLogosPath,
        baseURL: '/brand-logos',
        maxAge: 60 * 60 * 24 * 365,
      },
    ],
  },
  routeRules: {
    '/**': {
      headers: securityHeaders,
    },
    '/_nuxt/**': {
      headers: immutableAssetHeaders,
    },
    '/fonts/**': {
      headers: immutableAssetHeaders,
    },
    '/brand-logos/**': {
      headers: immutableAssetHeaders,
    },
    '/soulcuts-bot-qr.svg': {
      headers: staticAssetHeaders,
    },
    '/review': {
      redirect: {
        to: '/masters',
        statusCode: 302,
      },
    },
    '/review/**': {
      redirect: {
        to: '/masters',
        statusCode: 302,
      },
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
    '@shared-utils': sharedUtilsPath,
  },
  app: {
    head: {
      titleTemplate: '%s | Soul Cuts Barbershop Odesa',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'format-detection', content: 'telephone=yes' },
        { name: 'application-name', content: 'Soul Cuts' },
        { name: 'theme-color', content: '#0a0a0a' },
        { name: 'geo.region', content: 'UA-51' },
        { name: 'geo.placename', content: 'Odesa' },
      ],
    },
  },
})
