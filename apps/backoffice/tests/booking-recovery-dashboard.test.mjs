import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/bookingRecoveryContract.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const contract = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const summaryFixture = (overrides = {}) => ({
  timezone: 'Europe/Kyiv',
  date_from: '2026-08-01',
  date_to: '2026-08-05',
  no_slot_sessions: 12,
  alternatives_requested: 10,
  alternatives_returned: 9,
  alternative_slots_returned: 22,
  alternative_slots_selected: 5,
  bookings_after_alternative: 3,
  alternative_recovery_rate_percent: 25,
  waitlist_requests: 4,
  offers_sent: 3,
  offers_delivered: 2,
  offers_claimed: 1,
  offers_expired: 1,
  cancelled_slots_refilled: 1,
  average_cancellation_to_refill_seconds: 1800,
  ...overrides,
})

test('booking recovery summary maps the backend contract without personal data', () => {
  const parsed = contract.parseBookingRecoverySummary(summaryFixture({ alternative_recovery_rate_percent: '25.00' }))

  assert.equal(parsed.no_slot_sessions, 12)
  assert.equal(parsed.alternatives_returned, 9)
  assert.equal(parsed.cancelled_slots_refilled, 1)
  assert.equal(parsed.average_cancellation_to_refill_seconds, 1800)
  assert.equal(parsed.alternative_recovery_rate_percent, '25.00')
})

test('booking recovery summary rejects invalid counters and unsupported periods', () => {
  assert.throws(() => contract.parseBookingRecoverySummary(summaryFixture({ offers_sent: -1 })))
  assert.throws(() => contract.parseBookingRecoverySummary(summaryFixture({ date_to: '2026-07-31' })))
  assert.throws(() => contract.parseBookingRecoverySummary(summaryFixture({ timezone: 'UTC' })))
  assert.throws(() => contract.parseBookingRecoverySummary(summaryFixture({ alternative_recovery_rate_percent: 101 })))
  assert.throws(() => contract.parseBookingRecoverySummary(summaryFixture({ alternative_recovery_rate_percent: '' })))
  assert.throws(() => contract.parseBookingRecoverySummary(summaryFixture({ alternative_recovery_rate_percent: false })))
})

test('recovery dashboard remains global and never renders secure waitlist tokens', async () => {
  const component = await readFile(new URL('../components/dashboard/BookingRecoverySection.vue', import.meta.url), 'utf8')
  const page = await readFile(new URL('../pages/admin/dashboards/barbershop.vue', import.meta.url), 'utf8')

  assert.match(component, /Фільтр майстра вище на цей блок не впливає/)
  assert.match(component, /Унікальні сесії, не кількість втрачених клієнтів/)
  assert.doesNotMatch(component, /token|claim_url|booking_link/i)
  assert.match(page, /adminGetBookingRecoverySummary/)
})
