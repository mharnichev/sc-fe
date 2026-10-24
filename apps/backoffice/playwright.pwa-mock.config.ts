import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: 'pwa.mock.spec.ts', workers: 1,
  reporter: 'list', outputDir: '/tmp/backoffice-pwa-results',
  use: { baseURL: 'http://127.0.0.1:6084', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'NUXT_PUBLIC_API_BASE=/api/v1 NITRO_PORT=6084 NITRO_HOST=127.0.0.1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6084', reuseExistingServer: false, timeout: 120000,
  },
})
