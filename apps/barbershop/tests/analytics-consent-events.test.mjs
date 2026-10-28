import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = (await readFile(new URL('../composables/useAnalytics.ts', import.meta.url), 'utf8'))
  .replaceAll('import.meta.client', 'true')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function setup() {
  const consent = { value: false }
  const route = { path: '/' }
  const events = []
  const context = {
    exports: {},
    window: { location: { origin: 'https://example.test' }, gtag: (...args) => events.push(args) },
    useCookieConsent: () => ({ canUseAnalytics: consent }),
    useReviewPrivacy: () => ({ isPrivateReviewRoute: { value: false } }),
    useRoute: () => route,
  }
  vm.runInNewContext(code, context)
  return { analytics: context.exports.useAnalytics(), consent, route, events }
}

test('event eligibility follows consent and private customer activity routes', () => {
  const { analytics, consent, route, events } = setup()
  assert.equal(analytics.canTrackEvent(), false)
  assert.equal(analytics.trackEvent('waitlist_submit', { booking_location: 'home_booking' }), false)
  assert.equal(events.length, 0)
  consent.value = true
  assert.equal(analytics.canTrackEvent(), true)
  assert.equal(analytics.trackEvent('waitlist_submit', { booking_location: 'home_booking' }), true)
  assert.equal(events.length, 1)
  assert.equal(events[0][0], 'event')
  assert.equal(events[0][1], 'waitlist_submit')
  assert.equal(events[0][2].booking_location, 'home_booking')
  route.path = '/booking/manage'
  assert.equal(analytics.canTrackEvent(), false)
  assert.equal(analytics.trackEvent('waitlist_submit'), false)
  assert.equal(events.length, 1)
})
