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
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
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
      headers: {
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
    head: {
      titleTemplate: '%s | Atelier Supply',
      meta: [
        { name: 'robots', content: 'noindex, nofollow, noarchive' },
        { name: 'googlebot', content: 'noindex, nofollow, noarchive' },
      ],
    },
  },
})
