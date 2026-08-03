import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { validateBookingDiscountAmount } from '../utils/bookingDiscount.js'

const modalSource = await readFile(new URL('../components/BookingDetailsModal.vue', import.meta.url), 'utf8')
const bookingsPageSource = await readFile(new URL('../pages/bookings.vue', import.meta.url), 'utf8')
const apiSource = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')

test('booking discount validation accepts zero and the full subtotal', () => {
  assert.equal(validateBookingDiscountAmount(0, 1200), '')
  assert.equal(validateBookingDiscountAmount(1200, 1200), '')
})

test('booking discount validation rejects invalid monetary amounts', () => {
  assert.match(validateBookingDiscountAmount('', 1200), /суму знижки/)
  assert.match(validateBookingDiscountAmount(10.5, 1200), /цілим числом/)
  assert.match(validateBookingDiscountAmount(-1, 1200), /від’ємною/)
  assert.match(validateBookingDiscountAmount(1201, 1200), /перевищувати/)
})

test('booking details expose discount editing only through the Admin access flag', () => {
  assert.match(modalSource, /const canEditBookingDiscount = computed\(\(\) => Boolean\(props\.booking && isAdmin\.value && props\.canEditDiscount === true\)\)/)
  assert.match(modalSource, /v-if="canEditBookingDiscount && !discountEditing"/)
  assert.match(modalSource, /emit\('updateDiscount', Number\(discountForm\.amount\)\)/)
  assert.match(modalSource, /const removeDiscount = \(\) =>/)
  assert.match(modalSource, /v-if="bookingDiscount > 0"/)
  assert.match(modalSource, /emit\('updateDiscount', 0\)/)
  assert.match(modalSource, /Видалити знижку/)
  assert.doesNotMatch(modalSource, /canEditBookingDiscount[^\n]*status !== 'completed'/)
  assert.doesNotMatch(modalSource, /hasPromotion[^\n]*bookingDiscount/)
})

test('bookings page sends the Admin discount update through the backoffice API', () => {
  assert.match(bookingsPageSource, /:can-edit-discount="isAdmin"/)
  assert.match(bookingsPageSource, /@update-discount="updateDiscount"/)
  assert.match(bookingsPageSource, /api\.adminUpdateBookingDiscount\(selected\.value\.id, \{ discount_amount: discountAmount \}\)/)
  assert.match(bookingsPageSource, /discountAmount === 0 \? 'Знижку бронювання видалено\.'/)
  assert.match(apiSource, /interface BookingDiscountPayload/)
  assert.match(apiSource, /adminUpdateBookingDiscount/)
  assert.match(apiSource, /body: payload/)
})
