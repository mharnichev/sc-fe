import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const utils = await import(`data:text/javascript;base64,${Buffer.from(compile(await read('utils/inventory.ts'))).toString('base64')}`)
const page = await read('pages/inventory/receiving.vue')
const script = compile(page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*\n/gm, ''))
const apiSource = await read('composables/useBackofficeApi.ts')
const draft = { id: 12, status: 'draft', reason: 'test', items: [] }
const product = { id: 7, name: 'Test', barcode: 'ABC', on_hand: 0 }

function memoryStorage() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}

function harness(add, storage = memoryStorage(), getReceipt = async () => draft) {
  const ref = value => ({ value })
  const computed = getter => ({ get value() { return getter() } })
  const noop = () => {}
  const guards = []
  const watchers = []
  const globals = {
    ...utils, ref, shallowRef: ref, computed, watch: (target, callback) => { if (!Array.isArray(target)) watchers.push(callback) }, onMounted: noop, onBeforeUnmount: noop,
    sessionStorage: storage, window: {},
    onBeforeRouteLeave: guard => guards.push(guard), onBeforeRouteUpdate: guard => guards.push(guard),
    definePageMeta: noop, useAuthStore: () => ({ user: { role: 'admin' } }), navigateTo: noop,
    useRoute: () => ({ query: { id: '12' } }), useRouter: () => ({ replace: noop }),
    useBaseToastNotification: () => ({ success: noop }),
    useBackofficeApi: () => ({ addInventoryReceiptItem: add, lookupInventoryProductByBarcode: async () => product, getInventoryReceipt: getReceipt }),
  }
  const state = new Function(...Object.keys(globals), `${script}\nreturn { receipt, selectedProduct, quantity, unitCost, batchNumber, allocationQuantities, pendingAdd, adding, addLocked, errorMessage, addItem, loadReceipt, scanBarcode, guards: null };`)(...Object.values(globals))
  state.receipt.value = structuredClone(draft)
  state.selectedProduct.value = product
  state.unitCost.value = 5
  state.quantity.value = 3
  state.guards = guards
  state.restore = async () => { state.receipt.value = null; await watchers[0](12) }
  state.storage = storage
  return state
}

test('add-row API never sends a keyless request and preserves explicit retry keys', async () => {
  const start = apiSource.indexOf('  const addInventoryReceiptItem =')
  const source = compile(apiSource.slice(start, apiSource.indexOf('  const postInventoryReceipt', start)))
  const calls = []
  const add = new Function('api', 'idempotencyHeaders', `${source}; return addInventoryReceiptItem`)(
    (...args) => { calls.push(args); return draft }, key => ({ 'Idempotency-Key': key }),
  )
  for (const key of [undefined, '', '  ', 'x'.repeat(129)]) assert.throws(() => add(12, {}, key))
  assert.equal(calls.length, 0)
  await add(12, { quantity: 3 }, 'intent-1')
  assert.equal(calls[0][1].headers['Idempotency-Key'], 'intent-1')
})

test('ambiguous committed response retries the SAME immutable payload and key; receipt is authoritative', async () => {
  const calls = []
  const serverReceipt = { ...draft, items: [{ id: 1, product_id: 7, quantity: 9, allocations: [] }] }
  const state = harness(async (id, payload, key) => {
    calls.push({ id, payload, key })
    if (calls.length === 1) throw new TypeError('Network response lost after commit')
    return serverReceipt
  })
  await state.addItem()
  const pending = state.pendingAdd.value
  assert.equal(state.quantity.value, 3)
  assert.equal(state.addLocked.value, true)
  assert.ok(state.guards.every(guard => guard() === true), 'navigation is safe once the tuple is durable')
  assert.throws(() => { pending.payload.quantity = 99 }, TypeError)
  assert.throws(() => { pending.payload.allocations.push({ order_item_id: 2, quantity: 1 }) }, TypeError)
  await state.scanBarcode('ABC')
  assert.equal(state.quantity.value, 3, 'scan cannot change an unresolved intent')
  // Even programmatic form changes must not alter a retry.
  state.quantity.value = 99
  state.batchNumber.value = 'changed'
  await state.addItem()
  assert.deepEqual(calls[1], calls[0])
  assert.equal(calls[1].payload.quantity, 3)
  assert.equal(state.receipt.value, serverReceipt)
  assert.equal(state.receipt.value.items[0].quantity, 9, 'do not locally add the replay quantity')
  assert.equal(state.pendingAdd.value, null)
  assert.equal(state.quantity.value, 1)
  assert.ok(state.guards.every(guard => guard() === true))
  await state.scanBarcode('ABC')
  await state.addItem()
  assert.notEqual(calls[2].key, calls[1].key, 'a new intentional scan/add gets a fresh key')
  assert.equal(calls[2].payload.quantity, 2)
})

test('double submit is suppressed and form stays locked while add is in flight', async () => {
  let resolve
  let calls = 0
  const state = harness(() => { calls++; return new Promise(done => { resolve = done }) })
  const first = state.addItem()
  await state.addItem()
  assert.equal(calls, 1)
  assert.equal(state.addLocked.value, true)
  assert.ok(state.guards.every(guard => guard() === false))
  resolve(draft)
  await first
  assert.equal(state.addLocked.value, false)
})

test('lost response plus reload restores the receipt-scoped tuple before retry', async () => {
  const storage = memoryStorage()
  const calls = []
  const initial = harness(async (id, payload, key) => {
    calls.push({ id, payload, key })
    assert.ok(storage.getItem(utils.receiptItemStorageKey(id)), 'persisted before the API call')
    throw new Error('lost response after commit')
  }, storage)
  await initial.addItem()
  assert.equal(utils.restoreReceiptItemRequest(storage, 99), null, 'another receipt must not inherit this request')
  const reloaded = harness(async (id, payload, key) => { calls.push({ id, payload, key }); return draft }, storage)
  await reloaded.restore()
  reloaded.selectedProduct.value = null
  await reloaded.addItem()
  assert.deepEqual(calls[1], calls[0])
  assert.equal(storage.getItem(utils.receiptItemStorageKey(12)), null)
})

test('storage failures never send a non-durable intent; corrupt recovery fails closed', async () => {
  let calls = 0
  const unavailable = { ...memoryStorage(), setItem: () => { throw new Error('storage blocked') } }
  const state = harness(async () => { calls++; return draft }, unavailable)
  await state.addItem()
  assert.equal(calls, 0)
  const storage = memoryStorage()
  storage.setItem(utils.receiptItemStorageKey(12), '{corrupt')
  const restored = harness(async () => { calls++; return draft }, storage)
  await restored.restore()
  await restored.addItem()
  assert.equal(calls, 0)
  assert.equal(restored.addLocked.value, true)
})

test('failed GET after reload permits safe recovery without dropping the pending add tuple or editing lock', async () => {
  const storage = memoryStorage()
  const calls = []
  const original = harness(async (id, payload, key) => {
    calls.push({ id, payload, key })
    throw new Error('response lost after commit')
  }, storage)
  await original.addItem()
  const rawTuple = storage.getItem(utils.receiptItemStorageKey(12))
  let gets = 0
  const reloaded = harness(async (id, payload, key) => { calls.push({ id, payload, key }); return draft }, storage, async () => {
    if (++gets === 1) throw { response: { status: 503 }, data: { detail: 'Reload unavailable' } }
    return draft
  })
  await reloaded.restore()
  const pending = reloaded.pendingAdd.value
  assert.equal(reloaded.receipt.value, null)
  assert.match(reloaded.errorMessage.value, /Reload unavailable/)
  assert.equal(reloaded.addLocked.value, true)
  await reloaded.addItem()
  assert.equal(calls.length, 1, 'add retry waits for receipt recovery')
  await reloaded.loadReceipt()
  assert.equal(gets, 2)
  assert.equal(reloaded.pendingAdd.value, pending)
  assert.equal(storage.getItem(utils.receiptItemStorageKey(12)), rawTuple)
  assert.equal(reloaded.addLocked.value, true)
  await reloaded.scanBarcode('ABC')
  assert.equal(reloaded.quantity.value, 3)
  await reloaded.addItem()
  assert.deepEqual(calls[1], calls[0])
  assert.equal(calls.length, 2)
  assert.equal(storage.getItem(utils.receiptItemStorageKey(12)), null)
  assert.match(page, /v-if="receiptIdFromRoute && !adding"[^>]*@click="loadReceipt\(\)"/)
})

test('a rejected retry must not discard an earlier uncertain committed request', async () => {
  const calls = []
  const state = harness(async (id, payload, key) => {
    calls.push({ id, payload, key })
    if (calls.length === 1) throw new Error('response lost')
    if (calls.length === 2) throw { response: { status: 401 } }
    return draft
  })
  await state.addItem()
  await state.addItem()
  assert.equal(state.addLocked.value, true)
  await state.addItem()
  assert.deepEqual(calls[2], calls[0])
})

test('definite validation rejection permits an edited payload only with a NEW key', async () => {
  for (const status of [400, 422]) {
    const calls = []
    const state = harness(async (id, payload, key) => {
      calls.push({ payload, key })
      if (calls.length === 1) throw { response: { status } }
      return draft
    })
    await state.addItem()
    assert.equal(state.pendingAdd.value, null)
    state.quantity.value = 4
    await state.addItem()
    assert.notEqual(calls[0].key, calls[1].key)
    assert.equal(calls[1].payload.quantity, 4)
  }
})

test('409 keeps the tuple and surfaces conflict instead of silently creating a new request', async () => {
  const calls = []
  const state = harness(async (id, payload, key) => {
    calls.push({ id, payload, key })
    throw { response: { status: 409, _data: { detail: 'Idempotency key is already in use for a different receipt item request' } } }
  })
  await state.addItem()
  assert.equal(state.addLocked.value, true)
  assert.match(state.errorMessage.value, /different receipt item request/)
  state.quantity.value = 4
  await state.addItem()
  assert.deepEqual(calls[1], calls[0])
})

test('timeout and server errors remain uncertain; allocations are deeply snapshotted', () => {
  for (const cause of [new Error('timeout'), { statusCode: 408 }, { response: { status: 500 } }]) {
    assert.equal(utils.isDefiniteInventoryRejection(cause), false)
  }
  const payload = { product_id: 7, quantity: 3, purchase_unit_cost: 5, allocations: [{ order_item_id: 2, quantity: 1 }] }
  const request = utils.createReceiptItemRequest(12, payload)
  payload.allocations[0].quantity = 3
  assert.equal(request.payload.allocations[0].quantity, 1)
  assert.throws(() => { request.payload.allocations[0].quantity = 3 }, TypeError)
  assert.match(page, /<fieldset :disabled="isPosted \|\| addLocked"/)
  assert.match(page, /beforeunload/)
})
