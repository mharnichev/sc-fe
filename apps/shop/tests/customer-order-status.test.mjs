import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const dependency = url(compile(await readFile(new URL('../utils/shipmentStatus.ts', import.meta.url), 'utf8')))
const source = compile(await readFile(new URL('../utils/customerOrderStatus.ts', import.meta.url), 'utf8')).replace(/from ['"]\.\/shipmentStatus['"]/, 'from ' + JSON.stringify(dependency))
const { customerOrderStatus: status } = await import(url(source))
const parcel = (state, extra = {}) => ({ simulation: false, delivery_status: state, ...extra })
const order = (...shipments) => ({ status: 'completed', shipments })
test('completed and payment states without tracking never prove receipt', () => {
  for (const state of ['pending', 'confirmed', 'paid', 'completed']) {
    assert.equal(status({ status: state, shipments: [] }).label, 'Прийнято')
    assert.equal(status({ status: state, shipments: [] }).tone, 'neutral')
  }
})
test('customer states have explicit requested colors', () => {
  for (const [state, label, tone] of [
    ['preparing', 'Готуємо', 'warning'], ['handed_over', 'Передано пошті', 'info'],
    ['in_transit', 'У дорозі', 'info'], ['ready_for_pickup', 'У відділенні', 'info'],
    ['delivered', 'Посилку отримано', 'success'], ['cancelled', 'Доставку скасовано', 'danger'],
    ['refused', 'Відмова', 'danger'], ['returning', 'Повертається', 'warning'],
    ['returned', 'Повернено', 'neutral'], ['unknown', 'Потрібне уточнення', 'warning'],
  ]) { const actual = status(order(parcel(state))); assert.equal(actual.label, label); assert.equal(actual.tone, tone) }
  assert.equal(status({ status: 'cancelled', shipments: [] }).tone, 'danger')
})
test('partial receipt is yellow and never claims all goods received', () => {
  const result = status(order(parcel('delivered'), parcel('in_transit')))
  assert.equal(result.label, 'Отримано 1 з 2 посилок')
  assert.equal(result.tone, 'warning')
  assert.equal(status(order(parcel('delivered'), parcel('delivered'))).label, 'Усі посилки отримано')
})
test('MOCK cannot prove real receipt and retains separate evidence', () => {
  const mock = parcel(undefined, { simulation: true, status: 'delivered' })
  assert.equal(status(order(mock)).label, 'Тест: Посилку отримано')
  assert.equal(status(order(mock), 'en').label, 'Test: Parcel received')
  assert.equal(status(order(parcel('in_transit'), mock)).tone, 'info')
  assert.equal(status(order(parcel(undefined, { status: 'delivered' }))).tone, 'warning')
})
test('returns outrank receipt, canceled label allows replacement, payment remains untouched', () => {
  const input = { ...order(parcel('delivered'), parcel('returning')), payment_status: 'unpaid' }
  assert.equal(status(input).label, 'Є повернення')
  assert.equal(status(order(parcel('returned'), parcel('in_transit'))).label, 'Є повернені посилки')
  assert.equal(status(order(parcel('refused'), parcel('delivered'))).label, 'Є відмова')
  assert.equal(input.payment_status, 'unpaid')
  assert.equal(status(order(parcel('delivered', { return_of_shipment_id: 1 }))).tone, 'warning')
  assert.equal(status(order(parcel('cancelled'), parcel('delivered'))).label, 'Посилку отримано')
  assert.equal(status(order(parcel('delivered')), 'en').label, 'Parcel received')
})

test('mock-only aggregates mark every state as test data without changing real or mixed summaries', () => {
  for (const state of ['created', 'handed_over', 'in_transit', 'ready_for_pickup', 'delivered', 'refused', 'returning', 'returned', 'cancelled', 'unknown']) {
    const mock = parcel(undefined, { simulation: true, status: state })
    const actual = status(order(mock))
    const real = status(order(parcel(state)))
    assert.equal(actual.label, `Тест: ${real.label}`)
    assert.equal(actual.tone, real.tone)
    assert.equal(status(order(parcel(state), mock)).label, real.label)
  }
  assert.equal(status(order(parcel(undefined, { simulation: true, status: 'delivered' }), parcel(undefined, { simulation: true, status: 'in_transit' }))).label, 'Тест: Отримано 1 з 2 посилок')
})
