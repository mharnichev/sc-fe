import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
 testDir: './e2e', testMatch: ['order-shipments.mock.spec.ts'], workers: 1, reporter: 'list',
 use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:6076' },
 webServer: { command: 'NUXT_PUBLIC_API_BASE=http://127.0.0.1:9/api/v1 NITRO_PORT=6076 NITRO_HOST=127.0.0.1 node .output/server/index.mjs', url: 'http://127.0.0.1:6076', reuseExistingServer: false, timeout: 120000 }
})
