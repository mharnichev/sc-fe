import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const dependency = url(compile(await readFile(new URL('../utils/shipmentStatus.ts', import.meta.url), 'utf8')))
const source = compile(await readFile(new URL('../utils/orderReceiptDates.ts', import.meta.url), 'utf8')).replace(/from ['"]\.\/shipmentStatus['"]/, 'from ' + JSON.stringify(dependency))
const { orderReceiptDates } = await import(url(source))
const parcel = { id: 1, simulation: false, status: 'delivered', delivery_status: 'delivered' }
test('receipt uses event time, never successful poll or observation time', () => {
  assert.deepEqual(orderReceiptDates([{ ...parcel, events: [{ normalized_status: 'delivered', event_at: '2026-10-17T10:00:00Z', observed_at: '2026-10-17T11:00:00Z' }] }]), [{ id: 1, date: '2026-10-17T10:00:00Z' }])
  assert.deepEqual(orderReceiptDates([{ ...parcel, last_successful_check_at: '2026-10-17T11:00:00Z', events: [{ normalized_status: 'delivered', event_at: null, observed_at: '2026-10-17T11:00:00Z' }] }]), [{ id: 1, date: null }])
})
test('unknown, returned, return-child and MOCK cannot prove real customer receipt', () => {
  assert.deepEqual(orderReceiptDates([{ ...parcel, delivery_status: 'in_transit' }, { ...parcel, id: 2, simulation: true, status: 'delivered' }]), [])
  assert.deepEqual(orderReceiptDates([{ ...parcel, delivery_status: undefined }, { ...parcel, delivery_status: 'returned' }, { ...parcel, return_of_shipment_id: 2 }]), [])
})
test('multiple received parcels preserve dates and invalid times stay missing', () => {
  assert.deepEqual(orderReceiptDates([{ ...parcel, provider_event_at: 'invalid' }, { ...parcel, id: 2, provider_event_at: '2026-10-17T10:00:00Z' }]), [{ id: 1, date: null }, { id: 2, date: '2026-10-17T10:00:00Z' }])
})

test('mock-only delivered parcels never supply customer receipt dates', () => {
  const mock = { ...parcel, simulation: true, provider_event_at: '2026-10-17T10:00:00Z', events: [{ normalized_status: 'delivered', event_at: '2026-10-17T09:00:00Z' }] }
  assert.deepEqual(orderReceiptDates([mock]), [])
  assert.deepEqual(orderReceiptDates([mock, { ...parcel, id: 2, provider_event_at: '2026-10-17T11:00:00Z' }]), [{ id: 2, date: '2026-10-17T11:00:00Z' }])
})
