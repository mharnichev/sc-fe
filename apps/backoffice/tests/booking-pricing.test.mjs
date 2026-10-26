import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const modalSource = await readFile(new URL('../components/BookingDetailsModal.vue', import.meta.url), 'utf8')
const bookingsPageSource = await readFile(new URL('../pages/bookings.vue', import.meta.url), 'utf8')
const apiSource = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')

test('booking details permit owned active prices and keep promotions admin-only', () => {
  assert.match(modalSource, /canManageCurrentBooking\.value && \(isAdmin\.value \|\| props\.booking\.status !== 'completed'\)/)
  assert.match(modalSource, /<label v-if="isAdmin"/)
  assert.match(modalSource, /v-if="canEditBookingPricing && !pricingEditing"/)
  assert.match(modalSource, /v-for="item in pricingForm\.service_prices"/)
  assert.match(modalSource, /\.\.\.\(props\.promotions \|\| \[\]\)\.map\(promotion =>/)
  assert.match(modalSource, /label: 'Без акції'/)
  assert.match(modalSource, /promotion\.discount_percent}%/)
  assert.match(modalSource, /\.\.\.\(isAdmin\.value \? \{ promotion_code:/)
})

test('booking details submit per-booking prices and the selected promotion code', () => {
  assert.match(modalSource, /emit\('updatePricing', \{/)
  assert.match(modalSource, /service_id: item\.service_id/)
  assert.match(modalSource, /price_amount: Number\(item\.price_amount\)/)
  assert.match(modalSource, /promotion_code: pricingForm\.promotion_code \|\| null/)
  assert.match(modalSource, /Щоб прибрати застосовану знижку, виберіть «Без акції»/)
  assert.doesNotMatch(modalSource, /Знижка, грн/)
})

test('bookings page loads active promotions and saves pricing through the backoffice API', () => {
  assert.match(bookingsPageSource, /:promotions="activePromotions"/)
  assert.match(bookingsPageSource, /:can-edit-pricing="Boolean\(selected && canManageCalendarBooking\(selected\)\)"/)
  assert.match(bookingsPageSource, /@update-pricing="updatePricing"/)
  assert.match(bookingsPageSource, /api\.adminUpdateBookingPricing\(booking\.id, payload\)/)
  assert.match(apiSource, /interface BookingPricingPayload/)
  assert.match(apiSource, /service_prices: BookingServicePricePayload\[\]/)
  assert.match(apiSource, /promotion_code\?: string \| null/)
  assert.match(apiSource, /adminUpdateBookingPricing/)
})
