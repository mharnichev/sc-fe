import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { serviceGuide } from '../data/serviceGuides.ts'

const pageSource = await readFile(new URL('../pages/services/[slug].vue', import.meta.url), 'utf8')

test('five verified services have distinct guidance in both languages', () => {
  const services = [
    [7, 'Стрижка'],
    [6, 'Стрижка машинкою'],
    [4, 'Стрижка + борода'],
    [5, 'Стрижка бороди'],
    [1, 'Традиційне гоління'],
  ]

  for (const locale of ['uk', 'en']) {
    const guides = services.map(([id, name]) => serviceGuide(id, name, locale))
    assert.ok(guides.every(Boolean))
    for (const field of ['intro', 'choice', 'preparation', 'result']) {
      assert.equal(new Set(guides.map(guide => guide[field])).size, services.length)
      assert.ok(guides.every(guide => guide[field].length > 20))
    }
    assert.ok(guides.every(guide => guide.faq.length >= 1))
  }
})

test('unknown or renamed catalog services retain the generic detail page', () => {
  assert.equal(serviceGuide(999, 'Інша послуга', 'uk'), null)
  assert.equal(serviceGuide(7, 'Інша послуга', 'en'), null)
  assert.equal(serviceGuide(null, 'Стрижка', 'uk'), null)
  assert.match(pageSource, /v-if="guide"/)
  assert.match(pageSource, /statusCode: 404/)
})

test('service and barber calls to action preserve booking context', () => {
  assert.match(pageSource, /const bookingPath = seoBookingPath\(\{ serviceSlug: serviceSeoSlug\(service\) \}\)/)
  assert.match(pageSource, /:to="bookingPath"/)
  assert.match(pageSource, /seoBookingPath\(\{ serviceSlug: serviceSeoSlug\(service\), masterId: offer\.master\.id \}\)/)
})

