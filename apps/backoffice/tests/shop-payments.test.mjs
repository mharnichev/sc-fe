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
const hash = 'a'.repeat(64)
const policy = { id: 'manual-test', issuer: 'Synthetic carrier', account: 'TEST-ACCOUNT', types: ['bank_statement', 'carrier_settlement'], environment: 'test' }
const snapshot = (mode = 'prepayment', revision = 1) => ({ order_id: 321, revision, enabled: true, test_context: true, evidence: null, profile_id: mode === 'cod' ? policy.id : 'mono-test', profile_hash: hash, authority: 'none', mode, intent: null, payment: null, actions: { create_intent: mode === 'prepayment', verify_invoice: false, record_manual_cod: mode === 'cod' }, blocking_reasons: [], verification_status: null, readiness: { enabled: true, provider_available: true, profile_id: 'mono-test', profile_hash: hash, authority: 'test', transport: 'mock_http', manual_policy: policy, manual_policy_hash: hash, replay_actions: { invoice_intent: true, verify: true, manual_cod: true }, blocking_reasons: [] } })
const staged = () => { const value = snapshot('prepayment', 2); value.intent = { id: 'server-intent', reference: 'server-reference', amount_minor: 20000, currency: 'UAH', invoice_id: null, status: 'awaiting_invoice' }; value.actions = { create_intent: false, verify_invoice: true }; return value }
const paid = (mode = 'prepayment') => { const value = mode === 'cod' ? snapshot(mode, 3) : staged(); value.revision = 3; value.actions = {}; value.payment = { id: 9, amount_minor: 20000, currency: 'UAH', authority: mode === 'cod' ? 'manual' : 'test', source: mode === 'cod' ? 'manual' : 'provider', method: mode === 'cod' ? 'cod' : 'card', external_reference: 'proof-reference', created_at: '2026-10-18T12:00:00Z' }; return value }
const setup = async ({ api, storage = new Map(), mode = 'prepayment', component = 'OrderShopPayments' } = {}) => {
  const auth = vue.reactive({ user: { id: 2, can_record_sales: true } }), props = vue.reactive({ order: { id: 321, channel: 'shop', revision: 1 }, refreshToken: 0 }), events = []
  const utilities = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  const paymentUtilities = await importSource((await readFile(new URL('../utils/shopPayments.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
  Object.assign(globalThis, vue, utilities, paymentUtilities, { useAuthStore: () => auth, useApi: () => api || (async () => snapshot(mode)), defineProps: () => props, defineEmits: () => (...args) => events.push(args), useBookingFormatting: () => ({ formatMoney: String, formatDateTime: String }), localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
  const commandSource = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(commandSource))
  const source = (await readFile(new URL(`../components/orders/${component}.vue`, import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const expose = component === 'OrderShopPayments' ? 'state, loading, readError, invoiceId, cod, codEvidence, pinnedInvoiceId, lastVerificationStatus, stage, verify, manual, send, canRun, load, testAuthority' : 'state, send, canRun, manual, provider, handover, complete, externalReference, manualEvidence, manualConfirmed'
  const module = await importSource(`export function instantiate() {\n${source}\nreturn { ${expose} };\n}`)
  const scope = vue.effectScope(), panel = scope.run(() => module.instantiate()); await tick()
  return { panel, auth, props, storage, events, utilities: paymentUtilities, stop: () => scope.stop() }
}
const fillCOD = panel => { Object.assign(panel.cod, { type: 'bank_statement', source: 'Statement export', issuer: policy.issuer, account: policy.account, document_id: 'DOC-1', line_id: 'ROW-1', gross: '200.00', fee: '5.00', net: '195.00', settled: '2026-10-18T12:00:00Z', tracking_number: '20450000000001' }); panel.cod.verified = true }

test('mount is GET only; unavailable, denied and wrong-resource states fail closed', async () => {
  for (const kind of ['disabled', 'denied', 'mismatched']) {
    const calls = [], fixture = await setup({ api: async (_path, options) => { calls.push(options?.method || 'GET'); if (kind === 'denied') throw { status: 403 }; const value = snapshot(); if (kind === 'disabled') { value.actions = {}; value.enabled = false } else value.order_id = 999; return value } })
    await fixture.panel.send('invoice_intent'); assert.deepEqual(calls, ['GET']); assert.equal(fixture.panel.canRun('invoice_intent'), false); fixture.stop()
  }
})
test('reference staging sends only server revision/profile assertions, no bank invoice or paid authority', async () => {
  const posts = []; let current = snapshot()
  const fixture = await setup({ api: async (path, options) => { if (options?.method === 'POST') { posts.push({ path, ...options }); current = staged() } return current } })
  await fixture.panel.send('invoice_intent'); assert.equal(posts.length, 1); assert.equal(posts[0].path, '/backoffice/shop-payments/orders/321/invoice-intent')
  assert.deepEqual(posts[0].body, { expected_revision: 1, expected_profile_id: 'mono-test', expected_profile_hash: hash }); assert.equal(posts[0].retry, 0); assert.ok(posts[0].headers['Idempotency-Key']); assert.equal(fixture.storage.size, 0); assert.equal(fixture.panel.state.value.intent.reference, 'server-reference'); fixture.stop()
})
test('pending verification pins invoice, creates no payment and a deliberate fresh check uses a new key', async () => {
  const posts = []; let current = staged()
  const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts.push(options); current = { ...current, intent: { ...current.intent, invoice_id: options.body.invoice_id, status: 'awaiting_verification' } }; if (posts.length === 2) current = paid(); return { ...current, verification_status: posts.length === 1 ? 'processing' : 'success' } } return current } })
  fixture.panel.invoiceId.value = 'original-invoice'; await fixture.panel.send('verify'); assert.equal(fixture.panel.state.value.payment, null); assert.equal(fixture.panel.lastVerificationStatus.value, 'processing'); assert.equal(fixture.storage.size, 0)
  fixture.panel.invoiceId.value = 'replacement-invoice'; await fixture.panel.send('verify'); assert.equal(posts[1].body.invoice_id, 'original-invoice'); assert.notEqual(posts[0].headers['Idempotency-Key'], posts[1].headers['Idempotency-Key']); assert.ok(fixture.panel.state.value.payment); fixture.stop()
})
test('a lost accepted response survives reload and flagoff as exact same key/body; canonical GET wins over cached ACK', async () => {
  const storage = new Map(), posts = []; let current = staged(), accepted
  const api = async (_path, options) => { if (options?.method !== 'POST') return current; posts.push(options); if (!accepted) { accepted = paid(); current = { ...paid(), revision: 7, enabled: false }; throw new Error('lost browser response after commit') } return accepted }
  const first = await setup({ api, storage }); first.panel.invoiceId.value = 'original-invoice'; await first.panel.send('verify'); first.stop()
  const second = await setup({ api, storage }); await second.panel.send('verify'); assert.deepEqual(posts[1], posts[0]); assert.equal(second.panel.state.value.revision, 7); assert.equal(storage.size, 0); second.stop()
})
test('known ACK with failed canonical GET recovers by GET only after reload', async () => {
  const storage = new Map(); let posts = 0, fail = false, current = staged()
  const api = async (_path, options) => { if (options?.method === 'POST') { posts++; current = paid(); fail = true; return current } if (fail) throw new Error('canonical unavailable'); return current }
  const first = await setup({ api, storage }); first.panel.invoiceId.value = 'invoice'; await first.panel.send('verify'); assert.equal(JSON.parse([...storage.values()][0]).resultId, 321); first.stop()
  fail = false; const second = await setup({ api, storage }); await second.panel.send('verify'); assert.equal(posts, 1); assert.equal(storage.size, 0); second.stop()
})
test('profile changes block a saved unknown request without rewriting or dispatching it', async () => {
  let current = staged(), posts = 0
  const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts++; throw new Error('unknown outcome') } return current } })
  fixture.panel.invoiceId.value = 'invoice'; await fixture.panel.send('verify'); const original = [...fixture.storage.values()][0]
  current = { ...staged(), profile_id: 'replacement', profile_hash: 'b'.repeat(64) }; current.readiness = { ...current.readiness, profile_id: 'replacement', profile_hash: 'b'.repeat(64) }; await fixture.panel.load(); await fixture.panel.send('verify'); assert.equal(posts, 1); assert.equal([...fixture.storage.values()][0], original); fixture.stop()
})
test('current permission revocation blocks unknown replay without clearing it', async () => {
  let current = staged(), posts = 0
  const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts++; throw new Error('unknown') } return current } }); fixture.panel.invoiceId.value = 'invoice'; await fixture.panel.send('verify')
  current = { ...staged(), actions: {}, readiness: { ...staged().readiness, replay_actions: {} } }; fixture.auth.user = { id: 2, can_record_sales: false }; await tick(); await fixture.panel.send('verify'); assert.equal(posts, 1); assert.equal(fixture.storage.size, 1); fixture.stop()
})
for (const change of ['actor', 'order', 'permissions', 'unmount']) test(`late ACK after ${change} does not clear a preserved intent or emit stale changes`, async () => {
  const reply = deferred(); const fixture = await setup({ api: async (path, options) => { if (options?.method === 'POST') return reply.promise; return { ...staged(), order_id: path.includes('/322') ? 322 : 321 } } }); fixture.panel.invoiceId.value = 'invoice'; const pending = fixture.panel.send('verify'); await tick()
  if (change === 'actor') fixture.auth.user = { id: 3, can_record_sales: true }; else if (change === 'order') fixture.props.order = { id: 322, channel: 'shop', revision: 1 }; else if (change === 'permissions') fixture.auth.user = { id: 2, can_record_sales: false }; else fixture.stop()
  reply.resolve(paid()); await pending; assert.equal(fixture.storage.size, 1); assert.deepEqual(fixture.events, []); fixture.stop()
})
test('double activation sends one request; readonly refresh during acceptance does not invalidate recovery callback', async () => {
  const reply = deferred(); let posts = 0, current = staged()
  const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') { posts++; return reply.promise } return current } }); fixture.panel.invoiceId.value = 'invoice'; const first = fixture.panel.send('verify'), second = fixture.panel.send('verify'); await tick(); fixture.props.refreshToken++; await tick(); current = paid(); reply.resolve(current); await Promise.all([first, second]); assert.equal(posts, 1); assert.equal(fixture.storage.size, 0); assert.deepEqual(fixture.events, [['changed']]); fixture.stop()
})
test('COD evidence needs a complete exact decimal settlement and renewed human attestation', async () => {
  const posts = []; let current = snapshot('cod')
  const fixture = await setup({ mode: 'cod', api: async (_path, options) => { if (options?.method === 'POST') { posts.push(options); current = paid('cod') } return current } }); fillCOD(fixture.panel); fixture.panel.cod.net = '194.99'; fixture.panel.cod.verified = true; await fixture.panel.send('manual_cod'); assert.equal(posts.length, 0)
  fixture.panel.cod.net = '195.00'; assert.equal(fixture.panel.cod.verified, false); await fixture.panel.send('manual_cod'); assert.equal(posts.length, 0); fixture.panel.cod.verified = true; await fixture.panel.send('manual_cod'); assert.equal(posts.length, 1)
  assert.deepEqual(posts[0].body, { expected_revision: 1, expected_profile_id: policy.id, expected_profile_hash: hash, evidence: { type: 'bank_statement', source: 'Statement export', issuer: policy.issuer, account: policy.account, document_id: 'DOC-1', line_id: 'ROW-1', gross_amount_minor: 20000, fee_minor: 500, net_amount_minor: 19500, currency: 'UAH', settled_at: '2026-10-18T12:00:00.000Z', tracking_number: '20450000000001', verified: true } }); assert.equal(fixture.panel.state.value.payment.authority, 'manual'); fixture.stop()
})
test('COD unknown outcome replays original document despite changed visible inputs', async () => {
  const posts = []; let current = snapshot('cod')
  const fixture = await setup({ mode: 'cod', api: async (_path, options) => { if (options?.method !== 'POST') return current; posts.push(options); if (posts.length === 1) throw new Error('lost'); current = paid('cod'); return current } }); fillCOD(fixture.panel); await fixture.panel.send('manual_cod'); fixture.panel.cod.document_id = 'DO-NOT-SEND'; await fixture.panel.send('manual_cod'); assert.deepEqual(posts[1], posts[0]); assert.equal(fixture.storage.size, 0); fixture.stop()
})
for (const status of [409, 503]) test(`${status} structured rejection ${status === 409 ? 'releases a known rejected key' : 'retains exact unknown request'}`, async () => {
  const fixture = await setup({ api: async (_path, options) => { if (options?.method === 'POST') throw { status, data: { detail: { code: 'payment_profile_conflict', message: 'Profile changed' } } }; return staged() } }); fixture.panel.invoiceId.value = 'invoice'; await fixture.panel.send('verify'); assert.equal(fixture.storage.size, status === 409 ? 0 : 1); fixture.stop()
})
test('legacy B1 money and retries are blocked only for server-selected R2; physical actions remain separate', async () => {
  for (const profile of ['legacy', 'r2']) {
    const fixture = await setup({ component: 'OrderShopOperations', api: async () => ({ order_id: 321, revision: 1, order: { id: 321, channel: 'shop', revision: 1, total_amount: '200.00' }, stage: 'reserved', authority: 'none', payment: null, fulfillment: null, completion: null, payments_profile: profile, available_payment_methods: ['bank_transfer'], actions: { record_manual_payment: true, record_provider_payment: true, handover: true, replay_manual_payment: true }, blocking_reasons: [] }) })
    assert.equal(fixture.panel.canRun('manual_payment'), profile === 'legacy'); assert.equal(fixture.panel.canRun('provider_payment'), profile === 'legacy'); assert.equal(fixture.panel.canRun('handover'), true); fixture.stop()
  }
})
test('minor-unit parsing rejects exponent/precision/unsafe numbers and accepts zero fees', async () => {
  const fixture = await setup(); const parse = fixture.utilities.shopSettlementMinor
  for (const value of ['1e2', '1.001', '-1', 'NaN', '900719925474099.99']) assert.equal(parse(value), null)
  assert.equal(parse('0.00'), 0); assert.equal(parse('1.01'), 101); assert.equal(fixture.utilities.shopInvoiceIdValid('x'.repeat(101)), false); fixture.stop()
})

test('durable manual test context stays explicit after bank/policy configuration changes and audit survives reload', async () => {
  const current = paid('cod'); current.readiness = { ...current.readiness, authority: 'none', transport: 'unavailable', manual_policy: { ...policy, environment: 'production' } }; current.evidence = { id: 4, kind: 'cod', authority: 'manual', test_context: true, operator_id: 2, created_at: '2026-10-18T12:00:00Z', proof_hash: hash, proof: { document_id: 'DOC-1', line_id: 'ROW-1', account: policy.account, tracking_number: '20450000000001', gross_amount_minor: 20000, fee_minor: 500, net_amount_minor: 19500, settled_at: '2026-10-18T12:00:00Z' } }
  const fixture = await setup({ api: async () => current }); assert.equal(fixture.panel.testAuthority.value, true); const rows = fixture.utilities.shopPaymentEvidenceRows(fixture.panel.state.value.evidence); assert.equal(rows.find(row => row.label === 'Рядок').value, 'ROW-1'); assert.equal(rows.find(row => row.label === 'Валова сума').value, '200.00 грн'); assert.equal(rows.find(row => row.label === 'Комісія').value, '5.00 грн'); fixture.stop()
})

for (const knownACK of [false, true]) test(`legacy payment accepted before R2 recovers exact saved ${knownACK ? 'known ACK with GET only' : 'unknown ACK with cached POST'} and unlocks physical actions`, async () => {
  const storage = new Map(), posts = []; let failRead = false
  const legacy = { order_id: 321, revision: 1, order: { id: 321, channel: 'shop', revision: 1, total_amount: '200.00' }, stage: 'reserved', authority: 'manual', payment: null, fulfillment: null, completion: null, payments_profile: 'legacy', available_payment_methods: ['bank_transfer'], actions: { record_manual_payment: true, replay_manual_payment: true }, blocking_reasons: [] }
  const current = { ...legacy, revision: 2, order: { ...legacy.order, revision: 2 }, payments_profile: 'r2', stage: 'paid', payment: { id: 1, authority: 'manual' }, actions: { record_manual_payment: false, replay_manual_payment: true, handover: true } }; let canonical = legacy
  const api = async (_path, options) => { if (options?.method === 'POST') { posts.push(options); canonical = current; if (posts.length === 1 && !knownACK) throw new Error('old committed ACK lost'); if (knownACK) failRead = true; return current } if (failRead) throw new Error('known ACK canonical read lost'); return canonical }
  const first = await setup({ component: 'OrderShopOperations', api, storage }); first.panel.externalReference.value = 'OLD-REF'; first.panel.manualEvidence.value = 'Old verified statement'; first.panel.manualConfirmed.value = true; await first.panel.send('manual_payment'); first.stop(); assert.equal(storage.size, 1)
  failRead = false; const second = await setup({ component: 'OrderShopOperations', api, storage }); assert.equal(second.panel.canRun('manual_payment'), true); await second.panel.send('manual_payment'); assert.equal(posts.length, knownACK ? 1 : 2); if (!knownACK) assert.deepEqual(posts[1], posts[0]); assert.equal(storage.size, 0); assert.equal(second.panel.canRun('manual_payment'), false); assert.equal(second.panel.canRun('handover'), true); second.stop()
})

test('legacy never-accepted saved request clears only the explicit R2 workflow rejection and leaves R2 usable', async () => {
  const storage = new Map(); const legacy = { order_id: 321, revision: 1, order: { id: 321, channel: 'shop', revision: 1, total_amount: '200.00' }, stage: 'reserved', authority: 'none', payment: null, fulfillment: null, completion: null, payments_profile: 'legacy', available_payment_methods: ['bank_transfer'], actions: { record_manual_payment: true, replay_manual_payment: true }, blocking_reasons: [] }; let selected = false, posts = 0
  const fixture = await setup({ component: 'OrderShopOperations', storage, api: async (_path, options) => { if (options?.method === 'POST') { posts++; selected = true; throw { status: 409, data: { detail: { code: 'shop_payments_workflow_required', message: 'Use R2 payment workflow; no payment accepted' } } } } return selected ? { ...legacy, payments_profile: 'r2', actions: { replay_manual_payment: true } } : legacy } })
  fixture.panel.externalReference.value = 'NOT-ACCEPTED'; fixture.panel.manualEvidence.value = 'Synthetic'; fixture.panel.manualConfirmed.value = true; await fixture.panel.send('manual_payment'); assert.equal(posts, 1); assert.equal(storage.size, 0); assert.equal(fixture.panel.manual.intent.value, null); assert.equal(fixture.panel.canRun('manual_payment'), false); fixture.stop()
  const r2 = await setup({ storage }); assert.equal(r2.panel.canRun('invoice_intent'), true); r2.stop()
})

test('persisted COD audit renders the two supported document types in operator language', async () => {
 const fixture = await setup(); for (const [type, expected] of [['bank_statement', 'Банківська виписка'], ['carrier_settlement', 'Реєстр розрахунків перевізника']]) { const rows = fixture.utilities.shopPaymentEvidenceRows({ kind: 'cod', proof: { type } }); assert.equal(rows.find(row => row.label === 'Тип документа').value, expected) }; fixture.stop()
})
