import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const utilitySource = await readFile(new URL('../utils/scheduleIntervals.ts', import.meta.url), 'utf8')
const compiledUtility = ts.transpileModule(utilitySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const intervals = await import(`data:text/javascript;base64,${Buffer.from(compiledUtility).toString('base64')}`)

const range = (start, end) => ({
  start: new Date(`2026-08-02T${start}:00+03:00`).getTime(),
  end: new Date(`2026-08-02T${end}:00+03:00`).getTime(),
})

test('schedule ranges merge duplicate, overlapping, and adjacent blocks without filling real gaps', () => {
  const merged = intervals.mergeRanges([
    range('09:00', '10:00'),
    range('10:00', '12:30'),
    range('13:30', '16:00'),
    range('13:30', '16:00'),
    range('13:30', '16:00'),
    range('17:30', '20:00'),
  ])

  assert.deepEqual(merged, [
    range('09:00', '12:30'),
    range('13:30', '16:00'),
    range('17:30', '20:00'),
  ])
  assert.equal(intervals.minutesInRanges(merged), 8.5 * 60)
})

test('schedule capacity excludes blocks and only counts bookings inside bookable ranges', () => {
  const availability = [range('09:00', '20:00')]
  const blocks = [
    range('09:00', '12:30'),
    range('13:30', '16:00'),
    range('17:30', '20:00'),
  ]
  const capacity = intervals.subtractRanges(availability, blocks)
  const bookings = [range('12:00', '14:00'), range('17:00', '18:00')]
  const bookedInsideCapacity = intervals.intersectRanges(capacity, bookings)

  assert.deepEqual(capacity, [range('12:30', '13:30'), range('16:00', '17:30')])
  assert.equal(intervals.minutesInRanges(availability), 11 * 60)
  assert.equal(intervals.minutesInRanges(intervals.intersectRanges(availability, blocks)), 8.5 * 60)
  assert.equal(intervals.minutesInRanges(capacity), 2.5 * 60)
  assert.equal(intervals.minutesInRanges(bookedInsideCapacity), 1.5 * 60)
})

test('effective availability merges adjacent windows before subtracting blocked time', () => {
  const adjacentAvailability = [
    range('08:30', '09:00'),
    range('09:00', '20:00'),
  ]
  const fullDayAvailability = [range('08:00', '20:00')]

  assert.deepEqual(intervals.subtractRanges(adjacentAvailability, []), [range('08:30', '20:00')])
  assert.deepEqual(
    intervals.subtractRanges(fullDayAvailability, [range('10:00', '20:00')]),
    [range('08:00', '10:00')],
  )
})

test('shared physical resource unions aliases and overlapping occupancy; reported month example', () => {
  const start = Date.parse('2026-11-01T00:00:00+02:00')
  const minute = 60000
  const availability = [{ start, end: start + 178.5 * 60 * minute }]
  const bookings = [{ start, end: start + 5.5 * 60 * minute }, { start: start + 5.5 * 60 * minute, end: start + 12.5 * 60 * minute }]
  const stats = intervals.scheduleOccupancy([...availability, ...availability], [], [...bookings, bookings[0]], availability[0])
  assert.deepEqual(stats, { scheduledMinutes: 10710, blockedMinutes: 0, capacityMinutes: 10710, bookedMinutes: 750, freeMinutes: 9960, loadPercent: 7 })
  const redirects = new Map([[91002, 91001], [91003, 91002]])
  assert.equal(intervals.physicalCalendarId(91003, redirects), 91001)
  assert.equal(intervals.physicalCalendarId(91001, redirects), 91001)
  assert.equal(intervals.physicalCalendarId(2, new Map([[2, 3], [3, 2]])), 2)
})

test('monthly calculation clips before-month starts, after-month ends, overlap and blocks', () => {
  const bounds = { start: Date.parse('2026-11-01T00:00:00+02:00'), end: Date.parse('2026-12-01T00:00:00+02:00') }
  const hour = 3600000
  const stats = intervals.scheduleOccupancy(
    [{ start: bounds.start - hour, end: bounds.start + 4 * hour }],
    [{ start: bounds.start + hour, end: bounds.start + 2 * hour }, { start: bounds.start + hour, end: bounds.start + 2 * hour }],
    [{ start: bounds.start - hour, end: bounds.start + 3 * hour }, { start: bounds.start + 2 * hour, end: bounds.start + 3 * hour }], bounds)
  assert.deepEqual(stats, { scheduledMinutes: 240, blockedMinutes: 60, capacityMinutes: 180, bookedMinutes: 120, freeMinutes: 60, loadPercent: 67 })
  assert.equal(intervals.scheduleOccupancy([], [], [], bounds).loadPercent, null)
  assert.equal(intervals.scheduleOccupancy([bounds], [bounds], [], bounds).loadPercent, null)
})

test('cross-midnight multi-day clipping keeps identity and Kyiv DST day lengths', () => {
  for (const [start, end, hours] of [
    ['2026-03-29T00:00:00+02:00', '2026-03-30T00:00:00+03:00', 23],
    ['2026-10-25T00:00:00+03:00', '2026-10-26T00:00:00+02:00', 25],
  ]) {
    const bounds = { start: Date.parse(start), end: Date.parse(end) }
    const item = { id: 91001, start_at: new Date(bounds.start - 3600000).toISOString(), end_at: new Date(bounds.end + 3600000).toISOString() }
    const clipped = intervals.clipScheduleItems([item], bounds)
    assert.equal(clipped[0].id, 91001)
    assert.equal(intervals.minutesInRanges(intervals.rangesFromItems(clipped)), hours * 60)
    assert.equal(item.start_at, new Date(bounds.start - 3600000).toISOString())
    assert.deepEqual(intervals.clipScheduleItems([{ ...item, end_at: new Date(bounds.start).toISOString() }], bounds), [])
  }
})
