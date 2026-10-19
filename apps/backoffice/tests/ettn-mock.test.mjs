import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
let sequence = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}#${sequence++}`)
const safety = { mode: 'mock_only', provider_contract: 'unknown', simulation: true, is_sent_dps: false }
test('actual ETTN panel discards delayed actor/order preview and invalidates exact consent on snapshot or owner changes', async () => {
  const values = new Map(), auth = vue.reactive({ user: { id: 1, is_superuser: true } })
  const order = id => ({ id, revision: 2, shipments: [{ id: 4, tracking_number: 'MOCK-TTN', simulation: true, active: true }] })
  const props = vue.reactive({ order: order(321) })
  let releaseRead, submissions = 0, readCount = 0
  let deferred = new Promise(resolve => { releaseRead = resolve })
  const api = {
    getEttnMockProjects: async () => ({ ...safety, owner: null, available: true, items: [], allowed_actions: ['preview'], blocking_reasons: [] }),
    createEttnMockPreview: async () => ({ id: 7 }),
    getEttnMockPreview: async () => { readCount++; return deferred },
    armEttnMock: async () => { submissions++; return { id: 9 } },
  }
  const fiscal = await importSource(await readFile(new URL('../utils/fiscalMock.ts', import.meta.url), 'utf8'))
  const utils = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, fiscal, utils, { useAuthStore: () => auth, localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } })
  const command = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(command), { defineProps: () => props, defineEmits: () => () => {}, useBackofficeApi: () => api })
  const component = await readFile(new URL('../components/orders/OrderEttnMock.vue', import.meta.url), 'utf8')
  const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const state = await scope.run(() => importSource(script + '\nexport { preview, confirmed, createPreview, approve, canArm, state, shipmentId, unresolved };'))
  await new Promise(resolve => setTimeout(resolve, 0))
  const pending = state.createPreview()
  assert.equal(state.unresolved.value, true)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(readCount, 1)
  const preview = { ...safety, id: 7, order_id: 321, revision: 2, cash_register_id: 'MOCK-KASA-1', snapshot_hash: 'a'.repeat(64), shift_revision: 1, snapshot: { amount_minor: 12345, shipment_id: 4, tracking_number: 'MOCK-TTN', condition: 'mock_delivery_confirmed' }, expires_at: '2099-01-01T00:00:00Z', allowed_actions: ['arm'], blocking_reasons: [] }
  releaseRead(preview); await pending
  assert.equal(state.unresolved.value, false, 'accepted preview must release its shallow-ref pending state')
  assert.equal(state.canArm.value, true)
  state.confirmed.value = true; state.preview.value = { ...state.preview.value, snapshot_hash: 'b'.repeat(64) }
  assert.equal(state.confirmed.value, false)
  state.confirmed.value = true; state.state.value = { ...state.state.value, owner: 'checkbox_ettn', allowed_actions: [] }
  assert.equal(state.confirmed.value, false); assert.equal(state.canArm.value, false)
  await state.approve(); assert.equal(submissions, 0)
  state.state.value = { ...state.state.value, owner: null, allowed_actions: ['preview'] }
  deferred = new Promise(resolve => { releaseRead = resolve })
  const next = state.createPreview()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(readCount, 2)
  state.confirmed.value = true
  auth.user = { id: 2, is_superuser: true }; props.order = order(322)
  assert.equal(state.confirmed.value, false)
  releaseRead(preview); await next
  assert.equal(state.preview.value, null)
  assert.equal(state.canArm.value, false)
  await state.approve(); assert.equal(submissions, 0)
  assert.ok([...values.keys()].some(key => key.includes(':1:ettn-preview:321')))
  scope.stop()
})

test('actual linked receipt verifier binds canonical provenance and discards an old actor/order read', async () => {
  const values = new Map(), auth = vue.reactive({ user: { id: 1, is_superuser: true } }), props = vue.reactive({ order: { id: 321, revision: 2, shipments: [] } })
  const project = { ...safety, id: 9, order_id: 321, status: 'issued', fiscal_document_id: 19, allowed_actions: ['view_document'], provider_uuid: 'same-uuid', cash_register_id: 'MOCK-KASA-1', shift_revision: 1, snapshot_hash: 'approval-hash', external_id: 'MOCK-ETTN-9', shipment_id: 4, tracking_number: 'MOCK-TTN', condition: 'mock_delivery_confirmed', snapshot: { amount_minor: 2000 } }
  const document = { id: 19, order_id: 321, status: 'issued', source: 'automation', automation_id: 9, simulation: true, is_sent_dps: false, document_kind: 'mock_fiscal_receipt', provider_uuid: 'same-uuid', cash_register_id: 'MOCK-KASA-1', shift_revision: 1, snapshot: { source: 'mock_ettn', amount_minor: 2000, automation: { id: 9, provider_uuid: 'same-uuid', approval_snapshot_hash: 'approval-hash', external_id: 'MOCK-ETTN-9', shipment_id: 4, tracking_number: 'MOCK-TTN', condition: 'mock_delivery_confirmed' } } }
  let release, documentReads = 0
  const delayed = new Promise(resolve => { release = resolve })
  const api = { getEttnMockProjects: async order => ({ ...safety, owner: order === 321 ? 'checkbox_ettn' : null, available: false, allowed_actions: [], blocking_reasons: [], items: order === 321 ? [project] : [] }), getFiscalMockDocument: async () => { documentReads++; return delayed } }
  const fiscal = await importSource(await readFile(new URL('../utils/fiscalMock.ts', import.meta.url), 'utf8'))
  const utils = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, fiscal, utils, { useAuthStore: () => auth, localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } })
  const command = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(command), { defineProps: () => props, defineEmits: () => () => {}, useBackofficeApi: () => api })
  const component = await readFile(new URL('../components/orders/OrderEttnMock.vue', import.meta.url), 'utf8')
  const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const state = await scope.run(() => importSource(script + '\nexport { linkedDocumentMatches, linkedDocuments, linkedErrors, state };'))
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(documentReads, 1)
  assert.equal(state.linkedDocumentMatches(project, document), true)
  assert.equal(state.linkedDocumentMatches({ ...project, order_id: 322 }, { ...document, order_id: 322 }), false)
  for (const patch of [{ order_id: 322 }, { automation_id: 10 }, { source: 'manual' }, { provider_uuid: 'different' }, { status: 'queued' }, { is_sent_dps: true }]) assert.equal(state.linkedDocumentMatches(project, { ...document, ...patch }), false)
  for (const patch of [{ id: 10 }, { approval_snapshot_hash: 'different' }, { shipment_id: 5 }, { tracking_number: 'different' }, { condition: 'real_delivery' }]) assert.equal(state.linkedDocumentMatches(project, { ...document, snapshot: { ...document.snapshot, automation: { ...document.snapshot.automation, ...patch } } }), false)
  assert.equal(state.linkedDocumentMatches({ ...project, allowed_actions: [] }, document), false)
  assert.equal(state.linkedDocumentMatches(project, { ...document, snapshot: { ...document.snapshot, amount_minor: 9999 } }), false)
  auth.user = { id: 2, is_superuser: true }; props.order = { id: 322, revision: 2, shipments: [] }
  release(document); await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(state.linkedDocuments.value, {})
  assert.deepEqual(state.linkedErrors.value, [])
  assert.equal(state.state.value.owner, null)
  assert.equal(documentReads, 1)
  scope.stop()
})
