import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: 'catalog-access.mock.spec.ts', workers: 1,
  reporter: 'list', outputDir: '/tmp/catalog-access-fe-playwright',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:6079' },
  webServer: {
    command: 'NUXT_PUBLIC_API_BASE=http://127.0.0.1:9/api/v1 NITRO_PORT=6079 NITRO_HOST=127.0.0.1 node .output/server/index.mjs',
    url: 'http://127.0.0.1:6079', reuseExistingServer: false, timeout: 120000,
  },
})
