export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: true,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
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
    dirs: ['composables', 'domain', 'stores'],
  },
  alias: {
    '@shared-types': '../../packages/shared-types/src',
    '@shared-utils': '../../packages/shared-utils/src',
    '@shared-ui': '../../packages/shared-ui/src',
  },
  build: {
    transpile: ['@shared-ui'],
  },
  app: {
    head: {
      titleTemplate: '%s | Atelier Supply',
    },
  },
})
