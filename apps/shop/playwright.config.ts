import { defineConfig, devices } from '@playwright/test'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const port = Number(env.PLAYWRIGHT_PORT || 6060)
const baseURL = env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(env.CI),
  retries: env.CI ? 1 : 0,
  reporter: env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile/,
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: `NUXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api/v1 TMPDIR=/tmp pnpm --filter @apps/shop exec nuxt dev --host localhost --port ${port}`,
    cwd: '../..',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
