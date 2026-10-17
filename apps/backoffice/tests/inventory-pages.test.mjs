import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('receipt purchase-cost accessible name includes its visible label', async () => {
  const source = await read('../pages/inventory/receiving.vue')
  const field = source.match(/<BaseInput[^>]*v-model\.number="unitCost"[^>]*>/)?.[0]
  assert.ok(field)
  const label = field.match(/\blabel="([^"]+)"/)?.[1]
  const accessibleName = field.match(/\baria-label="([^"]+)"/)?.[1]
  assert.ok(label)
  assert.ok(accessibleName?.startsWith(label))
})

test('inventory pages stay private, URL-driven, and use inventory API contracts', async () => {
  const [overview, movements, operations] = await Promise.all([
    read('../pages/inventory/index.vue'),
    read('../pages/inventory/movements.vue'),
    read('../pages/inventory/operations.vue'),
  ])

  for (const page of [operations]) {
    assert.match(page, /is_superuser.*can_post_inventory/)
  }
  assert.doesNotMatch(overview, /role !== 'admin'/)
  assert.match(overview, /can_post_inventory/)
  assert.match(overview, /InventoryBarcodeCamera/)
  assert.doesNotMatch(overview, /InventoryProductPicker|InventoryQuickSearchModal/)
  assert.match(overview, /getInventoryStock/)
  assert.match(overview, /getProcurementQueue/)
  assert.match(overview, /route\.query\.search/)
  assert.match(overview, /on_hand/)
  assert.match(overview, /reserved/)
  assert.match(overview, /available/)
  assert.match(movements, /getProductInventoryMovements/)
  assert.match(movements, /product_id/)
  assert.match(movements, /movementTypeOptions/)
  assert.match(movements, /dateFrom/)
  assert.match(movements, /dateTo/)
  assert.match(movements, /hint="Фільтри діють на поточній сторінці історії/)
  assert.match(operations, /createInventoryOperation/)
  assert.match(operations, /ConfirmActionModal/)
  assert.match(operations, /createInventoryIdempotencyKey/)
  assert.match(operations, /opening-balance/)
  assert.match(operations, /customer-return/)
  assert.match(operations, /write-off/)
})

test('desktop inventory table visibility is applied to whole wrappers, not inner tables', async () => {
  for (const path of ['../pages/inventory/index.vue', '../pages/inventory/receiving.vue']) {
    const source = await read(path)
    const tables = source.match(/<BaseTable\b[^>]*>/g)
    assert.ok(tables?.length)
    for (const table of tables) {
      assert.match(table, /wrapper-class="hidden md:block(?: [^"]*)?"/)
      assert.doesNotMatch(table, /\sclass="hidden md:block"/)
    }
  }
})

test('product settings and order fulfillment are integrated internally', async () => {
  const [product, order, sidebar, settings] = await Promise.all([
    read('../pages/products/[id].vue'),
    read('../pages/orders/[id].vue'),
    read('../components/AppSidebar.vue'),
    read('../components/inventory/InventorySettingsPanel.vue'),
  ])

  assert.match(product, /InventorySettingsPanel/)
  assert.match(product, /reserved_quantity/)
  assert.match(product, /available_quantity/)
  assert.match(settings, /updateProductInventorySettings/)
  assert.match(settings, /Штрихкод має бути унікальним/)
  assert.match(order, /getOrderFulfillment/)
  assert.match(order, /quantity_from_stock/)
  assert.match(order, /quantity_to_order/)
  assert.match(order, /quantity_received_for_order/)
  assert.match(order, /procurement_status/)
  assert.match(sidebar, /to: '\/inventory'/)
})
