import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['availability-calendar.mock.spec.ts', 'availability-release.mock.spec.ts', 'reviews-inline-approval.mock.spec.ts'],
  workers: 1, timeout: 45000, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:6086', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'NUXT_PUBLIC_API_BASE=/api/v1 NITRO_PORT=6086 NITRO_HOST=127.0.0.1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6086', reuseExistingServer: false, timeout: 120000,
  },
})
