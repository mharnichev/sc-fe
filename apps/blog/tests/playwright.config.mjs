import { defineConfig, devices } from '../../shop/node_modules/@playwright/test/index.mjs'

export default defineConfig({
  testDir: '.',
  testMatch: '*.browser.spec.mjs',
  workers: 1,
  timeout: 45000,
  outputDir: '/tmp/blog-newsletter-browser-results',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5050', screenshot: 'only-on-failure' },
  webServer: {
    command: 'TMPDIR=/tmp pnpm --filter @apps/blog exec nuxt dev --host localhost --port 5050',
    cwd: '../../..',
    url: 'http://localhost:5050',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
