import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
let sequence = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}#${sequence++}`)
const tick = () => new Promise(resolve => setImmediate(resolve))
const fixture = () => ({ observed_at: '2026-10-19T09:00:00Z', counts: { fiscal_unknown: 2, pending_order: 3 }, total: 5, truncated: false,
  background_process: { role: 'owner', state: 'running', last_error_code: null, scheduler_names: ['sms_queue', 'review_scheduler'] } })
const setup = async (api, authenticated = true) => {
  const auth = vue.reactive({ user: authenticated ? { id: 1 } : null, accessToken: authenticated ? 'fixture-only' : '', sessionRevision: 1 })
  let unmount
  Object.assign(globalThis, vue, { useAuthStore: () => auth, useApi: options => { assert.equal(options.refreshOnUnauthorized, false); return api }, onBeforeUnmount: fn => { unmount = fn } })
  const file = await readFile(new URL('../pages/orders/operations-watch.vue', import.meta.url), 'utf8')
  const source = file.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replaceAll('import.meta.client', 'true')
  const module = await importSource(`export function instantiate() { ${source}\nreturn { refresh, snapshot, loading, error, counts }; }`)
  const scope = vue.effectScope(), page = scope.run(() => module.instantiate())
  await tick()
  return { page, auth, stop: () => { unmount(); scope.stop() } }
}

test('watch mount and explicit refresh use only the confirmed GET route; no polling', async () => {
  const calls = [], state = await setup(async (path, options) => { calls.push({ path, ...options }); return fixture() })
  assert.equal(state.page.snapshot.value.background_process.role, 'owner')
  assert.deepEqual(state.page.snapshot.value.background_process.scheduler_names, fixture().background_process.scheduler_names)
  assert.deepEqual(state.page.counts.value, [['fiscal_unknown', 2], ['pending_order', 3]])
  await tick(); assert.equal(calls.length, 1)
  await state.page.refresh(); assert.equal(calls.length, 2)
  assert.ok(calls.every(call => call.path === '/backoffice/shop-operations-watch' && call.method === 'GET' && call.retry === 0))
  state.stop()
})

test('unauthenticated page cannot issue requests even via explicit refresh', async () => {
  let calls = 0
  const state = await setup(async () => { calls++; return fixture() }, false)
  await state.page.refresh(); assert.equal(calls, 0); assert.equal(state.page.snapshot.value, null); state.stop()
})

for (const status of [401, 403, 503]) test(`HTTP ${status} discards old proof and renders an error without another action`, async () => {
  let calls = 0
  const state = await setup(async () => { if (++calls > 1) throw { statusCode: status }; return fixture() })
  await state.page.refresh()
  assert.equal(state.page.snapshot.value, null); assert.notEqual(state.page.error.value, ''); assert.equal(calls, 2); state.stop()
})

test('omitted scheduler names remain distinct from an explicitly empty list', async () => {
  const value = fixture(); delete value.background_process.scheduler_names
  const state = await setup(async () => value)
  assert.equal(state.page.snapshot.value.background_process.scheduler_names, undefined)
  value.background_process.scheduler_names = []; await state.page.refresh()
  assert.deepEqual(state.page.snapshot.value.background_process.scheduler_names, []); state.stop()
})

for (const transition of ['actor', 'token', 'unmount']) test(`late read cannot expose previous proof after ${transition}`, async () => {
  let resolve
  const pending = new Promise(done => { resolve = done })
  const state = await setup(() => pending)
  if (transition === 'actor') { state.auth.user = null; state.auth.accessToken = ''; state.auth.sessionRevision++ }
  if (transition === 'token') { state.auth.accessToken = ''; state.auth.sessionRevision++ }
  if (transition === 'unmount') state.stop()
  resolve(fixture()); await tick()
  assert.equal(state.page.snapshot.value, null)
  if (transition !== 'unmount') state.stop()
})
