import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
let sequence = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}#${sequence++}`)
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

for (const unmount of [true, false]) {
  test(`late command cannot replace a newer durable intent (${unmount ? 'unmounted' : 'overlapping'} instance)`, async () => {
    const auth = vue.reactive({ user: { id: 1 } }), values = new Map()
    const utils = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
    Object.assign(globalThis, vue, utils, { useAuthStore: () => auth, localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } })
    const source = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
    const { useOrderSalesCommand } = await importSource(source)
    const firstScope = vue.effectScope(), secondScope = vue.effectScope()
    const first = firstScope.run(() => useOrderSalesCommand('fiscal-submit', '321'))
    const response = deferred(); let oldCallbacks = 0
    const oldPending = first.execute({ preview_id: 7 }, async () => response.promise, () => { oldCallbacks++; first.clear() })
    const original = JSON.parse([...values.values()][0])
    if (unmount) firstScope.stop()
    const second = secondScope.run(() => useOrderSalesCommand('fiscal-submit', '321'))
    await second.execute({ preview_id: 99 }, async (body, key) => { assert.deepEqual(body, original.body); assert.equal(key, original.key); return { id: 9 } }, () => second.clear())
    await second.execute({ preview_id: 8 }, async () => { throw new Error('newer command has uncertain outcome') }, () => {})
    const newer = JSON.parse([...values.values()][0])
    assert.notEqual(newer.key, original.key)
    response.resolve({ id: 9 }); await oldPending
    assert.deepEqual(JSON.parse([...values.values()][0] || 'null'), newer)
    assert.equal(oldCallbacks, 0)
    firstScope.stop(); secondScope.stop()
  })
}

test('failed durable storage blocks send and exposes a retry error', async () => {
  const utils = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, utils, { useAuthStore: () => ({ user: { id: 1 } }), localStorage: { getItem: () => null, setItem: () => { throw new Error('storage quota denied') }, removeItem() {} } })
  const source = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const { useOrderSalesCommand } = await importSource(source)
  const scope = vue.effectScope(), command = scope.run(() => useOrderSalesCommand('prepare', 'new'))
  let sent = false
  await command.execute({}, async () => { sent = true; return { id: 9 } }, () => {})
  assert.equal(sent, false)
  assert.notEqual(command.error.value, '')
  scope.stop()
})
