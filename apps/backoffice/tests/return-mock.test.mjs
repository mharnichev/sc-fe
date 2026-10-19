import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const loadSource = source => import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}#${Math.random()}`)
const utils = await loadSource(await readFile(new URL('../utils/fiscalMock.ts', import.meta.url), 'utf8'))
const sales = await loadSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function setup(file, props, api, exports, actor = { id: 1, is_superuser: true }, values = new Map()) {
  const auth = vue.reactive({ user: actor })
  props = vue.reactive(props)
  Object.assign(globalThis, vue, utils, sales, { defineProps: () => props, defineEmits: () => () => {}, useAuthStore: () => auth, useBackofficeApi: () => api, localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } })
  const command = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await loadSource(command))
  const component = await readFile(new URL(`../components/orders/${file}.vue`, import.meta.url), 'utf8')
  const source = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const state = await scope.run(() => loadSource(source + `\nexport { ${exports} };`))
  await tick()
  return { state, props, auth, values, stop: () => scope.stop() }
}
const record = () => ({ id: 5, order_id: 321, parent_sale_id: 9, amount_minor: 1234, currency: 'UAH', items: [{ order_item_id: 11, product_id: 8, name: 'Shampoo', quantity: 1, total_minor: 1234 }], reason: 'test', simulation: true, created_at: '2026-01-01', refund: null, receipt: null, fiscal_document_ids: [], allowed_actions: ['refund','receive'], blocking_reasons: [] })
test('local capability URL accepts only exact backend path and loopback shop origin', () => {
  const path = '/api/v1/public/mock-fiscal-documents/' + 'a'.repeat(30)
  assert.equal(utils.localMockFiscalShareUrl(path, 'http://127.0.0.1:6083'), 'http://127.0.0.1:6083/mock-fiscal-documents/' + 'a'.repeat(30))
  for (const origin of ['https://example.com','javascript:alert(1)','http://127.0.0.1.evil.test','http://user@localhost','http://localhost/path','http://localhost/?x=y','http://localhost/#x']) assert.equal(utils.localMockFiscalShareUrl(path, origin), null, origin)
  for (const value of ['https://evil.test'+path,path+'?x=y',path+'#x','/api/v1/public/orders/tracking/'+ 'a'.repeat(30),path+'/print']) assert.equal(utils.localMockFiscalShareUrl(value, 'http://localhost:6060'), null, value)
})
test('unknown refund retries the exact server amount fact intent across reload without invoking fiscal submission', async () => {
  const values = new Map(), sends = []
  const api = { refundMockReturn: async (id, body, key) => { sends.push({ id, body, key }); if (sends.length === 1) throw new Error('unknown after acceptance'); return { id } } }
  const first = await setup('OrderReturnFactsMock', { record: record(), order: { id: 321 }, enabled: true }, api, 'refundEvidence, refundConfirmed, method, runRefund, refund', undefined, values)
  first.state.refundEvidence.value = 'Local test operator evidence'; first.state.refundConfirmed.value = true
  await Promise.all([first.state.runRefund(), first.state.runRefund()])
  assert.equal(sends.length, 1); assert.ok(first.state.refund.intent.value); first.stop()
  const second = await setup('OrderReturnFactsMock', { record: record(), order: { id: 321 }, enabled: true }, api, 'runRefund, refund', undefined, values)
  await second.state.runRefund()
  assert.deepEqual(sends[0], sends[1]); assert.deepEqual(sends[0].body, { method: 'cash', evidence: 'Local test operator evidence' }); assert.equal(second.state.refund.intent.value, null)
  second.stop()
})
test('receipt requires every explicit disposition, evidence and fit confirmation; fact blocks another receipt', async () => {
  const sends = [], row = record()
  const app = await setup('OrderReturnFactsMock', { record: row, order: { id: 321 }, enabled: true }, { receiveMockReturn: async (id, body, key) => { sends.push({ id, body, key }); return { id } } }, 'receiptEvidence, dispositions, goodsFit, receiptConfirmed, runReceipt, receiptValid')
  app.state.receiptEvidence.value = 'Physically checked'; app.state.receiptConfirmed.value = true
  await app.state.runReceipt(); assert.equal(sends.length, 0)
  app.state.dispositions.value = { 11: 'restock' }; app.state.receiptConfirmed.value = true
  await app.state.runReceipt(); assert.equal(sends.length, 0)
  app.state.goodsFit.value = true; app.state.receiptConfirmed.value = true
  await Promise.all([app.state.runReceipt(), app.state.runReceipt()]); assert.equal(sends.length, 1)
  assert.deepEqual(sends[0].body.items, [{ order_item_id: 11, quantity: 1, disposition: 'restock' }])
  app.props.record = { ...row, receipt: { id: 8 }, allowed_actions: ['refund'] }
  app.state.receiptConfirmed.value = true; await app.state.runReceipt(); assert.equal(sends.length, 1)
  app.stop()
})
test('money and stock permissions are independent and actor changes reset unsent evidence and confirmations', async () => {
  for (const actor of [{ id: 1, can_record_sales: true }, { id: 1, can_post_inventory: true }, { id: 1, can_fiscalize_returns: true }]) {
    const app = await setup('OrderReturnFactsMock', { record: record(), order: { id: 321 }, enabled: true }, {}, 'canRefund, canReceive, refundEvidence, receiptEvidence, refundConfirmed, receiptConfirmed, goodsFit', actor)
    assert.equal(Boolean(app.state.canRefund.value), actor.can_record_sales === true)
    assert.equal(Boolean(app.state.canReceive.value), actor.can_post_inventory === true)
    app.state.refundEvidence.value = 'proof'; app.state.receiptEvidence.value = 'proof'; app.state.refundConfirmed.value = true; app.state.receiptConfirmed.value = true; app.state.goodsFit.value = true
    app.auth.user = { id: 2, can_record_sales: true }
    assert.equal(app.state.refundEvidence.value, ''); assert.equal(app.state.receiptEvidence.value, ''); assert.equal(app.state.refundConfirmed.value, false); assert.equal(app.state.receiptConfirmed.value, false); assert.equal(app.state.goodsFit.value, false)
    app.stop()
  }
})
test('return fiscal scope keeps separate intents, rejects other-return previews and drops delayed actor reads', async () => {
  let release
  const deferred = new Promise(resolve => { release = resolve })
  const values = new Map()
  const api = { getFiscalMockReadiness: async () => ({ mode: 'mock_only', available: true, cash_registers: [{ id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: 1, shift_status: 'open' }] }), getFiscalMockDocuments: async () => [], createReturnFiscalMockPreview: async () => ({ id: 7 }), getFiscalMockPreview: async () => deferred }
  const app = await setup('OrderFiscalMock', { order: { id: 321, revision: 2 }, returnId: 5 }, api, 'createPreview, preview, confirmed, canSubmit, resource', { id: 1, can_fiscalize_returns: true }, values)
  assert.equal(app.state.resource.value, '321:return:5')
  const pending = app.state.createPreview(); await tick()
  app.props.returnId = 6
  release({ id: 7, kind: 'return', return_id: 5, order_id: 321, revision: 2, cash_register_id: 'MOCK-KASA-1', shift_revision: 1, allowed_actions: ['submit'], blocking_reasons: [] })
  await pending; assert.equal(app.state.preview.value, null); assert.equal(app.state.canSubmit.value, false)
  assert.ok([...values.keys()].some(key => key.endsWith('321:return:5')))
  assert.ok(![...values.keys()].some(key => key.endsWith('321:return:6')))
  app.stop()
})

test('immutable return preview revision is independent of later order revisions and submits exact return revision', async () => {
  const sends = []
  const preview = { id: 7, kind: 'return', return_id: 5, parent_sale_id: 9, order_id: 321, revision: 1, snapshot_hash: 'b'.repeat(64), cash_register_id: 'MOCK-KASA-1', shift_revision: 1, allowed_actions: ['submit'], blocking_reasons: [], expires_at: '2099-01-01T00:00:00Z' }
  const api = { getFiscalMockReadiness: async () => ({ mode: 'mock_only', available: true, cash_registers: [{ id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: 1, shift_status: 'open' }] }), getFiscalMockDocuments: async () => [], createReturnFiscalMockPreview: async () => ({ id: 7 }), getFiscalMockPreview: async () => preview, submitFiscalMock: async (order, body, key) => { sends.push({ order, body, key }); return { id: 10 } } }
  const app = await setup('OrderFiscalMock', { order: { id: 321, revision: 3 }, returnId: 5, parentSaleId: 9 }, api, 'createPreview, preview, confirmed, canSubmit, queue', { id: 1, can_fiscalize_returns: true })
  await app.state.createPreview(); assert.equal(app.state.canSubmit.value, true)
  app.state.confirmed.value = true
  app.props.order.revision = 4
  assert.equal(app.state.confirmed.value, true); assert.equal(app.state.canSubmit.value, true)
  await app.state.queue(); assert.equal(sends.length, 1); assert.equal(sends[0].body.expected_revision, 1)
  app.stop()
})


test('Shop COD return uses its issued MOCK sale even when the order itself is not simulated', async () => {
  const sends = []
  const sale = { id: 9, kind: 'sale', order_id: 321, status: 'issued', simulation: true, document_kind: 'mock_fiscal_receipt', snapshot: { items: [{ order_item_id: 11, quantity: 2 }] } }
  const api = { getMockReturns: async () => [], getFiscalMockReadiness: async () => ({ mode: 'mock_only', available: true }), getFiscalMockDocuments: async () => [sale], createMockReturn: async (order, body, key) => { sends.push({ order, body, key }); return { id: 5 } } }
  const app = await setup('OrderReturnsMock', { order: { id: 321, channel: 'shop', simulation: false } }, api, 'canCreate, parentId, quantities, reason, confirmed, create')
  assert.equal(app.state.canCreate.value, true)
  app.state.parentId.value = '9'; app.state.quantities.value = { 11: 1 }; app.state.reason.value = 'One returned COD item'; app.state.confirmed.value = true
  await app.state.create()
  assert.equal(sends.length, 1)
  assert.deepEqual(sends[0].body, { parent_sale_id: 9, items: [{ order_item_id: 11, quantity: 1 }], reason: 'One returned COD item' })
  assert.ok(sends[0].key)
  app.stop()
})

test('return creation requires a current-order issued MOCK sale, readiness and sales permission', async () => {
  const sale = { id: 9, kind: 'sale', order_id: 321, status: 'issued', simulation: true, document_kind: 'mock_fiscal_receipt', snapshot: {} }
  for (const options of [
    { documents: [] },
    { documents: [{ ...sale, status: 'queued' }] },
    { documents: [{ ...sale, simulation: false }] },
    { documents: [{ ...sale, kind: 'return' }] },
    { documents: [{ ...sale, order_id: 999 }] },
    { documents: [{ ...sale, document_kind: 'preliminary' }] },
    { documents: [{ ...sale, snapshot: { transport: 'provider_sandbox' } }] },
    { documents: [sale], available: false },
    { documents: [sale], actor: { id: 1, can_post_inventory: true } },
  ]) {
    const api = { getMockReturns: async () => [], getFiscalMockReadiness: async () => ({ mode: 'mock_only', available: options.available !== false }), getFiscalMockDocuments: async () => options.documents }
    const app = await setup('OrderReturnsMock', { order: { id: 321, simulation: true } }, api, 'canCreate', options.actor)
    assert.equal(Boolean(app.state.canCreate.value), false, JSON.stringify(options))
    app.stop()
  }
})
