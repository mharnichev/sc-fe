import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../utils/dobrodeskSandbox.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const harness = () => {
  const listeners = new Set(), commands = [], attributes = {}, timers = new Map()
  const frame = {
    contentWindow: { postMessage: (...args) => commands.push(args) },
    setAttribute: (name, value) => { attributes[name] = value },
    remove() { this.removed = true },
  }
  const context = {
    exports: {}, URL,
    window: {
      location: { origin: 'https://soulcuts.com.ua' },
      addEventListener: (_name, fn) => listeners.add(fn),
      removeEventListener: (_name, fn) => listeners.delete(fn),
    },
    document: { createElement: () => frame, body: { append: () => {} } },
    setTimeout: fn => { const id = timers.size + 1; timers.set(id, fn); return id },
    clearTimeout: id => timers.delete(id),
  }
  vm.runInNewContext(code, context)
  const create = url => context.exports.createSandboxedDobroDeskWidget({}, url)
  const receive = (data, origin = 'https://www.soulcuts.com.ua', sender = frame.contentWindow) => {
    for (const fn of listeners) fn({ data, origin, source: sender })
  }
  return { create, frame, commands, attributes, timers, listeners, receive }
}

test('sandbox refuses same origin and accepts readiness only from its own frame and origin', async () => {
  const h = harness()
  assert.throws(() => h.create('https://soulcuts.com.ua/support-widget'), /separate origin/)
  const client = h.create('https://www.soulcuts.com.ua/support-widget')
  assert.equal(h.attributes.sandbox, 'allow-scripts allow-same-origin allow-forms allow-popups')
  assert.equal(h.frame.referrerPolicy, 'no-referrer')
  assert.equal(h.frame.src, 'https://www.soulcuts.com.ua/support-widget')
  let ready = false
  client.ready.then(() => { ready = true })
  const message = { source: 'soulcuts-support', type: 'ready' }
  h.receive(message, 'https://evil.example')
  h.receive(message, undefined, {})
  h.receive({ ...message, source: 'other' })
  await Promise.resolve()
  assert.equal(ready, false)
  h.receive(message)
  await client.ready
  assert.equal(h.timers.size, 0)
  client.destroy()
  assert.equal(h.listeners.size, 0)
  assert.equal(h.frame.removed, true)
})

test('presentation cannot reopen a hidden private-route frame and commands expose no context', async () => {
  const h = harness(), client = h.create('https://www.soulcuts.com.ua/support-widget')
  h.receive({ source: 'soulcuts-support', type: 'ready' })
  await client.ready
  client.show(); client.open()
  assert.equal(h.frame.hidden, false)
  client.hide()
  h.receive({ source: 'soulcuts-support', type: 'presentation', open: true })
  client.open()
  assert.equal(h.frame.hidden, true)
  client.setLocale('en')
  client.setLauncherVisibility(false)
  assert.deepEqual(Object.keys(client).sort(), ['ready', 'open', 'close', 'show', 'hide', 'setLocale', 'setLauncherVisibility', 'destroy'].sort())
  for (const [message, origin] of h.commands) {
    assert.equal(origin, 'https://www.soulcuts.com.ua')
    assert.deepEqual(Object.keys(message).sort(), ['command', 'source', 'value'])
  }
  client.destroy()
})

test('timeout and disposal reject readiness without leaving listeners or timers', async () => {
  for (const timeout of [false, true]) {
    const h = harness(), client = h.create('https://www.soulcuts.com.ua/support-widget')
    const rejected = assert.rejects(client.ready, /Support (unavailable|disposed)/)
    if (timeout) for (const fn of h.timers.values()) fn()
    client.destroy()
    await rejected
    assert.equal(h.listeners.size, 0)
    assert.equal(h.timers.size, 0)
  }
})
