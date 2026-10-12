import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../components/inventory/InventoryProductPicker.vue', import.meta.url), 'utf8')
const script = ts.transpileModule(source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const product = { id: 7, name: 'Shampoo', barcode: '001 a ', on_hand: 0 }
function harness(lookup = async () => product, create = async () => product) {
  const events = []
  const storage = new Map()
  const globals = {
    localStorage: { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    createInventoryIdempotencyKey: () => "same-key",
    isDefiniteInventoryRejection: cause => cause?.status >= 400 && cause.status < 500 && ![408, 409].includes(cause.status),
    ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
    defineProps: () => ({}), defineEmits: () => (...event) => events.push(event),
    useBackofficeApi: () => ({ lookupInventoryProductByBarcode: lookup, createInventoryProduct: create, getInventoryStock: async () => ({ items: [], total: 0 }) }), useAuthStore: () => ({ user: { id: 1 } }),
    watch: () => {}, onMounted: () => {}, inventoryApiErrorMessage: () => 'Network failure',
  }
  return { ...new Function(...Object.keys(globals), `${script}; return { scan, choose, clear, selected, barcode, unknownCode, create, pending, name, price, sku };`)(...Object.values(globals)), events }
}

test('repeat lookup retains previous product identity while clearing unsafe selection first', async () => {
  const state = harness()
  state.choose(product)
  state.events.length = 0
  await state.scan(product.barcode)
  assert.deepEqual(state.events, [['clear'], ['select', product, true]])
})

test('new product scan and manual selection never mark a repeat', async () => {
  const state = harness(async () => ({ ...product, id: 9 }))
  state.choose(product)
  await state.scan('different')
  assert.equal(state.events.at(-1)[2], false)
  state.choose(product)
  assert.equal(state.events.at(-1)[2], false)
})

test('unknown and network-failed scans clear selection and preserve exact submitted code', async () => {
  for (const cause of [{ status: 404 }, new TypeError('response lost')]) {
    const state = harness(async () => { throw cause })
    state.choose(product)
    await state.scan('001 a ')
    assert.equal(state.selected.value, null)
    assert.equal(state.events.at(-1)[0], 'clear')
    assert.equal(cause.status === 404 ? state.unknownCode.value : state.barcode.value, '001 a ')
  }
})


test('unknown barcode exposes reset and clearing it allows ordinary product selection', async () => {
  assert.match(source, /:not-found="Boolean\(unknownCode\)"/)
  assert.match(source, /:show-not-found="false"/)
  assert.match(source, /@clear="clear"/)
  const state = harness(async () => { throw { status: 404 } })
  await state.scan('unknown')
  assert.equal(state.unknownCode.value, 'unknown')
  state.clear()
  assert.equal(state.unknownCode.value, '')
  assert.equal(state.events.at(-1)[0], 'clear')
  state.choose(product)
  assert.deepEqual(state.events.at(-1), ['select', product, false])
})

test('first definite create rejection releases tuple; earlier uncertainty keeps immutable retry', async () => {
  for (const status of [422, 409]) {
    const first = harness(async () => { throw { status: 404 } }, async () => { throw { status } })
    first.unknownCode.value = '001 a '
    first.name.value = 'Shampoo'
    first.sku.value = 'occupied'
    await first.create()
    assert.equal(first.pending.value, null)

    const calls = []
    const retry = harness(async () => { throw { status: 404 } }, async (payload, key) => {
      calls.push({ payload, key })
      throw calls.length === 1 ? new TypeError('response lost') : { status }
    })
    retry.unknownCode.value = '001 a '
    retry.name.value = 'Shampoo'
    retry.sku.value = 'occupied'
    await retry.create()
    retry.name.value = 'Changed'
    await retry.create()
    assert.ok(retry.pending.value)
    assert.equal(calls[1].payload, calls[0].payload)
    assert.equal(calls[1].key, calls[0].key)
    assert.equal(calls[1].payload.name, 'Shampoo')
  }
})
