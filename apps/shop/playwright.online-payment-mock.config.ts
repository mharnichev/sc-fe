import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: ['online-payment.mock.spec.ts'], workers: 1, timeout: 45000, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:6098', trace: 'retain-on-failure' },
  webServer: { command: 'NUXT_PUBLIC_DOBRODESK_ENABLED=false NUXT_PUBLIC_API_BASE=http://127.0.0.1:9/api/v1 NITRO_PORT=6098 NITRO_HOST=127.0.0.1 node .output/server/index.mjs', url: 'http://127.0.0.1:6098', reuseExistingServer: false, timeout: 120000 },
})
