import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../utils/bookingObservations.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { createBookingObservationTracker, deliverBookingObservation, availabilityFailure } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const context = { master_id: 91001, service_ids: [91003, 91002, 91003], target_date: '2026-11-03', duration_minutes: 60, trigger: 'initial' }
test('initial empty is observable separately from legacy explicit-date no_slot; one terminal per request', () => {
  let id = 0, session = 'booking-attempt-original'
  const sent = []
  const tracker = createBookingObservationTracker(() => session, () => `identity-${++id}`, event => sent.push(event))
  tracker.view(context)
  const first = tracker.begin(context)
  session = 'booking-attempt-new'
  first.result(0)
  first.fail('network')
  first.cancel('navigation')
  assert.deepEqual(sent.map(e => e.event_type), ['time_step_viewed', 'availability_requested', 'availability_result'])
  assert.equal(sent[2].slot_count, 0)
  assert.equal(sent[2].anonymous_session_id, 'booking-attempt-original')
  assert.deepEqual(sent[2].service_ids, [91002, 91003])
  assert.equal(sent[0].availability_request_id, undefined)
  assert.equal(sent[1].availability_request_id, sent[2].availability_request_id)
  assert.equal('customer_phone' in sent[2], false)
})
test('A to B to A cancels superseded requests and stale completion never overwrites terminal meaning', () => {
  const sent = []; let id = 0
  const tracker = createBookingObservationTracker(() => 'booking-attempt-12345', () => `identity-${++id}`, e => sent.push(e))
  const a = tracker.begin(context)
  const b = tracker.begin({ ...context, master_id: 91004 })
  const latest = tracker.begin(context)
  a.result(2); b.fail('timeout'); latest.fail('http_5xx'); tracker.cancel('navigation')
  assert.deepEqual(sent.map(e => e.event_type), ['availability_requested', 'availability_cancelled', 'availability_requested', 'availability_cancelled', 'availability_requested', 'availability_failed'])
  assert.equal(sent[1].cancel_reason, 'superseded')
  assert.equal(new Set(sent.filter(e => e.event_type === 'availability_requested').map(e => e.availability_request_id)).size, 3)
})
test('delivery failure is bounded and retry preserves the original immutable attempt/event payload', async () => {
  const events = []; let id = 0
  const tracker = createBookingObservationTracker(() => 'booking-attempt-original', () => `identity-${++id}`, e => events.push(e))
  tracker.begin(context).result(0)
  const calls = []
  await deliverBookingObservation(events[1], async payload => { calls.push(payload); throw new Error('offline') }, async () => {})
  assert.equal(calls.length, 2)
  assert.strictEqual(calls[0], calls[1])
  let count = 0
  await deliverBookingObservation(events[1], async () => { count++; throw { status: 409 } }, async () => {})
  assert.equal(count, 1)
  assert.equal(availabilityFailure({ name: 'TimeoutError' }), 'timeout')
  assert.equal(availabilityFailure({ response: { status: 503 } }), 'http_5xx')
  assert.equal(availabilityFailure({ status: 422 }), 'http_4xx')
  assert.equal(availabilityFailure(new Error('private raw message')), 'network')
})
