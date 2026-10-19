import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const load = async path => import(`data:text/javascript;base64,${Buffer.from(compile(await read(path))).toString('base64')}`)
const { canManageCatalog, isCatalogManagementPath } = await load('../utils/catalogAccess.ts')
const { productDisplayImage, productDisplayImages } = await load('../utils/productImages.ts')
const masterActors = [
  { role: 'master', master_id: null },
  { role: null, master_id: 7 },
  { role: 'admin', master_id: 7 },
].flatMap(actor => [actor, { ...actor, can_record_sales: true, can_post_inventory: true }])

test('catalog permissions reject every master identity despite sales/inventory grants, retaining staff and superuser policy', () => {
  for (const actor of masterActors) assert.equal(canManageCatalog(actor), false)
  for (const actor of [{ role: 'admin' }, { role: null }, { role: 'staff' }, { role: 'master', master_id: 7, is_superuser: true }]) assert.equal(canManageCatalog(actor), true)
  assert.equal(canManageCatalog(null), false)
})

test('actual global middleware denies direct catalog URLs after loading the authoritative user', async () => {
  const source = (await read('../middleware/auth.global.ts')).replace(/^import .*\n/gm, '').replace('export default ', 'return ')
  let user, initialized = false
  const run = new Function('defineNuxtRouteMiddleware', 'useAuthStore', 'navigateTo', 'canManageCatalog', 'isCatalogManagementPath', compile(source))(
    fn => fn, () => ({ accessToken: 'fixture', get user() { return initialized ? user : { role: 'admin' } }, init: async () => { initialized = true } }),
    destination => destination, canManageCatalog, isCatalogManagementPath,
  )
  for (const actor of masterActors) {
    user = actor
    for (const path of ['/products', '/products/', '/products/new', '/products/8', '/Products', '/PRODUCTS/8']) {
      initialized = false
      assert.equal(await run({ path, fullPath: path, query: {} }), '/dashboard')
    }
    for (const path of ['/inventory', '/inventory/receiving', '/orders/pos']) assert.equal(await run({ path, fullPath: path, query: {} }), undefined)
  }
  for (const actor of [{ role: null }, { role: 'admin' }, { role: 'master', master_id: 7, is_superuser: true }]) {
    user = actor
    assert.equal(await run({ path: '/products/8', fullPath: '/products/8', query: {} }), undefined)
  }
})

test('processed display projections win while originals and editable gallery remain unchanged', () => {
  const product = { image_url: '/original.jpg', images: [{ id: 1, sort_order: 0, is_active: true, image_url: '/original.jpg' }], display_image_url: '/processed.webp', display_image_urls: ['/processed.webp', '/second.webp'] }
  const before = JSON.stringify(product)
  assert.equal(productDisplayImage(product), '/processed.webp')
  assert.deepEqual(productDisplayImages(product), ['/processed.webp', '/second.webp'])
  assert.equal(JSON.stringify(product), before)
})

test('display fallback preserves active gallery ordering and legacy URLs without reintroducing hidden images', () => {
  assert.equal(productDisplayImage({ display_image_url: null, image_url: '/legacy.jpg' }), '/legacy.jpg')
  assert.deepEqual(productDisplayImages({ image_url: '/main.jpg', attributes_json: { image_urls: ['/extra.jpg', '/main.jpg', '', 3] } }), ['/main.jpg', '/extra.jpg'])
  assert.deepEqual(productDisplayImages({ image_url: '/legacy.jpg', images: [
    { id: 3, sort_order: 2, is_active: true, image_url: '/third.jpg' },
    { id: 2, sort_order: 1, is_active: true, image_url: '/second.jpg' },
    { id: 1, sort_order: 0, is_active: false, image_url: '/hidden.jpg' },
  ] }), ['/second.jpg', '/third.jpg'])
  assert.deepEqual(productDisplayImages({ image_url: '/legacy.jpg', images: [{ id: 1, sort_order: 0, is_active: false, image_url: '/hidden.jpg' }] }), [])
  assert.equal(productDisplayImage(null), '')
})

test('picker master callbacks cannot create/bind but still search and select existing stock after unknown scan', async () => {
  const source = (await read('../components/inventory/InventoryProductPicker.vue')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*\n/gm, '')
  const existing = { id: 8, name: 'Fixture', barcode: 'known' }
  for (const actor of masterActors) {
    const calls = [], events = []
    const globals = {
      ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), watch: () => {}, onMounted: () => {},
      defineProps: () => ({}), defineEmits: () => (...args) => events.push(args), useAuthStore: () => ({ user: { id: 1, ...actor } }),
      canManageCatalog, inventoryApiErrorMessage: () => '',
      useBackofficeApi: () => ({
        createInventoryProduct: () => { calls.push('create') }, bindInventoryBarcode: () => { calls.push('bind') },
        lookupInventoryProductByBarcode: async () => { throw { status: 404 } },
        getInventoryStock: async () => ({ items: [existing], total: 1 }),
      }),
    }
    const state = new Function(...Object.keys(globals), compile(source) + '; return { create, bind, find, scan, pick, binding, unknownCode, name, results, selected }')(...Object.values(globals))
    await state.scan('unknown')
    await state.find()
    state.binding.value = existing
    state.name.value = 'Attempted create'
    await state.bind()
    await state.create()
    assert.deepEqual(calls, [])
    state.pick(state.results.value[0])
    assert.equal(state.selected.value, existing)
    assert.deepEqual(events.at(-1), ['select', existing, false])
  }
})


test('mounted editor, gallery and settings mutation callbacks recheck the current actor', async () => {
  for (const component of ['ProductForm.vue', 'ProductImagesManager.vue', 'inventory/InventorySettingsPanel.vue']) {
    const source = (await read(`../components/${component}`)).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*\n/gm, '')
    let actor = { id: 1, role: 'admin' }
    const mutations = [], emissions = []
    const globals = {
      ref: value => ({ value }), reactive: value => value, computed: fn => ({ get value() { return fn() } }), watch: () => {}, onMounted: () => {}, onBeforeUnmount: () => {},
      defineProps: () => ({ productId: 8, initialImages: [], legacyImageUrls: [], categories: [], brands: [] }), withDefaults: props => props,
      defineEmits: () => (...args) => emissions.push(args), useAuthStore: () => ({ get user() { return actor } }),
      canManageCatalog, categoryPathLabels: () => new Map(), slugify: value => value, useAssetUrl: () => value => value,
      useBaseToastNotification: () => ({ warning: () => {}, success: () => {} }), inventoryApiErrorMessage: () => '',
      useBackofficeApi: () => new Proxy({}, { get: (_target, key) => () => { mutations.push(key) } }),
    }
    const exports = component === 'ProductForm.vue' ? '{ submit }'
      : component.endsWith('InventorySettingsPanel.vue') ? '{ save }'
      : '{ selectFiles, uploadReadyFiles, retryUpload, performReplacement, replaceImage, updateImage, moveImage, removeImage }'
    const state = new Function(...Object.keys(globals), compile(source) + `; return ${exports}`)(...Object.values(globals))
    // Simulate an editor opened before a refreshed session revokes catalog access.
    for (const nextActor of masterActors) {
      actor = { id: 1, ...nextActor }
      for (const callback of Object.values(state)) await callback({ id: 1 }, {})
    }
    assert.deepEqual(mutations, [])
    assert.deepEqual(emissions, [])
  }
})


test('gallery preview projections follow original source identity across local reorder and duplicate rows', async () => {
  const source = (await read('../components/ProductImagesManager.vue')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*\n/gm, '')
  const images = [
    { id: 1, sort_order: 0, is_active: true, image_url: '/first.jpg' },
    { id: 2, sort_order: 1, is_active: true, image_url: '/first.jpg' },
    { id: 3, sort_order: 2, is_active: true, image_url: '/third.jpg' },
  ]
  const props = { initialImages: images, legacyImageUrls: [], displayImageSources: images, displayImageUrls: ['/processed-first.webp', '/processed-third.webp'] }
  const globals = {
    ref: value => ({ value }), reactive: value => value, computed: fn => ({ get value() { return fn() } }), watch: () => {}, onMounted: () => {}, onBeforeUnmount: () => {},
    defineProps: () => props, withDefaults: props => props, defineEmits: () => () => {},
    useAuthStore: () => ({ user: { role: 'admin' } }), canManageCatalog, useBackofficeApi: () => ({}), useBaseToastNotification: () => ({}), useAssetUrl: () => value => value,
  }
  const state = new Function(...Object.keys(globals), compile(source) + '; return { displayImageUrl, images }')(...Object.values(globals))
  state.images.value = [ { ...images[2], sort_order: 0 }, { ...images[1], sort_order: 1 }, { ...images[0], sort_order: 2 } ]
  assert.equal(state.displayImageUrl(state.images.value[0]), '/processed-third.webp')
  assert.equal(state.displayImageUrl(state.images.value[1]), '/processed-first.webp')
  assert.equal(state.displayImageUrl(state.images.value[2]), '/processed-first.webp')
})


test('an explicitly empty canonical inventory projection keeps hidden gallery photos hidden', () => {
  const inventoryProduct = { id: 8, image_url: '/inactive-original.jpg', display_image_url: null, display_image_urls: [] }
  assert.deepEqual(productDisplayImages(inventoryProduct), [])
  assert.equal(productDisplayImage(inventoryProduct), '')
  assert.equal(productDisplayImage({ image_url: '/legacy-original.jpg' }), '/legacy-original.jpg')
})
