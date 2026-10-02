import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../pages/bookings.vue', import.meta.url), 'utf8')

test('booking notification links focus the requested booking and date', () => {
  assert.match(source, /route\.query\.booking_id/)
  assert.match(source, /route\.query\.date/)
  assert.match(source, /const anchorDate = ref\(routeDate \|\| today\)/)
  assert.match(source, /items\.find\(item => item\.id === routeBookingId\)/)
  assert.match(source, /selected\.value = booking/)
})
