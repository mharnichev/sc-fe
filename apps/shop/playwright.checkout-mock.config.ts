import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  testMatch: ['shop-checkout.mock.spec.ts', 'order-intent.mock.spec.ts', 'cart-checkout/nova-directory.spec.ts'],
  workers: 1, timeout: 45000, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:6097', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'NUXT_PUBLIC_DOBRODESK_ENABLED=false NUXT_PUBLIC_API_BASE=http://127.0.0.1:9/api/v1 NITRO_PORT=6097 NITRO_HOST=127.0.0.1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6097', reuseExistingServer: false, timeout: 120000,
  },
})
