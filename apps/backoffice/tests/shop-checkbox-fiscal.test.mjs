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
const tick = () => new Promise(resolve => setImmediate(resolve)), settle = async () => { await tick(); await tick(); await tick() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const common = { authority: 'test', transport: 'mock_http' }
const actions = names => Object.fromEntries(names.flatMap(name => [[name, true], [`replay_${name}`, true]]))
const line = { order_item_id: 7, product_id: 1, name: 'Item', quantity: 2, total_minor: 20000, unit_price_minor: 10000, tax_codes: [0] }
const snapshot = { kind: 'sale', amount_minor: 20000, currency: 'UAH', shift_id: 'shift-1', items: [line], payment: { type: 'CASHLESS', label: 'Bank transfer', code: 1, value: 20000 }, related_receipt_id: null }
const operation = (kind = 'sale', status = 'queued') => ({ ...common, id: kind === 'sale' ? 42 : 31, kind, status, revision: 1, order_id: kind === 'sale' ? 321 : null, document_id: kind === 'sale' ? 12 : null, provider_uuid: kind === 'x' ? null : 'original-uuid', shift_id: 'shift-1', snapshot_hash: 'a'.repeat(64), dispatched_at: null, acceptance_verified: status === 'accepted', accepted_at: null, result: null, actions: actions(['process', 'reconcile', 'cancel']), blocking_reasons: [] })
const register = () => ({ ...common, id: 'profile-A', revision: 3, identity_verified: true, shift_id: 'shift-1', shift_status: 'open', pending_operation: null, actions: actions(['open', 'close', 'x', 'z']), reconciliation: { pending_operation_ids: [], unreceipted_payment_ids: [], unresolved_return_ids: [] }, reports: [] })
const readiness = () => ({ ...common, profile: 'checkbox', profile_id: 'profile-A', configured: true, enabled: true, identity_verified: true, policy_available: true, register: register(), actions: actions(['verify']), blocking_reasons: [] })
const document = (status = 'queued', id = 12) => ({ ...common, id, order_id: 321, return_id: null, kind: 'sale', status, revision: 1, provider_uuid: 'original-uuid', shift_id: 'shift-1', is_sent_dps: false, acceptance_verified: status === 'issued', amount_minor: 20000, currency: 'UAH', snapshot, snapshot_hash: 'a'.repeat(64), operation: operation(), created_at: '', issued_at: null, actions: actions(['process', 'reconcile', 'cancel', 'print']), blocking_reasons: [] })
const order = () => ({ ...common, profile: 'checkbox', enabled: true, order_id: 321, revision: 5, sale_document: null, returns: [], actions: actions(['sale_preview', 'approve_sale', 'create_return']), blocking_reasons: [] })
const preview = () => ({ ...common, id: 10, order_id: 321, return_id: null, kind: 'sale', expected_revision: 5, register_revision: 3, snapshot, snapshot_hash: 'a'.repeat(64), expires_at: '2099-01-01T00:00:00Z' })
const returnRecord = () => ({ ...common, id: 8, order_id: 321, sale_document_id: 12, revision: 1, amount_minor: 10000, currency: 'UAH', lines: [{ ...line, quantity: 1, total_minor: 10000 }], reason: 'Partial', refund: null, physical_receipt: null, fiscal_document: null, actions: actions(['refund', 'physical_receipt', 'receipt_preview', 'approve_receipt']), blocking_reasons: [] })
const setup = async (name, api, storage = new Map(), overrides = {}) => {
  const auth = vue.reactive({ user: { id: 2, can_record_sales: true, can_manage_fiscal_settings: true } }), props = vue.reactive({ order: { id: 321, channel: 'shop', revision: 5, fulfillment_method: 'pickup' }, ...overrides }), events = []
  const local = new Proxy({}, { ownKeys: () => [...storage.keys()], getOwnPropertyDescriptor: (_, key) => storage.has(key) ? { enumerable: true, configurable: true } : undefined, get: (_, key) => key === 'getItem' ? name => storage.get(name) ?? null : key === 'setItem' ? (name, value) => storage.set(name, value) : key === 'removeItem' ? name => storage.delete(name) : undefined })
  Object.assign(globalThis, vue, { useAuthStore: () => auth, useApi: () => api, defineProps: () => props, defineEmits: () => (...args) => events.push(args), localStorage: local })
  for (const path of ['../utils/orderSales.ts', '../composables/useOrderSalesCommand.ts', '../utils/shopCheckboxFiscal.ts']) Object.assign(globalThis, await importSource((await readFile(new URL(path, import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')))
  const source = (await readFile(new URL(`../components/orders/${name}.vue`, import.meta.url), 'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const exported = { OrderShopCheckboxFiscal: 'read, entity, document, preview, operation, proofError, prepare, approve, process, reconcile, cancel, confirmed, cancelEvidence, can, canDocument, createPreview, submit, runDocument, reload', OrderShopCheckboxReturns: 'read, record, quantities, reason, confirmed, selectedId, dispositions, goodsFit, receiptEvidence, receiptConfirmed, refundReference, refundEvidence, refundConfirmed, create, refund, receive, canCreate, canRecord, createReturn, refundReturn, receiveReturn, reload', ShopCheckboxReports: 'read, register, operation, initial, verify, open, close, x, z, process, reconcile, cancel, confirmed, kind, candidate, cancelEvidence, canInitial, canOperation, send, runOperation, reload, totals' }[name]
  const module = await importSource(`export function instantiate() { ${source}\nreturn { ${exported} }; }`), scope = vue.effectScope(), component = scope.run(() => module.instantiate()); await settle()
  return { component, auth, props, storage, events, stop: () => scope.stop() }
}
for (const name of ['OrderShopCheckboxFiscal','OrderShopCheckboxReturns','ShopCheckboxReports']) test(`${name}: mount is GET-only and authority/transport mismatch fails closed`, async () => {
  const calls = []; const fixture = await setup(name, async (path, options) => { calls.push(options?.method || 'GET'); return path.endsWith('/readiness') ? readiness() : order() }); assert.ok(calls.length); assert.ok(calls.every(method => method === 'GET')); fixture.stop()
  const bad = await setup(name, async path => ({ ...(path.endsWith('/readiness') ? readiness() : order()), authority: 'provider', transport: 'mock_http' })); assert.equal(bad.component.read.state.value, null); assert.ok(bad.component.read.error.value); bad.stop()
})
test('profile and upstream DONE never imply fiscal acceptance; MockHTTP always remains explicitly test', async () => {
  const helpers = await importSource((await readFile(new URL('../utils/shopCheckboxFiscal.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
  assert.match(helpers.checkboxNotice(common), /ЛОКАЛЬНИЙ MOCK HTTP/); assert.match(helpers.checkboxNotice(common), /реальних операцій/)
  assert.equal(helpers.checkboxDocumentIssued({ ...document('issued'), acceptance_verified: false }), false)
  assert.match(helpers.checkboxDocumentStatus({ ...document('issued'), acceptance_verified: false }), /видачу не підтверджено/)
  assert.equal(helpers.checkboxDocumentIssued(document('issued')), true); assert.equal(helpers.checkboxDocumentIssued({ ...document('issued'), is_sent_dps: true }), false)
  assert.equal(helpers.checkboxDocumentIssued({ ...document('issued'), authority: 'provider', transport: 'live', is_sent_dps: false }), false)
  assert.equal(helpers.checkboxDocumentIssued({ ...document('issued'), authority: 'provider', transport: 'live', is_sent_dps: true }), true)
})
test('sale approval sends only exact preview identity/revision/confirmation, then process is a separate command', async () => {
  const posts = []; let current = order()
  const fixture = await setup('OrderShopCheckboxFiscal', async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); if (path.endsWith('/sale-preview')) return preview(); if (path.endsWith('/sale-receipts')) { current = { ...current, sale_document: document() }; return document() }; current = { ...current, sale_document: document('issued') }; return operation('sale', 'unknown') }
    return path.endsWith('/readiness') ? readiness() : path.endsWith('/previews/10') ? preview() : path.endsWith('/documents/12') ? current.sale_document : path.endsWith('/operations/42') ? operation('sale', 'accepted') : current
  }), c = fixture.component
  await c.createPreview(); c.confirmed.value = true; await c.submit(); assert.equal(posts.length, 2); assert.deepEqual(posts[1].body, { expected_revision: 5, preview_id: 10, confirm: true }); assert.equal(c.document.value.status, 'queued')
  await Promise.all([c.runDocument('process'), c.runDocument('process')]); assert.equal(posts.length, 3); assert.deepEqual(posts[2].body, { expected_revision: 1 }); assert.equal(c.document.value.status, 'issued'); assert.equal(c.operation.value.status, 'accepted'); assert.equal(fixture.storage.size, 0); fixture.stop()
})
test('lost document process recovers original register/key/body/target despite new profile and replacement document', async () => {
  const storage = new Map(), posts = []; let accepted = false, lost = true
  const api = async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); accepted = true; if (lost) { lost = false; throw new Error('Lost ACK') } return operation('sale', 'unknown') }
    if (path.endsWith('/readiness')) return accepted ? { ...readiness(), enabled: false, register: { ...register(), id: 'profile-B' } } : readiness()
    if (path.endsWith('/documents/12')) return { ...document('issued'), actions: { replay_process: true } }
    if (path.endsWith('/operations/42')) return operation('sale', 'accepted')
    return { ...order(), enabled: !accepted, sale_document: document('queued', accepted ? 13 : 12) }
  }
  const first = await setup('OrderShopCheckboxFiscal', api, storage); await first.component.runDocument('process'); assert.equal(storage.size, 1); const stored = JSON.parse([...storage.values()][0]); assert.equal(stored.body.register_id, 'profile-A'); first.stop()
  const second = await setup('OrderShopCheckboxFiscal', api, storage); assert.equal(second.component.document.value.id, 12); assert.equal(second.component.process.register.value, 'profile-A'); await second.component.runDocument('process'); await settle(); assert.deepEqual(posts[1], posts[0]); assert.equal(second.component.document.value.id, 13); assert.equal(storage.size, 0); assert.equal(second.component.process.register.value, 'profile-B'); second.stop()
})
for (const kind of ['sale','return']) test(`${kind}: cancelled original document remains recoverable after lost ACK and disappearing active document`, async () => {
  const posts = [], storage = new Map(); let accepted = false, lost = true
  const old = { ...document(), kind, return_id: kind === 'return' ? 8 : null }
  const api = async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); accepted = true; if (lost) { lost = false; throw new Error('Lost cancellation') } return { ...old, status: 'cancelled' } }
    if (path.endsWith('/readiness')) return readiness()
    if (path.endsWith('/documents/12')) return { ...old, status: 'cancelled', actions: { replay_cancel: true } }
    return kind === 'return' ? { ...returnRecord(), fiscal_document: accepted ? null : old } : { ...order(), sale_document: accepted ? null : old }
  }
  const props = kind === 'return' ? { returnId: 8 } : {}, first = await setup('OrderShopCheckboxFiscal', api, storage, props); first.component.cancelEvidence.value = 'Wrong unsubmitted preview'; await first.component.runDocument('cancel'); first.stop()
  const second = await setup('OrderShopCheckboxFiscal', api, storage, props); assert.equal(second.component.document.value.id, 12); await second.component.runDocument('cancel'); assert.deepEqual(posts[1], posts[0]); assert.equal(storage.size, 0); second.stop()
})
test('X approval queues only; explicit processing handles immutable unknown ACK with canonical operation hydration', async () => {
  const posts = []; let op = null
  const fixture = await setup('ShopCheckboxReports', async (path, options) => {
    if (options?.method === 'POST') { posts.push({ path, ...options }); op = operation('x', path.endsWith('/process') ? 'unknown' : 'queued'); return op }
    return path.includes('/operations/') ? op : { ...readiness(), register: { ...register(), pending_operation: op } }
  }), c = fixture.component
  c.confirmed.value = true; await c.send('x'); assert.equal(posts.length, 1); assert.deepEqual(posts[0].body, { expected_profile_id: 'profile-A', expected_revision: 3, confirm: true }); assert.equal(c.operation.value.status, 'queued')
  await c.runOperation('process'); assert.equal(posts.length, 2); assert.ok(posts[1].path.endsWith('/operations/31/process')); assert.deepEqual(posts[1].body, { expected_revision: 1 }); assert.equal(c.operation.value.status, 'unknown'); fixture.stop()
})
test('unknown X requires discovered candidate only on explicit reconcile; it never creates/reposts X', async () => {
  const posts = []; let op = operation('x', 'unknown')
  const fixture = await setup('ShopCheckboxReports', async (path, options) => { if (options?.method === 'POST') { posts.push({ path, ...options }); op = { ...operation('x', 'accepted'), provider_uuid: options.body.candidate_report_uuid }; return op }; return path.includes('/operations/') ? op : { ...readiness(), register: { ...register(), pending_operation: op } } }), c = fixture.component
  await c.runOperation('reconcile'); assert.equal(posts.length, 0); c.candidate.value = '12345678-1234-4234-8234-123456789abc'; await c.runOperation('reconcile'); assert.equal(posts.length, 1); assert.ok(posts[0].path.endsWith('/operations/31/reconcile')); assert.deepEqual(posts[0].body, { expected_revision: 1, candidate_report_uuid: '12345678-1234-4234-8234-123456789abc' }); assert.equal(c.operation.value.acceptance_verified, true); fixture.stop()
})
test('lost X approval replays exact queued operation without creating provider work or changing register revision', async () => {
  const posts = [], storage = new Map(); let op = null, lost = true
  const api = async (path, options) => { if (options?.method === 'POST') { posts.push({ path, ...options }); op = operation('x'); if (lost) { lost = false; throw new Error('Lost queued ACK') }; return op }; return path.includes('/operations/') ? op : { ...readiness(), enabled: !op, register: { ...register(), revision: op ? 5 : 3, pending_operation: op, actions: { x: !op, replay_x: true } } } }
  const first = await setup('ShopCheckboxReports', api, storage); first.component.confirmed.value = true; await first.component.send('x'); first.stop()
  const second = await setup('ShopCheckboxReports', api, storage); await second.component.send('x'); assert.deepEqual(posts[1], posts[0]); assert.equal(storage.size, 0); assert.equal(posts.length, 2); second.stop()
})
test('return/refund/physical receipt are separate exact facts, money/authority never supplied by client', async () => {
  const posts = []; let returns = []
  const fixture = await setup('OrderShopCheckboxReturns', async (path, options) => { if (options?.method === 'POST') { posts.push({ path, ...options }); returns = [returnRecord()]; return returns[0] }; return path.endsWith('/readiness') ? readiness() : { ...order(), sale_document: document('issued'), returns } }), c = fixture.component
  c.quantities.value = { 7: 1 }; c.reason.value = 'Partial returned pickup'; c.confirmed.value = true; await c.createReturn(); assert.deepEqual(posts[0].body, { expected_revision: 5, sale_document_id: 12, lines: [{ order_item_id: 7, quantity: 1 }], reason: 'Partial returned pickup' })
  c.refundReference.value = 'REF-1'; c.refundEvidence.value = 'Staff checked bank statement'; c.refundConfirmed.value = true; await c.refundReturn(); assert.deepEqual(posts[1].body, { expected_revision: 1, external_reference: 'REF-1', evidence: 'Staff checked bank statement' })
  c.dispositions.value = { 7: 'restock' }; c.receiptEvidence.value = 'Pickup return inspected'; c.goodsFit.value = true; c.receiptConfirmed.value = true; await c.receiveReturn(); assert.deepEqual(posts[2].body, { expected_revision: 1, lines: [{ order_item_id: 7, quantity: 1, disposition: 'restock' }], evidence: 'Pickup return inspected' }); assert.equal(fixture.storage.size, 0); fixture.stop()
})
test('NP returns remain blocked even if client has inventory/sales permissions', async () => {
  let posts = 0; const fixture = await setup('OrderShopCheckboxReturns', async (path, options) => { if (options?.method === 'POST') posts++; return path.endsWith('/readiness') ? readiness() : { ...order(), sale_document: document('issued') } }, new Map(), { order: { id: 321, fulfillment_method: 'nova_poshta' } }); fixture.component.quantities.value = { 7: 1 }; fixture.component.reason.value = 'NP'; fixture.component.confirmed.value = true; await fixture.component.createReturn(); assert.equal(posts, 0); assert.equal(fixture.component.canCreate.value, false); fixture.stop()
})
for (const change of ['actor','permissions','order','unmount']) test(`late canonical reads cannot hydrate old context after ${change}`, async () => {
  const wait = deferred(); let delayed = false
  const fixture = await setup('OrderShopCheckboxReturns', async path => { if (path.endsWith('/readiness')) return readiness(); if (delayed) { delayed = false; return wait.promise }; return order() }); delayed = true; const pending = fixture.component.read.load()
  if (change === 'actor') fixture.auth.user.id = 3
  if (change === 'permissions') fixture.auth.user.can_record_sales = false
  if (change === 'order') fixture.props.order.id = 999
  if (change === 'unmount') fixture.stop()
  wait.resolve({ ...order(), revision: 12345 }); await pending; await settle(); assert.notEqual(fixture.component.read.state.value?.revision, 12345); fixture.stop()
})
test('server permission revocation blocks exact pending refund without destroying it', async () => {
  let allowed = true, posts = 0
  const fixture = await setup('OrderShopCheckboxReturns', async (path, options) => { if (options?.method === 'POST') { posts++; throw new Error('Unknown') }; return path.endsWith('/readiness') ? readiness() : { ...order(), returns: [{ ...returnRecord(), actions: { refund: allowed, replay_refund: allowed } }] } }), c = fixture.component
  c.refundReference.value = 'REF'; c.refundEvidence.value = 'Evidence'; c.refundConfirmed.value = true; await c.refundReturn(); assert.equal(fixture.storage.size, 1); allowed = false; fixture.auth.user.can_record_sales = false; await settle(); assert.equal(c.canRecord('refund'), false); await c.refundReturn(); assert.equal(posts, 1); assert.equal(fixture.storage.size, 1); fixture.stop()
})

test('lost queued operation cancellation reloads original target and replays exact body/key', async () => {
  const storage = new Map(), posts = []; let op = operation('x'), lost = true
  const api = async (path, options) => { if (options?.method === 'POST') { posts.push({path,...options}); op = { ...op, status: 'cancelled', actions: { replay_cancel: true } }; if (lost) { lost=false; throw new Error('Lost cancel ACK') }; return op }; return path.includes('/operations/') ? op : { ...readiness(), register: { ...register(), pending_operation: op.status === 'cancelled' ? null : op } } }
  const first = await setup('ShopCheckboxReports',api,storage); first.component.cancelEvidence.value='Unsubmitted duplicate'; await first.component.runOperation('cancel'); first.stop()
  const second = await setup('ShopCheckboxReports',api,storage); assert.equal(second.component.operation.value.id,31); await second.component.runOperation('cancel'); assert.deepEqual(posts[1],posts[0]); assert.equal(storage.size,0); second.stop()
})
for (const code of ['unsupported_zero_total','checkbox_cash_rounding_unsupported','checkbox_history_unbound','checkbox_proof_mismatch']) test(`${code}: only definitive preflight failure clears intent`, async () => {
  const storage=new Map(), fixture=await setup('OrderShopCheckboxReturns',async(path,options)=>{ if(options?.method==='POST') throw {status:409,data:{detail:{code}}}; return path.endsWith('/readiness')?readiness():{...order(),sale_document:document('issued')} },storage), c=fixture.component
  c.quantities.value={7:1};c.reason.value='Partial';c.confirmed.value=true;await c.createReturn()
  assert.equal(storage.size,code==='checkbox_proof_mismatch'?1:0); assert.equal(!!c.create.intent.value,code==='checkbox_proof_mismatch');fixture.stop()
})
test('malformed persisted profile command blocks replacement work without deleting evidence', async()=>{
  const storage=new Map([['sc-sales:v1:2:checkbox-x:checkbox:profile-A:register',JSON.stringify({key:'original',body:{profile:'checkbox',register_id:'profile-A',resource:'register'}})]]);let posts=0
  const fixture=await setup('ShopCheckboxReports',async(path,options)=>{if(options?.method==='POST')posts++;return readiness()},storage);fixture.component.confirmed.value=true;await fixture.component.send('x');assert.equal(posts,0);assert.equal(storage.size,1);assert.ok(fixture.component.x.error.value);fixture.stop()
})

test('verified Z displays totals from its verified closing-shift report; unknown totals stay hidden', async()=>{
  const fixture=await setup('ShopCheckboxReports',async()=>readiness()), result={z_report:{totals:{sales_minor:20000,returns_minor:10000,net_minor:10000,sale_count:1,return_count:1}}}
  assert.equal(fixture.component.totals({...operation('z','accepted'),result})?.net_minor,10000)
  assert.equal(fixture.component.totals({...operation('z','unknown'),result}),null); fixture.stop()
})

test('first profile verification queues with server profile identity before any register exists', async()=>{
  const posts=[];let created=false
  const fixture=await setup('ShopCheckboxReports',async(path,options)=>{if(options?.method==='POST'){posts.push({path,...options});created=true;return operation('verify')};if(path.includes('/operations/'))return operation('verify');return {...readiness(),register:created?register():null}},new Map()), c=fixture.component
  assert.equal(c.verify.register.value,'profile-A');c.confirmed.value=true;await c.send('verify');assert.equal(posts.length,1);assert.equal(posts[0].path,'/backoffice/shop-checkbox/verify');assert.deepEqual(posts[0].body,{expected_profile_id:'profile-A',confirm:true});assert.equal(c.operation.value.kind,'verify');fixture.stop()
})

test('lost initial approval with no result ID cannot replay against a different server profile',async()=>{
  const posts=[],storage=new Map();let switched=false
  const api=async(path,options)=>{if(options?.method==='POST'){posts.push({path,...options});switched=true;throw new Error('Lost accepted ACK')};return {...readiness(),profile_id:switched?'profile-B':'profile-A',register:{...register(),id:switched?'profile-B':'profile-A'}}}
  const first=await setup('ShopCheckboxReports',api,storage);first.component.confirmed.value=true;await first.component.send('x');first.stop()
  const second=await setup('ShopCheckboxReports',api,storage);assert.equal(second.component.x.register.value,'profile-A');assert.equal(second.component.canInitial('x'),false);await second.component.send('x');assert.equal(posts.length,1);assert.equal(storage.size,1);second.stop()
})

test('known queued operation ID can hydrate original profile after config switch without another POST',async()=>{
 const storage=new Map(),posts=[];let broken=true
 const api=async(path,options)=>{if(options?.method==='POST'){posts.push({path,...options});return operation('x')};if(path.includes('/operations/')){if(broken)throw new Error('Temporary GET failure');return operation('x')};return {...readiness(),profile_id:broken?'profile-A':'profile-B',register:{...register(),id:broken?'profile-A':'profile-B'}}}
 const first=await setup('ShopCheckboxReports',api,storage);first.component.confirmed.value=true;await first.component.send('x');assert.equal(first.component.x.intent.value.resultId,31);first.stop();broken=false
 const second=await setup('ShopCheckboxReports',api,storage);assert.equal(second.component.canInitial('x'),true);await second.component.send('x');assert.equal(posts.length,1);assert.equal(storage.size,0);assert.equal(second.component.operation.value.id,31);second.stop()
})

test('backoffice Checkbox projections distinguish provider/test proof and never claim customer delivery',async()=>{
 const source=(await readFile(new URL('../components/orders/OrderProjections.vue',import.meta.url),'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm,'')
 Object.assign(globalThis,vue)
 for(const prefix of ['checkbox_fiscal_','simulated_checkbox_fiscal_'])for(const status of ['queued','unknown','pending','rejected','cancelled','invalid','issued','return_pending','partial_return','returned']){
  globalThis.defineProps=()=>({order:{fiscal_status:prefix+status,receipt_delivery_status:(prefix.startsWith('simulated')?'simulated_checkbox_':'checkbox_')+'local_print_available'}})
  const module=await importSource(source+'\nexport { rows };'),rows=module.rows.value
  assert.match(rows[2][1],/Checkbox/);assert.match(rows[3][1],/надсилання покупцю не підтверджено/)
  if(prefix.startsWith('simulated'))assert.match(rows[2][1],/Тест/);else assert.doesNotMatch(rows[2][1],/Тест/)
 }
})

for(const name of ['OrderShopCheckboxFiscal','OrderShopCheckboxReturns','ShopCheckboxReports'])test(`${name}: pending profile metadata blocks handlers without discarding mounted state`,async()=>{
 let posts=0;const fixture=await setup(name,async(path,options)=>{if(options?.method==='POST')posts++;return path.endsWith('/readiness')?readiness():{...order(),sale_document:document('issued'),returns:[returnRecord()]}},new Map(),{profileReady:false}),c=fixture.component
 if(name==='OrderShopCheckboxFiscal'){await c.createPreview();assert.equal(c.can('sale_preview',false),false)}
 if(name==='OrderShopCheckboxReturns'){c.quantities.value={7:1};c.reason.value='Partial';c.confirmed.value=true;await c.createReturn();assert.equal(c.canCreate.value,false)}
 if(name==='ShopCheckboxReports'){c.confirmed.value=true;await c.send('x');assert.equal(c.canInitial('x'),false)}
 assert.equal(posts,0);assert.ok(c.read.state.value);fixture.stop()
})
test('register process callback survives readonly refreshToken/profile-loading changes and clears accepted original intent',async()=>{
 const wait=deferred();let accepted=false,posts=0;const op=operation('x'),fixture=await setup('ShopCheckboxReports',async(path,options)=>{if(options?.method==='POST'){posts++;return wait.promise};if(path.includes('/operations/'))return operation('x',accepted?'accepted':'queued');return{...readiness(),register:{...register(),pending_operation:accepted?null:op,reports:accepted?[operation('x','accepted')]:[]}}}),c=fixture.component
 const pending=c.runOperation('process');fixture.props.profileReady=false;fixture.props.refreshToken=1;await settle();accepted=true;wait.resolve(operation('x','unknown'));await pending;await settle();assert.equal(posts,1);assert.equal(fixture.storage.size,0);assert.equal(c.operation.value.acceptance_verified,true);fixture.stop()
})

test('accepted X displays verified report result identity while immutable command UUID stays null',async()=>{
 const helper=await importSource((await readFile(new URL('../utils/shopCheckboxFiscal.ts',import.meta.url),'utf8')).replace(/^import .*\n/gm,'')),id='12345678-1234-4234-8234-123456789abc',op={...operation('x','accepted'),provider_uuid:null,result:{resource:'report',id,verified:true,accepted:true}}
 assert.equal(helper.checkboxOperationUuid(op),id);assert.equal(op.provider_uuid,null)
 for(const value of [{...op,status:'unknown'},{...op,acceptance_verified:false},{...op,result:{...op.result,verified:false}},{...op,result:{...op.result,resource:'receipt'}}])assert.equal(helper.checkboxOperationUuid(value),null)
})
