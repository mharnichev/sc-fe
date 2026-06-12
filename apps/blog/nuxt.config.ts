declare const process: {
  env: Record<string, string | undefined>
}

const siteUrl = process.env.NUXT_PUBLIC_BLOG_SITE_URL || process.env.NUXT_PUBLIC_SITE_URL || 'https://soulcuts.com.ua'
const isProduction = process.env.NODE_ENV === 'production'
const developmentApiBase = 'http://localhost:8000/api/v1'
const productionApiBase = 'https://api.soulcuts.com.ua/api/v1'
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
const uniqueSources = (...sources: string[]) => [...new Set(sources.filter(Boolean))]
const googleAnalyticsMeasurementId = 'G-YYYXH2R239'
const googleScriptSources = [
  'https://www.googletagmanager.com',
  'https://googletagmanager.com',
  'https://tagmanager.google.com',
  'https://www.google-analytics.com',
  'https://ssl.google-analytics.com',
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
]

const contentSecurityPolicy = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `script-src ${uniqueSources("'self'", "'unsafe-inline'", ...googleScriptSources).join(' ')}`,
  `script-src-elem ${uniqueSources("'self'", "'unsafe-inline'", ...googleScriptSources).join(' ')}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src ${uniqueSources("'self'", 'data:', 'blob:', 'https:', ...googleImageSources).join(' ')}`,
  `font-src 'self' data:`,
  `connect-src ${uniqueSources(
    "'self'",
    apiOrigin,
    ...googleConnectSources,
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
      apiBase,
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
      script: [
        {
          key: 'google-analytics-gtag',
          src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsMeasurementId}`,
          async: true,
        },
        {
          key: 'google-analytics-init',
          innerHTML: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsMeasurementId}', {
  send_page_view: false
});
          `.trim(),
        },
      ],
    },
  },
})
