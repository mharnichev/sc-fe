import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [homeReviewsSource, masterRatingSource, masterPageSource] = await Promise.all([
  readFile(new URL('../components/sections/ReviewsSection.vue', import.meta.url), 'utf8'),
  readFile(new URL('../components/ui/MasterRatingBlock.vue', import.meta.url), 'utf8'),
  readFile(new URL('../pages/masters/[slug].vue', import.meta.url), 'utf8'),
])

test('public barbershop review lists render only reviews with non-empty text', () => {
  assert.match(homeReviewsSource, /\.filter\(review => Boolean\(reviewText\(review\)\.trim\(\)\)\)/)
  assert.match(masterRatingSource, /\.filter\(review => Boolean\(review\.comment\?\.trim\(\)\)\)/)
  assert.match(masterPageSource, /const comment = review\.comment\?\.trim\(\) \|\| ''/)
  assert.match(masterPageSource, /if \(!comment \|\|/)
})
