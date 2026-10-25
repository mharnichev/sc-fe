import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: ['reviews-inline-approval.mock.spec.ts', 'availability-release.mock.spec.ts'], workers: 1,
  reporter: 'list', outputDir: '/tmp/backoffice-release-20261025-results',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:6085', trace: 'retain-on-failure' },
  webServer: {
    command: 'NUXT_PUBLIC_API_BASE=/api/v1 NITRO_PORT=6085 NITRO_HOST=127.0.0.1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6085', reuseExistingServer: false, timeout: 120000,
  },
})
