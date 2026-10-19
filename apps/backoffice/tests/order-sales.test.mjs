import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const utils = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
test('payment totals use exact minor units and reject invalid or unsafe amounts', () => {
  for (const [value, expected] of [['10.01', 1001], ['1', 100], ['0.10', 10], ['0', null], ['-1', null], ['1.001', null], ['Infinity', null], ['90071992547410', null]]) assert.equal(utils.orderAmountMinor(value), expected)
})
test('durable commands preserve exact body key and result across reload', () => {
  const body = { expected_revision: 7, amount_minor: 1001, method: 'card', evidence: 'fixture' }
  const command = { key: 'key-1', body }
  assert.deepEqual(utils.parseSalesIntent(JSON.stringify(command)), command)
  assert.deepEqual(utils.parseSalesIntent(JSON.stringify({ ...command, resultId: 123 })), { ...command, resultId: 123 })
  for (const value of ['broken', '{}', '{"key":"x","body":[]}', '{"key":"x","body":{},"resultId":-1}']) assert.equal(utils.parseSalesIntent(value), null)
})
test('scope separates operators operations and orders', () => {
  const keys = [utils.salesIntentStorageKey(1, 'payment', '2'), utils.salesIntentStorageKey(2, 'payment', '2'), utils.salesIntentStorageKey(1, 'handover', '2'), utils.salesIntentStorageKey(1, 'payment', '3')]
  assert.equal(new Set(keys).size, keys.length)
})
test('modern status dropdown cannot bypass separate payment and handover commands', () => {
  assert.deepEqual(utils.orderStatusOptions(false).map(item => item.value), ['pending', 'confirmed', 'cancelled'])
  assert.ok(utils.orderStatusOptions(true).some(item => item.value === 'completed'))
})

test('actual command runtime persists before send, deduplicates clicks and reload retries, and separates actors', async () => {
  const composable = await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')
  const transformed = composable.replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const runtime = ts.transpileModule(transformed, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const values = new Map()
  const callbacks = []
  const actor = { user: { id: 1 } }
  Object.assign(globalThis, {
    ref: value => ({ value }), shallowRef: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
    toValue: value => typeof value === 'function' ? value() : value?.value ?? value,
    watch: (scope, callback) => { callbacks.push(() => callback(scope.value)); callback(scope.value) },
    useAuthStore: () => actor, getCurrentScope: () => null,
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    ...utils,
  })
  const { useOrderSalesCommand } = await import(`data:text/javascript;base64,${Buffer.from(runtime).toString('base64')}`)
  const first = useOrderSalesCommand('payment', '123')
  let finish
  const deferred = new Promise(resolve => { finish = resolve })
  const sent = []
  const sender = async (body, key) => { sent.push({ body, key }); assert.equal(values.size, 1); return deferred }
  const pending = first.execute({ expected_revision: 1, amount_minor: 123 }, sender, async () => {})
  await first.execute({ expected_revision: 99 }, sender, async () => {})
  finish(Promise.reject(new Error('timeout')))
  await pending
  assert.equal(sent.length, 1)
  assert.equal(first.intent.value.body.expected_revision, 1)
  const reloaded = useOrderSalesCommand('payment', '123')
  await reloaded.execute({ expected_revision: 2 }, async (body, key) => { assert.deepEqual({ body, key }, sent[0]); return { id: 123 } }, async () => {})
  assert.equal(reloaded.intent.value.resultId, 123)
  let secondRequest = false
  await reloaded.execute({}, async () => { secondRequest = true; return { id: 123 } }, async () => {})
  assert.equal(secondRequest, false)
  actor.user = { id: 2 }; callbacks.forEach(callback => callback())
  assert.equal(reloaded.intent.value, null)
  assert.equal(values.size, 1)
  const rejection = useOrderSalesCommand('prepare', 'new')
  await rejection.execute({ items: [] }, async () => { throw { status: 422, data: { detail: [] } } }, async () => {})
  assert.equal(rejection.intent.value, null)
  await rejection.execute({ items: [] }, async () => { throw { status: 409, data: { detail: { code: 'idempotency_conflict' } } } }, async () => {})
  assert.ok(rejection.intent.value)
})
