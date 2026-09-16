import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/bookingQuote.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { createBookingQuoteReview, isBookingQuote, isPromotionConflict } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const payload = { master_id: 1, service_ids: [10], start_at: '2026-10-06T12:00:00+03:00', customer_phone: '+380501234567', promotion_code: null }
const quote = (percent = 20) => ({ subtotal_amount: 1000, discount_amount: percent * 10, total_amount: 1000 - percent * 10, applied_promotion: { id: 1, code: null, name_uk: 'Перший візит', name_en: 'First visit', discount_percent: percent, application_mode: 'automatic', eligibility_type: 'first_visit' }, eligibility: { status: 'applied', explanation: 'Checked again when booking.' } })
const regular = () => ({ subtotal_amount: 1000, discount_amount: 0, total_amount: 1000, applied_promotion: null, eligibility: { status: 'not_available', explanation: 'Unavailable.' } })

test('booking action approves the displayed price without a checkbox and still revalidates it', async () => {
  const component = await readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8')
  const submission = component.slice(component.indexOf('const submit = async () => {'))
  assert.doesNotMatch(component, /priceApproved|quoteCopy\.approve|Я погоджуюся з показаною підсумковою вартістю/)
  assert.match(submission, /const reviewedInput = quoteInputKey\.value\s+quoteController\.accept\(true\)\s+if \(!await verifyPrice\(\) \|\| reviewedInput !== quoteInputKey\.value\)/)
  assert.match(submission, /const expectedTotalAmount = quoteController\.approvedTotal\(\)/)
  assert.match(submission, /domain\.createBooking\(\{\s+expected_total_amount: expectedTotalAmount,/)

  let result = quote()
  let state
  const controller = createBookingQuoteReview(async () => result, next => { state = next })
  await controller.verify(payload)
  controller.accept(true) // The booking button approves the price currently visible to the guest.
  assert.equal(await controller.verify(payload), true)
  assert.equal(controller.approvedTotal(), 800)

  result = quote(25)
  controller.accept(true)
  assert.equal(await controller.verify(payload), false, 'A new amount stops this submission')
  assert.equal(state.quote.total_amount, 750)
  assert.equal(controller.approvedTotal(), null)
  controller.accept(true) // The next click acts on the updated displayed quote.
  assert.equal(await controller.verify(payload), true)
  assert.equal(controller.approvedTotal(), 750)
})

test('eligible customer reviews backend amounts; unchanged revalidation preserves approval', async () => {
  let state
  const review = createBookingQuoteReview(async () => quote(), next => { state = next })
  assert.equal(await review.verify(payload), false)
  assert.equal(state.quote.total_amount, 800)
  review.accept(true)
  assert.equal(await review.verify(payload), true)
  assert.equal(review.approvedTotal(), 800)
})

test('price_changed clears the submitted approval; even an identical requote needs consent', async () => {
  const review = createBookingQuoteReview(async () => quote(), () => {})
  assert.equal(review.approvedTotal(), null)
  await review.verify(payload)
  review.accept(true)
  assert.equal(await review.verify(payload), true)
  const submitted = review.approvedTotal()
  assert.equal(submitted, 800)
  assert.equal(isPromotionConflict({ data: { detail: { code: 'price_changed', total_amount: 1000 } } }), true)
  review.invalidate()
  assert.equal(review.approvedTotal(), null)
  assert.equal(await review.verify(payload), false)
  assert.equal(review.approvedTotal(), null)
  review.accept(true)
  assert.equal(review.approvedTotal(), 800)
})

test('zero is an approved total; in-flight revalidation cannot supply a submission price', async () => {
  const review = createBookingQuoteReview(async () => quote(100), () => {})
  await review.verify(payload)
  review.accept(true)
  assert.equal(review.approvedTotal(), 0)
  const pending = review.verify(payload)
  assert.equal(review.approvedTotal(), null)
  assert.equal(await pending, true)
  assert.equal(review.approvedTotal(), 0)
})

test('submission sends the captured approved total after exact-input revalidation', async () => {
  const component = await readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8')
  const submission = component.slice(component.indexOf('const submit = async () => {'))
  assert.match(submission, /reviewedInput !== quoteInputKey\.value/)
  assert.match(submission, /const expectedTotalAmount = quoteController\.approvedTotal\(\)/)
  assert.match(submission, /if \(expectedTotalAmount === null\) return/)
  assert.match(submission, /domain\.createBooking\(\{\s+expected_total_amount: expectedTotalAmount,/)
})

test('percentage changes and disabled/expired/returning responses require another review', async () => {
  for (const changed of [quote(25), regular()]) {
    let state
    let result = quote()
    const review = createBookingQuoteReview(async () => result, next => { state = next })
    await review.verify(payload)
    review.accept(true)
    result = changed
    assert.equal(await review.verify(payload), false)
    assert.equal(state.changed, true)
    assert.equal(state.accepted, false)
    assert.deepEqual(state.quote, changed)
    review.accept(true)
    assert.equal(await review.verify(payload), true)
  }
})

test('late responses for a previous master/service/customer cannot confirm a new price', async () => {
  let resolve
  let state
  const review = createBookingQuoteReview(() => new Promise(done => { resolve = done }), next => { state = next })
  const pending = review.verify(payload)
  review.invalidate()
  resolve(quote())
  assert.equal(await pending, false)
  assert.equal(state.quote, null)
  assert.equal(state.accepted, false)
})

test('verification failure clears an approved total and retry requires approval again', async () => {
  let fail = false
  let state
  const review = createBookingQuoteReview(async () => { if (fail) throw new Error('offline'); return quote() }, next => { state = next })
  await review.verify(payload)
  review.accept(true)
  fail = true
  assert.equal(await review.verify(payload), false)
  assert.equal(state.failed, true)
  assert.equal(state.quote, null)
  assert.equal(state.accepted, false)
  fail = false
  assert.equal(await review.verify(payload), false)
})

test('explicit promo code is forwarded; backend precedence and scoped amounts are retained', async () => {
  let received
  let state
  const codeQuote = { ...quote(10), discount_amount: 30, total_amount: 970, applied_promotion: { ...quote(10).applied_promotion, code: 'SAVE10', application_mode: 'code', eligibility_type: 'all_customers' } }
  const review = createBookingQuoteReview(async input => { received = input; return codeQuote }, next => { state = next })
  await review.verify({ ...payload, promotion_code: 'SAVE10', service_ids: [10, 11] })
  assert.equal(received.promotion_code, 'SAVE10')
  assert.deepEqual(received.service_ids, [10, 11])
  assert.equal(state.quote.discount_amount, 30)
  assert.equal(state.quote.total_amount, 970)
})

test('unverified customer or malformed quote cannot be approved', async () => {
  let state
  const missingCustomer = { ...regular(), eligibility: { status: 'customer_required', explanation: '' } }
  const review = createBookingQuoteReview(async () => missingCustomer, next => { state = next })
  await review.verify(payload)
  review.accept(true)
  assert.equal(state.accepted, false)
  assert.equal(isBookingQuote({ ...quote(), total_amount: 1 }), false)
  assert.equal(isBookingQuote({ ...quote(), discount_amount: -1 }), false)
  assert.equal(isBookingQuote({ ...regular(), discount_amount: 100, total_amount: 900 }), false)
})


test('promotion conflicts are distinct from ordinary slot conflicts', () => {
  for (const code of ['entitlement_reserved', 'not_eligible', 'promotion_no_longer_applicable', 'promotion_unavailable', 'customer_required', 'price_changed']) {
    assert.equal(isPromotionConflict({ data: { detail: { code } } }), true)
  }
  assert.equal(isPromotionConflict({ status: 409, data: { detail: 'Slot taken' } }), false)
  assert.equal(isPromotionConflict(null), false)
})

test('booking promotion conflict revokes approval and requotes without changing the time selection', async () => {
  const source = await readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8')
  const conflictBranch = source.slice(source.indexOf('if (status === 409 && isPromotionConflict(error)) {'))
  const promotionBranch = conflictBranch.slice(0, conflictBranch.indexOf('else if'))
  assert.match(promotionBranch, /quoteController\.invalidate\(\)/)
  assert.match(promotionBranch, /await verifyPrice\(\)/)
  assert.match(promotionBranch, /goToStep\(lastStepIndex\.value\)/)
  assert.doesNotMatch(promotionBranch, /refreshSlots/)
  assert.match(conflictBranch, /else if \(status === 409\) \{\s+await refreshSlots\(\)/)
})
