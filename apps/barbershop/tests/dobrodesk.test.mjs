import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/dobrodesk.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { barbershopSupportAppearance, createDobrodeskLifecycle, isDobrodeskEnabled, isDobrodeskPublicRoute } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
const safe = { allowed: true, visible: true, locale: 'uk' }
const harness = (extra = {}) => {
  const events = []
  const ready = deferred()
  const client = { ready: ready.promise }
  for (const method of ['open', 'show', 'hide', 'close', 'destroy', 'setLocale', 'setLauncherVisibility']) client[method] = value => events.push([method, value])
  const calls = []
  const sdk = { createDobroDeskWidget: options => { calls.push(options); return client } }
  let loads = 0
  const lifecycle = createDobrodeskLifecycle({ integrationId: 'wgt_public', enabled: true, appearance: { layout: { offsetBlock: 88 } }, load: async () => { loads++; return sdk }, ...extra })
  return { lifecycle, events, calls, ready, get loads() { return loads } }
}

test('only approved public paths without query or hash are eligible', () => {
  const check = (path, query = {}, hash = '', baseURL = '/') => isDobrodeskPublicRoute({ path, query, hash }, baseURL)
  assert.equal(check('/'), true)
  assert.equal(check('/', { token: 'secret' }), false)
  assert.equal(check('/', {}, '#secret'), false)
  for (const path of ['/booking', '/booking/manage', '/booking/repeat', '/booking/cancel', '/booking/waitlist-offer', '/cabinet', '/cabinet/orders/123', '/checkout', '/checkout/purchase', '/favorites', '/unknown', '/blog']) assert.equal(check(path), false, path)
  assert.equal(check('/services/haircut'), true)
  for (const path of ['/en/', '/en/services', '/en/masters/hlib-1', '/en/contacts']) {
    assert.equal(check(path), true, path)
    assert.equal(check(path, { token: 'secret' }), false)
    assert.equal(check(path, {}, '#secret'), false)
  }
  for (const path of ['/en/booking', '/en/booking/manage', '/en/review', '/en/api/v1', '/en/blog', '/en/unknown']) assert.equal(check(path), false, path)
  assert.equal(check('/shop'), false)
  assert.equal(check('/shop/catalog'), false)
})

test('runtime boolean and string flags require explicit enablement', () => {
  for (const value of [true, 'true']) assert.equal(isDobrodeskEnabled(value), true)
  for (const value of [false, 'false', '', undefined, 0]) assert.equal(isDobrodeskEnabled(value), false)
})

test('disabled or unconfigured integration never imports the SDK', async () => {
  for (const extra of [{ enabled: false }, { integrationId: '' }]) {
    const h = harness(extra)
    h.lifecycle.update(safe); h.lifecycle.activate(); await tick()
    assert.equal(h.loads, 0)
  }
})

test('interaction loads once, waits for ready, and sends no customer or booking context', async () => {
  const h = harness()
  h.lifecycle.update(safe); await tick(); assert.equal(h.loads, 0)
  h.lifecycle.activate(); h.lifecycle.activate(); await tick()
  assert.equal(h.loads, 1); assert.equal(h.calls.length, 1)
  assert.deepEqual(Object.keys(h.calls[0]).sort(), ['appearance', 'integrationId', 'launcher', 'locale'])
  assert.equal(h.calls[0].launcher, 'hidden')
  assert.equal(h.events.some(([name]) => name === 'show'), false)
  h.ready.resolve(); await tick()
  assert.equal(h.events.some(([name]) => name === 'show'), true)
  h.lifecycle.update({ ...safe, locale: 'en' })
  assert.deepEqual(h.events.at(-3), ['setLocale', 'en'])
  assert.equal(h.loads, 1)
})

test('private navigation and drawer hide the widget; public return reuses the instance', async () => {
  const h = harness()
  h.lifecycle.update(safe); h.lifecycle.activate(); await tick(); h.ready.resolve(); await tick()
  for (const next of [{ ...safe, allowed: false }, { ...safe, visible: false }]) {
    h.lifecycle.update(next)
    assert.equal(h.events.at(-1)[0], 'hide')
    assert.equal(h.events.at(-2)[0], 'close')
  }
  h.lifecycle.update(safe)
  assert.equal(h.events.at(-1)[0], 'show')
  assert.equal(h.calls.length, 1)
})

test('private route reached during import prevents initialization', async () => {
  const pending = deferred()
  const h = harness({ load: () => pending.promise })
  h.lifecycle.update(safe); h.lifecycle.activate()
  h.lifecycle.update({ ...safe, allowed: false })
  pending.resolve({ createDobroDeskWidget: () => assert.fail('must not create on private route') }); await tick()
  assert.equal(h.calls.length, 0)
})

test('private route reached during ready cannot flash a launcher', async () => {
  const h = harness()
  h.lifecycle.update(safe); h.lifecycle.activate(); await tick()
  h.lifecycle.update({ ...safe, allowed: false }); h.ready.resolve(); await tick()
  assert.equal(h.events.some(([name]) => name === 'show'), false)
  assert.equal(h.events.at(-1)[0], 'hide')
})

test('SDK failure is contained and disposal prevents delayed creation', async () => {
  const h = harness({ load: async () => { throw new Error('offline') } })
  h.lifecycle.update(safe); h.lifecycle.activate(); await tick()
  h.lifecycle.update(safe); await tick(); assert.equal(h.calls.length, 0)
  const pending = deferred()
  const disposed = harness({ load: () => pending.promise })
  disposed.lifecycle.update(safe); disposed.lifecycle.activate(); disposed.lifecycle.dispose()
  pending.resolve({ createDobroDeskWidget: () => assert.fail('disposed') }); await tick()
  const active = harness()
  active.lifecycle.update(safe); active.lifecycle.activate(); await tick(); active.lifecycle.dispose()
  active.ready.resolve(); await tick()
  assert.equal(active.events.filter(([name]) => name === 'destroy').length, 1)
  assert.equal(active.events.some(([name]) => name === 'show'), false)
})


test('custom launcher opens after SDK readiness without showing a duplicate launcher', async () => {
  const h = harness({ customLauncher: true })
  h.lifecycle.update(safe); h.lifecycle.open(); await tick()
  assert.equal(h.events.some(([name]) => name === 'open'), false)
  h.ready.resolve(); await tick()
  assert.equal(h.events.filter(([name]) => name === 'open').length, 1)
  assert.deepEqual(h.events.find(([name]) => name === 'setLauncherVisibility'), ['setLauncherVisibility', false])
})

test('private navigation cancels a pending custom launcher open', async () => {
  const h = harness({ customLauncher: true })
  h.lifecycle.update(safe); h.lifecycle.open(); await tick()
  h.lifecycle.update({ ...safe, allowed: false }); h.ready.resolve(); await tick()
  h.lifecycle.update(safe)
  assert.equal(h.events.some(([name]) => name === 'open'), false)
})


test('barbershop theme text and action colors retain readable contrast', () => {
  const luminance = color => {
    const rgb = color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  const palette = barbershopSupportAppearance.tokens.dark
  for (const [foreground, background] of [['text', 'surface'], ['mutedText', 'raisedSurface'], ['onAccent', 'accent'], ['link', 'surface']]) {
    const values = [luminance(palette[foreground]), luminance(palette[background])].sort((a, b) => b - a)
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${foreground}/${background}`)
  }
})

test('explicit click retries a transient import failure without automatic retry loops', async () => {
  let attempts = 0
  const h = harness({ load: async () => { attempts++; throw new Error('offline') } })
  h.lifecycle.update(safe); h.lifecycle.open(); await tick()
  h.lifecycle.update(safe); await tick()
  assert.equal(attempts, 1)
  h.lifecycle.open(); await tick()
  assert.equal(attempts, 2)
})

test('plugin loads only from support clicks inside a cross-origin sandbox', async () => {
  const plugin = await readFile(new URL('../plugins/dobrodesk.client.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(plugin, /addEventListener\(['"](?:pointerdown|keydown)/)
  const sandbox = await readFile(new URL('../utils/dobrodeskSandbox.ts', import.meta.url), 'utf8')
  assert.match(plugin, /import\('~\/utils\/dobrodeskSandbox'\)/)
  assert.match(sandbox, /setAttribute\('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups'\)/)
  assert.match(sandbox, /target\.origin === window\.location\.origin/)
  assert.match(sandbox, /frame\.referrerPolicy = 'no-referrer'/)
  assert.match(sandbox, /event\.source !== frame\.contentWindow/)
})

test('support document fails closed on main-site hosts and is private to the intended embed origin', async () => {
  const source = await readFile(new URL('../server/routes/support-widget.get.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source.replace(/^import .*\n/, 'const barbershopSupportAppearance = {};\n'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  globalThis.defineEventHandler = handler => handler
  globalThis.getRequestURL = event => new URL(event.url)
  globalThis.useRuntimeConfig = () => ({ public: { siteUrl: 'https://soulcuts.com.ua', dobrodeskEnabled: true, dobrodeskIntegrationId: 'wgt_public' } })
  globalThis.createError = error => Object.assign(new Error('HTTP error'), error)
  globalThis.setResponseHeaders = (event, headers) => { event.headers = headers }
  try {
    const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    for (const host of ['soulcuts.com.ua', 'admin.soulcuts.com.ua', 'evil.example']) assert.throws(() => handler({ url: `https://${host}/support-widget` }), { statusCode: 404 })
    const event = { url: 'https://www.soulcuts.com.ua/support-widget' }
    const html = handler(event)
    assert.match(html, /widget\.dobrodesk\.com\/widget\/loader\/v1\.min\.js/)
    assert.equal(event.headers['Cache-Control'], 'no-store')
    assert.equal(event.headers['Referrer-Policy'], 'no-referrer')
    assert.match(event.headers['X-Robots-Tag'], /noindex/)
    assert.match(event.headers['Content-Security-Policy'], /frame-ancestors https:\/\/soulcuts\.com\.ua/)
    assert.match(html, /event\.origin !== config\.parentOrigin/)
  } finally {
    for (const key of ['defineEventHandler', 'getRequestURL', 'useRuntimeConfig', 'createError', 'setResponseHeaders']) delete globalThis[key]
  }
})
