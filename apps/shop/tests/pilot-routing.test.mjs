import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Shop defaults to /shop/, root browser API and private SSR upstream', () => {
  const code = read('nuxt.config.ts').replace(/declare const process: \{[\s\S]*?\n\}/, '').replace('export default defineNuxtConfig(', 'globalThis.config = defineNuxtConfig(')
  const context = { process: { env: {} }, URL, defineNuxtConfig: value => value }
  vm.runInNewContext(code.replaceAll('import.meta.url', JSON.stringify(new URL('../nuxt.config.ts', import.meta.url).href)), context)
  assert.equal(context.config.app.baseURL, '/shop/')
  assert.equal(context.config.runtimeConfig.public.apiBase, '/api/v1')
  assert.equal(context.config.runtimeConfig.public.dobrodeskEnabled, false)
  assert.ok(context.config.runtimeConfig.apiBase.startsWith('http://'))
  assert.match(read('composables/useApi.ts'), /import.meta.server \? config.apiBase : config.public.apiBase/)
})

test('static assets stay under the configured mount', () => {
  for (const baseURL of ['/shop/', '/']) {
    const context = { useRuntimeConfig: () => ({ app: { baseURL } }) }
    vm.runInNewContext(read('composables/useShopAsset.ts').replace('export const', 'globalThis.').replace('(path: string)', '(path)'), context)
    const asset = context.useShopAsset()
    assert.equal(asset('/lehko/icons/default/info.svg'), `${baseURL}lehko/icons/default/info.svg`)
    assert.equal(asset(''), '')
  }
})

test('closed pilot retains noindex and does not publish unapproved policy promises', () => {
  assert.match(read('server/routes/robots.txt.ts'), /Disallow: \/shop\//)
  assert.match(read('nuxt.config.ts'), /X-Robots-Tag/)
  const locale = read('data/locale.ts')
  assert.doesNotMatch(locale, /60 грн|80 грн|150 грн|60 днів|60 days|5 банківських|5 banking/)
  assert.match(locale, /not approved/)
})
