import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const mastersSource = await readFile(new URL('../pages/masters/index.vue', import.meta.url), 'utf8')
const reviewsSource = await readFile(new URL('../pages/reviews/index.vue', import.meta.url), 'utf8')

test('master review counters link to the matching filtered review list', () => {
  assert.match(mastersSource, /query: \{ master_id: String\(master\.id\), moderation_status: moderationStatus \}/)
  assert.match(mastersSource, /masterReviewsRoute\(master, 'approved'\)/)
  assert.match(mastersSource, /masterReviewsRoute\(master, 'pending'\)/)
  assert.match(mastersSource, /v-if="ratingsByMaster\.get\(master\.id\)\?\.approved_review_count"/)
  assert.match(mastersSource, /v-if="ratingsByMaster\.get\(master\.id\)\?\.pending_review_count"/)
})

test('reviews page restores and persists a valid master filter from the URL', () => {
  assert.match(reviewsSource, /Number\.parseInt\(String\(route\.query\.master_id \|\| ''\), 10\)/)
  assert.match(reviewsSource, /master_id: routeMasterId/)
  assert.match(reviewsSource, /query\.master_id = String\(filters\.master_id\)/)
  assert.match(reviewsSource, /delete query\.master_id/)
})
