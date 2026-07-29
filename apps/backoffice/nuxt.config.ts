import svgLoader from 'vite-svg-loader'

const apiBase =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NUXT_PUBLIC_API_BASE
  || 'http://127.0.0.1:8000/api/v1'
const sharedTypesPath = new URL('../../packages/shared-types/src/index.ts', import.meta.url).pathname
const sharedUtilsPath = new URL('../../packages/shared-utils/src/index.ts', import.meta.url).pathname

export default defineNuxtConfig({
  compatibilityDate: '2026-07-28',
  ssr: false,
  devtools: { enabled: false },
  experimental: {
    viteEnvironmentApi: true,
  },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css', '~/assets/css/typography.css'],
  runtimeConfig: {
    public: {
      apiBase,
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  imports: {
    dirs: ['composables', 'stores'],
  },
  alias: {
    '@shared-types': sharedTypesPath,
    '@shared-utils': sharedUtilsPath,
  },
  vite: {
    plugins: [svgLoader()],
  },
})
