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
