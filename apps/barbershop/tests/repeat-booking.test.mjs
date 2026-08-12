import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('repeat booking accepts only opaque fragment tokens', async () => {
  const source = await read('../utils/repeatBooking.ts')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const utility = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

  assert.equal(utility.repeatBookingTokenFromHash(`#${'aB_9-'.repeat(7)}`), 'aB_9-'.repeat(7))
  assert.equal(utility.repeatBookingTokenFromHash('a'.repeat(43)), '')
  assert.equal(utility.repeatBookingTokenFromHash('#short'), '')
  assert.equal(utility.repeatBookingTokenFromHash(`#${'a'.repeat(32)}?phone=1`), '')
})

test('repeat booking keeps its capability private and completes through the normal booking flow', async () => {
  const [page, section, domain, proxy, analytics, hotjar, routerOptions] = await Promise.all([
    read('../pages/booking/repeat.vue'),
    read('../components/sections/BookingSection.vue'),
    read('../domain/barbershop.ts'),
    read('../server/api/v1/[...path].ts'),
    read('../plugins/google-analytics.client.ts'),
    read('../plugins/hotjar.client.ts'),
    read('../app/router.options.ts'),
  ])

  assert.match(page, /window\.location\.hash/)
  assert.match(page, /history\.replaceState/)
  assert.match(page, /resolveRepeatBooking/)
  assert.match(page, /startRepeatBooking/)
  assert.match(page, /noindex, nofollow, noarchive/)
  assert.match(page, /name: 'referrer', content: 'no-referrer'/)
  assert.doesNotMatch(page, /localStorage|sessionStorage|console\./)

  assert.match(section, /repeatBookingContext/)
  assert.match(section, /repeatBookingToken \|\| undefined/)
  assert.match(domain, /'X-Repeat-Booking-Token'/)
  assert.match(domain, /'\/public\/repeat-booking\/context'/)
  assert.match(domain, /'\/public\/repeat-booking\/start'/)
  assert.match(proxy, /repeatBookingTokenHeaderPaths/)
  assert.match(proxy, /requestHeaders\.set\('x-repeat-booking-token'/)
  assert.match(proxy, /setHeader\(event, 'cache-control', 'no-store, private'\)/)
  assert.match(analytics, /\/booking\/repeat/)
  assert.match(hotjar, /\/booking\/repeat/)
  assert.match(routerOptions, /opaqueCapabilityHash\(to\.hash\)/)
  assert.match(routerOptions, /return \{ left: 0, top: 0 \}/)
})
