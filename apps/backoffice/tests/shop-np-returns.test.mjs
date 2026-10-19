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
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const hash = 'a'.repeat(64), originalTTN = '59000000000321', returnTTN = '59000000000322'
const ready = () => ({ enabled: true, available: true, profile_id: 'np-test', profile_hash: hash, authority: 'test', transport: 'mock_http', manual_link_allowed: true, blocking_reasons: [] })
const line = quantity => ({ order_item_id: 501, product_id: 8, name: 'Synthetic product', quantity })
const snapshot = (mode = 'paid') => ({ order_id: 321, revision: 5, enabled: true, readiness: ready(), original_shipment_id: 19, original_ttn: originalTTN, financial_mode: mode, eligible_lines: [line(2)], cases: [], actions: { attach: true, replay_attach: true }, blocking_reasons: [] })
const record = (mode = 'paid', status = 'awaiting_return', revision = 1) => ({ id: 7, order_id: 321, revision, order_revision: 6, profile_id: 'np-test', profile_hash: hash, authority: 'test', transport: 'mock_http', test_context: true, original_shipment_id: 19, original_ttn: originalTTN, return_ttn: returnTTN, financial_mode: mode, linkage_kind: 'easy_return', linkage_authority: 'test', manual_link: null, sale_document_id: mode === 'paid' ? 3 : null, status, lines: [line(mode === 'paid' ? 1 : 2)], observation: null, receipt: null, closure: null, financial_return_id: null, financial_document_id: null, financial_remaining_lines: [], actions: { refresh: true, receive: status === 'arrived', close_unpaid: false, financial_claim: false, replay_refresh: true, replay_receive: true, replay_close_unpaid: true, replay_financial_claim: true }, blocking_reasons: [] })
const receipt = mode => ({ id: 11, case_id: 7, observation_id: 10, lines: [{ order_item_id: 501, quantity: mode === 'paid' ? 1 : 2, disposition: 'restock' }], evidence: 'Actual synthetic inspection', snapshot_hash: hash, operator_id: 2, created_at: '2026-10-19T00:00:00Z', contents_verified: true })
const withCase = item => ({ ...snapshot(item.financial_mode), revision: item.order_revision, eligible_lines: [], cases: [item], actions: { attach: false, replay_attach: true } })
const setup = async ({ api, storage = new Map(), mode = 'paid', component = 'OrderShopNPReturns', propsExtra = {} } = {}) => {
  const auth = vue.reactive({ user: { id: 2, can_record_sales: true, can_manage_shipments: true, can_post_inventory: true } }), props = vue.reactive({ order: { id: 321, channel: 'shop', fulfillment_method: 'nova_poshta', revision: 5 }, profileReady: true, refreshToken: 0, ...propsExtra }), events = []
  const sales = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, sales, { useAuthStore: () => auth, useApi: () => api || (async () => snapshot(mode)), defineProps: () => props, defineEmits: () => (...args) => events.push(args), useBookingFormatting: () => ({ formatDateTime: String, formatMoney: String }), localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
  const commandSource = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(commandSource))
  const utilities = await importSource((await readFile(new URL('../utils/shopNPReturns.ts', import.meta.url), 'utf8')).replace(/import\.meta\.client/g, 'true'))
  Object.assign(globalThis, utilities, await importSource((await readFile(new URL('../utils/shopCheckboxFiscal.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')))
  const source = (await readFile(new URL(`../components/orders/${component}.vue`, import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const exports = component === 'OrderShopNPReturns' ? 'state, loading, error, read, attach, refresh, receive, close, claim, record, pendingId, recovered, recoveryError, selectedId, returnTTN, linkage, reason, attachConfirmed, manualSource, manualDocument, manualLine, quantities, receiptEvidence, contentsConfirmed, goodsFit, dispositions, closeEvidence, closeConfirmed, claimReason, claimConfirmed, attachValid, receiptValid, canAttach, canCase, attachCase, runCase, reload, testContext' : 'state, read, record, selectedId, canRecord, refundReturn, receiveReturn, refundReference, refundEvidence, refundConfirmed, receive'
  const module = await importSource(`export function instantiate() {\n${source}\nreturn { ${exports} };\n}`)
  const scope = vue.effectScope(), panel = scope.run(() => module.instantiate()); await tick()
  return { panel, auth, props, storage, events, utilities, sales, stop: () => scope.stop() }
}
const fillAttach = panel => { panel.returnTTN.value = returnTTN; panel.quantities.value = { 501: 1 }; panel.reason.value = 'Synthetic partial return'; panel.attachConfirmed.value = true }
const fillReceipt = panel => { panel.dispositions.value = { 501: 'restock' }; panel.receiptEvidence.value = 'Actual synthetic inspection'; panel.goodsFit.value = true; panel.contentsConfirmed.value = true }
const common = (revision = 1) => ({ expected_revision: revision, expected_profile_id: 'np-test', expected_profile_hash: hash })

test('mount only reads; feature off, denied and wrong-order data cannot send', async () => {
 for (const kind of ['off', 'denied', 'wrong-order']) {
  const calls = [], fixture = await setup({ api: async (_path, options) => { calls.push(options?.method || 'GET'); if (kind === 'denied') throw { status: 403 }; const value = snapshot(); if (kind === 'off') value.actions = {}; else value.order_id = 999; return value } }); fillAttach(fixture.panel); await fixture.panel.attachCase(); assert.deepEqual(calls, ['GET']); assert.equal(fixture.panel.canAttach.value, false); fixture.stop()
 }
})
test('paid Easy Return attaches only an existing TTN and exact chosen lines, with no client authority/outcome', async () => {
 let current = snapshot(); const posts = []
 const fixture = await setup({ api: async (path, options) => { if (options?.method === 'POST') { posts.push({ path, ...options }); current = withCase(record()) ; return current.cases[0] } return current } }); fillAttach(fixture.panel); await fixture.panel.attachCase(); assert.equal(posts.length, 1); assert.equal(posts[0].path, '/backoffice/shop-np-returns/orders/321/attach'); assert.deepEqual(posts[0].body, { ...common(5), original_shipment_id: 19, return_ttn: returnTTN, linkage_kind: 'easy_return', manual_link: null, lines: [{ order_item_id: 501, quantity: 1 }], reason: 'Synthetic partial return' }); assert.ok(posts[0].headers['Idempotency-Key']); assert.equal(posts[0].retry, 0); assert.equal(fixture.storage.size, 0); fixture.stop()
})
test('manual documentary linkage has explicit staff attestation and canonical readonly order/shipment/TTN bindings', async () => {
 let current = snapshot(); const posts = []
 const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts.push(options); const item = { ...record(), linkage_kind: 'manual_document', linkage_authority: 'manual', manual_link: options.body.manual_link }; current = withCase(item); return item } return current } }); fillAttach(fixture.panel); fixture.panel.linkage.value = 'manual_document'; fixture.panel.manualSource.value = 'Synthetic external carrier statement'; fixture.panel.manualDocument.value = 'DOC-1'; fixture.panel.manualLine.value = 'ROW-1'; assert.equal(fixture.panel.attachConfirmed.value, false); await fixture.panel.attachCase(); assert.equal(posts.length, 0); fixture.panel.attachConfirmed.value = true; await fixture.panel.attachCase(); assert.deepEqual(posts[0].body.manual_link, { source: 'Synthetic external carrier statement', document_id: 'DOC-1', line_id: 'ROW-1', order_id: 321, original_shipment_id: 19, original_ttn: originalTTN, return_ttn: returnTTN, verified: true }); assert.equal(fixture.panel.record.value.linkage_authority, 'manual'); fixture.stop()
})
test('manual-link policy off blocks new manual work even when inputs are filled', async () => {
 const data = snapshot(); data.readiness.manual_link_allowed = false; let posts = 0
 const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') posts++; return data } }); fillAttach(fixture.panel); fixture.panel.linkage.value = 'manual_document'; fixture.panel.manualSource.value = 'Source'; fixture.panel.manualDocument.value = 'DOC'; fixture.panel.manualLine.value = 'LINE'; fixture.panel.attachConfirmed.value = true; await fixture.panel.attachCase(); assert.equal(posts, 0); fixture.stop()
})
test('unpaid COD always attaches the whole parcel despite a partial quantity in local form state', async () => {
 const posts = []; let current = snapshot('unpaid_cod')
 const fixture = await setup({ mode: 'unpaid_cod', api: async (_path, options) => { if (options?.method === 'POST') { posts.push(options); const item = record('unpaid_cod'); current = withCase(item); return item } return current } }); fillAttach(fixture.panel); await fixture.panel.attachCase(); assert.deepEqual(posts[0].body.lines, [{ order_item_id: 501, quantity: 2 }]); fixture.stop()
})
test('carrier arrival alone does not send inventory work; physical receipt requires contents and disposition attestation', async () => {
 let current = withCase(record('paid', 'arrived', 2)); const posts = []
 const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts.push(options); const item = { ...current.cases[0], revision: 3, status: 'received', receipt: receipt('paid') }; current = withCase(item); return item } return current } }); await fixture.panel.runCase('receive'); assert.equal(posts.length, 0); fillReceipt(fixture.panel); fixture.panel.contentsConfirmed.value = false; await fixture.panel.runCase('receive'); assert.equal(posts.length, 0); fixture.panel.contentsConfirmed.value = true; await fixture.panel.runCase('receive'); assert.deepEqual(posts[0].body, { ...common(2), lines: [{ order_item_id: 501, quantity: 1, disposition: 'restock' }], contents_verified: true, evidence: 'Actual synthetic inspection' }); assert.equal(fixture.panel.record.value.receipt.id, 11); fixture.stop()
})
test('accepting without restock is distinct and never requires a fit-for-sale assertion', async () => {
 let current = withCase(record('paid', 'arrived', 2)); const posts = []
 const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts.push(options); const item = { ...current.cases[0], revision: 3, receipt: { ...receipt('paid'), lines: options.body.lines } }; current = withCase(item); return item } return current } }); fixture.panel.dispositions.value = { 501: 'not_restock' }; fixture.panel.receiptEvidence.value = 'Inspected damaged item'; fixture.panel.contentsConfirmed.value = true; assert.equal(fixture.panel.receiptValid.value, true); await fixture.panel.runCase('receive'); assert.equal(posts[0].body.lines[0].disposition, 'not_restock'); fixture.stop()
})
test('paid financial claim sends only canonical case revision/profile and reason, no second physical POST', async () => {
 const item = { ...record('paid', 'received', 3), receipt: receipt('paid'), actions: { financial_claim: true } }; let current = withCase(item); const posts = []
 const fixture = await setup({ api: async (path, options) => { if (options?.method === 'POST') { posts.push({ path, ...options }); const result = { ...item, revision: 4, status: 'financial_claimed', financial_return_id: 17 }; current = withCase(result); return result } return current } }); fixture.panel.claimReason.value = 'Inspected paid return'; fixture.panel.claimConfirmed.value = true; await fixture.panel.runCase('financial_claim'); assert.deepEqual(posts[0].body, { ...common(3), reason: 'Inspected paid return' }); assert.equal(posts[0].path, '/backoffice/shop-np-returns/cases/7/financial-claim'); assert.equal(posts.length, 1); assert.equal(fixture.panel.record.value.financial_return_id, 17); assert.equal(fixture.panel.record.value.receipt.id, 11); fixture.stop()
})
test('unpaid closure is separate, confirmed, and cannot invoke paid financial claim even with a stale flag', async () => {
 const item = { ...record('unpaid_cod', 'received', 3), receipt: receipt('unpaid_cod'), actions: { close_unpaid: true, financial_claim: true } }; let current = withCase(item); const posts = []
 const fixture = await setup({ api: async (path, options) => { if (options?.method === 'POST') { posts.push({ path, ...options }); const result = { ...item, revision: 4, status: 'closed_unpaid', closure: { id: 2, case_id: 7, order_id: 321, receipt_id: 11 } }; current = withCase(result); return result } return current } }); fixture.panel.claimReason.value = 'Not allowed'; fixture.panel.claimConfirmed.value = true; await fixture.panel.runCase('financial_claim'); assert.equal(posts.length, 0); fixture.panel.closeEvidence.value = 'Synthetic unpaid reconciliation'; await fixture.panel.runCase('close_unpaid'); assert.equal(posts.length, 0); fixture.panel.closeConfirmed.value = true; await fixture.panel.runCase('close_unpaid'); assert.deepEqual(posts[0].body, { ...common(3), evidence: 'Synthetic unpaid reconciliation', confirm: true }); assert.equal(posts[0].path, '/backoffice/shop-np-returns/cases/7/close-unpaid'); assert.equal(fixture.panel.record.value.financial_return_id, null); fixture.stop()
})
test('lost physical receipt replays exact key/body after reload and flagoff, canonical GET overrides cached ACK', async () => {
 const storage = new Map(), posts = []; let current = withCase(record('paid', 'arrived', 2)), accepted
 const api = async (_path, options) => { if (options?.method !== 'POST') return current; posts.push(options); if (!accepted) { accepted = { ...record('paid', 'received', 3), receipt: receipt('paid') }; current = { ...withCase({ ...accepted, revision: 9 }), enabled: false }; throw new Error('Committed receipt response lost') } return accepted }
 const first = await setup({ api, storage }); fillReceipt(first.panel); await first.panel.runCase('receive'); first.stop(); const second = await setup({ api, storage }); await second.panel.runCase('receive'); assert.deepEqual(posts[1], posts[0]); assert.equal(second.panel.record.value.revision, 9); assert.equal(second.storage.size, 0); second.stop()
})
test('known attachment ACK survives canonical GET failure then recovers closed original case by GET only on another configured profile', async () => {
 const storage = new Map(); let posts = 0, fail = false, current = snapshot(); const original = record()
 const api = async (path, options) => { if (options?.method === 'POST') { posts++; current = { ...snapshot(), eligible_lines: [], actions: {} }; fail = true; return original } if (fail) throw new Error('canonical GET failed'); if (path.endsWith('/cases/7')) return original; return current }
 const first = await setup({ api, storage }); fillAttach(first.panel); await first.panel.attachCase(); assert.equal(JSON.parse([...storage.values()][0]).resultId, 7); first.stop(); fail = false; current.readiness = { ...ready(), profile_id: 'new-profile', profile_hash: 'b'.repeat(64) }
 const second = await setup({ api, storage }); await tick(); await second.panel.attachCase(); assert.equal(posts, 1); assert.equal(storage.size, 0); assert.equal(second.panel.record.value.id, 7); second.stop()
})
test('unknown attachment may not be sent to a changed profile; exact intent stays intact', async () => {
 let current = snapshot(), posts = 0
 const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts++; throw new Error('unknown') } return current } }); fillAttach(fixture.panel); await fixture.panel.attachCase(); const original = [...fixture.storage.values()][0]; current = { ...snapshot(), readiness: { ...ready(), profile_id: 'replacement', profile_hash: 'b'.repeat(64) } }; await fixture.panel.reload(); await fixture.panel.attachCase(); assert.equal(posts, 1); assert.equal([...fixture.storage.values()][0], original); fixture.stop()
})
for (const change of ['actor', 'order', 'permissions', 'unmount']) test(`late attachment ACK after ${change} cannot clear an intent or emit stale changes`, async () => {
 const response = deferred(); const fixture = await setup({ api: async (path, options) => options?.method === 'POST' ? response.promise : { ...snapshot(), order_id: path.includes('/322') ? 322 : 321 } }); fillAttach(fixture.panel); const pending = fixture.panel.attachCase(); await tick(); if (change === 'actor') fixture.auth.user = { id: 3 }; else if (change === 'order') fixture.props.order = { id: 322, channel: 'shop', fulfillment_method: 'nova_poshta', revision: 1 }; else if (change === 'permissions') fixture.auth.user = { id: 2, can_manage_shipments: false }; else fixture.stop(); response.resolve(record()); await pending; assert.equal(fixture.storage.size, 1); assert.deepEqual(fixture.events, []); fixture.stop()
})
test('fresh replay permission revocation and profile-readiness failure block pending work without deleting it', async () => {
 let current = withCase(record('paid', 'arrived', 2)), posts = 0
 const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts++; throw new Error('unknown') } return current } }); fillReceipt(fixture.panel); await fixture.panel.runCase('receive'); current = withCase({ ...current.cases[0], actions: {} }); fixture.auth.user = { id: 2, can_post_inventory: false }; await tick(); await fixture.panel.runCase('receive'); assert.equal(posts, 1); assert.equal(fixture.storage.size, 1); fixture.props.profileReady = false; assert.equal(fixture.panel.canCase('receive'), false); fixture.stop()
})
test('readonly revision refresh during acceptance preserves the mounted callback and double activation sends once', async () => {
 const response = deferred(); let current = snapshot(), posts = 0
 const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts++; return response.promise } return current } }); fillAttach(fixture.panel); const first = fixture.panel.attachCase(), second = fixture.panel.attachCase(); await tick(); fixture.props.refreshToken++; await tick(); current = withCase(record()); response.resolve(current.cases[0]); await Promise.all([first, second]); assert.equal(posts, 1); assert.equal(fixture.storage.size, 0); assert.deepEqual(fixture.events, [['changed']]); fixture.stop()
})
for (const status of [409, 503]) test(`${status} ${status === 409 ? 'known no-effect rejection clears' : 'unknown failure retains'} the exact intent`, async () => {
 const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') throw { status, data: { detail: { code: 'np_return_manual_link_invalid', message: 'Not accepted' } } }; return snapshot() } }); fillAttach(fixture.panel); await fixture.panel.attachCase(); assert.equal(fixture.storage.size, status === 409 ? 0 : 1); fixture.stop()
})
test('received test case remains explicitly test after the current provider profile changes', async () => {
 const item = { ...record('paid', 'received', 3), receipt: receipt('paid') }, data = withCase(item); data.readiness = { ...ready(), authority: 'provider', transport: 'https', profile_id: 'production', profile_hash: 'b'.repeat(64) }; const fixture = await setup({ api: async () => data }); assert.equal(fixture.panel.testContext.value, true); fixture.stop()
})
test('R1 inherited NP physical receipt is readonly and refund remains a separate financial action', async () => {
 const ret = { id: 17, order_id: 321, revision: 1, sale_document_id: 3, carrier_receipt_id: 11, amount_minor: 10000, currency: 'UAH', reason: 'NP claim', authority: 'test', transport: 'mock_http', lines: [{ ...line(1), total_minor: 10000 }], refund: null, physical_receipt: { ...receipt('paid'), carrier_receipt_id: 11 }, fiscal_document: null, actions: { refund: true, physical_receipt: true }, blocking_reasons: [] }
 const order = { profile: 'checkbox', authority: 'test', transport: 'mock_http', order_id: 321, revision: 6, sale_document: null, returns: [ret], actions: {}, blocking_reasons: [] }, readiness = { profile: 'checkbox', authority: 'test', transport: 'mock_http', register: { id: 'checkbox-test' }, profile_id: 'checkbox-test' }, posts = []
 const fixture = await setup({ component: 'OrderShopCheckboxReturns', api: async (path, options) => { if (options?.method === 'POST') { posts.push(path); return { ...ret, refund: { amount_minor: 10000 } } } if (path.endsWith('/readiness')) return readiness; return order } }); assert.equal(fixture.panel.record.value.carrier_receipt_id, 11); assert.equal(fixture.panel.canRecord('physical_receipt'), false); await fixture.panel.receiveReturn(); assert.equal(posts.length, 0); assert.equal(fixture.panel.canRecord('refund'), true); fixture.stop()
})

test('Backoffice labels render exact NP facts and keep unpaid projection independent', async () => {
 const source = (await readFile(new URL('../components/orders/OrderProjections.vue', import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
 for (const base of ['np_return_pending','np_return_received','np_return_fiscalized','np_refusal_closed']) for (const prefix of ['', 'simulated_']) {
  const state = prefix + base; Object.assign(globalThis, vue, { defineProps: () => ({ order: { payment_status: 'unpaid', fulfillment_status: state, fiscal_status: 'not_requested' } }) }); const actual = (await importSource(source + '\nexport { rows };')).rows.value
  assert.equal(actual[0][1], 'Не оплачено'); assert.notEqual(actual[1][1], state); if (prefix) assert.match(actual[1][1], /Тест/); else assert.doesNotMatch(actual[1][1], /Тест/)
 }
})

test('an old hydrated case cannot authorize replay while a fresh original-case permission read is pending', async () => {
 const original = record('paid', 'arrived', 2), lookup = deferred(); let filtered = false, deferLookup = false
 const fixture = await setup({ api: async (path, options) => { if (options?.method === 'POST') throw new Error('Unknown receipt result'); if (path.endsWith('/cases/7')) return deferLookup ? lookup.promise : original; return filtered ? { ...snapshot(), cases: [], eligible_lines: [], actions: {} } : withCase(original) } })
 fillReceipt(fixture.panel); await fixture.panel.runCase('receive'); filtered = true; await fixture.panel.reload(); await tick(); assert.equal(fixture.panel.record.value.id, 7); assert.equal(fixture.panel.canCase('receive'), true)
 deferLookup = true; const refreshing = fixture.panel.reload(); await tick()
 try { assert.equal(fixture.panel.canCase('receive'), false) } finally { lookup.resolve({ ...original, actions: {} }); await refreshing; fixture.stop() }
})

for (const code of ['np_return_unconfigured', 'np_return_profile_mismatch', 'np_return_manual_link_disabled', 'np_return_linkage_mismatch', 'np_return_proof_invalid', 'np_return_unavailable', 'checkbox_cash_rounding_unsupported']) test(`409 ${code} clears a proven read-only rejection so a corrected TTN gets a new intent`, async () => {
 let current = snapshot(); const posts = []
 const fixture = await setup({ api: async (_path, options) => {
  if (options?.method !== 'POST') return current
  posts.push(options)
  if (posts.length === 1) throw { status: 409, data: { detail: { code, message: 'Not accepted' } } }
  current = withCase({ ...record(), return_ttn: options.body.return_ttn }); return current.cases[0]
 } })
 fillAttach(fixture.panel); await fixture.panel.attachCase()
 assert.equal(fixture.storage.size, 0); assert.equal(fixture.panel.attach.intent.value, null)
 assert.notEqual(fixture.utilities.shopNPReason(code), fixture.utilities.shopNPReason('unknown')); assert.equal(fixture.panel.attach.error.value, fixture.utilities.shopNPReason(code))
 fixture.panel.returnTTN.value = '59000000000323'; fixture.panel.attachConfirmed.value = true
 assert.equal(fixture.panel.canAttach.value, true); await fixture.panel.attachCase()
 assert.equal(posts.length, 2); assert.notEqual(posts[0].headers['Idempotency-Key'], posts[1].headers['Idempotency-Key'])
 assert.equal(posts[1].body.return_ttn, '59000000000323'); assert.equal(fixture.storage.size, 0); fixture.stop()
})
