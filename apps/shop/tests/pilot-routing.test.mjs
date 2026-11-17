import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
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

test('Shop does not publish unapproved policy promises', () => {
  const locale = read('data/locale.ts')
  assert.doesNotMatch(locale, /60 грн|80 грн|150 грн|60 днів|60 days|5 банківських|5 banking/)
  assert.match(locale, /not approved/)
})

test('Shop canonical policy allows public pages and excludes private pages and filters', () => {
  const code = ts.transpile(read('utils/shopSeo.ts'), { module: ts.ModuleKind.CommonJS })
  const context = { exports: {}, URL }
  vm.runInNewContext(code, context)
  const origin = 'https://shop.example.test'
  const indexable = (path, query = '') =>
    context.exports.shopIndexableUrl(origin, '/shop/', path, new URLSearchParams(query))

  assert.equal(indexable('/products/fixture', 'utm_source=search'), origin + '/shop/products/fixture')
  assert.equal(indexable('/catalog', 'offset=20&category=care'), origin + '/shop/catalog?category=care&offset=20')
  assert.equal(indexable('/catalog', 'offset=1'), null)
  assert.equal(indexable('/catalog', 'q=care'), null)
  assert.equal(indexable('/checkout/recover'), null)
  assert.equal(indexable('/cabinet/orders/42'), null)
})
