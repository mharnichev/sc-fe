import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
let moduleId = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(compile(source + `\n// runtime ${moduleId++}`)).toString('base64')}`)
Object.assign(globalThis, await importSource(await readFile(new URL('../composables/useBackofficeAccess.ts', import.meta.url), 'utf8')))
const utils = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
Object.assign(globalThis, await importSource(await readFile(new URL('../utils/shopFiscal.ts', import.meta.url), 'utf8')))
Object.assign(globalThis, { useAssetUrl: () => value => value, useApi: () => async () => ({ order_id: 321, fiscal_profile: 'local_mock' }) })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const makeOrder = (id, revision = 1) => ({ id, revision, simulation: true, total_amount: '1.00', status: 'confirmed', sales_actions: { can_record_payment: true, can_handover: true }, items: [] })

for (const operation of ['payment', 'handover']) {
  for (const change of ['actor', 'order']) {
    test(`actual ${operation} callback preserves the next ${change} intent and ignores delayed sales reads`, async () => {
      const auth = vue.reactive({ user: { id: 1 } }), route = vue.reactive({ params: { id: '321' } })
      const storage = new Map(), callbacks = [], readsStarted = deferred(), oldRead = deferred()
      let delayed = false
      const api = {
        getOrder: async id => { if (delayed) { readsStarted.resolve(); return oldRead.promise } return makeOrder(Number(id)) },
        getOrderFulfillment: async () => ({ items: [], marker: delayed ? 'old' : 'initial' }),
        recordOrderPayment: async () => ({ id: 321 }), handoverOrder: async () => ({ id: 321 }),
      }
      Object.assign(globalThis, vue, utils, {
        useAuthStore: () => auth, useRoute: () => route, useBackofficeApi: () => api,
        useBaseToastNotification: () => ({ success() {}, error() {} }),
        useBookingFormatting: () => ({ apiErrorMessage: () => 'error', formatDateTime: String, formatMoney: String }),
        onBeforeUnmount: callback => callbacks.push(callback),
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        useAsyncData: async (_key, handler) => { const data = vue.ref(await handler()); return { data, pending: vue.ref(false), error: vue.ref(null), refresh: async () => { data.value = await handler() } } },
      })
      const commandSource = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
      Object.assign(globalThis, await importSource(commandSource))
      const component = await readFile(new URL('../pages/orders/[id].vue', import.meta.url), 'utf8')
      const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
      const scope = vue.effectScope()
      const page = await scope.run(() => importSource(script + '\nexport { order, fulfillment, paymentEvidence, handoverEvidence, paymentCommand, handoverCommand, recordPayment, handover };'))
      page.paymentEvidence.value = 'synthetic proof'; page.handoverEvidence.value = 'synthetic proof'
      delayed = true
      const pending = operation === 'payment' ? page.recordPayment() : page.handover()
      await readsStarted.promise
      const nextActor = change === 'actor' ? 2 : 1, nextOrder = change === 'order' ? 322 : 321
      const nextKey = utils.salesIntentStorageKey(nextActor, operation, String(nextOrder))
      storage.set(nextKey, JSON.stringify({ key: 'uncertain-next-command', body: { expected_revision: 7 } }))
      if (change === 'actor') auth.user = { id: nextActor }
      else route.params.id = String(nextOrder)
      page.order.value = makeOrder(nextOrder, 77)
      page.fulfillment.value = { items: [], marker: 'next' }
      const command = operation === 'payment' ? page.paymentCommand : page.handoverCommand
      assert.equal(command.intent.value.key, 'uncertain-next-command')
      oldRead.resolve(makeOrder(321, 2)); await pending
      assert.equal(command.intent.value?.key, 'uncertain-next-command')
      assert.equal(JSON.parse(storage.get(nextKey)).key, 'uncertain-next-command')
      assert.equal(page.order.value.id, nextOrder)
      assert.equal(page.order.value.revision, 77)
      assert.equal(page.fulfillment.value.marker, 'next')
      callbacks.forEach(callback => callback()); scope.stop()
    })
  }
}

const loadPage = async ({ api, storage = new Map(), actor = 1, id = '321', popups = [], metadata = async () => ({ order_id: Number(id), fiscal_profile: 'local_mock' }) }) => {
  const auth = vue.reactive({ user: { id: actor } }), route = vue.reactive({ params: { id } }), unmount = [], notices = []
  Object.assign(globalThis, vue, utils, {
    useAuthStore: () => auth, useRoute: () => route, useBackofficeApi: () => api, useApi: () => metadata,
    useBaseToastNotification: () => ({ success: value => notices.push(value), error: value => notices.push(value) }),
    useBookingFormatting: () => ({ apiErrorMessage: () => 'error', formatDateTime: String, formatMoney: String }),
    onBeforeUnmount: callback => unmount.push(callback),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { open: () => { const popup = { closed: false, close() { this.closed = true }, location: { replacements: [], replace(url) { this.replacements.push(url) } } }; popups.push(popup); return popup }, setTimeout: () => 0 },
    useAsyncData: async (_key, handler) => { const data = vue.ref(await handler()); return { data, pending: vue.ref(false), error: vue.ref(null), refresh: async () => { data.value = await handler() } } },
  })
  const commandSource = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(commandSource))
  const component = await readFile(new URL('../pages/orders/[id].vue', import.meta.url), 'utf8')
  const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const page = await scope.run(() => importSource(script + '\nexport { order, fulfillment, documentPending, documentError, createDocument, openDocument, statusDraft, statusPending, statusError, updateStatus, handoverEvidence, handover, paymentEvidence, recordPayment, usesShopFiscal, usesCheckbox, fiscalProfileReady, fiscalProfileError, shopFiscalProfile, fiscalProfileLoading, loadFiscalProfile, fiscalRefresh };'))
  return { page, auth, route, notices, popups, stop: () => { unmount.forEach(callback => callback()); scope.stop() } }
}

test('actual preliminary creation replays the persisted key and revision after an accepted timeout and reload', async () => {
  const storage = new Map(), sent = []
  let revision = 1, accepted = null
  const api = {
    getOrder: async () => makeOrder(321, revision), getOrderFulfillment: async () => ({ items: [] }),
    createOrderPreliminaryDocument: async (id, expectedRevision, key) => {
      sent.push({ id, expectedRevision, key })
      if (!accepted) { accepted = key; revision++; throw new Error('response lost after commit') }
      if (key !== accepted) revision++
      return { id: 44 }
    },
  }
  const first = await loadPage({ api, storage })
  await first.page.createDocument(); first.stop()
  const second = await loadPage({ api, storage })
  await second.page.createDocument()
  assert.deepEqual(sent[1], sent[0])
  assert.equal(revision, 2)
  second.stop()
})

for (const change of ['actor', 'order', 'unmount']) {
  test(`actual backoffice preliminary print closes pending popup on ${change}`, async () => {
    const print = deferred()
    const api = { getOrder: async () => makeOrder(321), getOrderFulfillment: async () => ({ items: [] }), getOrderPreliminaryDocumentHtml: async () => print.promise }
    const state = await loadPage({ api })
    const pending = state.page.openDocument({ id: 44 })
    if (change === 'actor') state.auth.user = { id: 2 }
    else if (change === 'order') state.route.params.id = '322'
    else state.stop()
    print.resolve('<h1>Private A</h1>'); await pending
    assert.equal(state.popups[0].closed, true)
    assert.deepEqual(state.popups[0].location.replacements, [])
    state.stop()
  })
  test(`actual status mutation ignores its delayed result after ${change}`, async () => {
    const response = deferred()
    const api = { getOrder: async () => makeOrder(321), getOrderFulfillment: async () => ({ items: [] }), updateOrderStatus: async () => response.promise }
    const state = await loadPage({ api })
    state.page.statusDraft.value = 'pending'
    const pending = state.page.updateStatus()
    if (change === 'actor') state.auth.user = { id: 2 }
    else if (change === 'order') state.route.params.id = '322'
    else state.stop()
    state.page.order.value = makeOrder(322, 77)
    response.resolve(makeOrder(321, 2)); await pending
    assert.equal(state.page.order.value.id, 322)
    assert.equal(state.page.order.value.revision, 77)
    assert.deepEqual(state.notices, [])
    state.stop()
  })
}

test('actual POS draft releases a known zero-total rejection for a corrected preparation', async () => {
  const auth = vue.reactive({ user: { id: 1 } }), storage = new Map(), sent = [], navigations = []
  const api = {
    getPosCapabilities: async () => ({ can_prepare: true, simulation_available: true }),
    createPosOrder: async (body, key) => {
      sent.push({ body, key })
      if (sent.length === 1) throw { status: 409, data: { detail: { code: 'unsupported_zero_total_pos', message: 'Zero-total POS orders are unsupported' } } }
      return { id: 55 }
    },
  }
  Object.assign(globalThis, vue, utils, {
    useAuthStore: () => auth, useBackofficeApi: () => api, navigateTo: path => { navigations.push(path) },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    useAsyncData: async (_key, handler) => ({ data: vue.ref(await handler()), error: vue.ref(null), refresh: async () => {} }),
  })
  const commandSource = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(commandSource))
  const component = await readFile(new URL('../pages/orders/pos.vue', import.meta.url), 'utf8')
  const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const page = await scope.run(() => importSource(script + '\nexport { add, promoCode, prepare, command, locked };'))
  page.add({ id: 8 }); page.promoCode.value = 'FREE'
  await page.prepare()
  assert.equal(page.command.intent.value, null)
  assert.equal(page.locked.value, false)
  assert.deepEqual(navigations, [])
  page.promoCode.value = 'CORRECTED'
  await page.prepare()
  assert.equal(sent[1].body.promo_code, 'CORRECTED')
  assert.notEqual(sent[1].key, sent[0].key)
  assert.deepEqual(navigations, ['/orders/55'])
  scope.stop()
})

test('actual preliminary acceptance after unmount retains its result without starting stale reads', async () => {
  const response = deferred()
  let reads = 0
  const api = { getOrder: async () => { reads++; return makeOrder(321) }, getOrderFulfillment: async () => ({ items: [] }), createOrderPreliminaryDocument: async () => response.promise }
  const state = await loadPage({ api })
  const pending = state.page.createDocument()
  state.stop(); response.resolve({ id: 44 }); await pending
  assert.equal(reads, 1)
})

for (const operation of ['payment', 'handover']) test(`actual accepted ${operation} refreshes exactly one canonical order/fulfillment pair`, async () => {
  let orderReads = 0, fulfillmentReads = 0, mutations = 0
  const api = {
    getOrder: async () => { orderReads++; return makeOrder(321) },
    getOrderFulfillment: async () => { fulfillmentReads++; return { items: [] } },
    recordOrderPayment: async () => { mutations++; return { id: 321 } },
    handoverOrder: async () => { mutations++; return { id: 321 } },
  }
  const state = await loadPage({ api })
  const initialOrderReads = orderReads, initialFulfillmentReads = fulfillmentReads
  if (operation === 'payment') { state.page.paymentEvidence.value = 'synthetic payment'; await state.page.recordPayment() }
  else { state.page.handoverEvidence.value = 'synthetic handover'; await state.page.handover() }
  assert.equal(mutations, 1)
  assert.equal(orderReads - initialOrderReads, 1)
  assert.equal(fulfillmentReads - initialFulfillmentReads, 1)
  state.stop()
})

for (const profile of ['checkbox', 'local_mock', 'unavailable']) test(`server fiscal metadata ${profile} selects only its canonical profile without mutation`, async () => {
  const reads = [], api = { getOrder: async () => ({ ...makeOrder(321), channel: 'shop', simulation: false }), getOrderFulfillment: async () => ({ items: [] }) }
  const fixture = await loadPage({ api, metadata: async (path, options) => { reads.push({ path, options }); return { order_id: 321, fiscal_profile: profile } } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(fixture.page.usesCheckbox.value, profile === 'checkbox'); assert.equal(fixture.page.fiscalProfileReady.value, true); assert.equal(fixture.page.shopFiscalProfile.value, profile)
  assert.equal(reads.length, 1); assert.equal(reads[0].path, '/backoffice/shop-checkbox/orders/321/profile'); assert.equal(reads[0].options.method, undefined); fixture.stop()
})
test('failed/late server fiscal profile cannot route new fiscal actions after actor change', async () => {
  const wait = deferred(), api = { getOrder: async () => ({ ...makeOrder(321), channel: 'shop', simulation: false }), getOrderFulfillment: async () => ({ items: [] }) }; let calls = 0
  const fixture = await loadPage({ api, metadata: async () => { if (++calls === 1) return wait.promise; throw new Error('Forbidden new actor') } })
  assert.equal(fixture.page.fiscalProfileReady.value, false); fixture.auth.user = { id: 2 }; wait.resolve({ order_id: 321, fiscal_profile: 'checkbox' }); await new Promise(resolve => setImmediate(resolve))
  assert.equal(fixture.page.usesCheckbox.value, false); assert.equal(fixture.page.fiscalProfileReady.value, false); assert.ok(fixture.page.fiscalProfileError.value); fixture.stop()
})

test('same actor/order metadata refresh preserves mounted profile while pending/error and explicitly retries safely',async()=>{
 const wait=deferred();let mode='ready';const api={getOrder:async()=>({...makeOrder(321),channel:'shop',simulation:false}),getOrderFulfillment:async()=>({items:[]})}
 const fixture=await loadPage({api,metadata:async()=>{if(mode==='wait')return wait.promise;if(mode==='error')throw new Error('read failure');return{order_id:321,fiscal_profile:'checkbox'}}});await new Promise(r=>setImmediate(r));assert.equal(fixture.page.usesCheckbox.value,true)
 mode='wait';fixture.page.order.value.revision++;assert.equal(fixture.page.usesCheckbox.value,true);assert.equal(fixture.page.fiscalProfileLoading.value,true);assert.equal(fixture.page.fiscalProfileReady.value,false);wait.resolve({order_id:321,fiscal_profile:'checkbox'});await new Promise(r=>setImmediate(r));assert.equal(fixture.page.fiscalProfileReady.value,true)
 mode='error';await fixture.page.loadFiscalProfile();assert.equal(fixture.page.usesCheckbox.value,true);assert.equal(fixture.page.fiscalProfileReady.value,false);assert.ok(fixture.page.fiscalProfileError.value)
 mode='ready';await fixture.page.loadFiscalProfile();assert.equal(fixture.page.fiscalProfileReady.value,true);fixture.stop()
})
test('profile refresh rejects out-of-order results and immediately clears mounted identity on permission change',async()=>{
 const old=deferred();let mode='ready';const api={getOrder:async()=>({...makeOrder(321),channel:'shop',simulation:false}),getOrderFulfillment:async()=>({items:[]})}
 const fixture=await loadPage({api,metadata:async()=>mode==='old'?old.promise:{order_id:321,fiscal_profile:mode==='new'?'local_mock':'checkbox'}});await new Promise(r=>setImmediate(r));mode='old';const pending=fixture.page.loadFiscalProfile();mode='new';await fixture.page.loadFiscalProfile();old.resolve({order_id:321,fiscal_profile:'checkbox'});await pending;assert.equal(fixture.page.shopFiscalProfile.value,'local_mock')
 mode='old';fixture.auth.user={id:1,can_fiscalize_sales:false};assert.equal(fixture.page.shopFiscalProfile.value,null);assert.equal(fixture.page.fiscalProfileReady.value,false);fixture.stop()
})
