import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = await readFile(new URL('../plugins/page-transition.client.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace('export default ', 'globalThis.plugin = '), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/export \{\};?/, '')

function setup() {
  let time = 0, id = 0
  const timers = new Map(), hooks = {}, visible = { value: false }
  const components = new Map()
  const route = fullPath => {
    const path = fullPath.split(/[?#]/)[0]
    if (!components.has(path)) components.set(path, {})
    return { fullPath, path, matched: [{ components: { default: components.get(path) } }] }
  }
  const router = {
    currentRoute: { value: route('/') },
    beforeEach: fn => { router.before = fn }, afterEach: fn => { router.after = fn }, onError: fn => { router.error = fn },
  }
  const context = vm.createContext({ defineNuxtPlugin: fn => fn, useRouter: () => router, usePageTransitionOverlay: () => visible,
    window: { setTimeout: (fn, delay) => { timers.set(++id, { fn, at: time + delay }); return id }, clearTimeout: key => timers.delete(key) } })
  vm.runInContext(compiled, context)
  context.plugin({ hook: (name, fn) => { hooks[name] = fn } })
  const tick = async duration => {
    const end = time + duration
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      time = next[1].at; timers.delete(next[0]); next[1].fn(); await Promise.resolve()
    }
    time = end
  }
  const navigate = async path => {
    const to = route(path), from = router.currentRoute.value
    const pending = router.before(to, from)
    await tick(300); await pending
    router.currentRoute.value = to; router.after(to, from)
    return to
  }
  const page = () => ({ type: router.currentRoute.value.matched.at(-1).components.default })
  return { router, hooks, visible, tick, navigate, route, page }
}

test('waits for the destination page and ignores duplicate navigation loading end', async () => {
  const app = setup()
  const to = await app.navigate('/brands')
  const page = app.page(); app.hooks['page:start'](page)
  app.router.after(app.route('/brands'), to, { type: 16 })
  await app.tick(1000); assert.equal(app.visible.value, true)
  app.hooks['page:finish'](page); await app.tick(80)
  assert.equal(app.visible.value, false)
})

test('stale asynchronous completion cannot reveal a newer page, including a synchronous replacement', async () => {
  const app = setup()
  await app.navigate('/first'); const first = app.page(); app.hooks['page:start'](first)
  await app.navigate('/second'); const second = app.page()
  app.hooks['page:finish'](first); await app.tick(1000)
  assert.equal(app.visible.value, true)
  app.hooks['page:finish'](second); await app.tick(80)
  assert.equal(app.visible.value, false)
})

test('query and hash changes skip overlay while preserving an already loading page', async () => {
  const app = setup()
  await app.navigate('/brands'); const page = app.page(); app.hooks['page:start'](page)
  await app.navigate('/brands?sort=1#b'); assert.equal(app.visible.value, true)
  app.hooks['page:finish'](page); await app.tick(80); assert.equal(app.visible.value, false)
  await app.navigate('/brands?sort=2'); assert.equal(app.visible.value, false)
})

test('cabinet internal navigation skips the overlay', async () => {
  const app = setup(); app.router.currentRoute.value = app.route('/cabinet')
  await app.navigate('/cabinet/favorites'); assert.equal(app.visible.value, false)
})

test('cancelled navigation only releases its own overlay and errors recover', async () => {
  const app = setup()
  const first = await app.navigate('/first')
  const second = await app.navigate('/second')
  app.router.after(first, {}, { type: 8 }); await app.tick(0); assert.equal(app.visible.value, true)
  app.router.error(new Error('failure'), second); await app.tick(0); assert.equal(app.visible.value, false)
  await app.navigate('/third'); app.hooks['app:error'](new Error('failure')); await app.tick(0); assert.equal(app.visible.value, false)
})

test('an old visit to the same path cannot finish a later visit', async () => {
  const app = setup()
  await app.navigate('/first'); const old = app.page(); app.hooks['page:start'](old)
  await app.navigate('/second')
  await app.navigate('/first'); const current = app.page(); app.hooks['page:start'](current)
  app.hooks['page:finish'](old); await app.tick(1000); assert.equal(app.visible.value, true)
  app.hooks['page:finish'](current); await app.tick(80); assert.equal(app.visible.value, false)
})

test('a rejected or cancelled query cannot release the still-loading page', async () => {
  for (const failure of [4, 8]) {
    const app = setup()
    const original = await app.navigate('/brands')
    const page = app.page(); app.hooks['page:start'](page)
    const query = app.route('/brands?probe=1')
    await app.router.before(query, original)
    app.router.after(query, original, { type: failure })
    app.router.after(app.route('/brands'), original, { type: 16 })
    app.router.error(new Error('query failed'), query)
    await app.tick(1000); assert.equal(app.visible.value, true)
    app.hooks['page:finish'](page); await app.tick(80)
    assert.equal(app.visible.value, false)
  }
})

test('a query navigation cannot cancel a reveal already scheduled by page finish', async () => {
  for (const failure of [undefined, { type: 4 }]) {
    const app = setup()
    const original = await app.navigate('/brands')
    const page = app.page(); app.hooks['page:start'](page); app.hooks['page:finish'](page)
    const query = app.route('/brands?probe=1')
    await app.router.before(query, original)
    if (!failure) app.router.currentRoute.value = query
    app.router.after(query, original, failure)
    await app.tick(80)
    assert.equal(app.visible.value, false, failure ? 'failed query' : 'successful query')
  }
})
