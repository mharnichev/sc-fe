import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const utilitySource = await read('../utils/customerActivity.ts')
const utilityCompiled = ts.transpileModule(utilitySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const activity = await import(`data:text/javascript;base64,${Buffer.from(utilityCompiled).toString('base64')}`)

test('customer activity accepts only opaque fragment tokens', () => {
  const token = 'a'.repeat(40)
  assert.equal(activity.customerActivityTokenFromHash(`#${token}`), token)
  assert.equal(activity.customerActivityTokenFromHash('#short'), '')
  assert.equal(activity.customerActivityTokenFromHash('#token with spaces'), '')
})

test('customer activity routes and API keep the capability private', async () => {
  const [domain, manage, cancel, modal, ga, hotjar, analytics, apiProxy] = await Promise.all([
    read('../domain/barbershop.ts'),
    read('../pages/booking/manage.vue'),
    read('../pages/booking/cancel.vue'),
    read('../components/customer-activity/CustomerActivityModal.vue'),
    read('../plugins/google-analytics.client.ts'),
    read('../plugins/hotjar.client.ts'),
    read('../composables/useAnalytics.ts'),
    read('../server/api/v1/[...path].ts'),
  ])

  assert.match(domain, /api<CustomerActivityResponseDto>\('\/public\/customer-activity'/)
  assert.match(domain, /X-Customer-Activity-Token/)
  assert.match(apiProxy, /isCustomerActivityPath/)
  assert.match(apiProxy, /x-customer-activity-token/)
  assert.match(apiProxy, /'cache-control', 'no-store, private'/)
  assert.match(apiProxy, /'vary', 'X-Customer-Activity-Token'/)
  assert.doesNotMatch(domain.match(/const resolveCustomerActivity[\s\S]*?const recordBookingFunnelEvent/)?.[0] || '', /body: \{ token \}/)
  assert.match(domain, /bookings\/\$\{encodeURIComponent\(publicId\)\}\/cancel/)
  assert.match(domain, /waitlist\/\$\{encodeURIComponent\(publicId\)\}\/cancel/)
  assert.match(domain, /public_id: string/)
  for (const source of [manage, cancel]) {
    assert.match(source, /customerActivityTokenFromHash\(window\.location\.hash\)/)
    assert.match(source, /history\.replaceState/)
    assert.match(source, /noindex, nofollow, noarchive/)
    assert.match(source, /name: 'referrer', content: 'no-referrer'/)
    assert.doesNotMatch(source, /route\.query|localStorage|sessionStorage|console\./)
  }
  assert.match(modal, /await loadActivity\(\)/)
  assert.match(modal, /cancellationTarget/)
  assert.match(cancel, /cancel-mode/)
  assert.match(ga, /hasPrivateCustomerActivityContext/)
  assert.match(ga, /if \(!canUseAnalytics\.value \|\| hasPrivateCustomerActivityContext\(\)\)/)
  assert.match(ga, /router\.beforeEach/)
  assert.match(ga, /window\.location\.assign\(to\.fullPath\)/)
  assert.match(hotjar, /isPrivateCustomerActivityPath/)
  assert.match(analytics, /privateCustomerActivityContext/)
})
