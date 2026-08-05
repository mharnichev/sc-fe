import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const autocompleteSource = await readFile(new URL('../components/BaseCustomerPhoneInput.vue', import.meta.url), 'utf8')
const phoneInputSource = await readFile(new URL('../components/BasePhoneInput.vue', import.meta.url), 'utf8')
const bookingModalSource = await readFile(new URL('../components/BookingCalendarActionModal.vue', import.meta.url), 'utf8')

test('customer phone autocomplete keeps the Ukrainian mask and debounces database search', () => {
  assert.match(autocompleteSource, /<BasePhoneInput/)
  assert.match(autocompleteSource, /debounceMs: 300/)
  assert.match(autocompleteSource, /setTimeout\(\(\) => \{/)
  assert.match(autocompleteSource, /api\.getCustomers\(1, props\.maxResults/)
  assert.match(autocompleteSource, /search: query/)
  assert.match(autocompleteSource, /sequence !== requestSequence/)
  assert.match(phoneInputSource, /emit\('keydown', event\)/)
})

test('customer phone autocomplete exposes an accessible selectable result list', () => {
  assert.match(autocompleteSource, /role="combobox"/)
  assert.match(autocompleteSource, /role="listbox"/)
  assert.match(autocompleteSource, /role="option"/)
  assert.match(autocompleteSource, /aria-activedescendant/)
  assert.match(autocompleteSource, /emit\('select', customer\)/)
})

test('manual booking fills the selected customer phone and name', () => {
  assert.match(bookingModalSource, /<BaseCustomerPhoneInput/)
  assert.match(bookingModalSource, /@select="selectCustomer"/)
  assert.match(bookingModalSource, /grid-cols-1 gap-2 min-\[676px\]:grid-cols-2/)
  assert.match(bookingModalSource, /form\.customer_phone = customer\.phone/)
  assert.match(bookingModalSource, /form\.customer_name = \[customer\.name, customer\.surname\]/)
  assert.match(bookingModalSource, /`Клієнт #\$\{customer\.id\}`/)
})
