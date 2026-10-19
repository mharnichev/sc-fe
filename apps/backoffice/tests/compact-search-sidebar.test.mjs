import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const modal = await read('../components/inventory/InventoryQuickSearchModal.vue')
const script = compile(modal.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*\n/gm, ''))
const ref = value => ({ value })

function mountFixture(compactMobile, api) {
  const events = []
  const globals = {
    defineProps: () => ({ modelValue: true, compactMobile }),
    defineEmits: () => (...args) => events.push(args),
    useBackofficeApi: () => api, useRoute: () => ({ fullPath: '/orders/pos' }),
    useAssetUrl: () => value => value, useId: () => 'fixture-scanner',
    ref, watch: () => {}, onBeforeUnmount: () => {}, inventoryApiErrorMessage: () => 'fixture error',
  }
  const state = new Function(...Object.keys(globals), script + '; return { find, lookup, choose, reset, search, results, busy, unknown, scannerOpen, failedImages, page, total }')(...Object.values(globals))
  return { state, events }
}

for (const compact of [false, true]) {
  test(`actual ${compact ? 'compact' : 'default'} search supports unknown barcode, paging and selection without mutations`, async () => {
    const calls = []
    const product = { id: 8, name: 'Fixture', display_image_urls: ['/processed.webp'] }
    const api = new Proxy({
      lookupInventoryProductByBarcode: async code => { calls.push(['lookup', code]); throw { status: 404 } },
      getInventoryStock: async (...args) => { calls.push(['stock', ...args]); return { items: [product], total: 21 } },
    }, { get(target, key) { if (key in target) return target[key]; throw new Error(`Unexpected API: ${String(key)}`) } })
    const { state, events } = mountFixture(compact, api)
    await state.lookup('unknown')
    assert.equal(state.unknown.value, true)
    state.search.value = '  Fixture  '
    await state.find(2)
    assert.deepEqual(calls, [['lookup', 'unknown'], ['stock', 2, 10, { search: 'Fixture' }]])
    assert.equal(state.page.value, 2)
    assert.equal(state.total.value, 21)
    state.busy.value = true
    state.choose(product)
    assert.deepEqual(events, [])
    state.busy.value = false
    state.scannerOpen.value = true
    state.failedImages.value = [8]
    state.choose(product)
    assert.deepEqual(events, [['select', product], ['update:modelValue', false]])
    assert.equal(state.scannerOpen.value, false)
    assert.deepEqual(state.failedImages.value, [])
    assert.deepEqual(state.results.value, [])
  })

  test(`actual ${compact ? 'compact' : 'default'} search ignores responses after reset`, async () => {
    let resolve
    const { state } = mountFixture(compact, { getInventoryStock: () => new Promise(done => { resolve = done }) })
    const pending = state.find()
    state.reset()
    resolve({ items: [{ id: 99 }], total: 1 })
    await pending
    assert.deepEqual(state.results.value, [])
    assert.equal(state.total.value, 0)
    assert.equal(state.busy.value, false)
  })
}

test('compact and default templates retain distinct scanner/results branches and canonical photos', () => {
  assert.match(modal, /InventoryBarcodeInput v-if="!compactMobile"/)
  assert.match(modal, /v-if="compactMobile"[\s\S]*:aria-expanded="scannerOpen" :aria-controls="scannerId"/)
  assert.match(modal, /v-if="scannerOpen" :id="scannerId"/)
  assert.match(modal, /v-if="compactMobile" class="space-y-2 sm:hidden"/)
  assert.match(modal, /compactMobile \? 'hidden space-y-4 sm:block' : 'space-y-4'/)
  assert.match(modal, /assetUrl\(productDisplayImage\(product\)\)/)
  assert.match(modal, /<InventoryProductCard v-for="product in results"/)
})

test('actual sidebar exposes POS only by sales grant or superuser and retains catalog restrictions', async () => {
  const source = await read('../components/AppSidebar.vue')
  const links = source.slice(source.indexOf('const onlineStoreLinks ='), source.indexOf('const blogLinks ='))
  const icons = [...new Set(links.match(/\b[A-Z]\w+Icon\b/g))]
  const roleSource = compile((await read('../composables/useBackofficeAccess.ts')).replace(/^import .*\n/gm, '').replace(/export /g, ''))
  const access = await import(`data:text/javascript;base64,${Buffer.from(compile(await read('../utils/catalogAccess.ts'))).toString('base64')}`)
  const actors = [
    { role: 'admin' }, { role: 'staff' }, { role: 'barber' }, { role: 'master' }, { role: 'staff', master_id: 7 }, { role: 'admin', master_id: 7 },
    { role: 'master', master_id: 7, is_superuser: true },
  ]
  for (const actor of actors) for (const granted of [false, true]) for (const qrAllowed of [false, true]) {
    const user = { ...actor, can_record_sales: granted, can_accept_qr_payments: qrAllowed }
    const computed = fn => ({ get value() { return fn() } })
    const roles = new Function('useAuthStore', 'computed', roleSource + '; return useBackofficeAccess()')(() => ({ user }), computed)
    const admin = roles.isAdmin.value
    const globals = {
      auth: { user }, isBarber: roles.isBarber, isAdmin: ref(admin),
      catalogEditable: ref(access.canManageCatalog(user)), computed: fn => ({ get value() { return fn() } }),
      ...Object.fromEntries(icons.map(icon => [icon, icon])),
    }
    const result = new Function(...Object.keys(globals), links + '; return onlineStoreLinks.value')(...Object.values(globals)).map(link => link.to)
    assert.equal(result.includes('/orders/pos'), Boolean(granted || user.is_superuser))
    assert.equal(result.includes('/inventory'), true)
    assert.equal(result.includes('/products'), Boolean(admin && access.canManageCatalog(user)))
  }
})
