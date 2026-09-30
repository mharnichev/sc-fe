import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [accordionSource, servicesSource, bookingSource] = await Promise.all([
  readFile(new URL('../components/ui/ServiceDescriptionAccordion.vue', import.meta.url), 'utf8'),
  readFile(new URL('../components/sections/ServicesGrid.vue', import.meta.url), 'utf8'),
  readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8'),
])

test('service descriptions use the base accordion and a two-line mobile preview', () => {
  assert.match(accordionSource, /<BaseAccordion/)
  assert.match(accordionSource, /-webkit-line-clamp: 2/)
  assert.match(accordionSource, /line-clamp: 2/)
  assert.match(accordionSource, /@media \(max-width: 639px\)/)
  assert.match(accordionSource, /Читати повністю/)
  assert.doesNotMatch(accordionSource, /Згорнути опис/)
  assert.equal((accordionSource.match(/pt-2 text-xs leading-5/g) || []).length, 2)
  assert.doesNotMatch(accordionSource, /pt-2 text-sm leading-6/)
})

test('catalogue and booking cards both expose expandable descriptions outside selection buttons', () => {
  assert.match(servicesSource, /<ServiceDescriptionAccordion[\s\S]*?:description="localizedService\.serviceDescription\(service\) \|\| terms\.home\.services\.noDescription"/)
  assert.match(bookingSource, /<article[\s\S]*?v-for="service in filteredActiveServices"[\s\S]*?<button[\s\S]*?<\/button>[\s\S]*?<ServiceDescriptionAccordion/)
  assert.match(bookingSource, /<article[\s\S]*?booking-service__selected-scribble[\s\S]*?<button/)
  assert.match(bookingSource, /:description="serviceDescription\(service\)"/)
  assert.match(bookingSource, /theme="dark"/)
})
