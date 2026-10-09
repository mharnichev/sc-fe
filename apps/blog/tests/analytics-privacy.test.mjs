import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const privacySource = read('../utils/blogAnalyticsPrivacy.ts')
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const privacy = await import(`data:text/javascript;base64,${Buffer.from(compile(privacySource)).toString('base64')}`)

function loadAnalytics(path = '/', referrer = '') {
  const app = {}
  const route = { path: path.split('?')[0], fullPath: path }
  const calls = []
  const timers = []
  const frames = []
  const scripts = []
  const hooks = {}
  const window = {
    location: { href: `https://blog.example${path}`, origin: 'https://blog.example' },
    gtag: (...args) => calls.push(args),
    setTimeout: callback => timers.push(callback),
    requestAnimationFrame: callback => frames.push(callback),
    addEventListener: () => {},
  }
  const context = vm.createContext({
    URL, URLSearchParams,
    window,
    document: { referrer, readyState: 'complete', title: 'Journal', getElementById: () => null, createElement: () => ({}), head: { appendChild: script => scripts.push(script) } },
    useRoute: () => route,
    useNuxtApp: () => app,
    useRouter: () => ({ beforeEach: callback => { hooks.before = callback }, afterEach: callback => { hooks.after = callback } }),
    defineNuxtPlugin: callback => callback,
  })
  const analyticsSource = read('../composables/useBlogAnalytics.ts')
    .replace(/^import .*\n/gm, '').replace('import.meta.client', 'true')
  const pluginSource = read('../plugins/google-analytics.client.ts').replace(/^import .*\n/gm, '')
  vm.runInContext(compile(privacySource).replaceAll('export ', '')
    + compile(analyticsSource).replaceAll('export ', '')
    + '\nglobalThis.useBlogAnalytics = useBlogAnalytics;\n'
    + compile(pluginSource).replace('export default', 'globalThis.plugin ='), context)
  return { route, window, calls, timers, frames, scripts, hooks, track: context.useBlogAnalytics().trackBlogEvent, plugin: context.plugin }
}

test('capability detection covers personal tokens, encoded keys, aliases, fragments and newsletter pages', () => {
  for (const url of ['/?token=SECRET', '/?confirmation_token=SECRET', '/?%74oken=SECRET', '/?accessToken=SECRET', '/?unsubscribe_token=SECRET', '/?session_id=SECRET', '/#token=SECRET', '/newsletter/unsubscribe']) {
    assert.equal(privacy.hasPersonalCapability(url), true, url)
  }
  assert.equal(privacy.hasPersonalCapability('/posts?utm_source=journal#section'), false)
})

test('all URL attribution strips query and fragment; invalid schemes fail closed', () => {
  assert.equal(privacy.sanitizeAnalyticsUrl('https://blog.example/post?token=SECRET#SECRET'), 'https://blog.example/post')
  assert.equal(privacy.sanitizeAnalyticsUrl('/post?confirmation_token=SECRET'), '/post')
  assert.equal(privacy.sanitizeAnalyticsUrl('javascript:SECRET'), '')
  const params = privacy.sanitizeAnalyticsParams({ document_referer: 'https://email.example/?token=SECRET', referrer: '/?confirmation_token=SECRET', token: 'SECRET', source: 'footer', link_url: '/?token=SECRET' })
  assert.equal(JSON.stringify(params).includes('SECRET'), false)
  assert.equal(params.source, 'footer')
})

for (const path of ['/?token=SECRET', '/?confirmation_token=SECRET', '/newsletter/unsubscribe?token=SECRET']) {
  test(`GA never initializes on ${path}, including after URL cleanup`, () => {
    const analytics = loadAnalytics(path)
    analytics.plugin()
    analytics.window.location.href = 'https://blog.example/'
    analytics.route.path = '/'
    analytics.route.fullPath = '/'
    analytics.hooks.after?.()
    analytics.frames.forEach(callback => callback())
    analytics.timers.forEach(callback => callback())
    analytics.track('subscribe_submit', { source: 'modal' })
    assert.equal(analytics.window['ga-disable-G-YYYXH2R239'], true)
    assert.deepEqual(analytics.calls, [])
    assert.deepEqual(analytics.scripts, [])
  })
}

test('personal document referrer suppresses GA initialization and every event', () => {
  const analytics = loadAnalytics('/', 'https://blog.example/newsletter/unsubscribe?token=SECRET')
  analytics.plugin()
  analytics.track('navigation_click')
  assert.deepEqual(analytics.calls, [])
  assert.deepEqual(analytics.scripts, [])
})

test('ordinary GA config disables automatic page view and supplies safe dl/dr equivalents', () => {
  const analytics = loadAnalytics('/posts?utm_source=journal', 'https://email.example/?utm_source=letter#section')
  analytics.plugin()
  analytics.frames.forEach(callback => callback())
  analytics.timers.forEach(callback => callback())
  const config = analytics.calls.find(([command]) => command === 'config')[2]
  assert.equal(config.send_page_view, false)
  assert.equal(config.page_location, 'https://blog.example/posts')
  assert.equal(config.page_path, '/posts')
  assert.equal(config.page_referrer, 'https://email.example/')
  assert.equal(analytics.scripts.length, 1)
  analytics.track('click', { page_path: '/?token=SECRET', page_location: 'https://blog.example/?token=SECRET', document_referer: 'https://email.example/?token=SECRET', confirmation_token: 'SECRET' })
  assert.equal(JSON.stringify(analytics.calls).includes('SECRET'), false)
})

test('SPA capability navigation disables existing GA before history changes and scheduled initialization', () => {
  const analytics = loadAnalytics('/')
  analytics.plugin()
  analytics.frames.forEach(callback => callback())
  analytics.calls.length = 0
  analytics.hooks.before({ fullPath: '/?token=SECRET' })
  assert.equal(analytics.window['ga-disable-G-YYYXH2R239'], true)
  analytics.timers.forEach(callback => callback())
  analytics.track('click')
  assert.deepEqual(analytics.calls, [])
  assert.deepEqual(analytics.scripts, [])
})
