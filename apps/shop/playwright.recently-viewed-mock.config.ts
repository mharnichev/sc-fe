import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: 'recently-viewed-layout.mock.spec.ts', workers: 1,
  timeout: 60_000, expect: { timeout: 10_000 }, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:6078/shop/', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'HOST=127.0.0.1 PORT=6078 NUXT_API_BASE=http://127.0.0.1:9/api/v1 NUXT_PUBLIC_API_BASE=/api/v1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6078/shop/soulcuts/sc-logo-email.png', reuseExistingServer: false, timeout: 120_000,
  },
})
