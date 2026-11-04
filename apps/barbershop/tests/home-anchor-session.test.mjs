import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Execute the actual page script; the scheduler can deliver even cancelled callbacks
// to model callbacks already queued by the browser before input/navigation.
const source = await readFile(new URL('../pages/index.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
function harness(hash = '#booking') {
  let now = 0, id = 0, mounted, unmount, mountWatcher, releaseTick
  const frames = new Map(), timers = new Map(), listeners = new Map(), scrolls = []
  const queue = (map, callback, delay = 0) => { const key = ++id; const value = { callback, at: now + delay }; map.set(key, value); return key }
  const window = {
    location: { hash }, performance: { now: () => now },
    requestAnimationFrame: callback => queue(frames, callback), cancelAnimationFrame: key => frames.delete(key),
    setTimeout: (callback, delay) => queue(timers, callback, delay), clearTimeout: key => timers.delete(key),
    addEventListener: (event, callback, options) => { if (!listeners.has(event)) listeners.set(event, new Map()); listeners.get(event).set(callback, options) },
    removeEventListener: (event, callback) => listeners.get(event)?.delete(callback),
  }
  const target = id => ({ scrollIntoView: () => scrolls.push({ id, at: now }) })
  const document = { querySelector: () => target('booking'), getElementById: id => target(id) }
  const Observer = class { observe() {} disconnect() {} }
  window.IntersectionObserver = Observer
  const page = new Function('window', 'document', 'IntersectionObserver', 'ref', 'useTerms', 'onMounted', 'onBeforeUnmount', 'watch', 'nextTick', 'useSeo', `${compiled}; return { keepMountedBookingHashTargetAnchored, handleBookingHashNavigation }`)(
    window, document, Observer, value => ({ value }), () => ({ terms: { value: { seo: {} } } }),
    callback => { mounted = callback }, callback => { unmount = callback }, (_source, callback) => { mountWatcher = callback },
    () => new Promise(resolve => { releaseTick = resolve }), () => {},
  )
  const emit = event => {
    for (const [callback, options] of [...(listeners.get(event) || [])]) { if (options?.once) listeners.get(event).delete(callback); callback() }
  }
  const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(item => item.callback()) }
  const advance = until => {
    let iterations = 0
    while (true) {
      const next = [...timers.entries()].filter(([, item]) => item.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      assert.ok(++iterations < 1000, 'scheduler must stay bounded')
      timers.delete(next[0]); now = next[1].at; next[1].callback()
    }
    now = until
  }
  return { ...page, window, frames, timers, scrolls, emit, flushFrames, advance, mounted: () => mounted(), unmount: () => unmount(), mountWatcher: () => mountWatcher(true), releaseTick: () => releaseTick(), pendingAnchorTimers: () => [...timers.values()].filter(item => item.at === now + 100).length }
}

test('duplicate starts before RAF own one loop and input cancels its pending timer', () => {
  const h = harness(); h.mounted(); h.keepMountedBookingHashTargetAnchored(); h.flushFrames()
  assert.equal(h.scrolls.length, 1)
  h.emit('pointerdown'); h.advance(500)
  assert.equal(h.scrolls.length, 1)
})
for (const input of ['pointerdown', 'wheel', 'touchstart', 'keydown']) test(`${input} before first RAF prevents every later anchor scroll`, () => {
  const h = harness(); h.mounted(); h.emit(input); h.flushFrames(); h.advance(500)
  assert.deepEqual(h.scrolls, [])
})
test('already queued stale RAF and timer callbacks cannot scroll or reschedule after input', () => {
  const h = harness(); h.mounted(); const frame = [...h.frames.values()][0].callback
  h.flushFrames(); const timer = [...h.timers.values()].find(item => item.at === 100).callback
  h.emit('pointerdown'); const count = h.scrolls.length
  frame(); timer(); h.advance(500)
  assert.equal(h.scrolls.length, count)
  assert.equal(h.frames.size, 0)
  assert.equal(h.pendingAnchorTimers(), 0)
})
test('late mount completion cannot restart a navigation already cancelled by input', async () => {
  const h = harness(); h.mounted(); const completion = h.mountWatcher()
  h.emit('pointerdown'); h.releaseTick(); await completion; h.flushFrames(); h.advance(500)
  assert.deepEqual(h.scrolls, [])
})
test('hash navigation replaces a session, invalidates old callbacks and preserves all target mappings', () => {
  const h = harness(); h.mounted(); const old = [...h.frames.values()][0].callback
  h.window.location.hash = '#team'; h.emit('hashchange'); old(); h.flushFrames()
  assert.deepEqual(h.scrolls.map(item => item.id), ['team'])
  for (const hash of ['#reviews', '#booking-stepper', '#booking']) {
    h.window.location.hash = hash; h.emit('hashchange'); h.flushFrames()
    assert.equal(h.scrolls.at(-1).id, hash.slice(1))
  }
  const count = h.scrolls.length
  h.window.location.hash = '#other'; h.emit('hashchange'); h.flushFrames(); h.advance(500)
  assert.equal(h.scrolls.length, count)
  assert.equal(h.pendingAnchorTimers(), 0)
})
test('unmount invalidates queued callbacks and a pending mount continuation', async () => {
  const h = harness(); h.mounted(); const old = [...h.frames.values()][0].callback; const completion = h.mountWatcher()
  h.unmount(); h.releaseTick(); await completion; old(); h.flushFrames(); h.advance(500)
  assert.deepEqual(h.scrolls, [])
  assert.equal(h.frames.size, 0)
  assert.equal(h.timers.size, 0)
})

test('returning to the same hash cannot revive a callback from its older navigation', () => {
  const h = harness(); h.mounted(); const oldFrame = [...h.frames.values()][0].callback
  h.flushFrames(); const oldTimer = [...h.timers.values()].find(item => item.at === 100).callback
  h.window.location.hash = '#team'; h.emit('hashchange')
  h.window.location.hash = '#booking'; h.emit('hashchange')
  oldFrame(); oldTimer(); h.flushFrames()
  assert.deepEqual(h.scrolls.map(item => item.id), ['booking', 'booking'])
  assert.equal(h.pendingAnchorTimers(), 1)
})
