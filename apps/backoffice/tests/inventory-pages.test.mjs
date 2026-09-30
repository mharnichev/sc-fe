import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('inventory pages stay private, URL-driven, and use inventory API contracts', async () => {
  const [overview, movements, operations] = await Promise.all([
    read('../pages/inventory/index.vue'),
    read('../pages/inventory/movements.vue'),
    read('../pages/inventory/operations.vue'),
  ])

  for (const page of [overview, movements, operations]) {
    assert.match(page, /is_superuser.*role !== 'admin'/)
  }
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
  assert.match(movements, /лише поточну завантажену сторінку/)
  assert.match(operations, /createInventoryOperation/)
  assert.match(operations, /ConfirmActionModal/)
  assert.match(operations, /createInventoryIdempotencyKey/)
  assert.match(operations, /opening-balance/)
  assert.match(operations, /customer-return/)
  assert.match(operations, /write-off/)
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
