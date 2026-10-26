import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../utils/bookingScheduleTime.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { parseBookingTime, bookingEndTime, bookingTimeDuration } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('24h start and duration calculate exact end with minute carry', () => {
  assert.equal(bookingEndTime('09:45', 90), '11:15')
  assert.equal(bookingEndTime('12:00', 45), '12:45')
  assert.equal(bookingEndTime('00:00', 1), '00:01')
})
test('end time determines duration and rejects equal, reversed and cross-day ranges', () => {
  assert.equal(bookingTimeDuration('09:30', '11:15'), 105)
  for (const end of ['09:30', '09:00', '24:00', '11:60', '11:']) assert.equal(bookingTimeDuration('09:30', end), null)
})
test('invalid duration and overnight end never wrap into a different day', () => {
  for (const duration of [0, -1, 1.5, NaN, Infinity]) assert.equal(bookingEndTime('10:00', duration), '')
  assert.equal(bookingEndTime('23:30', 60), '')
  assert.equal(bookingEndTime('23:30', 30), '')
})
test('time input requires explicit 24-hour HH:mm', () => {
  for (const value of ['', '9:30', '09:3', '10:00 AM', '-1:00', '24:00', '12:60']) assert.equal(parseBookingTime(value), null)
  assert.equal(parseBookingTime('23:59'), 1439)
})
