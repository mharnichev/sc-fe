import { fileURLToPath } from 'node:url'
import svgLoader from 'vite-svg-loader'

const sharedTypesPath = fileURLToPath(new URL('../../packages/shared-types/src', import.meta.url))
const sharedUtilsPath = fileURLToPath(new URL('../../packages/shared-utils/src', import.meta.url))
const sharedUiPath = fileURLToPath(new URL('../../packages/shared-ui/src', import.meta.url))

export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000/api/v1',
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
    '@shared-ui': sharedUiPath,
  },
  build: {
    transpile: ['@shared-ui'],
  },
  vite: {
    plugins: [svgLoader()],
  },
})
