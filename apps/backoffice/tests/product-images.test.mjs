import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const apiSource = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')
const managerSource = await readFile(new URL('../components/ProductImagesManager.vue', import.meta.url), 'utf8')
const formSource = await readFile(new URL('../components/ProductForm.vue', import.meta.url), 'utf8')
const productPageSource = await readFile(new URL('../pages/products/[id].vue', import.meta.url), 'utf8')
const productListSource = await readFile(new URL('../pages/products/index.vue', import.meta.url), 'utf8')
const dashboardSource = await readFile(new URL('../pages/admin/dashboards/store.vue', import.meta.url), 'utf8')

test('product image API uses the backend contract and lets the browser set multipart boundaries', () => {
  const imageApiSource = apiSource.slice(
    apiSource.indexOf('const getProductImages'),
    apiSource.indexOf('const getCategories'),
  )

  assert.match(imageApiSource, /getProductImages/)
  assert.match(imageApiSource, /method: 'POST'/)
  assert.match(imageApiSource, /method: 'PUT'/)
  assert.match(imageApiSource, /method: 'PATCH'/)
  assert.match(imageApiSource, /method: 'DELETE'/)
  assert.match(imageApiSource, /new FormData\(\)/)
  assert.match(imageApiSource, /formData\.append\('file', file\)/)
  assert.match(imageApiSource, /body: \{ image_ids:/)
  assert.doesNotMatch(imageApiSource, /Content-Type/i)
})

test('manager validates files, uploads sequentially, and releases every local preview', () => {
  assert.match(managerSource, /new Set\(\['image\/jpeg', 'image\/png', 'image\/webp'\]\)/)
  assert.match(managerSource, /5 \* 1024 \* 1024/)
  assert.match(managerSource, /uploadInProgress\.value/)
  assert.match(managerSource, /while \(item\)/)
  assert.match(managerSource, /input\.value = ''/)
  assert.match(managerSource, /URL\.createObjectURL/)
  assert.match(managerSource, /URL\.revokeObjectURL/)
  assert.match(managerSource, /onBeforeUnmount/)
  assert.match(managerSource, /Повторити заміну/)
})

test('late gallery refreshes cannot overwrite a newer local mutation', () => {
  assert.match(managerSource, /const startingRevision = imagesRevision/)
  assert.match(managerSource, /startingRevision !== imagesRevision/)
  assert.match(managerSource, /imagesRevision \+= 1/)
})

test('gallery mutations are serialized with reorder and ignore replies after unmount', () => {
  assert.match(managerSource, /let disposed = false/)
  assert.match(managerSource, /disposed = true/)
  assert.match(managerSource, /loadRequestId \+= 1/)
  assert.match(managerSource, /disposed\s*\|\| reorderInProgress\.value/)
  assert.match(managerSource, /:disabled="reorderInProgress \|\| updatePending\.has\(image\.id\)/)
  assert.match(managerSource, /:disabled="reorderInProgress \|\| replacePending\.has\(image\.id\)/)
})

test('main badge requires a usable URL and route changes clear malformed image state', () => {
  assert.match(managerSource, /image\.is_active && image\.image_url/)
  assert.match(productPageSource, /managedImages\.value = Array\.isArray\(value\) \? \[\.\.\.value\] : \[\]/)
})

test('embedded ProductImage rows take precedence and avoid an initial duplicate request', () => {
  assert.match(productPageSource, /if \(managedImages\.value\.length\)/)
  assert.match(productPageSource, /\.filter\(image => image\.is_active && image\.image_url\)/)
  assert.match(productPageSource, /:initial-images="managedImages"/)
  assert.match(managerSource, /if \(props\.initialImages === undefined\) void loadImages\(\)/)
  assert.match(productListSource, /if \(Array\.isArray\(product\.images\) && product\.images\.length\)/)
  assert.match(dashboardSource, /product\.images\.some\(image => image\.is_active/)
})

test('legacy URLs remain available and new products defer uploads until after save', () => {
  assert.match(formSource, /<details/)
  assert.match(formSource, /Зовнішні URL \/ старі зображення/)
  assert.match(productPageSource, /Спочатку збережіть товар, потім додайте фотографії/)
  assert.match(productPageSource, /router\.replace\(`\/products\/\$\{createdProduct\.id\}`\)/)
  assert.match(managerSource, /legacyPreviewUrls/)
})
