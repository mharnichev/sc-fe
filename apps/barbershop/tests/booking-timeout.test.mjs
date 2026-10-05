import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getEventListeners } from 'node:events'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../utils/bookingTimeout.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { withBookingTimeout } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('deadline rejects even an unresponsive transport without cancelling the parent; retry succeeds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const parent = new AbortController()
  let transportSignal
  const pending = withBookingTimeout(signal => { transportSignal = signal; return new Promise(() => {}) }, 15000, parent.signal)
  const rejected = assert.rejects(pending, { name: 'TimeoutError' })
  await Promise.resolve()
  t.mock.timers.tick(14999)
  assert.equal(transportSignal.aborted, false)
  t.mock.timers.tick(1)
  await rejected
  assert.equal(transportSignal.aborted, true)
  assert.equal(parent.signal.aborted, false)
  assert.equal(getEventListeners(parent.signal, 'abort').length, 0)
  assert.equal(await withBookingTimeout(async () => 'fresh', 15000, parent.signal), 'fresh')
})

test('context cancellation aborts transport, settles immediately and removes its listener', async () => {
  const parent = new AbortController()
  let transportSignal
  const pending = withBookingTimeout(signal => { transportSignal = signal; return new Promise(() => {}) }, 20000, parent.signal)
  const rejected = assert.rejects(pending, { name: 'AbortError' })
  await Promise.resolve()
  parent.abort()
  await rejected
  assert.equal(transportSignal.aborted, true)
  assert.equal(getEventListeners(parent.signal, 'abort').length, 0)
})

test('already cancelled request never starts transport', async () => {
  const parent = new AbortController(); parent.abort()
  let calls = 0
  await assert.rejects(withBookingTimeout(async () => { calls++; return 'old' }, 15000, parent.signal), { name: 'AbortError' })
  assert.equal(calls, 0)
})

test('success and network failure clean listeners and timers without late cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const fail of [false, true]) {
    const parent = new AbortController()
    let transportSignal
    const pending = withBookingTimeout(async signal => {
      transportSignal = signal
      if (fail) throw new Error('network down')
      return ['slot']
    }, 20000, parent.signal)
    if (fail) await assert.rejects(pending, /network down/)
    else assert.deepEqual(await pending, ['slot'])
    assert.equal(getEventListeners(parent.signal, 'abort').length, 0)
    t.mock.timers.tick(20001)
    parent.abort()
    assert.equal(transportSignal.aborted, false)
  }
})
