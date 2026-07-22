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

test('conversion accepts backend ratio or percentage semantics', () => {
  assert.equal(reviews.formatReviewConversionRate(0.25), '25%')
  assert.equal(reviews.formatReviewConversionRate(25), '25%')
  assert.equal(reviews.formatReviewConversionRate(250), '100%')
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
