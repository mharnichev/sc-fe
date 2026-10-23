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
const localeUrl = dataUrl(await readFile(new URL('../utils/localeRoutes.ts', import.meta.url), 'utf8'))
const guideUrl = dataUrl(await readFile(new URL('../data/serviceGuideNames.ts', import.meta.url), 'utf8'))
const activeUrl = dataUrl(await readFile(new URL('../composables/useActiveServiceCatalog.ts', import.meta.url), 'utf8'))
const seoUrl = dataUrl((await readFile(new URL('../utils/seoRoutes.ts', import.meta.url), 'utf8'))
  .replace("'~/data/serviceGuideNames'", JSON.stringify(guideUrl))
  .replace("'~/composables/useActiveServiceCatalog'", JSON.stringify(activeUrl)))
const realSeo = await import(seoUrl)

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
  .replace("'../../utils/localeRoutes'", JSON.stringify(localeUrl))
  .replace(/import type \{[\s\S]*?\} from '\.\.\/\.\.\/utils\/seoRoutes'\n/, '')
  .replace(/import \{[\s\S]*?\} from '\.\.\/\.\.\/utils\/seoRoutes'\n/, 'const { indexablePublicMasters, indexableServiceCatalog, latestIsoTimestamp, masterSeoPath, serviceSeoPath, serviceStableId } = globalThis.__barbershopSitemapRuntimeMocks.seo\n')
  .replace("'../../data/serviceGuideNames'", JSON.stringify(guideUrl))
  .replace("'../../composables/useActiveServiceCatalog'", JSON.stringify(activeUrl))
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
  assert.match(xml, /https:\/\/soulcuts\.com\.ua\/znyzhka-dlia-zsu/)
  assert.ok(requests.every(request => request.options.timeout === 5000 && request.options.retry === 0))
  assert.match(xml, /https:\/\/soulcuts\.com\.ua\/services\/safe/)
  assert.match(xml, /https:\/\/soulcuts\.com\.ua\/masters\/safe/)
  assert.match(xml, /<loc>https:\/\/soulcuts\.com\.ua\/en\/<\/loc>/)
  assert.match(xml, /<loc>https:\/\/soulcuts\.com\.ua\/en\/services\/safe<\/loc>/)
  assert.match(xml, /<loc>https:\/\/soulcuts\.com\.ua\/en\/masters\/safe<\/loc>/)
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

test('sitemap lastmod uses the latest real API or guide edit and stays absent without modification evidence', async () => {
  const mockedSeo = runtimeMocks.seo
  runtimeMocks.seo = realSeo
  runtimeMocks.config = { public: { siteUrl: 'https://lastmod.example' }, apiUpstreamBase: 'https://api.example/v1' }
  const catalogItem = (id, name, overrides = {}) => ({
    catalog_id: `base:${id}`, base_service_id: id, source_type: 'base',
    title_uk: name, name, price: 400, duration_minutes: 30,
    barber_services: [{ id: id * 100, barber_id: 1 }], ...overrides,
  })
  const catalog = [
    catalogItem(3, 'Стрижка машинкою + стрижка бороди'),
    catalogItem(7, 'Стрижка', { updated_at: '2026-10-22T09:00:00Z' }),
    catalogItem(8, 'Укладка волосся'),
    catalogItem(10, 'Камуфляж сивини бороди', { barber_services: [{ id: 1000, barber_id: 1, updated_at: '2026-10-22T11:00:00Z' }] }),
    catalogItem(999, 'API service', { description_uk: 'API content' }),
    catalogItem(15, 'Стрижка машинкою+стрижка бороди ЗСУ', { description_uk: 'Legacy', updated_at: '2026-10-23T00:00:00Z' }),
  ]
  runtimeMocks.fetch = async (url) => {
    if (url.endsWith('/public/service-catalog')) return catalog
    if (url.endsWith('/public/masters')) return [{
      id: 1, full_name_uk: 'Майстер', photo_url: '/photo.jpg', updated_at: '2026-10-19T08:00:00Z',
      services: [
        { id: 300, base_service_id: 3, updated_at: '2026-10-20T08:00:00Z' },
        { id: 1500, base_service_id: 15, updated_at: '2026-10-23T08:00:00Z' },
      ],
    }]
    return [
      { id: 300, base_service_id: 3, updated_at: '2026-10-18T08:00:00Z' },
      { id: 301, base_service_id: 3, is_active: false, updated_at: '2026-10-23T08:00:00Z' },
      { id: 800, base_service_id: 8, updated_at: '2026-10-22T10:00:00Z' },
      { id: 801, base_service_id: 8, updated_at: 'invalid date' },
    ]
  }
  try {
    // The handler captures helpers when imported, so import a fresh binding to real SEO helpers.
    const { default: handler } = await import(dataUrl(routeSource.replace('__barbershopSitemapRuntimeMocks\n', '__barbershopSitemapRuntimeMocks\n// real SEO lastmod regression\n')))
    const xml = await handler({ headers: {} })
    const entry = path => xml.split('<url>').find(value => value.includes(`<loc>https://lastmod.example${path}</loc>`))
    assert.match(entry(realSeo.serviceSeoPath(catalog[0])), /<lastmod>2026-10-21T12:59:14\.000Z<\/lastmod>/)
    assert.match(entry(realSeo.serviceSeoPath(catalog[1])), /<lastmod>2026-10-22T09:00:00\.000Z<\/lastmod>/)
    assert.match(entry(realSeo.serviceSeoPath(catalog[2])), /<lastmod>2026-10-22T10:00:00\.000Z<\/lastmod>/)
    assert.match(entry(realSeo.serviceSeoPath(catalog[3])), /<lastmod>2026-10-22T11:00:00\.000Z<\/lastmod>/)
    assert.doesNotMatch(entry(realSeo.serviceSeoPath(catalog[4])), /<lastmod>/)
    assert.doesNotMatch(entry('/'), /<lastmod>/)
    assert.match(entry(realSeo.masterSeoPath({ id: 1, full_name_uk: 'Майстер' })), /<lastmod>2026-10-20T08:00:00\.000Z<\/lastmod>/)
    assert.doesNotMatch(xml, /zsu-15|2026-10-23/)
    const repeatedXml = await handler({ headers: {} })
    assert.equal(repeatedXml, xml)
  }
  finally {
    runtimeMocks.seo = mockedSeo
  }
})

