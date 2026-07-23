import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isValidReviewRating,
  isTokenizedReviewLocation,
  reviewAnalyticsPayload,
  reviewRequestStateFromStatus,
  reviewTokenFromHash,
} from '../utils/reviews.js'

test('accepts only opaque base64url-style review tokens from the fragment', () => {
  const token = 'a'.repeat(32)

  assert.equal(reviewTokenFromHash(`#${token}`), token)
  assert.equal(reviewTokenFromHash(`#${encodeURIComponent(token)}`), token)
  assert.equal(reviewTokenFromHash('#short'), '')
  assert.equal(reviewTokenFromHash('#token with spaces'), '')
  assert.equal(reviewTokenFromHash('#%E0%A4%A'), '')
})

test('recognizes tokenized review entry only on masters and legacy review routes', () => {
  const tokenHash = `#${'a'.repeat(32)}`

  assert.equal(isTokenizedReviewLocation('/masters', tokenHash), true)
  assert.equal(isTokenizedReviewLocation('/review', tokenHash), true)
  assert.equal(isTokenizedReviewLocation('/', tokenHash), false)
  assert.equal(isTokenizedReviewLocation('/masters', '#team'), false)
})

test('accepts integer ratings from one through five only', () => {
  assert.equal(isValidReviewRating(1), true)
  assert.equal(isValidReviewRating(5), true)
  assert.equal(isValidReviewRating(0), false)
  assert.equal(isValidReviewRating(6), false)
  assert.equal(isValidReviewRating(4.5), false)
})

test('maps API statuses to non-sensitive review form states', () => {
  assert.equal(reviewRequestStateFromStatus(404), 'invalid')
  assert.equal(reviewRequestStateFromStatus(409), 'submitted')
  assert.equal(reviewRequestStateFromStatus(410), 'expired')
  assert.equal(reviewRequestStateFromStatus(422), 'validation')
  assert.equal(reviewRequestStateFromStatus(500), 'network')
})

test('analytics payloads allow only non-sensitive review metadata', () => {
  assert.deepEqual(
    reviewAnalyticsPayload({
      rating: 4,
      hasText: true,
      reason: 'network',
      token: 'must-not-leak',
      reviewText: 'must-not-leak',
      bookingId: 123,
      email: 'must-not-leak@example.com',
    }),
    { rating: 4, has_text: true, reason: 'network' },
  )
  assert.deepEqual(reviewAnalyticsPayload({ rating: 10, reason: 'server said secret' }), {})
})
