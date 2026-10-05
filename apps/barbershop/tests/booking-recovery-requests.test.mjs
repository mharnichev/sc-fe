import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const source = await readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8')
const requestSource = await readFile(new URL('../utils/bookingRequest.ts', import.meta.url), 'utf8')
const { createBookingRequest } = await import(`data:text/javascript;base64,${Buffer.from(compile(requestSource)).toString('base64')}`)
// Execute the component's actual request functions, not a copy of their implementation.
const functions = compile(source.slice(source.indexOf('const loadRecoveryAlternatives ='), source.indexOf('const alternativeChanges =')))
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const harness = () => {
  const calls = []
  const recovery = { loading: false, loadedKey: '', sameMaster: [], otherMasters: [], nextOffset: null, pageLoading: false, error: '', searchContextId: '' }
  const context = { value: 'A' }
  const dependencies = {
    recovery, recoveryRequestKey: context, recoveryRequest: createBookingRequest(),
    selectedMasterId: { value: 1 }, selectedServiceIds: { value: [1] }, selectedDate: { value: '2026-10-06' },
    selectedDurationMinutes: { value: 60 }, bookingFunnel: { sessionId: () => 'session-1234567890' },
    bookingAlternativesPayload: value => value, recoveryCopy: { value: { unavailable: 'Network error' } },
    showAllAlternatives: { value: false },
    domain: { getBookingAlternatives: (payload, signal) => {
      const request = deferred()
      calls.push({ payload, signal, ...request })
      return request.promise
    } },
  }
  const methods = new Function(...Object.keys(dependencies), `${functions}; return { loadRecoveryAlternatives, loadMoreAlternatives }`)(...Object.values(dependencies))
  return { ...methods, recovery, context, calls, dependencies }
}
const response = (id, next = null) => ({ same_master: [{ offer_id: id, recommended: true }], other_masters: [], search_context_id: 'context-1234567890', next_offset: next })

test('actual recovery loader starts B during A, then distinguishes the newer A', async () => {
  const h = harness()
  const first = h.loadRecoveryAlternatives()
  h.context.value = 'B'
  const second = h.loadRecoveryAlternatives()
  h.context.value = 'A'
  const latest = h.loadRecoveryAlternatives()
  assert.equal(h.calls.length, 3)
  assert.equal(h.calls[0].signal.aborted, true)
  h.calls[0].resolve(response('old-A'))
  await first
  assert.equal(h.recovery.loading, true)
  assert.deepEqual(h.recovery.sameMaster, [])
  h.calls[2].resolve(response('new-A'))
  await latest
  h.calls[1].resolve(response('old-B'))
  await second
  assert.equal(h.recovery.loading, false)
  assert.equal(h.recovery.loadedKey, 'A')
  assert.equal(h.recovery.sameMaster[0].offer_id, 'new-A')
})

test('actual recovery error can be retried without a context change', async () => {
  const h = harness()
  const failed = h.loadRecoveryAlternatives()
  h.calls[0].reject(new Error('offline'))
  await failed
  assert.equal(h.recovery.error, 'Network error')
  assert.equal(h.recovery.loadedKey, '')
  const retry = h.loadRecoveryAlternatives(true)
  h.calls[1].resolve(response('retried'))
  await retry
  assert.equal(h.recovery.error, '')
  assert.equal(h.recovery.sameMaster[0].offer_id, 'retried')
})

test('pages append unique offers and a newer search discards an old page', async () => {
  const h = harness()
  const initial = h.loadRecoveryAlternatives()
  h.calls[0].resolve(response('one', 9))
  await initial
  const page = h.loadMoreAlternatives()
  assert.equal(h.calls[1].payload.offset, 9)
  h.calls[1].resolve({ ...response('one', 59), other_masters: [{ offer_id: 'two' }] })
  await page
  assert.equal(h.recovery.sameMaster.length, 1)
  assert.equal(h.recovery.otherMasters.length, 1)
  const oldPage = h.loadMoreAlternatives()
  h.context.value = 'B'
  const newer = h.loadRecoveryAlternatives()
  h.calls[3].resolve(response('new-context'))
  await newer
  h.calls[2].resolve(response('stale-page'))
  await oldPage
  assert.deepEqual(h.recovery.sameMaster.map(slot => slot.offer_id), ['new-context'])
  assert.equal(h.recovery.pageLoading, false)
})
