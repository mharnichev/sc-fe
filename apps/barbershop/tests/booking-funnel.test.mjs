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

test('keeps pre-duration event keys stable for non-no-slot events', () => {
  const attempt = {
    anonymousSessionId: 'booking-session-id-123456',
    eventIds: {
      'master_selected:7:11::': 'event-existing-id-123456',
    },
  }

  const payload = funnel.bookingFunnelEventPayload(
    attempt,
    'master_selected',
    { masterId: 7, serviceId: 11 },
    ids('must-not-be-used'),
  )

  assert.equal(payload.event_id, 'event-existing-id-123456')
})

test('restores only safe, unexpired attempts from session storage', () => {
  const stored = JSON.stringify({
    attempt: {
      anonymousSessionId: 'booking-session-id-123456',
      eventIds: {
        'booking_start::': 'event-event-id-123456',
      },
    },
    expiresAt: 2_000,
    analyticsStarted: false,
  })

  assert.deepEqual(funnel.parseStoredBookingFunnelAttempt(stored, 1_000), {
    attempt: {
      anonymousSessionId: 'booking-session-id-123456',
      eventIds: {
        'booking_start::': 'event-event-id-123456',
      },
    },
    expiresAt: 2_000,
    analyticsStarted: false,
  })
  assert.equal(funnel.parseStoredBookingFunnelAttempt(stored, 2_000), null)
  assert.equal(
    funnel.parseStoredBookingFunnelAttempt(
      stored.replace('"analyticsStarted":false', '"analyticsStarted":"yes"'),
      1_000,
    ),
    null,
  )
  assert.equal(funnel.parseStoredBookingFunnelAttempt('{"attempt":{"anonymousSessionId":"unsafe"}}'), null)
})

test('sends a no-slot target date and uses it to deduplicate observations', () => {
  const attempt = funnel.createBookingFunnelAttempt(ids('session-id-123456'))
  const randomId = ids('first-event-id', 'second-event-id', 'third-event-id', 'fourth-event-id')

  const firstDate = funnel.bookingFunnelEventPayload(
    attempt,
    'no_slot',
    { masterId: 7, serviceId: 12, serviceIds: [12, 11, 12], targetDate: '2026-07-25', durationMinutes: 90 },
    randomId,
  )
  const firstDateRetry = funnel.bookingFunnelEventPayload(
    attempt,
    'no_slot',
    { masterId: 7, serviceId: 11, serviceIds: [11, 12], targetDate: '2026-07-25', durationMinutes: 90 },
    randomId,
  )
  const secondDate = funnel.bookingFunnelEventPayload(
    attempt,
    'no_slot',
    { masterId: 7, serviceId: 11, serviceIds: [11, 12], targetDate: '2026-07-26', durationMinutes: 90 },
    randomId,
  )
  const anotherServiceSet = funnel.bookingFunnelEventPayload(
    attempt,
    'no_slot',
    { masterId: 7, serviceId: 11, serviceIds: [11], targetDate: '2026-07-25', durationMinutes: 90 },
    randomId,
  )
  const anotherDuration = funnel.bookingFunnelEventPayload(
    attempt,
    'no_slot',
    { masterId: 7, serviceId: 11, serviceIds: [11, 12], targetDate: '2026-07-25', durationMinutes: 120 },
    randomId,
  )

  assert.equal(firstDateRetry.event_id, firstDate.event_id)
  assert.deepEqual(firstDateRetry.service_ids, firstDate.service_ids)
  assert.notEqual(firstDate.event_id, secondDate.event_id)
  assert.notEqual(firstDate.event_id, anotherServiceSet.event_id)
  assert.notEqual(firstDate.event_id, anotherDuration.event_id)
  assert.deepEqual(firstDate.service_ids, [11, 12])
  assert.equal(firstDate.target_date, '2026-07-25')
  assert.equal(firstDate.duration_minutes, 90)
  assert.equal(secondDate.target_date, '2026-07-26')
})

test('records no-slot only for the settled empty response matching the current request', () => {
  const settledEmpty = {
    canLoad: true,
    isClosedDate: false,
    loadedKey: 'master-7-date-b',
    requestKey: 'master-7-date-b',
    pending: false,
    hasError: false,
    slotCount: 0,
  }

  assert.equal(funnel.shouldRecordNoSlotObservation(settledEmpty), true)
  assert.equal(funnel.shouldRecordNoSlotObservation({ ...settledEmpty, loadedKey: 'master-7-date-a' }), false)
  assert.equal(funnel.shouldRecordNoSlotObservation({ ...settledEmpty, pending: true }), false)
  assert.equal(funnel.shouldRecordNoSlotObservation({ ...settledEmpty, hasError: true }), false)
  assert.equal(funnel.shouldRecordNoSlotObservation({ ...settledEmpty, slotCount: 1 }), false)
  assert.equal(funnel.shouldRecordNoSlotObservation({ ...settledEmpty, canLoad: false }), false)
  assert.equal(funnel.shouldRecordNoSlotObservation({ ...settledEmpty, isClosedDate: true }), false)
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
  assert.equal(funnel.bookingFunnelFailureEvent(400), null)
  assert.equal(funnel.bookingFunnelFailureEvent(422), null)
  assert.equal(funnel.bookingFunnelFailureEvent(429), null)
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
  const funnelComposableSource = await readFile(
    new URL('../composables/useBookingFunnel.ts', import.meta.url),
    'utf8',
  )

  assert.match(domainSource, /api<BookingFunnelEventReceipt>\('\/public\/booking-funnel\/events'/)
  assert.match(domainSource, /funnel_session_id\?: string/)
  assert.match(domainSource, /keepalive: true/)
  assert.match(domainSource, /retry: 2/)
  assert.match(funnelComposableSource, /window\.sessionStorage/)
  assert.match(funnelComposableSource, /storedAttempt\.value\.analyticsStarted = true/)
  assert.match(funnelComposableSource, /const claimAnalyticsStart =/)

  for (const source of [bookingSource, contactsSource]) {
    assert.match(source, /bookingFunnel\.recordInBackground\('contact_entered'/)
    assert.match(source, /funnel_session_id: funnelSessionId/)
    assert.match(source, /bookingFunnelFailureEvent\(status\)/)
    assert.match(source, /bookingFunnel\.claimAnalyticsStart\(\)/)
    assert.doesNotMatch(source, /const bookingStarted = ref\(false\)/)
  }
  assert.match(bookingSource, /targetDate: selectedDate\.value/)
  assert.match(bookingSource, /serviceIds: selectedServiceIds\.value/)
  assert.match(bookingSource, /durationMinutes: selectedDurationMinutes\.value/)
  assert.match(bookingSource, /shouldRecordNoSlotObservation/)
  assert.match(bookingSource, /isSelectedDateClosed\.value/)
  assert.match(bookingSource, /slotsError\.value/)
  assert.match(bookingSource, /visibleSlots\.value\.length/)
  assert.match(bookingSource, /recordReachedMasterStep/)
  assert.match(bookingSource, /trackEvent\('booking_start', \{\s*source: props\.analyticsSource/)
  assert.match(contactsSource, /kyivLocalDateTimeToIso\(form\.scheduled_at\)/)
  assert.match(contactsSource, /recordReachedMasterStep\(masterId, serviceIds\[0\]\)/)
  assert.match(contactsSource, /trackEvent\('booking_start', \{\s*source: 'contacts_page'/)
})

test('CTA clicks stay separate from meaningful booking starts', async () => {
  const sources = await Promise.all([
    '../components/FloatingBookingDrawer.vue',
    '../components/sections/HeroSection.vue',
    '../components/sections/Footer.vue',
    '../components/sections/ServicesGrid.vue',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))

  for (const ctaSource of sources) {
    assert.match(ctaSource, /booking_cta_click/)
    assert.doesNotMatch(ctaSource, /trackEvent\(['"]booking_start/)
    assert.doesNotMatch(ctaSource, /trackEvent\(['"]select_service/)
  }
})
