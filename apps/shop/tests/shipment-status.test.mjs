import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../utils/shipmentStatus.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { shipmentStatusLabel, guestShipmentPath, deliveryStatus, deliverySummaryEntries, retrySeconds, shipmentStatusIcon } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
test('unrecognized provider codes disclose only safe review status', () => {
  assert.equal(shipmentStatusLabel('provider-secret'), 'Потрібне уточнення')
  assert.equal(shipmentStatusLabel('delivered'), 'Доставлено')
  assert.equal(shipmentStatusLabel('refused'), 'Відмова')
  assert.equal(shipmentStatusLabel('handed_over'), 'Передано пошті')
})
test('guest tracking accepts only scoped local capability routes', () => {
  const token = 'a'.repeat(40)
  assert.equal(guestShipmentPath(`/api/v1/public/orders/tracking/${token}`), `/tracking/${token}`)
  for (const url of ['https://evil.test/x', '/api/v1/public/orders/12', '/api/v1/public/orders/tracking/short', '/api/v1/public/orders/tracking/../../secrets']) assert.equal(guestShipmentPath(url), null)
})

test('real tracking never treats legacy completed/delivered as receipt evidence', () => {
  assert.equal(deliveryStatus({ simulation: false, status: 'delivered' }), 'requires_review')
  assert.equal(deliveryStatus({ simulation: false, status: 'completed' }), 'requires_review')
  assert.equal(deliveryStatus({ simulation: false, status: 'requires_review', delivery_status: 'ready_for_pickup' }), 'ready_for_pickup')
  assert.equal(deliveryStatus({ simulation: true, status: 'delivered' }), 'delivered')
})
test('delivery summary is independent and rejects invalid counts', () => {
  assert.deepEqual(deliverySummaryEntries({ delivered: 1, in_transit: 2, paid: 0, bad: -1, invalid: 1.5 }), [
    { status: 'delivered', count: 1, label: 'Доставлено' }, { status: 'in_transit', count: 2, label: 'У дорозі' },
  ])
  assert.deepEqual(deliverySummaryEntries(), [])
  assert.equal(shipmentStatusLabel('preparing'), 'Готуємо')
  assert.equal(shipmentStatusLabel('ready_for_pickup'), 'У відділенні')
  assert.equal(shipmentStatusLabel('returned'), 'Повернено')
})
test('cooldown accepts bounded numeric retry values without NaN', () => {
  assert.equal(retrySeconds('120'), 120)
  assert.equal(retrySeconds(-2), 60)
  assert.equal(retrySeconds(undefined), 60)
  assert.equal(retrySeconds(null), 60)
  assert.equal(retrySeconds(''), 60)
  assert.equal(retrySeconds(Infinity), 60)
})

test('real receipt labels and English states are explicit and safe', () => {
  assert.equal(shipmentStatusLabel('delivered', 'uk', true), 'Отримано')
  assert.equal(shipmentStatusLabel('delivered', 'en', true), 'Received')
  assert.equal(shipmentStatusLabel('internal-secret', 'en'), 'Needs attention')
  assert.equal(shipmentStatusLabel('in_transit', 'en'), 'In transit')
  assert.equal(retrySeconds('9999999999999999'), 60)
  assert.equal(retrySeconds('   '), 60)
  assert.equal(retrySeconds({}), 60)
  assert.equal(retrySeconds([]), 60)
  assert.equal(retrySeconds(true), 60)
  assert.equal(deliverySummaryEntries({ delivered: 1 }, 'uk', true)[0].label, 'Отримано')
})

test('all normalized real shipment states have explicit Ukrainian and English labels', () => {
  const expected = [
    ['preparing', 'Готуємо', 'Preparing'],
    ['handed_over', 'Передано пошті', 'With carrier'],
    ['in_transit', 'У дорозі', 'In transit'],
    ['ready_for_pickup', 'У відділенні', 'Ready to collect'],
    ['delivered', 'Отримано', 'Received'],
    ['refused', 'Відмова', 'Refused'],
    ['returning', 'Повертається', 'Returning'],
    ['returned', 'Повернено', 'Returned'],
    ['cancelled', 'Скасовано', 'Cancelled'],
    ['requires_review', 'Потрібне уточнення', 'Needs attention'],
    ['unrecognized-provider-code', 'Потрібне уточнення', 'Needs attention'],
  ]
  for (const [status, ukrainian, english] of expected) {
    assert.equal(shipmentStatusLabel(status, 'uk', true), ukrainian, `${status}: Ukrainian`)
    assert.equal(shipmentStatusLabel(status, 'en', true), english, `${status}: English`)
  }
})


test('status icons remain safe for grouped and unknown carrier states', () => {
  assert.equal(shipmentStatusIcon('real:in_transit'), 'truck')
  assert.equal(shipmentStatusIcon('mock:delivered'), 'check-outline')
  assert.equal(shipmentStatusIcon('provider-secret'), 'info-outline')
})
