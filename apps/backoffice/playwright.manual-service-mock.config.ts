import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['manual-booking-touch.mock.spec.ts', 'manual-booking-ios-regression.mock.spec.ts'],
  outputDir: '/tmp/sc-ios-service-results',
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
  use: { baseURL: 'http://127.0.0.1:6085', isMobile: true, hasTouch: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'NUXT_PUBLIC_API_BASE=/api/v1 NITRO_PORT=6085 NITRO_HOST=127.0.0.1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6085', reuseExistingServer: false, timeout: 120000,
  },
})
