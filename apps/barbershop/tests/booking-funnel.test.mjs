import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/bookingFunnel.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const funnel = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const ids = (...values) => {
  const queue = [...values]
  return () => queue.shift()
}

test('creates an anonymous attempt and stable event IDs for retries', () => {
  const attempt = funnel.createBookingFunnelAttempt(ids('session-id-123456'))
  const randomId = ids('event-id-123456', 'unused-event-id')

  const first = funnel.bookingFunnelEventPayload(
    attempt,
    'master_selected',
    { masterId: 7, serviceId: 11 },
    randomId,
  )
  const retry = funnel.bookingFunnelEventPayload(
    attempt,
    'master_selected',
    { masterId: 7, serviceId: 11 },
    randomId,
  )

  assert.equal(first.anonymous_session_id, 'booking-session-id-123456')
  assert.equal(first.event_id, 'event-event-id-123456')
  assert.deepEqual(retry, first)
})

test('sends a no-slot target date and uses it to deduplicate observations', () => {
  const attempt = funnel.createBookingFunnelAttempt(ids('session-id-123456'))
  const randomId = ids('first-event-id', 'second-event-id')

  const firstDate = funnel.bookingFunnelEventPayload(
    attempt,
    'no_slot',
    { masterId: 7, serviceId: 11, targetDate: '2026-07-25' },
    randomId,
  )
  const firstDateRetry = funnel.bookingFunnelEventPayload(
    attempt,
    'no_slot',
    { masterId: 7, serviceId: 11, targetDate: '2026-07-25' },
    randomId,
  )
  const secondDate = funnel.bookingFunnelEventPayload(
    attempt,
    'no_slot',
    { masterId: 7, serviceId: 11, targetDate: '2026-07-26' },
    randomId,
  )

  assert.deepEqual(firstDateRetry, firstDate)
  assert.notEqual(firstDate.event_id, secondDate.event_id)
  assert.equal(firstDate.target_date, '2026-07-25')
  assert.equal(secondDate.target_date, '2026-07-26')
})

test('does not expose malformed dates or target dates for unrelated events', () => {
  const malformed = funnel.bookingFunnelEventPayload(
    funnel.createBookingFunnelAttempt(ids('session-id-123456')),
    'no_slot',
    { targetDate: '2026-02-31' },
    ids('event-id-123456'),
  )
  const unrelated = funnel.bookingFunnelEventPayload(
    funnel.createBookingFunnelAttempt(ids('session-id-654321')),
    'slot_selected',
    { targetDate: '2026-07-25' },
    ids('event-id-654321'),
  )

  assert.equal('target_date' in malformed, false)
  assert.equal('target_date' in unrelated, false)
})

test('allows only aggregate identifiers and drops invalid or personal fields', () => {
  const attempt = funnel.createBookingFunnelAttempt(ids('session-id-123456'))
  const payload = funnel.bookingFunnelEventPayload(
    attempt,
    'contact_entered',
    {
      masterId: 7,
      serviceId: -1,
      customerName: 'Must not leak',
      phone: '+380501112233',
      comment: 'Must not leak',
    },
    ids('event-id-123456'),
  )

  assert.deepEqual(payload, {
    event_id: 'event-event-id-123456',
    anonymous_session_id: 'booking-session-id-123456',
    event_type: 'contact_entered',
    master_id: 7,
  })
})

test('maps slot conflicts separately from other booking failures', () => {
  assert.equal(funnel.bookingFunnelFailureEvent(409), 'stale_schedule')
  assert.equal(funnel.bookingFunnelFailureEvent(422), 'booking_error')
  assert.equal(funnel.bookingFunnelFailureEvent(500), 'booking_error')
  assert.equal(funnel.bookingFunnelFailureEvent(), 'booking_error')
})

test('public booking API contract records events and attributes server-side success', async () => {
  const domainSource = await readFile(new URL('../domain/barbershop.ts', import.meta.url), 'utf8')
  const bookingSource = await readFile(
    new URL('../components/sections/BookingSection.vue', import.meta.url),
    'utf8',
  )
  const contactsSource = await readFile(new URL('../pages/contacts.vue', import.meta.url), 'utf8')

  assert.match(domainSource, /api<BookingFunnelEventReceipt>\('\/public\/booking-funnel\/events'/)
  assert.match(domainSource, /funnel_session_id\?: string/)

  for (const source of [bookingSource, contactsSource]) {
    assert.match(source, /bookingFunnel\.recordInBackground\('contact_entered'/)
    assert.match(source, /funnel_session_id: funnelSessionId/)
    assert.match(source, /bookingFunnelFailureEvent\(status\)/)
  }
  assert.match(bookingSource, /targetDate: selectedDate\.value/)
})
