import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: ['qr-provider-sandbox.mock.spec.ts', 'qr-payment.mock.spec.ts', 'order-sales.mock.spec.ts', 'order-documents.mock.spec.ts', 'order-shipments.mock.spec.ts', 'order-fiscal.mock.spec.ts', 'order-returns.mock.spec.ts', 'order-ettn.mock.spec.ts', 'order-ettn-link.mock.spec.ts'], workers: 1,
  retries: 0, reporter: 'list', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:6090' },
  webServer: {
    command: 'NUXT_PUBLIC_MOCK_SHOP_BASE=http://127.0.0.1:6083 NUXT_PUBLIC_API_BASE=http://127.0.0.1:9/api/v1 NITRO_PORT=6090 NITRO_HOST=127.0.0.1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6090', reuseExistingServer: false, timeout: 120000,
  },
})
