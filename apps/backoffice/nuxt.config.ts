import svgLoader from 'vite-svg-loader'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const apiBase = env.NUXT_PUBLIC_API_BASE || '/api/v1'
const sharedTypesPath = new URL('../../packages/shared-types/src/index.ts', import.meta.url).pathname
const sharedUtilsPath = new URL('../../packages/shared-utils/src/index.ts', import.meta.url).pathname

export default defineNuxtConfig({
  compatibilityDate: '2026-07-28',
  ssr: false,
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Soul Cuts Backoffice',
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [
        { name: 'theme-color', content: '#171717' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Soul Cuts' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icons/icon-192.png' },
      ],
    },
  },
  experimental: {
    viteEnvironmentApi: true,
  },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css', '~/assets/css/typography.css'],
  runtimeConfig: {
    public: {
      apiBase,
      mockShopBase: env.NUXT_PUBLIC_MOCK_SHOP_BASE || 'http://127.0.0.1:6060',
    },
  },
  nitro: {
    devProxy: {
      '/api/v1': {
        target: env.NUXT_DEV_API_TARGET || 'http://127.0.0.1:8000/api/v1',
        changeOrigin: true,
      },
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
