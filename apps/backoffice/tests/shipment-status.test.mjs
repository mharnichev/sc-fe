import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../utils/shipmentStatus.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { shipmentStatusLabel, orderUsesNovaPoshta, storedShipmentAddressReady, shipmentAddressSummary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
test('unrecognized provider codes disclose only safe review status', () => {
  assert.equal(shipmentStatusLabel('provider-secret'), 'Потрібна перевірка')
  assert.equal(shipmentStatusLabel('delivered'), 'Доставлено')
  assert.equal(shipmentStatusLabel('refused'), 'Відмова отримувача')
  assert.equal(shipmentStatusLabel('handed_over'), 'Передано перевізнику')
})

test('legacy carrier compatibility is explicit and does not guess from free text', () => {
  for (const shipping_company of ['nova_poshta', 'novaPoshta', 'novaPost']) assert.equal(orderUsesNovaPoshta({ shipping_company }), true)
  for (const shipping_company of ['Нова пошта', 'other', '']) assert.equal(orderUsesNovaPoshta({ shipping_company }), false)
  assert.equal(orderUsesNovaPoshta({ fulfillment_method: 'pickup', shipping_company: 'novaPost' }), false)
  assert.equal(orderUsesNovaPoshta({ fulfillment_method: 'nova_poshta' }), true)
})

test('shipment readiness uses only authoritative snapshot refs and requires street building', () => {
  for (const snapshot of [null, {}, { shippingSettlementRef: 'settlement', shippingWarehouseRef: 'warehouse' }, { shippingCityRef: 'city' }, { shippingCityRef: 'city', shippingStreetRef: 'street' }]) assert.equal(storedShipmentAddressReady(snapshot), false)
  assert.equal(storedShipmentAddressReady({ shippingCityRef: 'city', shippingWarehouseRef: 'warehouse' }), true)
  assert.equal(storedShipmentAddressReady({ shippingCityRef: 'city', shippingStreetRef: 'street', buildingNumber: '1' }), true)
})

test('address review displays refs from the same snapshot used for shipment creation', () => {
  const fallback = { shipping_city: 'Old label', shipping_warehouse_number: 'Old warehouse', shipping_city_ref: 'wrong-top-level-city', shipping_warehouse_ref: 'wrong-top-level-warehouse' }
  assert.deepEqual(shipmentAddressSummary({ cityLabel: 'Snapshot city', warehouseLabel: 'Snapshot warehouse', shippingCityRef: 'actual-city', shippingWarehouseRef: 'actual-warehouse' }, fallback), { city: 'Snapshot city', destination: 'Snapshot warehouse', cityRef: 'actual-city', destinationRef: 'actual-warehouse' })
  assert.deepEqual(shipmentAddressSummary(null, fallback), { city: 'Old label', destination: 'Old warehouse', cityRef: 'Відсутній', destinationRef: 'Відсутній' })
})
