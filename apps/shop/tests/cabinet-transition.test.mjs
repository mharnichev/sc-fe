import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../plugins/page-transition.client.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace('export default ', 'globalThis.plugin = '), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText

function setup() {
  const visible = { value: false }
  const timers = new Map()
  const hooks = {}
  let id = 0
  const router = {
    currentRoute: { value: { fullPath: '/', path: '/' } },
    beforeEach: fn => { router.before = fn },
    afterEach: fn => { router.after = fn },
    onError: fn => { router.error = fn },
  }
  const context = vm.createContext({
    defineNuxtPlugin: fn => fn,
    useRouter: () => router,
    usePageTransitionOverlay: () => visible,
    window: {
      setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id },
      clearTimeout: key => timers.delete(key),
    },
  })
  vm.runInContext(compiled, context)
  context.plugin({ hook: (name, fn) => { hooks[name] = fn } })
  const flush = async delay => {
    for (const [key, timer] of [...timers]) {
      if (timer.delay !== delay) continue
      timers.delete(key)
      timer.fn()
      await Promise.resolve()
    }
  }
  const route = fullPath => ({ fullPath, path: fullPath.split(/[?#]/)[0], matched: [{}] })
  const begin = (from, to) => {
    router.currentRoute.value = route(from)
    return router.before(route(to), route(from))
  }
  const commit = (to, failure) => {
    router.currentRoute.value = route(to)
    router.after(route(to), {}, failure)
  }
  return { visible, timers, router, hooks, flush, begin, commit }
}

test('all seven cabinet child routes skip the global overlay and delay', async () => {
  const paths = ['/cabinet', '/cabinet/settings', '/cabinet/favorites', '/cabinet/purchase-history', '/cabinet/orders/321', '/cabinet/contact', '/cabinet/shop-rules']
  for (const from of paths) for (const to of paths) {
    const app = setup()
    await app.begin(from, to)
    assert.equal(app.visible.value, false, `${from} -> ${to}`)
    assert.equal(app.timers.size, 0)
  }
})

test('cabinet query/hash navigation also skips the global transition', async () => {
  const app = setup()
  await app.begin('/cabinet/', '/cabinet/purchase-history?page=2#orders')
  assert.equal(app.visible.value, false)
  assert.equal(app.timers.size, 0)
})

test('entering/leaving cabinet and similarly named public paths keep the delay', async () => {
  for (const [from, to] of [['/', '/cabinet'], ['/cabinet', '/contacts'], ['/cabinet-other', '/cabinet']]) {
    const app = setup()
    const pending = app.begin(from, to)
    assert.equal(app.visible.value, true)
    assert.equal([...app.timers.values()][0].delay, 300)
    await app.flush(300)
    await pending
    app.commit(to)
    await app.flush(80)
    assert.equal(app.visible.value, false)
  }
})

test('query-only public navigation recovers via afterEach without a Nuxt hook', async () => {
  const app = setup()
  const pending = app.begin('/catalog?page=1', '/catalog?page=2')
  await app.flush(300)
  await pending
  app.commit('/catalog?page=2')
  await app.flush(80)
  assert.equal(app.visible.value, false)
})

test('internal navigation cancels a pending cabinet-entry reveal', async () => {
  const app = setup()
  const pending = app.begin('/', '/cabinet')
  await app.flush(300)
  await pending
  app.commit('/cabinet')
  await app.begin('/cabinet', '/cabinet/favorites')
  assert.equal(app.visible.value, false)
  assert.equal(app.timers.size, 0)
  app.hooks['page:finish']()
  assert.equal(app.timers.size, 0)
})

for (const failure of ['abort', 'router']) {
  test(`${failure} still releases the overlay`, async () => {
    const app = setup()
    const pending = app.begin('/', '/cabinet')
    await app.flush(300)
    await pending
    if (failure === 'abort') app.commit('/cabinet', new Error('aborted'))
    else app.router.error(new Error('failed'))
    await app.flush(0)
    assert.equal(app.visible.value, false)
  })
}

test('only the cabinet parent owns the persistent shell', async () => {
  const parent = await readFile(new URL('../pages/cabinet.vue', import.meta.url), 'utf8')
  assert.match(parent, /<CabinetShell>\s*<NuxtPage :transition="contentTransition"\s*\/>\s*<\/CabinetShell>/)
  for (const path of ['index.vue', 'settings.vue', 'favorites.vue', 'purchase-history.vue', 'orders/[id].vue', 'contact.vue', 'shop-rules.vue']) {
    const child = await readFile(new URL(`../pages/cabinet/${path}`, import.meta.url), 'utf8')
    assert.doesNotMatch(child, /<\/?CabinetShell\b/)
  }
})
