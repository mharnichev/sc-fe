import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/masterTrustCache.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { readMasterTrustCache, getMasterTrustCachedData, loadMasterTrustData, MASTER_TRUST_CACHE_TTL } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`,
)

test('switching back reuses successful data until the freshness limit', () => {
  const cached = { value: [], fetchedAt: 1000 }
  assert.equal(readMasterTrustCache(cached, false, 'initial', 1001), cached)
  assert.equal(readMasterTrustCache(cached, false, 'watch', 1000 + MASTER_TRUST_CACHE_TTL - 1), cached)
  assert.equal(readMasterTrustCache(cached, false, 'initial', 1000 + MASTER_TRUST_CACHE_TTL), undefined)
  assert.equal(readMasterTrustCache(undefined, false, 'initial', 1001), undefined)
})

test('hydration reuses the server result even after its freshness limit', () => {
  const cached = { value: { approved_review_count: 72 }, fetchedAt: 1000 }
  assert.equal(readMasterTrustCache(cached, true, 'initial', 1000 + MASTER_TRUST_CACHE_TTL), cached)
})

test('explicit refresh bypasses cache even during hydration', () => {
  const cached = { value: [], fetchedAt: 1000 }
  for (const cause of ['refresh:manual', 'refresh:hook']) {
    assert.equal(readMasterTrustCache(cached, true, cause, 1001), undefined)
  }
})

test('cache is scoped to the current Nuxt app and the requested master', () => {
  const key = 'master-rating-summary-1'
  const cached = { value: { approved_review_count: 72 }, fetchedAt: Date.now() }
  const app = { payload: { data: { [key]: cached } }, static: { data: {} }, isHydrating: false }
  assert.equal(getMasterTrustCachedData(key, app, { cause: 'initial' }), cached)
  assert.equal(getMasterTrustCachedData('master-rating-summary-2', app, { cause: 'initial' }), undefined)
  const otherApp = { payload: { data: {} }, static: { data: {} }, isHydrating: false }
  assert.equal(getMasterTrustCachedData(key, otherApp, { cause: 'initial' }), undefined)
})

const { runMasterTrustRequest } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`,
)

test('overlapping consumers and rapid remounts share one request and receive its result', async () => {
  const app = {}
  let resolve
  let calls = 0
  const load = () => {
    calls++
    return new Promise(done => { resolve = done })
  }
  const first = runMasterTrustRequest(app, 'master-1', load)
  const remounted = runMasterTrustRequest(app, 'master-1', load)
  assert.equal(first, remounted)
  await Promise.resolve()
  assert.equal(calls, 1)
  resolve({ rating: 5 })
  assert.deepEqual(await remounted, { rating: 5 })
  assert.deepEqual(await first, { rating: 5 })
})

test('failed requests can be retried and different apps never share pending data', async () => {
  const app = {}
  await assert.rejects(runMasterTrustRequest(app, 'master-1', async () => { throw new Error('offline') }))
  assert.equal(await runMasterTrustRequest(app, 'master-1', async () => 'retry'), 'retry')
  let calls = 0
  const load = async () => ++calls
  await Promise.all([
    runMasterTrustRequest(app, 'master-1', load),
    runMasterTrustRequest({}, 'master-1', load),
  ])
  assert.equal(calls, 2)
})

test('shared results retain request identity and enter the app cache only after success', async () => {
  const app = { payload: { data: {} } }
  let finish
  const first = loadMasterTrustData(app, 'master-1', () => new Promise(resolve => { finish = resolve }))
  const second = loadMasterTrustData(app, 'master-1', async () => assert.fail('duplicate request'))
  await Promise.resolve()
  assert.equal(app.payload.data['master-1'], undefined)
  finish({ rating: 5 })
  const result = await first
  assert.equal(await second, result)
  assert.equal(result.cacheKey, 'master-1')
  assert.equal(app.payload.data['master-1'], result)
  await assert.rejects(loadMasterTrustData(app, 'master-2', async () => { throw new Error('offline') }))
  assert.equal(app.payload.data['master-2'], undefined)
})
