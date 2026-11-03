import { defineConfig } from '@playwright/test'
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const app = env.BOOKING_TEST_APP || 'backoffice'
const port = app === 'barbershop' ? 3313 : 4413
export default defineConfig({
  testDir: './e2e', testMatch: app === 'barbershop' ? 'booking-public-availability.mock.spec.ts' : 'time-blocks-physical.mock.spec.ts',
  outputDir: `test-results/booking-fixes-${app}`, fullyParallel: false, workers: 1, retries: 0, timeout: 45000,
  expect: { timeout: 10000 }, reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, locale: 'uk-UA', timezoneId: 'Europe/Kyiv', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `NUXT_API_UPSTREAM_BASE=http://127.0.0.1:19999/api/v1 NITRO_PORT=${port} HOST=127.0.0.1 node apps/${app}/.output/server/index.mjs`, cwd: '../..', url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 60000 },
})
