declare const process: {
  env: Record<string, string | undefined>
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
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1',
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
      ],
    },
  },
})
