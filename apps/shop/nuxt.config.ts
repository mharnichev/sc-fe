declare const process: {
  env: Record<string, string | undefined>
}

const sharedTypesPath = new URL('../../packages/shared-types/src/index.ts', import.meta.url).pathname
const sharedUtilsPath = new URL('../../packages/shared-utils/src/index.ts', import.meta.url).pathname

export default defineNuxtConfig({
  devtools: { enabled: false },
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
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
    },
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
