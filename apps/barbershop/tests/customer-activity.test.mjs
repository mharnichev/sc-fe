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
  const [domain, manage, cancel, modal, ga, hotjar, analytics, apiProxy, apiClient] = await Promise.all([
    read('../domain/barbershop.ts'),
    read('../pages/booking/manage.vue'),
    read('../pages/booking/cancel.vue'),
    read('../components/customer-activity/CustomerActivityModal.vue'),
    read('../plugins/google-analytics.client.ts'),
    read('../plugins/hotjar.client.ts'),
    read('../composables/useAnalytics.ts'),
    read('../server/api/v1/[...path].ts'),
    read('../composables/useApi.ts'),
  ])

  assert.match(domain, /api<CustomerActivityResponseDto>\('\/public\/customer-activity'/)
  assert.match(domain, /X-Customer-Activity-Token/)
  assert.match(apiProxy, /isCustomerActivityPath/)
  assert.match(apiProxy, /x-customer-activity-token/)
  assert.match(apiProxy, /'cache-control', 'no-store, private'/)
  assert.match(apiProxy, /'vary', 'Cookie, X-Customer-Activity-Token'/)
  assert.match(apiClient, /credentials: 'same-origin'/)
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

test('proxy scopes Cookie forwarding and preserves every upstream Set-Cookie header', async () => {
  const proxy = await read('../server/api/v1/[...path].ts')

  assert.match(proxy, /const customerActivityCookie = isCustomerActivityPath\(apiPath\)[\s\S]*?getHeader\(event, 'cookie'\)/)
  assert.match(proxy, /if \(customerActivityCookie\) requestHeaders\.set\('cookie', customerActivityCookie\)/)
  assert.doesNotMatch(proxy, /requestHeaders\.set\('cookie', getHeader/)
  assert.match(proxy, /path === 'public\/bookings' \|\| isCustomerActivityPath\(path\)/)
  assert.match(proxy, /getSetCookie\?\.\(\)/)
  assert.match(proxy, /splitCookiesString\(response\.headers\.get\('set-cookie'\) \|\| ''\)/)
  assert.match(proxy, /for \(const setCookie of setCookieHeaders\)[\s\S]*?appendResponseHeader\(event, 'set-cookie', setCookie\)/)
  assert.match(proxy, /apiPath === 'public\/bookings'[\s\S]*?startsWith\(`\$\{customerActivityCookieName\}=`\)/)
  assert.match(proxy, /if \(browserSessionWasSet\)/)
  assert.match(proxy, /'x-customer-activity-session', 'set'/)
})

test('modal loads and cancels through a cookie when no fragment token is present', async () => {
  const [domain, modal] = await Promise.all([
    read('../domain/barbershop.ts'),
    read('../components/customer-activity/CustomerActivityModal.vue'),
  ])

  assert.match(domain, /const resolveCustomerActivity = \(token\?: string\)/)
  assert.match(domain, /const customerActivityHeaders = \(token\?: string\) => token[\s\S]*?: undefined/)
  assert.match(modal, /domain\.resolveCustomerActivity\(props\.token \|\| undefined\)/)
  assert.doesNotMatch(modal, /if \(!props\.token\).*state\.value = 'expired'/)
  assert.match(modal, /domain\.cancelCustomerActivityBooking\(target\.item\.public_id, props\.token \|\| undefined\)/)
  assert.match(modal, /На цьому пристрої немає збережених записів\. Відкрийте останнє SMS від Soul Cuts, щоб керувати записом\./)
})

test('customer activity keeps empty waitlist hidden and omits the ready-state eye and long title', async () => {
  const modal = await read('../components/customer-activity/CustomerActivityModal.vue')

  assert.match(modal, /<FeedbackFace[^>]+name="joyful-heart-grin"/)
  assert.match(modal, /<template v-else-if="activity">\s*<h1[^>]+>\{\{ labels\.eyebrow \}\}<\/h1>/)
  assert.doesNotMatch(modal, /Ваші записи та лист очікування/)
  assert.doesNotMatch(modal, /labels\.title/)
  assert.doesNotMatch(modal, /my-appointments-calendar\.webp/)
  assert.match(modal, /<section v-if="activity\.waitlist\.length"[^>]+:aria-label="labels\.waitlist"/)
  assert.doesNotMatch(modal, /v-if="!activity\.waitlist\.length"/)
  assert.doesNotMatch(modal, /border-t border-neutral-200/)
})

test('cookie access can be forgotten without exposing a browser credential', async () => {
  const [domain, modal] = await Promise.all([
    read('../domain/barbershop.ts'),
    read('../components/customer-activity/CustomerActivityModal.vue'),
  ])

  assert.match(domain, /'\/public\/customer-activity\/browser-session\/forget'/)
  assert.match(modal, /Це не мій пристрій/)
  assert.match(modal, /await domain\.forgetCustomerActivityDevice\(\)/)
  assert.match(modal, /v-if="usesBrowserSession"/)
  assert.match(modal, /emit\('closed'\)/)
})

test('customer activity never persists or logs its credential', async () => {
  const sources = await Promise.all([
    '../domain/barbershop.ts',
    '../pages/booking/manage.vue',
    '../pages/booking/cancel.vue',
    '../components/customer-activity/CustomerActivityModal.vue',
    '../server/api/v1/[...path].ts',
  ].map(read))

  for (const source of sources) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|useState\(|console\./)
  }
})

test('floating actions include an accessible calendar shortcut and move together', async () => {
  const floating = await read('../components/FloatingBookingDrawer.vue')

  assert.match(floating, /my-appointments-calendar\.webp/)
  assert.match(floating, /<img[\s\S]*?:src="myAppointmentsCalendarImage"[\s\S]*?aria-hidden="true"/)
  assert.doesNotMatch(floating, /CalendarDaysIcon/)
  assert.doesNotMatch(floating, /to="\/booking\/manage"/)
  assert.match(floating, /<button[\s\S]*?type="button"[\s\S]*?@click="openCustomerActivity"/)
  assert.match(floating, /<CustomerActivityModal[\s\S]*?v-if="isCustomerActivityOpen"[\s\S]*?@closed="closeCustomerActivity"/)
  assert.match(floating, /aria-label="Мої записи"/)
  const actionClasses = floating.match(/class="my-appointments-button ([^"]+)"/)?.[1] ?? ''
  const imageClasses = floating.match(/:src="myAppointmentsCalendarImage"[\s\S]*?class="([^"]+)"/)?.[1] ?? ''
  assert.match(actionClasses, /(?:^|\s)h-14(?:\s|$)/)
  assert.match(actionClasses, /(?:^|\s)w-14(?:\s|$)/)
  assert.doesNotMatch(actionClasses, /(?:^|\s)rounded-/)
  assert.doesNotMatch(actionClasses, /(?:^|\s)border(?:-|\s|$)/)
  assert.doesNotMatch(actionClasses, /(?:^|\s)bg-/)
  assert.doesNotMatch(actionClasses, /(?:^|\s)shadow-/)
  assert.doesNotMatch(imageClasses, /(?:^|\s)[hw]-/)
  assert.doesNotMatch(imageClasses, /(?:^|\s)rounded-/)
  assert.match(imageClasses, /(?:^|\s)drop-shadow-/)
  assert.match(floating, /v-show="!isOpen && !isCustomerActivityOpen"/)
  assert.match(floating, /floating-booking-actions/)
  assert.match(floating, /isTriggerOverBooking \? \{ right: '-48px' \}/)
  assert.match(floating, /group-hover:opacity-100/)
  assert.match(floating, /prefers-reduced-motion: reduce/)
})

test('customer activity modal keeps backdrop blur independent from overlay hover', async () => {
  const baseModal = await read('../components/ui/BaseModal.vue')

  assert.match(baseModal, /class="base-modal__backdrop[^\"]*pointer-events-none[^\"]*backdrop-blur-sm"/)
  assert.match(baseModal, /class="base-modal__overlay[^\"]*bg-transparent"/)
  assert.doesNotMatch(baseModal, /class="base-modal__overlay[^\"]*backdrop-blur/)
  assert.match(baseModal, /base-modal-enter-active \.base-modal__backdrop/)
})

test('booking success hints are shown only when the proxy confirms a session cookie', async () => {
  const [domain, section, contacts] = await Promise.all([
    read('../domain/barbershop.ts'),
    read('../components/sections/BookingSection.vue'),
    read('../pages/contacts.vue'),
  ])

  assert.match(domain, /browserSessionCreated: response\.headers\.get\('x-customer-activity-session'\) === 'set'/)
  for (const source of [section, contacts]) {
    assert.match(source, /bookingResult\.browserSessionCreated/)
    assert.match(source, /v-if="(?:state\.success && )?state\.browserSessionCreated"/)
    assert.match(source, /Ми зберегли ваш запис на цьому пристрої на 30 днів\. Він доступний у «Мої записи»\./)
    assert.doesNotMatch(source, /browserSessionToken|customerActivityToken/)
  }
})
