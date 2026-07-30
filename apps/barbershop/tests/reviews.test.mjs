import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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
  assert.equal(isTokenizedReviewLocation('/masters/', tokenHash), true)
  assert.equal(isTokenizedReviewLocation('/review', tokenHash), true)
  assert.equal(isTokenizedReviewLocation('/review/', tokenHash), true)
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
  assert.deepEqual(reviewAnalyticsPayload({ rating: 5, masterId: 7 }), {
    rating: 5,
    master_id: 7,
  })
  assert.deepEqual(reviewAnalyticsPayload({ masterId: -1 }), {})
  assert.deepEqual(reviewAnalyticsPayload({ rating: 10, reason: 'server said secret' }), {})
})

test('records a persisted form-open event independently from browser analytics', async () => {
  const [domainSource, modalSource, analyticsSource, proxySource] = await Promise.all([
    readFile(new URL('../domain/barbershop.ts', import.meta.url), 'utf8'),
    readFile(new URL('../components/reviews/ReviewRequestModal.vue', import.meta.url), 'utf8'),
    readFile(new URL('../plugins/google-analytics.client.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/api/v1/[...path].ts', import.meta.url), 'utf8'),
  ])

  assert.match(domainSource, /api<void>\('\/public\/reviews\/request\/open'/)
  assert.match(domainSource, /keepalive: true/)
  assert.match(domainSource, /retry: 2/)
  assert.match(domainSource, /recordReviewFormOpen/)
  assert.match(modalSource, /domain\.recordReviewFormOpen\(props\.token\)/)
  assert.match(modalSource, /if \(response\.state !== 'submitted'\)/)
  assert.match(modalSource, /if \(!hasTrackedAnalyticsOpen\)/)
  assert.match(modalSource, /Re-attempt this idempotent milestone/)
  assert.match(proxySource, /'public\/reviews\/request'/)
  assert.match(proxySource, /'public\/reviews\/request\/open'/)
  assert.match(proxySource, /reviewTokenHeaderPaths\.has\(apiPath\)/)
  assert.match(modalSource, /data-hj-suppress/)
  assert.match(analyticsSource, /route\.fullPath\.split\('#', 1\)/)
  assert.match(analyticsSource, /const pagePath = privateReviewContext/)
  assert.match(analyticsSource, /const pageTitle = document\.title/)
  assert.doesNotMatch(analyticsSource, /page_location: window\.location\.href/)
})

test('captures private review context before analytics and keeps third-party URLs sanitized', async () => {
  const [
    privacyPluginSource,
    privacyComposableSource,
    mastersPageSource,
    analyticsPluginSource,
    analyticsComposableSource,
    hotjarSource,
  ] = await Promise.all([
    readFile(new URL('../plugins/00-review-privacy.client.ts', import.meta.url), 'utf8'),
    readFile(new URL('../composables/useReviewPrivacy.ts', import.meta.url), 'utf8'),
    readFile(new URL('../pages/masters/index.vue', import.meta.url), 'utf8'),
    readFile(new URL('../plugins/google-analytics.client.ts', import.meta.url), 'utf8'),
    readFile(new URL('../composables/useAnalytics.ts', import.meta.url), 'utf8'),
    readFile(new URL('../plugins/hotjar.client.ts', import.meta.url), 'utf8'),
  ])

  assert.match(privacyPluginSource, /name: 'review-token-privacy'/)
  assert.match(privacyPluginSource, /enforce: 'pre'/)
  assert.match(privacyPluginSource, /reviewTokenFromHash\(hash\)/)
  assert.match(privacyPluginSource, /window\.history\.replaceState\(/)
  assert.match(privacyPluginSource, /router\.beforeEach\(/)
  assert.match(privacyPluginSource, /hash: ''/)

  assert.match(privacyComposableSource, /useState<string>\('private-review-token'/)
  assert.match(privacyComposableSource, /useState<boolean>\('private-review-route'/)
  assert.match(privacyComposableSource, /const clearPrivateReview =/)
  assert.match(mastersPageSource, /useReviewPrivacy\(\)/)
  assert.match(mastersPageSource, /clearPrivateReview\(\)/)

  assert.match(analyticsPluginSource, /const \{ isPrivateReviewRoute \} = useReviewPrivacy\(\)/)
  assert.match(analyticsComposableSource, /const contextualParams = isPrivateReviewRoute\.value/)
  assert.match(analyticsComposableSource, /page_path: '\/masters'/)
  assert.match(
    analyticsComposableSource,
    /page_location: `\$\{window\.location\.origin\}\/masters`/,
  )

  assert.match(hotjarSource, /const \{ isPrivateReviewRoute \} = useReviewPrivacy\(\)/)
  assert.match(hotjarSource, /if \(isPrivateReviewRoute\.value\) return true/)
  assert.match(hotjarSource, /window\.location\.reload\(\)/)

  for (const source of [analyticsPluginSource, hotjarSource]) {
    assert.doesNotMatch(source, /isPrivateReviewSession/)
  }
})
