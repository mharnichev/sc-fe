import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const appPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const rootPackage = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'))
const nuxtConfig = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')

test('network development mode exposes Nuxt and keeps phone API calls on the same origin', () => {
  const command = appPackage.scripts['dev:network']

  assert.match(command, /nuxt dev --host 0\.0\.0\.0 --port 3000/)
  assert.match(command, /NUXT_PUBLIC_API_BASE=\/api\/v1/)
  assert.match(command, /NUXT_API_UPSTREAM_BASE=http:\/\/127\.0\.0\.1:8000\/api\/v1/)
  assert.equal(
    rootPackage.scripts['dev:barbershop:network'],
    'pnpm --filter @apps/barbershop dev:network',
  )
  assert.match(nuxtConfig, /const developmentApiBase = '\/api\/v1'/)
  assert.match(nuxtConfig, /const developmentApiUpstreamBase = 'http:\/\/127\.0\.0\.1:8000\/api\/v1'/)
  assert.match(nuxtConfig, /const defaultApiUpstreamBase = isProduction \? productionApiUpstreamBase : developmentApiUpstreamBase/)
  assert.doesNotMatch(nuxtConfig, /const developmentApiBase = 'http:\/\/localhost:8000/)
})
