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
const common = { authority: 'test', simulation: true, is_sent_dps: false, notice: 'Local test only' }
const lines = [{ order_item_id: 7, product_id: 1, name: 'Test item', quantity: 2, total_minor: 20000 }]
const snapshot = { items: lines, amount_minor: 20000, currency: 'UAH', payment: { id: 4, method: 'bank_transfer' } }
const actions = names => Object.fromEntries(names.flatMap(name => [[name, true], [`replay_${name}`, true]]))
const register = () => ({ ...common, id: 'SHOP-MOCK-KASA-1', enabled: true, shift_status: 'open', shift_revision: 2, actions: actions(['open', 'close', 'x', 'z']), blocking_reasons: [], reconciliation: { pending_document_ids: [], unreceipted_payment_ids: [], unresolved_return_ids: [], unknown_document_ids: [] }, reports: [] })
const document = (status = 'issued') => ({ ...common, id: 12, order_id: 321, return_id: null, kind: 'sale', status, revision: 1, provider_uuid: 'original-uuid', shift_revision: 2, amount_minor: 20000, currency: 'UAH', snapshot, snapshot_hash: 'a'.repeat(64), dispatched_at: null, issued_at: null, created_at: '2026-10-18T00:00:00Z', actions: actions(['process', 'reconcile', 'cancel', 'print']), blocking_reasons: [] })
const order = () => ({ ...common, enabled: true, order_id: 321, revision: 5, sale_document: null, returns: [], actions: actions(['sale_preview', 'sale_receipt', 'create_return']), blocking_reasons: [] })
const returnRecord = () => ({ ...common, id: 8, order_id: 321, sale_document_id: 12, revision: 1, shift_revision: 2, amount_minor: 10000, currency: 'UAH', lines: [{ ...lines[0], quantity: 1, total_minor: 10000 }], reason: 'Partial return', refund: null, physical_receipt: null, fiscal_document: null, created_at: '2026-10-18T00:00:00Z', actions: actions(['refund', 'receipt_preview', 'receipt', 'physical_receipt']), blocking_reasons: [] })
const preview = () => ({ ...common, id: 10, order_id: 321, return_id: null, kind: 'sale', expected_revision: 5, shift_revision: 2, snapshot, snapshot_hash: 'a'.repeat(64), expires_at: '2099-01-01T00:00:00Z' })
const setup = async (name, api, storage = new Map(), overrides = {}) => {
  const auth = vue.reactive({ user: { id: 2, can_record_sales: true } }), props = vue.reactive({ order: { id: 321, channel: 'shop', revision: 5 }, ...overrides }), events = []
  Object.assign(globalThis, vue, { useAuthStore: () => auth, useApi: () => api, defineProps: () => props, defineEmits: () => (...args) => events.push(args), localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
  Object.assign(globalThis, await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8')))
  Object.assign(globalThis, await importSource((await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')))
  Object.assign(globalThis, await importSource((await readFile(new URL('../utils/shopFiscal.ts', import.meta.url), 'utf8')).replace(/import\.meta\.client/g, 'true')))
  Object.assign(globalThis, await importSource((await readFile(new URL('../utils/shopCarrierReturns.ts', import.meta.url), 'utf8')).replace(/import\.meta\.client/g, 'true')))
  const source = (await readFile(new URL(`../components/orders/${name}.vue`, import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const exported = { OrderShopFiscal: 'read, entity, document, preview, previewError, prepare, approve, process, reconcile, cancel, confirmed, can, canDocument, createPreview, submit, runDocument, hydratePreview, cancelEvidence', OrderShopReturns: 'read, record, quantities, reason, confirmed, selectedId, dispositions, goodsFit, receiptEvidence, receiptConfirmed, refundReference, refundEvidence, refundConfirmed, create, refund, receive, remaining, canCreate, canRecord, createReturn, refundReturn, receiveReturn, carrierRead, carrierReceiptId, carrierCases, physicalLines, physicalValid', ShopFiscalReports: 'read, kind, shiftConfirmed, reportConfirmed, open, close, x, z, canRun, send' }[name]
  const module = await importSource(`export function instantiate() {\n${source}\nreturn { ${exported} };\n}`)
  const scope = vue.effectScope(), component = scope.run(() => module.instantiate())
  await settle()
  return { component, auth, props, storage, events, stop: () => scope.stop() }
}

for (const name of ['OrderShopFiscal', 'OrderShopReturns', 'ShopFiscalReports']) test(`${name} mount is read-only and unverified authority fails closed`, async () => {
  const calls = [], state = await setup(name, async (path, options) => { calls.push(options?.method || 'GET'); return path.endsWith('/register') ? register() : order() })
  assert.ok(calls.length); assert.ok(calls.every(method => method === 'GET')); state.stop()
  const invalid = await setup(name, async path => ({ ...(path.endsWith('/register') ? register() : order()), authority: 'provider', is_sent_dps: true }))
  assert.equal(invalid.component.read.state.value, null); assert.notEqual(invalid.component.read.error.value, ''); invalid.stop()
})

test('sale preview approval sends only server identity/revision and exact confirmation', async () => {
  const posts = []; let current = order()
  const state = await setup('OrderShopFiscal', async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); if (path.endsWith('/sale-preview')) return preview(); current = { ...order(), sale_document: document('queued') }; return current.sale_document }
    return path.endsWith('/register') ? register() : path.includes('/previews/') ? preview() : current
  })
  await state.component.createPreview(); assert.deepEqual(posts[0].body, { expected_revision: 5 }); assert.equal(state.component.preview.value.id, 10)
  await state.component.submit(); assert.equal(posts.length, 1)
  state.component.confirmed.value = true; await state.component.submit(); await settle()
  assert.deepEqual(posts[1].body, { expected_revision: 5, preview_id: 10, confirm: true }); assert.ok(posts.every(post => post.headers['Idempotency-Key']))
  assert.equal(state.component.document.value.status, 'queued'); assert.equal(state.component.preview.value, null); assert.equal(state.storage.size, 0); state.stop()
})

test('lost approval replays exact key/body while new work is disabled and displays fresh canonical document', async () => {
  const storage = new Map(), posts = []; let current = order(), lost = true
  const api = async (path, options) => {
    if (options?.method === 'POST') {
      posts.push({ path, ...options })
      if (path.endsWith('/sale-preview')) return preview()
      current = { ...order(), enabled: false, sale_document: document('issued'), actions: { sale_preview: false, sale_receipt: false, replay_sale_receipt: true } }
      if (lost) { lost = false; throw new Error('Lost after acceptance') }
      return document('queued')
    }
    return path.endsWith('/register') ? register() : path.includes('/previews/') ? preview() : current
  }
  const first = await setup('OrderShopFiscal', api, storage); await first.component.createPreview(); first.component.confirmed.value = true; await first.component.submit(); first.stop()
  const second = await setup('OrderShopFiscal', api, storage); await second.component.submit(); await settle()
  assert.deepEqual(posts[2], posts[1]); assert.equal(second.component.document.value.status, 'issued'); assert.equal(storage.size, 0); second.stop()
})

test('expired preview cannot be approved even if the earlier confirmation was checked', async () => {
  const expired = { ...preview(), expires_at: '2000-01-01T00:00:00Z' }; let posts = 0
  const state = await setup('OrderShopFiscal', async (path, options) => { if (options?.method === 'POST') { posts++; return expired } return path.endsWith('/register') ? register() : path.includes('/previews/') ? expired : order() })
  await state.component.createPreview(); state.component.confirmed.value = true; await state.component.submit(); assert.equal(posts, 1); state.stop()
})

test('document processing and lookup-only reconciliation use original document identity and strict bodies', async () => {
  const posts = []; let current = { ...order(), sale_document: document('queued') }
  const state = await setup('OrderShopFiscal', async (path, options) => { if (options?.method === 'POST') { posts.push({ path, ...options }); current = { ...order(), sale_document: { ...document(path.endsWith('/process') ? 'unknown' : 'issued'), revision: 2 } }; return current.sale_document } return path.endsWith('/register') ? register() : current })
  await state.component.runDocument('process'); assert.equal(state.component.document.value.status, 'unknown')
  await state.component.runDocument('reconcile'); assert.equal(state.component.document.value.status, 'issued')
  assert.ok(posts[0].path.endsWith('/documents/12/process')); assert.deepEqual(posts[0].body, { expected_revision: 1 }); assert.deepEqual(posts[1].body, { expected_revision: 2 }); state.stop()
})

test('reserved return quantities consume capacity before refund and pre-handover creation fails closed', async () => {
  const current = { ...order(), sale_document: document(), returns: [returnRecord()], actions: { create_return: false, replay_create_return: true } }; let posts = 0
  const state = await setup('OrderShopReturns', async (_path, options) => { if (options?.method === 'POST') posts++; return current })
  assert.equal(state.component.remaining(lines[0]), 1)
  state.component.quantities.value = { 7: 1 }; state.component.reason.value = 'Wanted'; state.component.confirmed.value = true; await state.component.createReturn()
  assert.equal(posts, 0); assert.equal(state.component.canCreate.value, false); state.stop()
})

test('partial return creation never submits an amount, tax, or paid-status authority', async () => {
  let current = { ...order(), sale_document: document() }; const posts = []
  const state = await setup('OrderShopReturns', async (_path, options) => { if (options?.method === 'POST') { posts.push(options); current = { ...current, returns: [returnRecord()] }; return returnRecord() } return current })
  state.component.quantities.value = { 7: 1 }; state.component.reason.value = 'Partial'; state.component.confirmed.value = true; await state.component.createReturn()
  assert.deepEqual(posts[0].body, { expected_revision: 5, sale_document_id: 12, lines: [{ order_item_id: 7, quantity: 1 }], reason: 'Partial' }); assert.equal(state.component.remaining(lines[0]), 1); state.stop()
})

test('refund unknown outcome retains exact reference/key/body after reload despite accepted canonical fact', async () => {
  const storage = new Map(), posts = []; let record = returnRecord(), lost = true
  const api = async (_path, options) => { if (options?.method === 'POST') { posts.push(options); record = { ...record, revision: 2, refund: { id: 1, amount_minor: 10000, method: 'bank_transfer', external_reference: 'REF-ONE', evidence: 'Verified' }, actions: { refund: false, replay_refund: true } }; if (lost) { lost = false; throw new Error('Lost after acceptance') } return record } return { ...order(), sale_document: document(), returns: [record] } }
  const first = await setup('OrderShopReturns', api, storage); first.component.refundReference.value = 'REF-ONE'; first.component.refundEvidence.value = 'Verified'; first.component.refundConfirmed.value = true; await first.component.refundReturn(); first.stop()
  const second = await setup('OrderShopReturns', api, storage); await second.component.refundReturn()
  assert.deepEqual(posts[1], posts[0]); assert.deepEqual(posts[0].body, { expected_revision: 1, external_reference: 'REF-ONE', evidence: 'Verified' }); assert.equal(storage.size, 0); second.stop()
})

test('physical receipt is a separate exact-quantity command and NP capability remains blocked', async () => {
  const posts = []; let record = returnRecord()
  const state = await setup('OrderShopReturns', async (_path, options) => { if (options?.method === 'POST') { posts.push(options); record = { ...record, revision: 2, physical_receipt: { id: 1, lines: options.body.lines, evidence: options.body.evidence } }; return record } return { ...order(), sale_document: document(), returns: [record] } })
  state.component.dispositions.value = { 7: 'restock' }; state.component.receiptEvidence.value = 'Received'; state.component.receiptConfirmed.value = true; await state.component.receiveReturn(); assert.equal(posts.length, 0)
  state.component.goodsFit.value = true; state.component.receiptConfirmed.value = true; await state.component.receiveReturn()
  assert.deepEqual(posts[0].body, { expected_revision: 1, lines: [{ order_item_id: 7, quantity: 1, disposition: 'restock' }], evidence: 'Received' }); assert.equal(state.component.record.value.refund, null); state.stop()
  record = { ...returnRecord(), actions: { physical_receipt: false, replay_physical_receipt: false }, blocking_reasons: ['carrier_return_pending_b3'] }
  const blocked = await setup('OrderShopReturns', async () => ({ ...order(), returns: [record] })); assert.equal(blocked.component.canRecord('physical_receipt'), false); blocked.stop()
})

test('Z lost response replays exact old shift revision after closure with no replacement report', async () => {
  const storage = new Map(), posts = []; let current = register(), lost = true
  const report = { ...common, id: 4, kind: 'z', register_id: current.id, shift_revision: 2, totals: { sale_count: 1, return_count: 1, sales_minor: 20000, returns_minor: 10000, net_minor: 10000, document_ids: [12, 13] }, reconciliation: current.reconciliation, created_at: '2026-10-18T00:00:00Z' }
  const api = async (_path, options) => { if (options?.method === 'POST') { posts.push(options); current = { ...register(), enabled: false, shift_status: 'closed', shift_revision: 3, reports: [report], actions: { z: false, replay_z: true } }; if (lost) { lost = false; throw new Error('Lost report') } return report } return current }
  const first = await setup('ShopFiscalReports', api, storage); first.component.kind.value = 'z'; first.component.reportConfirmed.value = true; await first.component.send('z'); first.stop()
  const second = await setup('ShopFiscalReports', api, storage); await second.component.send('z')
  assert.deepEqual(posts[1], posts[0]); assert.deepEqual(posts[0].body, { expected_shift_revision: 2, confirm: true }); assert.equal(second.component.read.state.value.reports.length, 1); assert.equal(storage.size, 0); second.stop()
})

for (const change of ['actor', 'permissions', 'order', 'unmount']) test(`late fiscal state read cannot overwrite changed ${change} context`, async () => {
  const pending = deferred(); let reads = 0
  const state = await setup('OrderShopReturns', async () => ++reads === 1 ? pending.promise : order())
  if (change === 'actor') state.auth.user = { id: 3 }
  else if (change === 'permissions') state.auth.user = { id: 2, can_record_sales: false }
  else if (change === 'order') state.props.order = { id: 322, channel: 'shop', revision: 1 }
  else state.stop()
  await settle(); pending.resolve({ ...order(), revision: 99 }); await settle()
  assert.notEqual(state.component.read.state.value?.revision, 99); state.stop()
})

test('fresh replay permissions revoke pending refund without deleting the unresolved intent', async () => {
  const storage = new Map(); let posts = 0, allowed = true
  const state = await setup('OrderShopReturns', async (_path, options) => { if (options?.method === 'POST') { posts++; throw new Error('Unknown') } return { ...order(), returns: [{ ...returnRecord(), actions: { refund: allowed, replay_refund: allowed } }] } }, storage)
  state.component.refundReference.value = 'ONE'; state.component.refundEvidence.value = 'Evidence'; state.component.refundConfirmed.value = true; await state.component.refundReturn()
  allowed = false; state.auth.user = { id: 2, can_record_sales: false }; await settle(); await state.component.refundReturn()
  assert.equal(posts, 1); assert.equal(storage.size, 1); state.stop()
})

for (const change of ['actor', 'permissions', 'order', 'unmount']) test(`late accepted refund cannot clear or emit into changed ${change} context`, async () => {
  const pending = deferred(), storage = new Map(); let posts = 0
  const state = await setup('OrderShopReturns', async (_path, options) => { if (options?.method === 'POST') { posts++; return pending.promise } return { ...order(), returns: [returnRecord()] } }, storage)
  state.component.refundReference.value = 'ONLY'; state.component.refundEvidence.value = 'Verified'; state.component.refundConfirmed.value = true
  const request = state.component.refundReturn(); await settle()
  if (change === 'actor') state.auth.user = { id: 3 }
  else if (change === 'permissions') state.auth.user = { id: 2, can_record_sales: false }
  else if (change === 'order') state.props.order = { id: 322, channel: 'shop', revision: 1 }
  else state.stop()
  await settle(); pending.resolve(returnRecord()); await request
  assert.equal(posts, 1); assert.equal(storage.size, 1); assert.deepEqual(state.events, []); state.stop()
})

test('double activation of a refund creates only one in-flight original command', async () => {
  const pending = deferred(); let posts = 0
  const state = await setup('OrderShopReturns', async (_path, options) => { if (options?.method === 'POST') { posts++; return pending.promise } return { ...order(), returns: [returnRecord()] } })
  state.component.refundReference.value = 'ONLY'; state.component.refundEvidence.value = 'Verified'; state.component.refundConfirmed.value = true
  const first = state.component.refundReturn(), second = state.component.refundReturn(); await settle()
  assert.equal(posts, 1); pending.resolve(returnRecord()); await Promise.all([first, second]); state.stop()
})

test('Shop fiscal panel routing preserves prior guest MOCK COD/QR and POS histories', async () => {
  const utilities = await importSource(await readFile(new URL('../utils/shopFiscal.ts', import.meta.url), 'utf8'))
  const choose = utilities.shopFiscalUsesCanonicalPanel
  const clean = { channel: 'shop', simulation: false, payments: [], handovers: [], shipments: [] }
  assert.equal(choose(clean), true)
  for (const source of ['shop_manual', 'shop_provider']) assert.equal(choose({ ...clean, payments: [{ source, simulation: false }] }), true)
  const previousGuestCod = { ...clean, payments: [{ source: 'mock_cod_confirmation', simulation: true }], shipments: [{ simulation: true, carrier: 'mock_nova_poshta' }] }
  assert.equal(choose(previousGuestCod), false)
  assert.equal(choose({ ...clean, payments: previousGuestCod.payments }), false)
  assert.equal(choose({ ...clean, shipments: previousGuestCod.shipments }), false)
  assert.equal(choose({ ...clean, simulation: true }), false)
  assert.equal(choose({ ...clean, payments: [{ source: 'provider_confirmation', simulation: true, method: 'monobank_qr' }] }), false)
  assert.equal(choose({ ...clean, channel: 'backoffice_pos' }), false)
  assert.equal(choose({ ...clean, handovers: [{ simulation: true }] }), false)
})

test('redacted register exposes lightweight shift state without inventing reconciliation facts', async () => {
  const redacted = { ...register(), reconciliation: null, reports: [], actions: {} }
  const state = await setup('ShopFiscalReports', async () => redacted)
  assert.equal(state.component.read.state.value.reconciliation, null)
  assert.equal(state.component.canRun('x'), false); assert.equal(state.component.canRun('z'), false); state.stop()
})


test('Backoffice Shop fiscal projections label every new status explicitly as test while retaining legacy values', async () => {
  const source = (await readFile(new URL('../components/orders/OrderProjections.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  for (const status of ['simulated_fiscal_queued', 'simulated_fiscal_unknown', 'simulated_fiscal_issued', 'simulated_fiscal_cancelled', 'simulated_fiscal_error', 'simulated_fiscal_invalid', 'simulated_fiscal_return_pending', 'simulated_fiscal_partial_return', 'simulated_fiscal_returned', 'simulated_pending_document', 'simulated_local_print_available']) {
    Object.assign(globalThis, vue, { defineProps: () => ({ order: { fiscal_status: status, receipt_delivery_status: status } }) })
    const component = await importSource(source + '\nexport { rows };')
    assert.match(component.rows.value[2][1], /[Тт]ест/); assert.notEqual(component.rows.value[2][1], status)
  }
  Object.assign(globalThis, vue, { defineProps: () => ({ order: { fiscal_status: 'not_requested', receipt_delivery_status: 'pending_document' } }) })
  const legacy = await importSource(source + '\nexport { rows };')
  assert.equal(legacy.rows.value[2][1], 'Не запитувалась'); assert.equal(legacy.rows.value[3][1], 'Фіскальний документ відсутній')
})

for (const kind of ['sale', 'return']) for (const failure of ['lost_ack', 'canonical_get_failure']) test(`${kind} cancellation survives ${failure} and reload even when active document disappears`, async () => {
  const storage = new Map(), posts = []; let accepted = false, failedReads = false
  const old = { ...document('queued'), kind, return_id: kind === 'return' ? 8 : null }
  const canonical = () => kind === 'sale' ? { ...order(), sale_document: accepted ? null : old } : { ...returnRecord(), fiscal_document: accepted ? null : old }
  const api = async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); accepted = true; if (failure === 'lost_ack' && posts.length === 1) throw new Error('Lost cancellation ACK'); if (failure === 'canonical_get_failure' && posts.length === 1) failedReads = true; return { ...old, status: 'cancelled', revision: 2 } }
    if (path.endsWith('/register')) return register()
    if (path.endsWith('/documents/12')) return { ...old, status: 'cancelled', revision: 2, actions: { cancel: false, replay_cancel: true } }
    if (failedReads) throw new Error('Canonical GET unavailable')
    return canonical()
  }
  const overrides = kind === 'return' ? { returnId: 8 } : {}
  const first = await setup('OrderShopFiscal', api, storage, overrides); first.component.cancelEvidence.value = 'Wrong approval'; await first.component.runDocument('cancel'); first.stop()
  assert.equal(storage.size, 1); failedReads = false
  const second = await setup('OrderShopFiscal', api, storage, overrides)
  assert.equal(second.component.document.value.id, 12); assert.equal(second.component.document.value.status, 'cancelled'); assert.equal(second.component.canDocument('cancel'), true)
  await second.component.runDocument('cancel'); await settle()
  assert.equal(posts.length, failure === 'lost_ack' ? 2 : 1)
  if (posts.length === 2) assert.deepEqual(posts[1], posts[0])
  assert.equal(storage.size, 0); assert.equal(second.component.document.value, null); second.stop()
})

test('saved cancellation targets its original document when another actor creates a replacement active document', async () => {
  const storage = new Map(), posts = []; let accepted = false
  const old = document('queued'), replacement = { ...document('queued'), id: 13, provider_uuid: 'replacement-uuid' }
  const api = async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); accepted = true; if (posts.length === 1) throw new Error('Lost ACK'); return { ...old, status: 'cancelled' } }
    if (path.endsWith('/register')) return register()
    if (path.endsWith('/documents/12')) return { ...old, status: 'cancelled', actions: { cancel: false, replay_cancel: true } }
    return { ...order(), sale_document: accepted ? replacement : old }
  }
  const first = await setup('OrderShopFiscal', api, storage); first.component.cancelEvidence.value = 'Old approval'; await first.component.runDocument('cancel'); first.stop()
  const second = await setup('OrderShopFiscal', api, storage); assert.equal(second.component.document.value.id, 12)
  await second.component.runDocument('cancel'); await settle()
  assert.deepEqual(posts[1], posts[0]); assert.ok(posts[1].path.endsWith('/documents/12/cancel')); assert.equal(second.component.document.value.id, 13); second.stop()
})

test('only complete canonical B3 reverse brand preserves the new Shop financial panels', async () => {
  const { isShopCarrierReturnShipment, shopFiscalUsesCanonicalPanel } = await importSource(await readFile(new URL('../utils/shopFiscal.ts', import.meta.url), 'utf8'))
  const brand = { carrier: 'shop_mock_np_return', simulation: true, source: 'shop_return', shop_carrier_return_case_id: 3, return_of_shipment_id: 1, authority: 'test', provenance: 'shop_carrier_return_test' }
  assert.equal(isShopCarrierReturnShipment(brand), true)
  assert.equal(shopFiscalUsesCanonicalPanel({ channel: 'shop', simulation: false, shipments: [brand] }), true)
  for (const field of Object.keys(brand)) { const forged = { ...brand }; delete forged[field]; assert.equal(isShopCarrierReturnShipment(forged), false); if (field !== 'simulation') assert.equal(shopFiscalUsesCanonicalPanel({ channel: 'shop', simulation: false, shipments: [forged] }), false) }
  assert.equal(shopFiscalUsesCanonicalPanel({ channel: 'shop', simulation: false, shipments: [{ simulation: true, carrier: 'mock_nova_poshta' }], payments: [{ simulation: true, source: 'mock_cod_confirmation' }] }), false)
})
const carrierState = () => ({ authority: 'test', simulation: true, notice: 'Local', order_id: 321, revision: 8, enabled: true, original_shipment_id: 1, financial_mode: 'paid', eligible_lines: [], actions: {}, blocking_reasons: [], cases: [{ id: 3, financial_mode: 'paid', receipt: { id: 99, lines: [{ order_item_id: 7, quantity: 1, disposition: 'not_restock' }] }, financial_remaining_lines: [{ order_item_id: 7, product_id: 1, name: 'Test item', quantity: 1 }], actions: { create_financial_return: true } }] })
test('NP financial return claims only received remaining quantities and sends strict receipt identity', async () => {
  const posts = []; let current = { ...order(), sale_document: document() }
  const state = await setup('OrderShopReturns', async (path, options) => {
    if (options?.method === 'POST') { posts.push(options); current = { ...current, returns: [{ ...returnRecord(), carrier_receipt_id: 99 }] }; return current.returns[0] }
    return path.endsWith('/carrier-returns') ? carrierState() : current
  }, new Map(), { order: { id: 321, revision: 5, fulfillment_method: 'nova_poshta' } })
  state.component.reason.value = 'Received partial parcel'; state.component.quantities.value = { 7: 2 }; state.component.confirmed.value = true; await state.component.createReturn(); assert.equal(posts.length, 0)
  state.component.quantities.value = { 7: 1 }; state.component.confirmed.value = true; await state.component.createReturn()
  assert.deepEqual(posts[0].body, { expected_revision: 5, sale_document_id: 12, carrier_receipt_id: 99, lines: [{ order_item_id: 7, quantity: 1 }], reason: 'Received partial parcel' }); state.stop()
})
test('NP physical financial acknowledgement links the original disposition and never accepts a new stock choice', async () => {
  const posts = [], record = { ...returnRecord(), carrier_receipt_id: 99 }
  const state = await setup('OrderShopReturns', async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); return record }
    return path.endsWith('/carrier-returns') ? carrierState() : { ...order(), returns: [record] }
  }, new Map(), { order: { id: 321, revision: 5, fulfillment_method: 'nova_poshta' } })
  state.component.dispositions.value = { 7: 'restock' }; state.component.goodsFit.value = false; state.component.receiptEvidence.value = 'Link original receipt'; state.component.receiptConfirmed.value = true
  assert.equal(state.component.physicalValid.value, true); await state.component.receiveReturn()
  assert.equal(posts.length, 1); assert.ok(posts[0].path.endsWith('/physical-receipt')); assert.deepEqual(posts[0].body.lines, [{ order_item_id: 7, quantity: 1, disposition: 'not_restock' }]); assert.equal('carrier_receipt_id' in posts[0].body, false); state.stop()
})
test('missing original carrier receipt prevents a new physical link', async () => {
  const record = { ...returnRecord(), carrier_receipt_id: 404 }; let posts = 0
  const state = await setup('OrderShopReturns', async (path, options) => { if (options?.method === 'POST') posts++; return path.endsWith('/carrier-returns') ? carrierState() : { ...order(), returns: [record] } }, new Map(), { order: { id: 321, fulfillment_method: 'nova_poshta' } })
  state.component.receiptEvidence.value = 'Missing'; state.component.receiptConfirmed.value = true; assert.equal(state.component.physicalValid.value, false); await state.component.receiveReturn(); assert.equal(posts, 0); state.stop()
})

test('zero-total financial claim clears its rejected intent and permits a combined positive selection with a new key', async () => {
  const posts = []; let current = { ...order(), sale_document: document() }
  const fixture = await setup('OrderShopReturns', async (_path, options) => {
    if (options?.method === 'POST') { posts.push(options); if (posts.length === 1) throw { response: { status: 409 }, data: { detail: { code: 'unsupported_zero_total', message: 'Selection has zero total' } } }; current = { ...current, returns: [returnRecord()] }; return returnRecord() }
    return current
  }), c = fixture.component
  c.quantities.value = { 7: 1 }; c.reason.value = 'Rejected rounded claim'; c.confirmed.value = true; await c.createReturn()
  assert.equal(c.create.intent.value, null); assert.equal(fixture.storage.size, 0); assert.equal(c.create.busy.value, false); assert.equal(c.canCreate.value, true); assert.match(c.create.error.value, /zero total/)
  c.quantities.value = { 7: 2 }; c.reason.value = 'Combined positive final claim including zero-value lines'; c.confirmed.value = true; await c.createReturn()
  assert.equal(posts.length, 2); assert.notEqual(posts[1].headers['Idempotency-Key'], posts[0].headers['Idempotency-Key']); assert.deepEqual(posts[1].body.lines, [{ order_item_id: 7, quantity: 2 }]); assert.equal(fixture.storage.size, 0)
  const { shopFiscalReason } = await importSource(await readFile(new URL('../utils/shopFiscal.ts', import.meta.url), 'utf8')); assert.match(shopFiscalReason('unsupported_zero_total'), /додатною сумою/); assert.match(shopFiscalReason('unsupported_zero_total'), /нульовою вартістю/); fixture.stop()
})

test('BO unknown carrier return projection states creation uncertainty without parcel-transit claim', async () => {
  const props = { order: { payment_status: 'unpaid', fulfillment_status: 'simulated_carrier_return_unknown', fiscal_status: 'not_requested', receipt_delivery_status: 'pending_document' } }
  Object.assign(globalThis, vue, { defineProps: () => props })
  const source = (await readFile(new URL('../components/orders/OrderProjections.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const actual = (await importSource(source + '\nexport { rows };')).rows.value
  assert.deepEqual(actual[0], ['Оплата', 'Не оплачено'])
  assert.deepEqual(actual[1], ['Виконання', 'Тестове повернення НП: результат створення невідомий; зворотну ТТН не підтверджено'])
})
