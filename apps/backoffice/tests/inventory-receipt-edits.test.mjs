import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source.replace(/^import .*\n/gm, ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const helper = await import(`data:text/javascript;base64,${Buffer.from(compile(await read('utils/inventoryReceiptEdits.ts'))).toString('base64')}`)
const inventory = await import(`data:text/javascript;base64,${Buffer.from(compile(await read('utils/inventory.ts'))).toString('base64')}`)
const page = compile((await read('pages/inventory/receiving.vue')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1])
const item = { id: 8, product_id: 42, quantity: 3, purchase_unit_cost: '10.00', barcode: null, allocations: [{ order_item_id: 9, quantity: 1 }] }
const receipt = { id: 12, status: 'draft', revision: 2, items: [item] }
const operation = { userId: 5, receiptId: 12, itemId: 8, kind: 'update', key: 'edit-key', item, payload: { expected_revision: 2, reason: 'Fix', quantity: 2, purchase_unit_cost: '12.00', allocations: [] } }
function harness(change, getReceipt) {
  const watchers = []
  const route = { query: { id: '12' } }
  const saved = new Map()
  const noop = () => {}
  const ref = value => ({ value })
  const auth = { user: { id: 5, is_superuser: true } }
  const globals = { ...helper, ...inventory, ref, shallowRef: ref, computed: get => ({ get value() { return get() } }),
    provide: noop, watch: (target, callback) => { if (!Array.isArray(target)) watchers.push(callback) }, onMounted: noop, onBeforeUnmount: noop, onBeforeRouteUpdate: noop,
    useAuthStore: () => auth, useRoute: () => route, useRouter: () => ({}), useBaseToastNotification: () => ({ success: noop }),
    sessionStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    window: {}, useBackofficeApi: () => ({ changeInventoryReceiptItem: change, getInventoryReceipt: getReceipt ?? (async () => ({ ...receipt, revision: 3 })), getInventoryProduct: async () => ({ id: 42 }), getInventoryReceiptChanges: async () => ({ items: [], total: 0 }) }),
  }
  const state = new Function(...Object.keys(globals), `${page}; return { receipt, openEdit, saveEdit, sendEdit, editOpen, editItem, editError, pendingEdit, restoreEdit, addItem, postReceipt, hasUnsavedChanges, effectiveQuantity, effectiveCost, effectiveValue };`)(...Object.values(globals))
  state.receipt.value = structuredClone(receipt)
  return { ...state, saved, auth, route, loadRoute: id => watchers[0](id) }
}
test('draft edit carries captured revision, complete allocations, reason and exact cost', async () => {
  const calls = []
  const state = harness(async (...args) => { calls.push(args); return { ...receipt, revision: 4 } })
  state.openEdit(item)
  state.receipt.value = { ...receipt, revision: 3 }
  await state.saveEdit({ quantity: 2, purchase_unit_cost: '12.50', reason: '' })
  assert.equal(calls[0][2], 'update')
  assert.deepEqual(calls[0][3], { expected_revision: 2, reason: 'Виправлення даних приймання', quantity: 2, purchase_unit_cost: '12.50', allocations: item.allocations })
  assert.equal(state.pendingEdit.value, null)
  assert.equal(state.editOpen.value, false)
})
test('unknown outcome persists and replays identical key/payload; restored retry cannot unlock on rejection', async () => {
  const calls = []
  let fail = true
  const state = harness(async (...args) => { calls.push(structuredClone(args)); if (fail) throw new TypeError('lost response'); return { ...receipt, revision: 3 } })
  state.openEdit(item)
  await state.saveEdit({ quantity: 2, purchase_unit_cost: '12.50', reason: 'Fix' })
  const stored = [...state.saved.values()][0]
  assert.ok(stored)
  state.pendingEdit.value = null
  state.restoreEdit(12)
  await state.sendEdit()
  assert.deepEqual(calls[0], calls[1])
  assert.ok(state.pendingEdit.value)
  fail = false
  await state.sendEdit()
  assert.deepEqual(calls[0], calls[2])
  assert.equal(state.saved.size, 0)
})
test('posted correction sends no allocations and display uses effective zero quantity', async () => {
  const calls = []
  const state = harness(async (...args) => { calls.push(args); return { ...receipt, status: 'posted', revision: 3 } })
  state.receipt.value = { ...receipt, status: 'posted' }
  state.openEdit(item)
  await state.saveEdit({ quantity: 1, purchase_unit_cost: '12.50', reason: 'Correction' })
  assert.equal(calls[0][2], 'correct')
  assert.equal('allocations' in calls[0][3], false)
  assert.equal(state.effectiveQuantity({ ...item, effective_quantity: 0 }), 0)
  assert.equal(state.effectiveCost({ ...item, effective_purchase_unit_cost: '0.00' }), '0.00')
})
test('draft delete sends only revision/reason; posting and additions block while edit pending', async () => {
  const calls = []
  const state = harness(async (...args) => { calls.push(args); throw new TypeError('lost') })
  state.openEdit(item)
  await state.saveEdit(undefined, true)
  assert.equal(calls[0][2], 'remove')
  assert.deepEqual(Object.keys(calls[0][3]).sort(), ['expected_revision', 'reason'])
  await state.addItem()
  await state.postReceipt()
  assert.equal(calls.length, 1)
  assert.equal(state.hasUnsavedChanges.value, true)
})
test('stored edits reject cross-account and malformed money/command data', () => {
  assert.deepEqual(helper.restoreReceiptEdit(JSON.stringify(operation), 5, 12), operation)
  assert.throws(() => helper.restoreReceiptEdit(JSON.stringify(operation), 6, 12))
  assert.throws(() => helper.restoreReceiptEdit(JSON.stringify({ ...operation, payload: { ...operation.payload, purchase_unit_cost: 'Infinity' } }), 5, 12))
  assert.throws(() => helper.restoreReceiptEdit(JSON.stringify({ ...operation, payload: { ...operation.payload, unknown: true } }), 5, 12))
})

test('409 on exact replay after an unknown outcome unlocks and reloads the latest revision', async () => {
  let attempt = 0
  const state = harness(async () => { attempt++; if (attempt === 1) throw new TypeError('lost'); throw { status: 409 } })
  state.openEdit(item)
  await state.saveEdit({ quantity: 2, purchase_unit_cost: '12.50', reason: 'Fix' })
  assert.ok(state.pendingEdit.value)
  await state.sendEdit()
  assert.equal(state.pendingEdit.value, null)
  assert.equal(state.saved.size, 0)
  assert.equal(state.editOpen.value, false)
  assert.equal(state.receipt.value.revision, 3)
})

test('draft edit can clear planned allocations rather than resubmitting the old plan', async () => {
  const calls = []
  const state = harness(async (...args) => { calls.push(args); return { ...receipt, revision: 3 } })
  state.openEdit(item)
  await state.saveEdit({ quantity: 1, purchase_unit_cost: '12.50', reason: 'Fix', allocations: [] })
  assert.deepEqual(calls[0][3].allocations, [])
})

test('change adapter matches draft update/delete and posted correction routes', async () => {
  const source = await read('composables/useBackofficeApi.ts')
  const start = source.indexOf('  const changeInventoryReceiptItem =')
  const block = compile(source.slice(start, source.indexOf('  const postInventoryReceipt', start)))
  const calls = []
  const change = new Function('api', 'idempotencyHeaders', `${block}; return changeInventoryReceiptItem`)((...args) => { calls.push(args); return receipt }, key => ({ 'Idempotency-Key': key }))
  for (const key of ['', ' ', undefined, 'x'.repeat(129)]) assert.throws(() => change(12, 8, 'update', operation.payload, key))
  for (const kind of ['update', 'remove', 'correct']) await change(12, 8, kind, operation.payload, 'edit-key')
  assert.deepEqual(calls.map(([path, options]) => [path, options.method]), [
    ['/backoffice/inventory/receipts/12/items/8', 'PUT'], ['/backoffice/inventory/receipts/12/items/8', 'DELETE'], ['/backoffice/inventory/receipts/12/items/8/corrections', 'POST'],
  ])
  assert.ok(calls.every(([, options]) => options.retry === 0 && options.headers['Idempotency-Key'] === 'edit-key'))
})

test('late receipt response cannot restore a pending command for a route the user left', async () => {
  let release
  const state = harness(async () => receipt, id => id === 14 ? new Promise(resolve => { release = resolve }) : Promise.resolve({ ...receipt, id }))
  state.saved.set(helper.receiptEditStorageKey(5, 14), JSON.stringify({ ...operation, receiptId: 14 }))
  state.receipt.value = null
  state.route.query.id = '14'
  const oldLoad = state.loadRoute(14)
  state.route.query.id = '13'
  await state.loadRoute(13)
  release({ ...receipt, id: 14 })
  await oldLoad
  assert.equal(state.receipt.value.id, 13)
  assert.equal(state.pendingEdit.value, null)
  assert.equal(state.editOpen.value, false)
})

test('a linked master cannot edit even with an inventory posting flag', () => {
  const state = harness(async () => receipt)
  state.auth.user = { id: 5, is_superuser: false, can_post_inventory: true, master_id: 3, role: 'barber' }
  state.openEdit(item)
  assert.equal(state.editOpen.value, false)
})

test('a stock constraint conflict leaves the form editable when the document revision did not change', async () => {
  const state = harness(async () => { throw { status: 409, data: { detail: 'receipt_insufficient_free_stock' } } }, async () => receipt)
  state.openEdit(item)
  await state.saveEdit({ quantity: 1, purchase_unit_cost: '12.50', reason: 'Fix' })
  assert.equal(state.pendingEdit.value, null)
  assert.equal(state.editOpen.value, true)
  assert.match(state.editError.value, /Недостатньо вільного залишку/)
})
