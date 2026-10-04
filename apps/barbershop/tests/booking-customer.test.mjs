import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

test('booking master cards use regular photos in a transparent two-column mobile layout', async () => {
  const source = await readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /const masterPassportPhoto/)
  assert.match(source, /key="booking-master"[\s\S]*?class="grid grid-cols-2 gap-1"/)
  assert.match(source, /grid-cols-\[4rem_minmax\(0,1fr\)\][^"\n]*px-2 py-1[^"\n]*sm:p-3/)
  assert.match(source, /class="booking-step-panel scroll-mt-28 px-2 pb-2 sm:px-3 sm:pb-3"/)
  assert.match(source, /@media \(max-width: 639\.98px\) \{[\s\S]*?\.booking-form \.booking-step-content \{[\s\S]*?gap: 0\.5rem;/)
  assert.match(source, /:src="masterPhoto\(master\)"/)
  assert.match(source, /masterPhoto\(master\)[^>]*class="h-16 w-16 object-cover object-top sm:h-20 sm:w-20"/)
  assert.match(source, /class="block text-\[0\.6875rem\] font-semibold leading-4">\{\{ masterName\(master\) \}\}/)
  assert.match(source, /class="mt-0\.5 block text-\[0\.625rem\] leading-4 opacity-70">\{\{ masterPosition\(master\) \}\}/)
  assert.match(source, /booking-step-panel--master :deep\(\.booking-master-rating \[role='img'\]\)[\s\S]*?font-size: 0\.6875rem/)
  assert.match(source, /selectedMasterId === master\.id \? 'bg-white text-neutral-950' : 'text-white\/75 hover:text-white'/)
  assert.match(source, /:tone="selectedMasterId === master\.id \? 'light' : 'dark'"/)
  assert.match(source, /class="booking-master-rating col-span-2 mt-1"/)
  assert.match(source, /:show-summary-details="false"[\s\S]*?:review-limit="2"[\s\S]*?show-review-count[\s\S]*?show-reviews[\s\S]*?hide-empty/)
  assert.doesNotMatch(source, /show-reviews[\s\S]*?hide-empty[\s\S]*?compact/)

  const ratingSource = await readFile(new URL('../components/ui/MasterRatingBlock.vue', import.meta.url), 'utf8')
  assert.match(ratingSource, /hideEmpty\?: boolean/)
  assert.match(ratingSource, /!hasRating && !hideEmpty/)
  assert.match(ratingSource, /v-else-if="hasRating"/)

})

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
