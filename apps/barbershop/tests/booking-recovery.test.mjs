import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const utilitySource = await read('../utils/bookingRecovery.ts')
const utilityCompiled = ts.transpileModule(utilitySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const recovery = await import(`data:text/javascript;base64,${Buffer.from(utilityCompiled).toString('base64')}`)

test('public recovery contracts use only documented endpoints and private-safe analytics payloads', async () => {
  const domainSource = await read('../domain/barbershop.ts')

  assert.match(domainSource, /api<BookingAlternativesResponseDto>\('\/public\/booking-alternatives'/)
  assert.match(domainSource, /api<PublicWaitlistResponseDto>\('\/public\/waitlist'/)
  assert.match(domainSource, /api<BookingFunnelEventReceipt>\('\/public\/booking-recovery\/events'/)
  assert.match(domainSource, /event_type: 'alternative_slot_selected' \| 'waitlist_opened'/)
  assert.match(domainSource, /claimWaitlistOffer = \(token: string\)/)
  assert.match(domainSource, /interface WaitlistOfferClaimResponseDto \{\s+public_id: string/)
  assert.doesNotMatch(domainSource, /interface WaitlistOfferClaimResponseDto \{\s+booking_id:/)
  assert.match(domainSource, /'\/public\/waitlist\/offers\/claim'/)
  assert.match(domainSource, /body: \{ token \}/)
  assert.doesNotMatch(domainSource, /customer_name.*BookingRecoveryEventPayload/)
  assert.doesNotMatch(domainSource, /customer_phone.*BookingRecoveryEventPayload/)
})

test('no-slot recovery maps alternatives through the normal booking flow and clamps waitlist dates', async () => {
  const source = await read('../components/sections/BookingSection.vue')

  const alternatives = recovery.bookingAlternativesPayload({
    masterId: 7,
    serviceIds: [11, 12],
    desiredDate: '2026-08-08',
    durationMinutes: 90,
    funnelSessionId: 'booking-session-123456',
  })
  assert.deepEqual(alternatives, {
    master_id: 7,
    service_ids: [11, 12],
    desired_date: '2026-08-08',
    duration_minutes: 90,
    another_master_acceptable: true,
    funnel_session_id: 'booking-session-123456',
  })

  const waitlist = recovery.publicWaitlistPayload({
    customerName: 'Іван Петренко',
    customerPhone: '+380671234567',
    serviceIds: [11, 12],
    selectedMasterId: 7,
    desiredDate: '2026-10-29',
    durationMinutes: 90,
    anotherMasterAcceptable: true,
    nearbyDatesAcceptable: true,
    maxBookableDate: '2026-10-31',
  })
  assert.deepEqual(waitlist, {
    customer_name: 'Іван Петренко',
    customer_phone: '+380671234567',
    service_ids: [11, 12],
    preferred_master_id: null,
    desired_date: '2026-10-29',
    acceptable_date_from: '2026-10-29',
    acceptable_date_to: '2026-10-31',
    duration_minutes: 90,
    notification_consent: true,
  })

  assert.match(source, /sameMaster = response\.same_master\.slice\(0, 3\)/)
  assert.match(source, /await refreshSlots\(\)/)
  assert.match(source, /recovery_source: 'alternative'/)
  assert.match(source, /status === 409 \? 'duplicate' : 'error'/)
  assert.match(source, /recordRecoveryEvent\('alternative_slot_selected'/)
  assert.match(source, /recordRecoveryEvent\('waitlist_opened'/)
  assert.match(source, /waitlistNamePrefilled\.value = waitlistForm\.customer_name\.trim\(\)\.length >= 2/)
  assert.match(source, /waitlistPhonePrefilled\.value = isValidPhoneNumber/)
  assert.match(source, /\.booking-step-panel--time \.booking-recovery \{[\s\S]*?overflow-y: auto;/)
  assert.match(source, /class="booking-recovery mt-4 bg-white\/\[0\.035\] p-3 sm:p-4"/)
  assert.match(source, /masterPhoto\(mastersById\.value\.get\(slot\.master\.id\)\)/)
  assert.match(source, /:alt="slot\.master\.name" class="h-14 w-14 object-cover object-top"/)
  assert.match(source, /:deep\(\.booking-recovery-action\) \{[\s\S]*?border-color: transparent;/)
})

test('custom and base multi-service alternatives remap to the target master', () => {
  const sourceServices = [
    { id: 11, base_service_id: 5, title_uk: 'Стрижка', duration_minutes: 60, price: '800.00' },
    { id: 12, base_service_id: null, title_uk: 'Камуфлювання', title_en: 'Camouflage', duration_minutes: 30, price: '500.00' },
  ]
  const targetServices = [
    { id: 21, base_service_id: 5, title_uk: 'Стрижка', duration_minutes: 60, price: 900 },
    { id: 22, base_service_id: null, title_uk: ' камуфлювання ', title_en: 'CAMOUFLAGE', duration_minutes: 30, price: 500 },
  ]

  assert.deepEqual(recovery.remapRecoveryServiceIds([11, 12], sourceServices, targetServices), [21, 22])
  assert.equal(recovery.remapRecoveryServiceIds([11, 12], sourceServices, targetServices.slice(0, 1)), null)
})

test('recovery calendar dates follow Kyiv and the backend two-calendar-month horizon', () => {
  assert.equal(recovery.kyivRecoveryDateInput(new Date('2026-08-05T21:30:00.000Z')), '2026-08-06')
  assert.equal(recovery.addRecoveryCalendarMonths('2026-12-31', 2), '2027-02-28')
  assert.equal(recovery.addRecoveryCalendarDays('2026-03-29', 1), '2026-03-30')
})

test('the waitlist offer route reads the opaque token only from the fragment and handles stale claims', async () => {
  const source = await read('../pages/booking/waitlist-offer.vue')

  assert.match(source, /waitlistOfferTokenFromHash\(window\.location\.hash \|\| route\.hash\)/)
  assert.doesNotMatch(source, /route\.query\.token/)
  assert.match(source, /domain\.claimWaitlistOffer\(token\.value\)/)
  assert.match(source, /status === 409 \|\| status === 410 \? 'unavailable' : 'error'/)
  assert.match(source, /noindex, nofollow, noarchive/)
  assert.match(source, /name: 'referrer', content: 'no-referrer'/)
  assert.doesNotMatch(source, /trackEvent\(/)
  assert.doesNotMatch(source, /console\./)
})

test('waitlist offer token parser accepts only opaque fragment values', () => {
  const token = 'a'.repeat(40)
  assert.equal(recovery.waitlistOfferTokenFromHash(`#${token}`), token)
  assert.equal(recovery.waitlistOfferTokenFromHash('#short'), '')
  assert.equal(recovery.waitlistOfferTokenFromHash('#token with spaces'), '')
  assert.equal(recovery.waitlistOfferTokenFromHash('#%E0%A4%A'), '')
})

test('secure waitlist offer tokens are excluded from browser analytics', async () => {
  const [googleAnalytics, hotjar, analytics] = await Promise.all([
    read('../plugins/google-analytics.client.ts'),
    read('../plugins/hotjar.client.ts'),
    read('../composables/useAnalytics.ts'),
  ])

  assert.match(googleAnalytics, /privateWaitlistOfferContext/)
  assert.match(googleAnalytics, /'\/booking\/waitlist-offer'/)
  assert.match(hotjar, /hasPrivateWaitlistOfferContext/)
  assert.match(hotjar, /hasPrivateContext\(\)/)
  assert.match(hotjar, /router\.beforeEach/)
  assert.match(hotjar, /window\.location\.assign\(to\.fullPath\)/)
  assert.match(analytics, /privateWaitlistOfferContext/)
  assert.match(analytics, /'\/booking\/waitlist-offer'/)
})
