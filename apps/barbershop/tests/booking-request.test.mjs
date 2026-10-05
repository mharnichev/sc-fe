import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../utils/bookingRequest.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { createBookingRequest, bookingContextKey } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
test('context normalizes service sets and includes duration', () => {
  assert.equal(bookingContextKey(1, [3, 2, 3], '2026-10-04', 60), bookingContextKey(1, [2, 3], '2026-10-04', 60))
  assert.notEqual(bookingContextKey(1, [2], '2026-10-04', 60), bookingContextKey(1, [2], '2026-10-04', 90))
})
test('A→B→A rejects both old answers even when fetch ignores abort', async () => {
  const request = createBookingRequest()
  const a = request.begin(); const b = request.begin(); const latest = request.begin()
  assert.equal(a.signal.aborted, true); assert.equal(b.signal.aborted, true)
  assert.equal(a.current(), false); assert.equal(b.current(), false); assert.equal(latest.current(), true)
  const old = deferred(); const fresh = deferred(); const state = { loading: true, slots: [] }
  const apply = async (ticket, pending) => { try { const value = await pending; if (ticket.current()) state.slots = value } finally { if (ticket.current()) state.loading = false } }
  const p1 = apply(a, old.promise); const p2 = apply(latest, fresh.promise)
  old.resolve(['old']); await p1; assert.deepEqual(state, { loading: true, slots: [] })
  fresh.resolve(['fresh']); await p2; assert.deepEqual(state, { loading: false, slots: ['fresh'] })
})
test('cancel on context change invalidates selection and permits retry after failure', () => {
  const request = createBookingRequest(); const first = request.begin(); request.cancel()
  assert.equal(first.current(), false); assert.equal(first.signal.aborted, true)
  const retry = request.begin(); assert.equal(retry.current(), true); assert.equal(retry.signal.aborted, false)
})
