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
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
const snapshot = (id = 321, revision = 1, stage = 'reserved') => ({ order_id: id, revision, order: { id, channel: 'shop', revision, total_amount: '123.45' }, stage, authority: 'none', payment: null, fulfillment: null, completion: null, available_payment_methods: ['cash', 'card', 'bank_transfer'], blocking_reasons: [], actions: { record_manual_payment: stage === 'reserved', record_provider_payment: stage === 'reserved', handover: stage === 'paid', complete: stage === 'dispatched', replay_manual_payment: true, replay_provider_payment: true, replay_handover: true, replay_complete: true } })
const setup = async ({ api, storage = new Map(), actor = 1, id = 321 } = {}) => {
  const auth = vue.reactive({ user: { id: actor, can_record_sales: true } }), props = vue.reactive({ order: { id, channel: 'shop', revision: 1 } }), events = []
  const utilities = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, utilities, { useAuthStore: () => auth, useApi: () => api || (async () => snapshot()), defineProps: () => props, defineEmits: () => (...args) => events.push(args), useBookingFormatting: () => ({ formatMoney: String, formatDateTime: String }), localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
  const commandSource = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(commandSource))
  const source = (await readFile(new URL('../components/orders/OrderShopOperations.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const module = await importSource('export function instantiate() {\n' + source + '\nreturn { state, readError, loading, source, method, externalReference, manualEvidence, providerReference, handoverEvidence, completionEvidence, manualConfirmed, providerConfirmed, handoverConfirmed, completionConfirmed, manual, provider, handover, complete, send, canRun, testAuthority };\n}')
  const component = scope.run(() => module.instantiate())
  await tick()
  return { component, auth, props, storage, events, stop: () => scope.stop() }
}
const fillManual = component => { component.externalReference.value = 'BANK-REFERENCE'; component.manualEvidence.value = 'Staff verified bank statement'; component.manualConfirmed.value = true }

test('mount only reads capabilities and unavailable or failed state cannot send', async () => {
  const calls = []
  const state = await setup({ api: async (_path, options) => { calls.push(options?.method || 'GET'); const data = snapshot(); data.actions = {}; data.blocking_reasons = ['shop_operations_disabled']; return data } })
  fillManual(state.component); await state.component.send('manual_payment')
  assert.deepEqual(calls, ['GET']); assert.equal(state.component.canRun('manual_payment'), false)
  state.stop()
  const failed = await setup({ api: async () => { throw new Error('unavailable') } })
  assert.equal(failed.component.state.value, null); assert.equal(failed.component.canRun('provider_payment'), false)
  assert.notEqual(failed.component.readError.value, ''); failed.stop()
})

test('manual evidence and provider reference use separate strict command bodies', async () => {
  for (const operation of ['manual_payment', 'provider_payment']) {
    const posts = []; let current = snapshot()
    const state = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts.push(options); current = snapshot(321, 2, 'paid') } return current } })
    if (operation === 'manual_payment') fillManual(state.component)
    else { state.component.source.value = 'provider'; state.component.providerReference.value = 'PROVIDER-REFERENCE'; state.component.providerConfirmed.value = true }
    await state.component.send(operation)
    assert.equal(posts.length, 1); assert.equal(posts[0].retry, 0); assert.ok(posts[0].headers['Idempotency-Key'])
    assert.deepEqual(posts[0].body, operation === 'manual_payment' ? { expected_revision: 1, amount_minor: 12345, currency: 'UAH', method: 'bank_transfer', external_reference: 'BANK-REFERENCE', evidence: 'Staff verified bank statement' } : { expected_revision: 1, reference: 'PROVIDER-REFERENCE' })
    assert.equal(state.component.state.value.stage, 'paid'); assert.equal(state.storage.size, 0)
    assert.deepEqual(state.events, [['changed']]); state.stop()
  }
})

test('a lost accepted payment replays its exact key/body after reload and reads canonical state instead of stale ACK', async () => {
  const storage = new Map(), posts = []; let current = snapshot(), accepted
  const api = async (_path, options) => {
    if (options?.method !== 'POST') return current
    posts.push(options)
    if (!accepted) { accepted = snapshot(321, 2, 'paid'); current = snapshot(321, 3, 'dispatched'); throw new Error('lost response after commit') }
    return accepted
  }
  const first = await setup({ api, storage }); fillManual(first.component); await first.component.send('manual_payment'); first.stop()
  assert.equal(storage.size, 1)
  const second = await setup({ api, storage }); assert.equal(second.component.canRun('manual_payment'), true)
  assert.equal(second.component.externalReference.value, posts[0].body.external_reference)
  assert.equal(second.component.manualEvidence.value, posts[0].body.evidence)
  await second.component.send('manual_payment')
  assert.deepEqual(posts[1], posts[0]); assert.equal(second.component.state.value.stage, 'dispatched'); assert.equal(storage.size, 0)
  second.stop()
})

test('an accepted acknowledgement with a failed canonical read retains recovery and performs no duplicate POST', async () => {
  const storage = new Map(); let posts = 0, readsFail = false, current = snapshot()
  const api = async (_path, options) => {
    if (options?.method === 'POST') { posts++; current = snapshot(321, 2, 'paid'); readsFail = true; return current }
    if (readsFail) throw new Error('read failed')
    return current
  }
  const first = await setup({ api, storage }); fillManual(first.component); await first.component.send('manual_payment'); first.stop()
  assert.equal(JSON.parse([...storage.values()][0]).resultId, 321)
  readsFail = false
  const second = await setup({ api, storage }); await second.component.send('manual_payment')
  assert.equal(posts, 1); assert.equal(storage.size, 0); assert.equal(second.component.state.value.stage, 'paid'); second.stop()
})

for (const status of [409, 503]) test(`known business ${status} ${status === 409 ? 'releases rejected' : 'preserves uncertain'} exact intent`, async () => {
  const state = await setup({ api: async (_path, options) => {
    if (options?.method === 'POST') throw { response: { status }, data: { detail: { code: status === 409 ? 'provider_proof_invalid' : 'shop_operations_disabled', message: 'Not accepted' } } }
    return snapshot()
  } })
  state.component.providerReference.value = 'REF'; state.component.providerConfirmed.value = true
  await state.component.send('provider_payment')
  assert.equal(state.storage.size, status === 409 ? 0 : 1)
  assert.equal(!!state.component.provider.intent.value, status === 503); state.stop()
})

for (const change of ['actor', 'order', 'unmount']) test(`late accepted response cannot clear or overwrite another ${change} context`, async () => {
  const response = deferred(), storage = new Map(); let writes = 0
  const state = await setup({ storage, api: async (path, options) => { if (options?.method === 'POST') { writes++; return response.promise } return snapshot(path.includes('/322/') ? 322 : 321) } })
  fillManual(state.component); const pending = state.component.send('manual_payment'); await tick()
  if (change === 'actor') state.auth.user = { id: 2, can_record_sales: true }
  else if (change === 'order') state.props.order = { id: 322, channel: 'shop', revision: 1 }
  else state.stop()
  await tick(); response.resolve(snapshot(321, 2, 'paid')); await pending
  assert.equal(writes, 1); assert.equal(storage.size, 1); assert.deepEqual(state.events, [])
  if (change !== 'unmount') assert.equal(state.component.state.value.stage, 'reserved')
  state.stop()
})

test('fresh server replay permission revocation blocks a pending request without clearing it', async () => {
  const storage = new Map(); let writes = 0, permitted = true
  const state = await setup({ storage, api: async (_path, options) => {
    if (options?.method === 'POST') { writes++; throw new Error('unknown outcome') }
    const data = snapshot(); if (!permitted) data.actions = {}; return data
  } })
  fillManual(state.component); await state.component.send('manual_payment'); permitted = false
  state.auth.user = { id: 1, can_record_sales: false }; await tick(); await state.component.send('manual_payment')
  assert.equal(writes, 1); assert.equal(storage.size, 1); assert.equal(state.component.canRun('manual_payment'), false); state.stop()
})

test('double activation sends only one pending request', async () => {
  const response = deferred(); let writes = 0, current = snapshot()
  const state = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { writes++; return response.promise } return current } })
  fillManual(state.component)
  const first = state.component.send('manual_payment'), second = state.component.send('manual_payment')
  await tick(); assert.equal(writes, 1); current = snapshot(321, 2, 'paid'); response.resolve(current); await Promise.all([first, second]); state.stop()
})

test('test authority in any accepted fact is conspicuous independently of the payment authority', async () => {
  const data = snapshot(321, 4, 'completed'); data.authority = 'manual'; data.completion = { id: 9, authority: 'test', created_at: '2026-10-18T00:00:00Z' }
  const state = await setup({ api: async () => data }); assert.equal(state.component.testAuthority.value, true); state.stop()
})

for (const operation of ['handover', 'complete']) test(`${operation} requires its own evidence and confirmation and uses its canonical phase revision`, async () => {
  const initialStage = operation === 'handover' ? 'paid' : 'dispatched'
  const nextStage = operation === 'handover' ? 'dispatched' : 'completed'
  const posts = []; let current = snapshot(321, 7, initialStage)
  const state = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts.push(options); current = snapshot(321, 8, nextStage) } return current } })
  const evidence = operation === 'handover' ? state.component.handoverEvidence : state.component.completionEvidence
  const confirmed = operation === 'handover' ? state.component.handoverConfirmed : state.component.completionConfirmed
  evidence.value = 'Separately verified physical evidence'
  await state.component.send(operation); assert.equal(posts.length, 0)
  confirmed.value = true; await state.component.send(operation)
  assert.equal(posts.length, 1); assert.deepEqual(posts[0].body, { expected_revision: 7, evidence: 'Separately verified physical evidence' })
  assert.equal(state.component.state.value.stage, nextStage); assert.equal(state.storage.size, 0); state.stop()
})

test('editing manual evidence revokes a previously checked confirmation', async () => {
  let writes = 0
  const state = await setup({ api: async (_path, options) => { if (options?.method === 'POST') writes++; return snapshot() } })
  fillManual(state.component); state.component.manualEvidence.value = 'Different evidence'
  assert.equal(state.component.manualConfirmed.value, false)
  await state.component.send('manual_payment'); assert.equal(writes, 0); state.stop()
})


test('shipment settlement reads require mock TTN while mock provenance retains unknown-outcome recovery', async () => {
  const calls = [], auth = vue.reactive({ user: { id: 1, is_superuser: true } })
  const real = { id: 11, simulation: false, carrier: 'nova_poshta', tracking_number: '20450000000000', status: 'delivered' }
  const unknown = { id: 12, simulation: true, carrier: 'mock_nova_poshta', tracking_number: null, provider_reference: 'accepted-provider-ref', status: 'unknown', active: true }
  const valid = { id: 13, simulation: true, carrier: 'mock_nova_poshta', tracking_number: 'MOCK-ACCEPTED', status: 'delivered' }
  const rejected = { id: 14, simulation: true, carrier: 'mock_nova_poshta', tracking_number: 'MOCK-FAILED', status: 'delivered' }
  const forged = { id: 15, simulation: false, carrier: 'mock_nova_poshta', tracking_number: 'MOCK-FORGED', status: 'delivered' }
  const props = vue.reactive({ order: { id: 321, revision: 1, channel: 'shop', simulation: false, total_amount: '123.45', shipments: [real, unknown, valid, rejected, forged], shipment_actions: { mode: 'mock_only', simulation_available: true, can_manage: true } } })
  Object.assign(globalThis, vue, { useAuthStore: () => auth, defineProps: () => props, defineEmits: () => () => {}, useBackofficeApi: () => ({ getShipmentSettlement: async (orderId, shipmentId) => { calls.push([orderId, shipmentId]); if (shipmentId === 14) throw new Error('read failed'); return { mode: 'mock_only', order_id: orderId, shipment_id: shipmentId, allowed_actions: [], items: [] } } }) })
  const source = (await readFile(new URL('../components/orders/OrderShipments.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const module = await importSource('export function instantiate() {\n' + source + '\nreturn { isMockShipment, isMockSettlementEligible, enabled, settlements, settlementErrors, loadSettlements };\n}')
  const scope = vue.effectScope(), component = scope.run(() => module.instantiate())
  await tick()
  assert.deepEqual(calls, [[321, 13], [321, 14]])
  assert.deepEqual(Object.keys(component.settlements.value), ['13'])
  assert.deepEqual(Object.keys(component.settlementErrors.value), ['14'])
  assert.equal(component.enabled.value, true)
  assert.equal(component.isMockShipment(unknown), true)
  assert.equal(component.isMockSettlementEligible(unknown), false)
  assert.equal(component.isMockShipment(real), false)
  assert.equal(component.isMockSettlementEligible(forged), false)
  props.order.shipments = [valid, real]
  await tick()
  assert.deepEqual(Object.keys(component.settlements.value), ['13'])
  assert.deepEqual(Object.keys(component.settlementErrors.value), [])
  scope.stop()
})
