import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const bookingsPage = new URL('../pages/bookings.vue', import.meta.url)
const timeBlocksPage = new URL('../pages/time-blocks.vue', import.meta.url)
const myTimeBlocksPage = new URL('../pages/my-time-blocks.vue', import.meta.url)
const calendarSource = await readFile(new URL('../composables/useBookingCalendar.ts', import.meta.url), 'utf8')
const compiledCalendar = ts.transpileModule(calendarSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const calendarContract = await import(`data:text/javascript;base64,${Buffer.from(compiledCalendar).toString('base64')}`)
const calendarGridSource = await readFile(new URL('../components/BookingCalendarGrid.vue', import.meta.url), 'utf8')
const apiSource = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')
const accessSource = await readFile(new URL('../composables/useBackofficeAccess.ts', import.meta.url), 'utf8')
const compiledAccess = ts.transpileModule(accessSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const access = await import(`data:text/javascript;base64,${Buffer.from(compiledAccess).toString('base64')}`)

test('booking calendar keeps time blocks returned for a redirected master', async () => {
  const source = await readFile(bookingsPage, 'utf8')

  assert.match(source, /const visibleBlocks = computed<TimeBlock\[\]>\(\(\) => timeBlocks\.value\)/)
  assert.doesNotMatch(
    source,
    /timeBlocks\.value\.filter\([\s\S]*?Number\(block\.master_id\) === selectedMasterId\.value/,
  )
})

test('master time-block filters use an inclusive Kyiv date selection as a half-open datetime range', async () => {
  const source = await readFile(myTimeBlocksPage, 'utf8')

  assert.match(source, /date_from: toKyivIso\(filters\.date_from, '00:00'\)/)
  assert.match(source, /date_to: toKyivIso\(addDaysInput\(filters\.date_to, 1\), '00:00'\)/)
  assert.match(source, /const blocks = computed<TimeBlock\[\]>\(\(\) => normalizeItems\(data\.value\?\.timeBlocks\)\)/)
  assert.doesNotMatch(source, /date_from: filters\.date_from/)
  assert.doesNotMatch(source, /date_to: filters\.date_to/)
  assert.doesNotMatch(source, /block\.start_at\.slice\(0, 10\)/)
})

test('time blocks remain busy and expose their Kyiv time in calendar entries', () => {
  const timeFormatter = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  })
  globalThis.useBookingFormatting = () => ({
    timeZone: 'Europe/Kyiv',
    addDaysInput: value => value,
    todayInput: () => '2026-08-09',
    toKyivIso: (date, time) => `${date}T${time}:00+03:00`,
    formatDateTime: value => value,
    formatTime: value => value ? timeFormatter.format(new Date(value)) : '-',
    bookingStart: booking => booking.start_at,
    bookingEnd: booking => booking.end_at,
    bookingPhone: () => '',
    customerName: () => '',
    bookingRedirectSourceLabel: () => '',
    bookingServices: () => [],
    bookingServicesLabel: () => '',
  })

  const block = {
    id: 42,
    master_id: 2,
    start_at: '2026-08-09T09:00:00Z',
    end_at: '2026-08-09T10:00:00Z',
    reason: 'Перерва',
  }
  const calendar = calendarContract.useBookingCalendar()

  assert.deepEqual(calendar.buildBusyRanges([], [block], []), [{
    id: 'block-42',
    kind: 'block',
    date: '2026-08-09',
    startAt: block.start_at,
    endAt: block.end_at,
    startMinutes: 12 * 60,
    endMinutes: 13 * 60,
  }])
  assert.deepEqual(calendar.buildDisplayEntries([], [block], []), [{
    id: 'block-42',
    kind: 'block',
    date: '2026-08-09',
    startAt: block.start_at,
    endAt: block.end_at,
    startMinutes: 12 * 60,
    endMinutes: 13 * 60,
    title: 'Заблоковано',
    subtitle: 'Перерва',
    meta: '12:00-13:00',
    block,
  }])
})

test('time-block filters send an inclusive Kyiv date selection as a half-open datetime range', async () => {
  const source = await readFile(timeBlocksPage, 'utf8')

  assert.match(source, /date_from: toKyivIso\(filters\.date_from, '00:00'\)/)
  assert.match(source, /date_to: toKyivIso\(addDaysInput\(filters\.date_to, 1\), '00:00'\)/)
  assert.match(source, /const blocks = computed<TimeBlock\[\]>\(\(\) => normalizeItems\(data\.value\?\.timeBlocks\)\)/)
  assert.match(source, /api\.adminGetCalendarTimeBlocks\(\{/)
  assert.doesNotMatch(source, /api\.adminGetTimeBlocks\(1,/)
  assert.doesNotMatch(source, /date_from: filters\.date_from/)
  assert.doesNotMatch(source, /date_to: filters\.date_to/)
  assert.doesNotMatch(source, /block\.start_at\.slice\(0, 10\)/)
})

test('backoffice calendar covers the same 08:00-20:00 Kyiv workday as booking capacity', () => {
  assert.match(calendarSource, /const workdayStart = '08:00'/)
  assert.match(calendarSource, /const workdayEnd = '20:00'/)
  assert.match(calendarSource, /const workdayStartMinutes = 8 \* 60/)
  assert.match(calendarSource, /const workdayEndMinutes = 20 \* 60/)
})

test('redirected booking ownership follows the source master', () => {
  assert.equal(access.bookingBelongsToMaster(1, 2, 1), true)
  assert.equal(access.bookingBelongsToMaster(2, 2, 1), true)
  assert.equal(access.bookingBelongsToMaster(3, 2, 1), false)
  assert.equal(access.bookingBelongsToMaster(2, 2, null), true)
  assert.equal(access.bookingBelongsToMaster(null, 2, 1), false)
})

test('booking controls pass redirect source ownership to the access check', async () => {
  const source = await readFile(bookingsPage, 'utf8')

  assert.match(
    source,
    /canManageBooking\(booking\.master_id, redirectedFromMasterId\(booking\)\)/,
  )
  assert.match(source, /canManageCalendarBooking\(selected\)/)
})

test('calendar hold API contract remains redacted and uses dedicated self/admin endpoints', () => {
  const contract = /export interface CalendarHold \{([\s\S]*?)\n\}/.exec(apiSource)?.[1]

  assert.ok(contract)
  assert.match(contract, /kind: 'waitlist_hold'/)
  assert.match(contract, /master_id: number/)
  assert.match(contract, /start_at: string/)
  assert.match(contract, /end_at: string/)
  assert.match(contract, /expires_at: string/)
  assert.doesNotMatch(contract, /^\s*(?:id|customer|phone|token)\??:/m)
  assert.match(apiSource, /api<CalendarHold\[\]>\('\/backoffice\/masters\/me\/calendar-holds'/)
  assert.match(apiSource, /api<CalendarHold\[\]>\('\/backoffice\/calendar-holds'/)
})

test('waitlist holds block slots and render with Kyiv expiry without edit actions', async () => {
  const pageSource = await readFile(bookingsPage, 'utf8')

  assert.match(pageSource, /api\.adminGetCalendarHolds\(/)
  assert.match(pageSource, /api\.getMyCalendarHolds\(/)
  assert.match(pageSource, /buildBusyRanges\([\s\S]*?calendarHolds\.value\)/)
  assert.match(pageSource, /buildDisplayEntries\([\s\S]*?calendarHolds\.value\)/)
  assert.match(pageSource, /if \(entry\.kind === 'waitlist_hold'\) return/)
  assert.match(calendarSource, /kind: 'waitlist_hold'/)
  assert.match(calendarSource, /title: 'Тимчасово зарезервовано'/)
  assert.match(calendarSource, /formatDateTime\(hold\.expires_at\).*за Києвом/)
  assert.match(calendarGridSource, /:disabled="!entryIsInteractive\(entry\)"/)
  assert.match(calendarGridSource, /entry\.kind !== 'waitlist_hold'/)
  assert.doesNotMatch(pageSource, /selectedHold|deleteSelectedHold|editSelectedHold/)
})

test('capacity keeps every confirmed booking busy regardless of service filters', async () => {
  const pageSource = await readFile(bookingsPage, 'utf8')
  const bookings = [
    { id: 1, status: 'confirmed', service_ids: [8] },
    { id: 2, status: 'confirmed', service_ids: [5] },
    { id: 3, status: 'cancelled', service_ids: [8] },
    { id: 4, status: 'pending', service_ids: [8] },
  ]

  assert.deepEqual(calendarContract.capacityBlockingBookings(bookings).map(booking => booking.id), [1, 2])
  assert.match(pageSource, /capacityBlockingBookings\(bookings\.value\)/)
  assert.match(pageSource, /buildBusyRanges\(\s*capacityBookings\.value,/)
  assert.match(pageSource, /buildDisplayEntries\(visibleBookings\.value,/)
  assert.match(pageSource, /api\.getMyCalendar\(\{/)
  assert.doesNotMatch(pageSource, /api\.getMyBookings\(\{/)
  assert.doesNotMatch(pageSource, /service_id: filters\.service_id \? Number\(filters\.service_id\) : null/)
  assert.doesNotMatch(pageSource, /status: filters\.status as BookingStatus \| ''/)
})

test('admin calendar uses bounded unpaginated capacity endpoints', async () => {
  const pageSource = await readFile(bookingsPage, 'utf8')

  assert.match(apiSource, /api<Booking\[\]>\('\/backoffice\/calendar\/bookings'/)
  assert.match(apiSource, /api<TimeBlock\[\]>\('\/backoffice\/calendar\/time-blocks'/)
  assert.match(pageSource, /api\.adminGetCalendarBookings\(bookingFilters\)/)
  assert.match(pageSource, /api\.adminGetCalendarTimeBlocks\(\{/)
  assert.doesNotMatch(pageSource, /api\.adminGetBookings\(1,/)
  assert.doesNotMatch(pageSource, /api\.adminGetTimeBlocks\(1,/)
  assert.doesNotMatch(pageSource, /const pageSize =/)
})

test('barber occupancy uses the redacted effective-target capacity contract', async () => {
  const pageSource = await readFile(bookingsPage, 'utf8')
  const contract = /export interface CalendarCapacityBooking \{([\s\S]*?)\n\}/.exec(apiSource)?.[1]

  assert.ok(contract)
  assert.match(contract, /kind: 'booking'/)
  assert.match(contract, /master_id: number/)
  assert.match(contract, /start_at: string/)
  assert.match(contract, /end_at: string/)
  assert.doesNotMatch(contract, /^\s*(?:id|customer|phone|token|service)\??:/m)
  assert.match(apiSource, /api<CalendarCapacityBooking\[\]>\('\/backoffice\/masters\/me\/calendar-capacity'/)
  assert.match(pageSource, /api\.getMyCalendarCapacity\(\{/)
  assert.match(pageSource, /isAdmin\.value \? calendar\.capacityBlockingBookings\(bookings\.value\) : \[\]/)
  assert.match(pageSource, /isAdmin\.value \? \[\] : calendarCapacityBookings\.value/)
  assert.match(pageSource, /redactedCapacityBookings\.value/)
  assert.doesNotMatch(calendarSource, /CalendarDisplayEntry[\s\S]*?capacity\?:/)
})

test('expired holds stop blocking and nearest expiry schedules a refresh with cleanup', async () => {
  const pageSource = await readFile(bookingsPage, 'utf8')
  const holds = [
    { kind: 'waitlist_hold', master_id: 1, start_at: '2026-08-08T12:00:00Z', end_at: '2026-08-08T13:00:00Z', expires_at: '2026-08-08T10:00:00Z' },
    { kind: 'waitlist_hold', master_id: 1, start_at: '2026-08-08T14:00:00Z', end_at: '2026-08-08T15:00:00Z', expires_at: '2026-08-08T11:00:00Z' },
  ]
  const nowMs = new Date('2026-08-08T10:00:00Z').getTime()

  assert.deepEqual(calendarContract.activeCalendarHoldsAt(holds, nowMs), [holds[1]])
  assert.equal(calendarContract.nearestCalendarHoldExpiryAt(holds, nowMs), new Date(holds[1].expires_at).getTime())
  assert.match(pageSource, /watch\(calendarHoldRecords, scheduleCalendarHoldExpiryRefresh, \{ immediate: true \}\)/)
  assert.match(pageSource, /void refresh\(\)\.finally\(scheduleCalendarHoldExpiryRefresh\)/)
  assert.match(pageSource, /calendarHoldExpiryMounted = false/)
  assert.match(pageSource, /stopCalendarHoldExpiryWatch\?\.\(\)/)
  assert.match(pageSource, /clearCalendarHoldExpiryTimer\(\)/)
})
