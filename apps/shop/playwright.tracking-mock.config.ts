import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: ['order-tracking.mock.spec.ts', 'order-shipments.mock.spec.ts', 'order-tracking-audit.mock.spec.ts', 'order-intent.mock.spec.ts'], workers: 1, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:6077' },
  webServer: { command: 'NUXT_PUBLIC_DOBRODESK_ENABLED=false NUXT_PUBLIC_API_BASE=http://127.0.0.1:9/api/v1 NITRO_PORT=6077 NITRO_HOST=127.0.0.1 node .output/server/index.mjs', url: 'http://127.0.0.1:6077', reuseExistingServer: false, timeout: 120000 },
})
