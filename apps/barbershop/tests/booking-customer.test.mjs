import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const utilitySource = await readFile(new URL('../utils/bookingCustomer.ts', import.meta.url), 'utf8')
const utilityCompiled = ts.transpileModule(utilitySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const bookingCustomer = await import(`data:text/javascript;base64,${Buffer.from(utilityCompiled).toString('base64')}`)

const memoryStorage = (initial = new Map()) => ({
  getItem: key => initial.get(key) ?? null,
  setItem: (key, value) => initial.set(key, value),
})

test('successful booking customer details round-trip through browser storage', () => {
  const storage = memoryStorage()
  const customer = { name: "О'Брайен", phone: '+380671234567' }

  bookingCustomer.saveBookingCustomer(storage, customer)

  assert.deepEqual(bookingCustomer.readSavedBookingCustomer(storage), customer)
})

test('invalid or unavailable browser storage does not break booking customer restore', () => {
  const invalidStorage = memoryStorage(new Map([
    [bookingCustomer.BOOKING_CUSTOMER_STORAGE_KEY, JSON.stringify({ name: 'І', phone: '0671234567' })],
  ]))
  const unavailableStorage = {
    getItem: () => { throw new Error('Storage unavailable') },
    setItem: () => { throw new Error('Storage unavailable') },
  }

  assert.equal(bookingCustomer.readSavedBookingCustomer(invalidStorage), null)
  assert.equal(bookingCustomer.readSavedBookingCustomer(unavailableStorage), null)
  assert.equal(bookingCustomer.saveBookingCustomer(unavailableStorage, {
    name: 'Іван Петренко',
    phone: '+380671234567',
  }), false)
})

test('booking form restores details on mount and stores them only after createBooking succeeds', async () => {
  const source = await readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8')
  const createBookingIndex = source.indexOf('await domain.createBooking')
  const saveCustomerIndex = source.indexOf('persistBookingCustomer(bookedCustomer)')

  assert.match(source, /onMounted\(\(\) => \{[\s\S]*?restoreSavedBookingCustomer\(\)/)
  assert.match(source, /const restoreSavedBookingCustomer = \([\s\S]*?readSavedBookingCustomer\(window\.localStorage\)[\s\S]*?catch/)
  assert.ok(createBookingIndex >= 0)
  assert.ok(saveCustomerIndex > createBookingIndex)
  assert.match(source, /await resetBookingFlow\(bookedCustomer\)/)
  assert.match(source, /if \(saveBookingCustomer\(window\.localStorage, customer\)\) \{[\s\S]*?dispatchEvent/)
  assert.match(source, /restoreSavedBookingCustomer\(\{ onlyEmpty: true \}\)/)
  assert.match(source, /options\.onlyEmpty && \(form\.customer_name\.trim\(\) \|\| form\.customer_phone\.trim\(\)\)/)
  assert.match(source, /window\.addEventListener\(BOOKING_CUSTOMER_UPDATED_EVENT, syncSavedBookingCustomer\)/)
  assert.match(source, /event\.key === BOOKING_CUSTOMER_STORAGE_KEY\) syncSavedBookingCustomer\(\)/)
})
