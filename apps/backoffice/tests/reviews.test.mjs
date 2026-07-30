import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/reviews.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const reviews = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('ratings are clamped before rendering stars', () => {
  assert.equal(reviews.clampRating(4.6), 5)
  assert.equal(reviews.clampRating(-2), 0)
  assert.equal(reviews.formatRating(null), '—')
})

test('conversion preserves backend percentage semantics and rejects impossible values', () => {
  assert.equal(reviews.formatReviewConversionRate(0.25), '0,25%')
  assert.equal(reviews.formatReviewConversionRate(25), '25%')
  assert.equal(reviews.formatReviewConversionRate(250), 'Недоступно')
  assert.equal(reviews.formatReviewConversionRate(null), 'Недоступно')
})

test('review state presentation keeps rejected and failed records visible', () => {
  assert.match(reviews.reviewStatusClass('rejected'), /rose/)
  assert.match(reviews.reviewStatusClass('failed'), /rose/)
  assert.equal(reviews.safeBookingReference(''), 'Підтверджений запис')
})

test('moderation duration is readable and empty-safe', () => {
  assert.equal(reviews.formatModerationDuration(45), '45 хв')
  assert.equal(reviews.formatModerationDuration(125), '2 год 5 хв')
  assert.equal(reviews.formatModerationDuration(null), '—')
})

const metricsFixture = () => ({
  date_from: '2026-07-29',
  date_to: '2026-07-31',
  timezone: 'Europe/Kyiv',
  cohort_definition: 'Completed bookings scheduled in the selected range.',
  eligible_completed_visits: 4,
  requests_scheduled: 4,
  requests_sent: 3,
  requests_delivered: 2,
  review_form_opens: 2,
  review_form_opens_status: 'available',
  review_form_open_tracking_started_at: '2026-07-29T09:00:00Z',
  submitted_reviews: 2,
  approved_reviews: 1,
  review_conversion_rate: 66.67,
  sent_to_open_rate: 66.67,
  opened_to_submitted_rate: 100,
  sent_and_submitted_count: 2,
  sent_and_opened_count: 2,
  opened_and_submitted_count: 2,
  submitted_without_sent_count: 0,
  average_moderation_time_minutes: 90,
  average_rating_by_master: [{
    master_id: 3,
    master: null,
    approved_average_rating: 5,
    approved_review_count: 1,
    pending_review_count: 1,
  }],
})

test('review metrics parser rejects malformed counts, rates and coverage', () => {
  assert.deepEqual(reviews.parseReviewMetricsResponse(metricsFixture()), metricsFixture())

  const impossibleRate = metricsFixture()
  impossibleRate.review_conversion_rate = 120
  assert.throws(() => reviews.parseReviewMetricsResponse(impossibleRate), /percentage/)

  const falseHistoricalZero = metricsFixture()
  falseHistoricalZero.review_form_opens_status = 'unavailable'
  assert.throws(() => reviews.parseReviewMetricsResponse(falseHistoricalZero), /coverage/)

  const missingDenominator = metricsFixture()
  missingDenominator.requests_sent = 0
  assert.throws(() => reviews.parseReviewMetricsResponse(missingDenominator), /Inconsistent/)

  const duplicateRequests = metricsFixture()
  duplicateRequests.requests_scheduled = 5
  assert.throws(() => reviews.parseReviewMetricsResponse(duplicateRequests), /Inconsistent/)

  const duplicateReviews = metricsFixture()
  duplicateReviews.submitted_reviews = 5
  assert.throws(() => reviews.parseReviewMetricsResponse(duplicateReviews), /Inconsistent/)

  const reversedCohort = metricsFixture()
  reversedCohort.date_from = '2026-08-01'
  assert.throws(() => reviews.parseReviewMetricsResponse(reversedCohort), /cohort range/)

  const oversizedCohort = metricsFixture()
  oversizedCohort.date_from = '2025-07-01'
  assert.throws(() => reviews.parseReviewMetricsResponse(oversizedCohort), /cohort range/)

  const unsentSubmission = metricsFixture()
  Object.assign(unsentSubmission, {
    requests_scheduled: 4,
    requests_sent: 2,
    requests_delivered: 2,
    review_form_opens: 3,
    submitted_reviews: 3,
    review_conversion_rate: 100,
    sent_to_open_rate: 100,
    opened_to_submitted_rate: 100,
    sent_and_submitted_count: 2,
    sent_and_opened_count: 2,
    opened_and_submitted_count: 3,
    submitted_without_sent_count: 1,
  })
  assert.deepEqual(reviews.parseReviewMetricsResponse(unsentSubmission), unsentSubmission)
})
