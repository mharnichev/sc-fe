import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'

const source = await readFile(new URL('../utils/dobrodesk.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { shopSupportAppearance, createDobrodeskLifecycle, isDobrodeskEnabled, isDobrodeskPublicRoute } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
const safe = { allowed: true, visible: true, locale: 'uk' }
const harness = (extra = {}) => {
  const events = []
  const ready = deferred()
  const client = { ready: ready.promise }
  for (const method of ['show', 'hide', 'close', 'destroy', 'setLocale', 'setLauncherVisibility']) client[method] = value => events.push([method, value])
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
  assert.equal(check('/products/shampoo'), true)
  assert.equal(check('/shop/products/shampoo', {}, '', '/shop/'), true)
  assert.equal(check('/shop', {}, '', '/shop/'), true)
  assert.equal(check('/shop/checkout', {}, '', '/shop/'), false)
})

test('matched category pages are public while private and sensitive slugs stay blocked', () => {
  const check = (path, query = {}, hash = '') => isDobrodeskPublicRoute({ name: 'slug', path, query, hash })
  assert.equal(check('/profesiini-grebeni-ta-shchitki/goods/'), true)
  assert.equal(check('/volossia/shampuni'), true)
  for (const path of ['/account', '/cabinet/settings', '/auth/login', '/checkout', '/orders/123', '/api/session', '/admin', '/blog', '/%63abinet']) assert.equal(check(path), false, path)
  assert.equal(check('/volossia', { token: 'private' }), false)
  assert.equal(check('/volossia', {}, '#private'), false)
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


test('shop appearance is forwarded intact and keeps text and actions readable', async () => {
  const h = harness({ appearance: shopSupportAppearance })
  h.lifecycle.update(safe); h.lifecycle.activate(); await tick()
  assert.deepEqual(h.calls[0].appearance, shopSupportAppearance)
  assert.equal(shopSupportAppearance.mode, 'light')
  assert.equal(shopSupportAppearance.layout.offsetBlock, 88)
  const luminance = color => {
    const rgb = color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  for (const palette of [shopSupportAppearance.tokens.light, shopSupportAppearance.tokens.dark]) {
    for (const [foreground, background] of [['text', 'surface'], ['text', 'raisedSurface'], ['mutedText', 'surface'], ['onAccent', 'accent'], ['link', 'surface'], ['focus', 'surface']]) {
      const values = [luminance(palette[foreground]), luminance(palette[background])].sort((a, b) => b - a)
      assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${foreground}/${background}`)
    }
  }
})


const nuxtSource = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
const configured = value => {
  const code = ts.transpileModule(nuxtSource.replaceAll('import.meta.url', JSON.stringify(new URL('../nuxt.config.ts', import.meta.url).href)), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('export default ', 'result = ')
  const context = { process: { env: value === undefined ? {} : { NUXT_PUBLIC_DOBRODESK_ENABLED: value } }, URL, defineNuxtConfig: config => config }
  vm.runInNewContext(code, context)
  return context.result
}

test('actual Nuxt configuration defaults Dobrodesk off and requires explicit true', () => {
  for (const value of [undefined, '', 'false', '0', 'TRUE']) assert.equal(configured(value).runtimeConfig.public.dobrodeskEnabled, false)
  assert.equal(configured('true').runtimeConfig.public.dobrodeskEnabled, true)
})

const pluginSource = await readFile(new URL('../plugins/dobrodesk.client.ts', import.meta.url), 'utf8')
const helperURL = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
let pluginSequence = 0
const actualPlugin = async (config, event) => {
  const saved = Object.fromEntries(['defineNuxtPlugin', 'useRuntimeConfig', 'useRouter', 'useShopLocale', 'watch', 'window', '__dobrodeskPluginSpy'].map(key => [key, { present: Object.hasOwn(globalThis,key), value: globalThis[key] }]))
  const listeners = new Map(), hooks = new Map(), spy = { loads: 0, creates: [], events: [] }
  const sdk = `globalThis.__dobrodeskPluginSpy.loads++;export function createDobroDeskWidget(options){const spy=globalThis.__dobrodeskPluginSpy;spy.creates.push(options);const client={ready:Promise.resolve()};for(const method of ['show','hide','close','destroy','setLocale','setLauncherVisibility'])client[method]=value=>spy.events.push([method,value]);return client}`
  const sdkURL = `data:text/javascript;base64,${Buffer.from(sdk).toString('base64')}#${pluginSequence++}`
  const route = { name: 'index', path: '/', query: {}, hash: '', fullPath: '/' }
  Object.assign(globalThis, {
    __dobrodeskPluginSpy: spy,
    defineNuxtPlugin: plugin => plugin,
    useRuntimeConfig: () => ({ public: config.runtimeConfig.public, app: { baseURL: '/' } }),
    useRouter: () => ({ currentRoute: { value: route }, beforeEach: () => () => {}, afterEach: () => () => {} }),
    useShopLocale: () => ({ locale: { value: 'uk' } }),
    watch: (_source, callback, options) => { if(options.immediate)callback();return () => {} },
    window: { addEventListener: (name, callback) => listeners.set(name,callback), removeEventListener: (name, callback) => { if(listeners.get(name)===callback)listeners.delete(name) } },
  })
  try {
    const code = ts.transpileModule(pluginSource.replace("'~/utils/dobrodesk'", JSON.stringify(helperURL)).replace("'@dobrodesk/widget'", JSON.stringify(sdkURL)), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    const plugin = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${pluginSequence++}`)).default
    plugin({ hook: (name, callback) => hooks.set(name,callback) })
    hooks.get('app:mounted')()
    assert.equal(spy.loads,0)
    assert.equal(typeof listeners.get(event),'function')
    listeners.get(event)()
    await tick();await tick()
    return spy
  } finally {
    for(const [key,entry] of Object.entries(saved))if(entry.present)globalThis[key]=entry.value;else delete globalThis[key]
  }
}

test('actual disabled plugin never imports or creates SDK under pointer or keyboard interaction', async () => {
  for(const value of [undefined,'false'])for(const event of ['pointerdown','keydown']) {
    const spy=await actualPlugin(configured(value),event)
    assert.equal(spy.loads,0);assert.deepEqual(spy.creates,[]);assert.deepEqual(spy.events,[])
  }
})

test('actual plugin explicit true retains deferred SDK initialization after either interaction', async () => {
  for(const event of ['pointerdown','keydown']) {
    const spy=await actualPlugin(configured('true'),event)
    assert.equal(spy.loads,1);assert.equal(spy.creates.length,1)
    assert.deepEqual(Object.keys(spy.creates[0]).sort(),['appearance','integrationId','launcher','locale'])
    assert.ok(spy.events.some(([name])=>name==='show'))
  }
})
