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
const settle = async () => { await tick(); await tick(); await tick() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const common = { authority: 'test', simulation: true, notice: 'Local carrier test' }
const line = { order_item_id: 7, product_id: 1, name: 'Item', quantity: 2 }
const actions = names => Object.fromEntries(names.flatMap(name => [[name, true], [`replay_${name}`, true]]))
const record = (mode = 'paid') => ({ ...common, id: 8, order_id: 321, revision: 1, order_revision: 6, original_shipment_id: 1, return_shipment_id: 2, tracking_number: null, provider_uuid: 'original-uuid', status: 'unknown', financial_mode: mode, shift_revision: mode === 'paid' ? 2 : null, sale_document_id: mode === 'paid' ? 12 : null, lines: [line], observation: null, receipt: null, closure: null, financial_remaining_lines: [], actions: actions(['refresh', 'reconcile', 'receive', 'close_unpaid']), blocking_reasons: [] })
const state = (mode = 'paid') => ({ ...common, order_id: 321, revision: 5, enabled: true, original_shipment_id: 1, financial_mode: mode, eligible_lines: [line], cases: [], actions: actions(['create']), blocking_reasons: [] })
const setup = async (api, storage = new Map()) => {
  const auth = vue.reactive({ user: { id: 2, can_manage_shipments: true, can_post_inventory: true } }), props = vue.reactive({ order: { id: 321, revision: 5, channel: 'shop', fulfillment_method: 'nova_poshta' } }), events = []
  Object.assign(globalThis, vue, { useAuthStore: () => auth, useApi: () => api, defineProps: () => props, defineEmits: () => (...args) => events.push(args), localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
  for (const path of ['../utils/orderSales.ts', '../composables/useOrderSalesCommand.ts', '../utils/shopCarrierReturns.ts']) Object.assign(globalThis, await importSource((await readFile(new URL(path, import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')))
  const source = (await readFile(new URL('../components/orders/OrderShopCarrierReturns.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const module = await importSource(`export function instantiate() { ${source}\nreturn { read, record, create, refresh, reconcile, receive, close, selectedId, quantities, createEvidence, createConfirmed, createValid, createCase, receiptEvidence, receiptConfirmed, goodsFit, dispositions, closeEvidence, closeConfirmed, canCreate, canCase, runCase, reload, recoveryError }; }`)
  const scope = vue.effectScope(), component = scope.run(() => module.instantiate()); await settle()
  return { component, auth, props, storage, events, stop: () => scope.stop() }
}
test('mount only reads canonical test state and rejects unverified authority', async () => {
  const calls = [], fixture = await setup(async (path, options) => { calls.push(options?.method || 'GET'); return state() }); assert.deepEqual(calls, ['GET']); fixture.stop()
  const invalid = await setup(async () => ({ ...state(), authority: 'provider' })); assert.equal(invalid.component.read.state.value, null); assert.ok(invalid.component.read.error.value); invalid.stop()
})
for (const mode of ['paid', 'unpaid_cod']) test(`${mode}: create sends strict server identities and explicit evidence; unpaid always full allocation`, async () => {
  const posts = []; let current = state(mode)
  const fixture = await setup(async (_path, options) => { if (options?.method === 'POST') { posts.push(options); current = { ...current, cases: [record(mode)] }; return record(mode) } return current })
  const c = fixture.component; c.quantities.value = { 7: 1 }; c.createEvidence.value = 'Parcel reason'; await c.createCase(); assert.equal(posts.length, 0)
  c.createConfirmed.value = true; await Promise.all([c.createCase(), c.createCase()]); assert.equal(posts.length, 1)
  assert.deepEqual(posts[0].body, { expected_revision: 5, original_shipment_id: 1, lines: [{ order_item_id: 7, quantity: mode === 'paid' ? 1 : 2 }], evidence: 'Parcel reason', confirm: true }); assert.equal(fixture.storage.size, 0); assert.equal(c.record.value.provider_uuid, 'original-uuid'); fixture.stop()
})
test('server actions block new and replay mutations despite local operator permissions', async () => {
  let posts = 0
  const fixture = await setup(async (_path, options) => { if (options?.method === 'POST') posts++; return { ...state(), actions: {}, cases: [{ ...record(), actions: {} }] } })
  const c = fixture.component; c.createEvidence.value = 'Reason'; c.quantities.value = { 7: 1 }; c.createConfirmed.value = true; await c.createCase(); await c.runCase('reconcile'); assert.equal(posts, 0); assert.equal(c.canCreate.value, false); assert.equal(c.canCase('reconcile'), false); fixture.stop()
})
test('create lost response survives reload/flagoff and replays the exact key/body before canonical hydrate', async () => {
  const storage = new Map(), posts = []; let current = state(), lost = true
  const api = async (_path, options) => { if (options?.method === 'POST') { posts.push(options); current = { ...current, enabled: false, actions: { create: false, replay_create: true }, cases: [record()] }; if (lost) { lost = false; throw new Error('Lost ACK') } return record() } return current }
  const first = await setup(api, storage); first.component.quantities.value = { 7: 1 }; first.component.createEvidence.value = 'Reason'; first.component.createConfirmed.value = true; await first.component.createCase(); assert.ok(first.component.create.intent.value); first.stop()
  const replay = await setup(api, storage); await replay.component.createCase(); assert.equal(posts.length, 2); assert.deepEqual(posts[1].body, posts[0].body); assert.equal(posts[1].headers['Idempotency-Key'], posts[0].headers['Idempotency-Key']); assert.equal(storage.size, 0); replay.stop()
})
for (const operation of ['receive', 'close_unpaid']) test(`${operation}: exact saved target recovers by ID even when canonical list excludes closed case`, async () => {
  const storage = new Map(), posts = []; let accepted = false, lost = true
  const old = record('unpaid_cod')
  const api = async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); accepted = true; if (lost) { lost = false; throw new Error('Lost ACK') } return old }
    if (path.endsWith('/8')) return { ...old, status: operation === 'receive' ? 'received' : 'closed_unpaid', actions: { [`replay_${operation}`]: true } }
    return { ...state('unpaid_cod'), cases: accepted ? [] : [old] }
  }
  const first = await setup(api, storage), c = first.component
  if (operation === 'receive') { c.dispositions.value = { 7: 'restock' }; c.receiptEvidence.value = 'Received'; c.goodsFit.value = true; c.receiptConfirmed.value = true } else { c.closeEvidence.value = 'No payment'; c.closeConfirmed.value = true }
  await c.runCase(operation); assert.ok((operation === 'receive' ? c.receive : c.close).intent.value); first.stop()
  const replay = await setup(api, storage); assert.equal(replay.component.record.value.id, 8); assert.equal(replay.component.canCase(operation), true); await replay.component.runCase(operation)
  assert.equal(posts.length, 2); assert.deepEqual(posts[1], posts[0]); assert.equal(storage.size, 0)
  if (operation === 'receive') assert.deepEqual(posts[0].body.lines, [{ order_item_id: 7, quantity: 2, disposition: 'restock' }]); else assert.deepEqual(posts[0].body, { expected_revision: 1, evidence: 'No payment', confirm: true }); replay.stop()
})
test('refresh and reconcile are deliberate commands using the original case revision and no client outcome', async () => {
  const posts = [], fixture = await setup(async (_path, options) => { if (options?.method === 'POST') { posts.push(options); return record() } return { ...state(), cases: [record()] } })
  await fixture.component.runCase('refresh'); await fixture.component.runCase('reconcile'); assert.equal(posts.length, 2); for (const post of posts) assert.deepEqual(post.body, { expected_revision: 1 }); fixture.stop()
})
test('receive requires every disposition plus fitness only for restocked goods', async () => {
  const posts = [], fixture = await setup(async (_path, options) => { if (options?.method === 'POST') { posts.push(options); return record() } return { ...state(), cases: [record()] } }), c = fixture.component
  c.receiptEvidence.value = 'Received'; c.receiptConfirmed.value = true; await c.runCase('receive'); assert.equal(posts.length, 0)
  c.dispositions.value = { 7: 'restock' }; c.receiptConfirmed.value = true; await c.runCase('receive'); assert.equal(posts.length, 0)
  c.dispositions.value = { 7: 'not_restock' }; c.receiptConfirmed.value = true; await c.runCase('receive'); assert.equal(posts.length, 1); fixture.stop()
})
for (const change of ['actor', 'permission', 'order', 'unmount']) test(`late case hydration invalidated on ${change}`, async () => {
  const wait = deferred(); let delayed = false
  const fixture = await setup(async () => { if (delayed) { delayed = false; return wait.promise } return state() }); delayed = true
  const pending = fixture.component.read.load()
  if (change === 'actor') fixture.auth.user = { ...fixture.auth.user, id: 3 }
  if (change === 'permission') fixture.auth.user.can_manage_shipments = false
  if (change === 'order') fixture.props.order.id = 999
  if (change === 'unmount') fixture.stop()
  wait.resolve({ ...state(), order_id: 321, notice: 'Old read' }); await pending; await settle()
  assert.notEqual(fixture.component.read.state.value?.notice, 'Old read'); fixture.stop()
})
test('permission revocation blocks an unknown pending command without destroying its durable intent', async () => {
  const storage = new Map(); let allowed = true, posts = 0
  const fixture = await setup(async (_path, options) => { if (options?.method === 'POST') { posts++; throw new Error('Unknown') } return { ...state(), actions: { create: allowed, replay_create: allowed } } }, storage)
  fixture.component.quantities.value = { 7: 1 }; fixture.component.createEvidence.value = 'Reason'; fixture.component.createConfirmed.value = true; await fixture.component.createCase(); assert.equal(storage.size, 1)
  allowed = false; fixture.auth.user.can_manage_shipments = false; await settle(); assert.equal(fixture.component.canCreate.value, false); await fixture.component.createCase(); assert.equal(posts, 1); assert.equal(storage.size, 1); fixture.stop()
})

test('historical carrier return observation describes no automatic stock effect, without claiming current stock is unchanged', async () => {
  const { shopCarrierStatus } = await importSource(await readFile(new URL('../utils/shopCarrierReturns.ts', import.meta.url), 'utf8'))
  assert.equal(shopCarrierStatus('returned'), 'Перевізник підтвердив повернення — сам статус не змінює склад')
  assert.equal(shopCarrierStatus('received'), 'Фізичне приймання зафіксовано окремо')
})

test('zero-total reverse selection is a definitive rejection: intent clears and revised quantities get a new key', async () => {
  const posts = []; let current = state()
  const fixture = await setup(async (_path, options) => {
    if (options?.method === 'POST') { posts.push(options); if (posts.length === 1) throw { statusCode: 409, data: { detail: { code: 'unsupported_zero_total', message: 'Selection has zero total' } } }; current = { ...current, cases: [record()] }; return record() }
    return current
  }), c = fixture.component
  c.quantities.value = { 7: 1 }; c.createEvidence.value = 'Rejected rounded quantity'; c.createConfirmed.value = true; await c.createCase()
  assert.equal(c.create.intent.value, null); assert.equal(fixture.storage.size, 0); assert.equal(c.create.busy.value, false); assert.equal(c.canCreate.value, true); assert.match(c.create.error.value, /zero total/)
  c.quantities.value = { 7: 2 }; c.createEvidence.value = 'Combined positive selection including zero-value lines'; c.createConfirmed.value = true; await c.createCase()
  assert.equal(posts.length, 2); assert.notEqual(posts[1].headers['Idempotency-Key'], posts[0].headers['Idempotency-Key']); assert.deepEqual(posts[1].body.lines, [{ order_item_id: 7, quantity: 2 }]); assert.equal(fixture.storage.size, 0)
  const { shopCarrierReason } = await importSource(await readFile(new URL('../utils/shopCarrierReturns.ts', import.meta.url), 'utf8')); assert.match(shopCarrierReason('unsupported_zero_total'), /додатною сумою/); assert.match(shopCarrierReason('unsupported_zero_total'), /нульовою вартістю/); fixture.stop()
})
