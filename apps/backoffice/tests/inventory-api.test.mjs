import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
const apiSource = await read('composables/useBackofficeApi.ts')
const typesSource = await read('types/inventory.ts')
const utilsSource = await read('utils/inventory.ts')
const barcodeSource = await read('components/inventory/BarcodeInput.vue')
const compiledUtils = ts.transpileModule(utilsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const inventoryUtils = await import(`data:text/javascript;base64,${Buffer.from(compiledUtils).toString('base64')}`)

test('inventory API exposes the backend success contracts and HTTP paths', () => {
  const expectedMethods = [
    'getInventoryStock',
    'lookupInventoryProductByBarcode',
    'updateProductInventorySettings',
    'getProcurementQueue',
    'markProcurementOrdered',
    'createInventoryReceipt',
    'getInventoryReceipt',
    'addInventoryReceiptItem',
    'postInventoryReceipt',
    'createInventoryOperation',
    'getProductInventoryMovements',
    'createInventoryCount',
    'getInventoryCount',
    'setInventoryCountItem',
    'postInventoryCount',
    'getOrderFulfillment',
  ]

  for (const method of expectedMethods) {
    assert.match(apiSource, new RegExp(`const ${method}`))
    assert.match(apiSource, new RegExp(`${method},`))
  }

  assert.match(apiSource, /'\/backoffice\/inventory\/stock'/)
  assert.match(apiSource, /`\/backoffice\/inventory\/products\/barcode\/\$\{encodeURIComponent\(barcode\.trim\(\)\)\}`/)
  assert.match(apiSource, /`\/backoffice\/inventory\/products\/\$\{productId\}\/settings`/)
  assert.match(apiSource, /'\/backoffice\/inventory\/procurement'/)
  assert.match(apiSource, /'\/backoffice\/inventory\/procurement\/mark-ordered'/)
  assert.match(apiSource, /`\/backoffice\/inventory\/receipts\/\$\{receiptId\}\/items`/)
  assert.match(apiSource, /`\/backoffice\/inventory\/products\/\$\{productId\}\/movements`/)
  assert.match(apiSource, /`\/backoffice\/orders\/\$\{orderId\}\/fulfillment`/)
  assert.match(apiSource, /method: 'PATCH'[\s\S]*body: payload/)
  assert.match(apiSource, /method: 'PUT'[\s\S]*body: payload/)
})

test('inventory mutations send idempotency headers where the backend requires them', () => {
  assert.match(apiSource, /const idempotencyHeaders = \(idempotencyKey = createInventoryIdempotencyKey\(\)\) => \(\{\s*'Idempotency-Key': idempotencyKey,/)
  for (const method of [
    'createInventoryReceipt',
    'postInventoryReceipt',
    'createInventoryOperation',
    'createInventoryCount',
    'postInventoryCount',
  ]) {
    const start = apiSource.indexOf(`const ${method}`)
    assert.ok(start >= 0, `${method} exists`)
    const next = apiSource.indexOf('\n  const ', start + 1)
    const methodSource = apiSource.slice(start, next < 0 ? undefined : next)
    assert.match(methodSource, /headers: idempotencyHeaders\(idempotencyKey\)/)
  }
  assert.match(utilsSource, /globalThis\.crypto\?\.randomUUID\?\.\(\) \|\| fallbackIdempotencyKey\(\)/)
})

test('inventory contracts include backend fulfillment and server-authoritative quantities', () => {
  for (const field of [
    'on_hand', 'reserved', 'available', 'purchase_unit_cost', 'counted_quantity',
    'quantity_from_stock', 'quantity_to_order', 'quantity_received_for_order', 'procurement_status',
  ]) assert.match(typesSource + apiSource, new RegExp(`\\b${field}\\b`))

  assert.doesNotMatch(typesSource, /optimistic|local.*quantity|quantity.*local/i)
})

test('barcode input suppresses duplicate Enter events without blocking a newly scanned identical barcode', () => {
  assert.match(barcodeSource, /shouldSuppressBarcodeSubmission/)
  assert.match(barcodeSource, /inputSinceSubmit/)
  assert.match(barcodeSource, /!inputSinceSubmit\.value && shouldSuppressBarcodeSubmission/)
  assert.match(barcodeSource, /@keydown\.enter\.prevent="submit"/)
  assert.match(barcodeSource, /emit\('submit', barcode\)/)
  assert.match(barcodeSource, /v-if="match"/)
  assert.match(barcodeSource, /v-else-if="notFound"/)
  assert.match(barcodeSource, /defineExpose\(\{ focus \}\)/)
  assert.doesNotMatch(barcodeSource, /useBackofficeApi|\$fetch|\/backoffice\/inventory/)
})

test('barcode guards and repeated receipt scans execute with normalized scanner values', () => {
  assert.equal(inventoryUtils.normalizeInventoryBarcode(' ab 12 '), 'AB12')
  assert.equal(inventoryUtils.shouldSuppressBarcodeSubmission('ab12', ' AB 12 ', 1500, 1000, 900), true)
  assert.equal(inventoryUtils.shouldSuppressBarcodeSubmission('ab12', 'AB12', 2000, 1000, 900), false)
  assert.equal(inventoryUtils.repeatedReceiptScanQuantity('AB12', ' ab 12 ', 1), 2)
  assert.equal(inventoryUtils.repeatedReceiptScanQuantity('AB12', 'CD34', 1), null)
})

test('inventory error extraction supports FastAPI details and conflict validation failures', () => {
  assert.match(utilsSource, /const formatDetail = \(detail: unknown\): string \| null =>/)
  assert.match(utilsSource, /value\.msg/)
  assert.match(utilsSource, /messages\.join\('; '\)/)
  assert.match(utilsSource, /source\.response\?\.status === 409/)
  assert.match(utilsSource, /source\.response\?\.status === 422/)
  assert.ok(
    utilsSource.indexOf('const detail = formatDetail(data?.detail)') < utilsSource.indexOf('source.response?.status === 409'),
    'structured FastAPI details take precedence over fallback status messages',
  )
  assert.equal(
    inventoryUtils.inventoryApiErrorMessage({ response: { _data: { detail: [{ loc: ['body', 'barcode'], msg: 'already exists' }] } } }),
    'body.barcode: already exists',
  )
})
