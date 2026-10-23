import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'remaining-shop.mock.spec.ts',
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:6087/shop/', screenshot: 'only-on-failure' },
  webServer: {
    // Run after pnpm --filter @apps/shop build; production server avoids dev SSR startup.
    command: 'HOST=127.0.0.1 PORT=6087 NUXT_API_BASE=http://127.0.0.1:9/api/v1 NUXT_PUBLIC_API_BASE=/api/v1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6087/shop/soulcuts/sc-logo-email.png',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
