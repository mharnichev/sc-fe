import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../server/utils/sitemapCache.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { createSitemapCache, SITEMAP_FRESH_MS, SITEMAP_MAX_STALE_MS, SITEMAP_UPSTREAM_TIMEOUT_MS } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`,
)

const xml = '<?xml version="1.0"?><urlset></urlset>'

test('shares a refresh, serves fresh snapshots, and isolates configuration keys', async () => {
  let now = 1000
  let calls = 0
  let complete
  const cache = createSitemapCache(() => now)
  const build = () => {
    calls++
    return new Promise(resolve => { complete = resolve })
  }
  const first = cache('site-a|api-a', build)
  const second = cache('site-a|api-a', build)
  await Promise.resolve()
  assert.equal(calls, 1)
  complete(xml)
  assert.equal((await first).freshness, 'fresh')
  assert.equal((await second).xml, xml)
  assert.equal((await cache('site-a|api-a', build)).freshness, 'fresh')
  assert.equal(calls, 1)
  assert.equal((await cache('site-b|api-a', async () => xml)).freshness, 'fresh')
  assert.equal((await cache('site-a|api-b', async () => xml)).freshness, 'fresh')
  now += SITEMAP_FRESH_MS
  assert.equal((await cache('site-a|api-a', async () => xml)).freshness, 'fresh')
})

test('serves bounded last-known-good after failed refresh, then fails after expiry', async () => {
  let now = 1000
  const cache = createSitemapCache(() => now)
  await cache('site', async () => xml)
  now += SITEMAP_FRESH_MS
  const fallback = await cache('site', async () => { throw new Error('upstream timed out') })
  assert.equal(fallback.freshness, 'stale')
  assert.equal(fallback.xml, xml)
  assert.match(String(fallback.error), /timed out/)
  now = 1000 + SITEMAP_MAX_STALE_MS + 1
  await assert.rejects(cache('site', async () => { throw new Error('upstream timed out') }), /timed out/)
})

test('cold failure and invalid XML never turn into successful static-only sitemaps', async () => {
  const cache = createSitemapCache()
  await assert.rejects(cache('site', async () => { throw new Error('upstream timed out') }), /timed out/)
  await assert.rejects(cache('site', async () => '<urlset>'), /invalid XML/)
  assert.equal(SITEMAP_UPSTREAM_TIMEOUT_MS, 5000)
})

