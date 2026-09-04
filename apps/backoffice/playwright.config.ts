import { defineConfig } from '@playwright/test'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const port = Number(env.PLAYWRIGHT_PORT || 4040)
const baseURL = env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(env.CI),
  retries: env.CI ? 1 : 0,
  reporter: env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `TMPDIR=/tmp pnpm --filter @apps/backoffice exec nuxt dev --host 127.0.0.1 --port ${port}`,
    cwd: '../..',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
