import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`
const cacheSource = await readFile(new URL('../server/utils/sitemapCache.ts', import.meta.url), 'utf8')
const cacheUrl = dataUrl(cacheSource)

const runtimeMocks = {
  seo: {
    indexablePublicMasters: value => value,
    indexableServiceCatalog: value => value,
    latestIsoTimestamp: () => undefined,
    masterSeoPath: value => value.slug === 'safe' ? '/masters/safe' : '/admin/private',
    serviceSeoPath: value => value.slug === 'safe' ? '/services/safe' : '/booking/private',
    serviceStableId: () => 1,
  },
  defineEventHandler: handler => handler,
  useRuntimeConfig: () => runtimeMocks.config,
  setHeader: (event, key, value) => { event.headers[key] = value },
  createError: options => Object.assign(new Error(options.statusMessage), options),
  $fetch: (...args) => runtimeMocks.fetch(...args),
}
globalThis.__barbershopSitemapRuntimeMocks = runtimeMocks

const routeSource = `const { defineEventHandler, useRuntimeConfig, setHeader, createError, $fetch } = globalThis.__barbershopSitemapRuntimeMocks\n${(await readFile(new URL('../server/routes/sitemap.xml.ts', import.meta.url), 'utf8'))
  .replace(/import type \{[\s\S]*?\} from '\.\.\/\.\.\/utils\/seoRoutes'\n/, '')
  .replace(/import \{[\s\S]*?\} from '\.\.\/\.\.\/utils\/seoRoutes'\n/, 'const { indexablePublicMasters, indexableServiceCatalog, latestIsoTimestamp, masterSeoPath, serviceSeoPath, serviceStableId } = globalThis.__barbershopSitemapRuntimeMocks.seo\n')
  .replace("from '../utils/sitemapCache'", `from '${cacheUrl}'`)}`
const { default: handleSitemap } = await import(dataUrl(routeSource))

test('successful sitemap uses bounded upstream requests and excludes private paths', async () => {
  runtimeMocks.config = { public: { siteUrl: 'https://soulcuts.com.ua' }, apiUpstreamBase: 'https://api.example/v1' }
  const requests = []
  runtimeMocks.fetch = async (url, options) => {
    requests.push({ url, options })
    if (url.endsWith('/public/service-catalog')) return [{ slug: 'safe', barber_services: [] }, { slug: 'private', barber_services: [] }]
    if (url.endsWith('/public/masters')) return [{ slug: 'safe', services: [] }, { slug: 'private', services: [] }]
    return []
  }
  const event = { headers: {} }
  const xml = await handleSitemap(event)
  assert.equal(requests.length, 3)
  assert.ok(requests.every(request => request.options.timeout === 5000 && request.options.retry === 0))
  assert.match(xml, /https:\/\/soulcuts\.com\.ua\/services\/safe/)
  assert.match(xml, /https:\/\/soulcuts\.com\.ua\/masters\/safe/)
  assert.doesNotMatch(xml, /\/admin\/private|\/booking\/private/)
  assert.equal(event.headers['x-sitemap-freshness'], 'fresh')
})

test('cold upstream timeout returns 502 rather than static-only XML', async () => {
  runtimeMocks.config = { public: { siteUrl: 'https://other.example' }, apiUpstreamBase: 'https://api.example/v1' }
  runtimeMocks.fetch = async () => { throw new Error('timeout') }
  const originalError = console.error
  console.error = () => {}
  try {
    await assert.rejects(handleSitemap({ headers: {} }), error => error.statusCode === 502)
  }
  finally {
    console.error = originalError
  }
})
