declare const process: {
  env: Record<string, string | undefined>
}

const sharedTypesPath = new URL('../../packages/shared-types/src/index.ts', import.meta.url).pathname
const sharedUtilsPath = new URL('../../packages/shared-utils/src/index.ts', import.meta.url).pathname
const sharedBrandLogosPath = new URL('../../packages/shared-assets/brand-logos', import.meta.url).pathname

export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: true,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: [
    '~/assets/css/animations/reveal.css',
    '~/assets/css/main.css',
    '~/assets/css/typography.css',
  ],
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  runtimeConfig: {
    apiBase: process.env.NUXT_API_BASE || 'http://127.0.0.1:8000/api/v1',
    public: {
      dobrodeskEnabled: process.env.NUXT_PUBLIC_DOBRODESK_ENABLED === 'true',
      dobrodeskIntegrationId: process.env.NUXT_PUBLIC_DOBRODESK_INTEGRATION_ID || 'wgt_3ba0ea807f451e69170cb4bbfeb74ba0',
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api/v1',
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
    '/mock-fiscal-documents/**': { headers: { 'Referrer-Policy': 'no-referrer' } },
    '/**': {
      headers: {
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  imports: {
    dirs: ['composables', 'domain', 'stores'],
  },
  alias: {
    '@shared-types': sharedTypesPath,
    '@shared-utils': sharedUtilsPath,
  },
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/shop/',
    head: {
      titleTemplate: '%s | Atelier Supply',
      meta: [
        { name: 'robots', content: 'noindex, nofollow, noarchive' },
        { name: 'googlebot', content: 'noindex, nofollow, noarchive' },
      ],
    },
  },
})
