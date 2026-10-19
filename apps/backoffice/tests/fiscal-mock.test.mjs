import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../utils/fiscalMock.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const utils = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
test('fiscal labels distinguish unknown, error and issued MOCK from preliminary documents', () => {
  const labels = ['queued', 'unknown', 'issued', 'error', 'unexpected'].map(utils.fiscalStatusLabel)
  assert.equal(new Set(labels).size, 5)
  for (const label of labels) { assert.match(label, /MOCK/); assert.doesNotMatch(label, /Попередній/) }
  assert.match(labels[2], /не надсилалось до ДПС/)
  assert.match(utils.fiscalDeliveryLabel('failed'), /Помилка локального/)
  assert.match(utils.fiscalDeliveryLabel('delivered'), /Локальний показ/)
})
test('approval identity changes with every actor order revision register preview hash and shift change', () => {
  const preview = { id: 8, snapshot_hash: 'hash-1', shift_revision: 2 }
  const identity = (...values) => utils.fiscalApprovalIdentity(...values)
  const baseline = identity(1, 2, 3, 'MOCK-KASA-1', preview)
  for (const values of [[2,2,3,'MOCK-KASA-1',preview],[1,4,3,'MOCK-KASA-1',preview],[1,2,4,'MOCK-KASA-1',preview],[1,2,3,'other',preview],[1,2,3,'MOCK-KASA-1',{...preview,id:9}],[1,2,3,'MOCK-KASA-1',{...preview,snapshot_hash:'hash-2'}],[1,2,3,'MOCK-KASA-1',{...preview,shift_revision:3}],[1,2,3,'MOCK-KASA-1',null]]) assert.notEqual(identity(...values), baseline)
  assert.equal(utils.fiscalMoney(12345), '123.45 грн')
})

test('actual panel drops delayed preview reads and unsent approval when actor or order changes', async () => {
  const require = createRequire(import.meta.url)
  const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
  const values = new Map()
  const auth = vue.reactive({ user: { id: 1, is_superuser: true } })
  const props = vue.reactive({ order: { id: 321, revision: 2 } })
  let releaseRead
  const deferred = new Promise(resolve => { releaseRead = resolve })
  let reads = 0, submissions = 0
  const api = {
    getFiscalMockReadiness: async () => ({ mode: 'mock_only', available: true, blocking_reasons: [], cash_registers: [{ id: 'MOCK-KASA-1', credential_kind: 'mock', shift_status: 'open', shift_revision: 1 }] }),
    getFiscalMockDocuments: async () => [],
    createFiscalMockPreview: async () => ({ id: 7 }),
    getFiscalMockPreview: async () => { reads++; return deferred },
    submitFiscalMock: async () => { submissions++; return { id: 9 } },
  }
  const salesSource = await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8')
  const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const importSource = async source => import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`)
  const salesUtils = await importSource(salesSource)
  Object.assign(globalThis, vue, utils, salesUtils, {
    useAuthStore: () => auth,
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  })
  const commandSource = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(commandSource), { defineProps: () => props, defineEmits: () => () => {}, useBackofficeApi: () => api })
  const component = await readFile(new URL('../components/orders/OrderFiscalMock.vue', import.meta.url), 'utf8')
  const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const state = await scope.run(() => importSource(script + '\nexport { preview, confirmed, createPreview, queue, canSubmit, documents };'))
  await new Promise(resolve => setTimeout(resolve, 0))
  const pending = state.createPreview()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(reads, 1)
  state.confirmed.value = true
  auth.user = { id: 2, is_superuser: true }
  props.order = { id: 322, revision: 3 }
  assert.equal(state.confirmed.value, false)
  releaseRead({ id: 7, order_id: 321, revision: 2, cash_register_id: 'MOCK-KASA-1', shift_revision: 1, snapshot_hash: 'hash', allowed_actions: ['submit'], blocking_reasons: [], expires_at: '2099-01-01T00:00:00Z' })
  await pending
  assert.equal(state.preview.value, null)
  assert.equal(state.canSubmit.value, false)
  await state.queue()
  assert.equal(submissions, 0)
  assert.equal([...values.keys()].some(key => key.includes(':1:fiscal-preview:321')), true)
  assert.equal([...values.keys()].some(key => key.includes(':2:fiscal-preview:322')), false)
  scope.stop()
})

test('fiscal definitive rejections clear only confirmed pre-acceptance conflicts and retain unknown/auth/idempotency outcomes', async () => {
  const source = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const { useOrderSalesCommand } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  for (const code of utils.fiscalDefinitiveRejections) {
    const command = useOrderSalesCommand(`rejection-${code}`, '321', utils.fiscalDefinitiveRejections)
    await command.execute({ expected_revision: 2 }, async () => { throw { status: 409, data: { detail: { code } } } }, () => {})
    assert.equal(command.intent.value, null, code)
  }
  for (const [status, code] of [[409,'mock_fiscal_disabled'],[409,'idempotency_conflict'],[409,'mock_receipt_mismatch'],[403,'stale_preview'],[500,'stale_preview'],[undefined,undefined]]) {
    const command = useOrderSalesCommand(`unknown-${status}-${code}`, '321', utils.fiscalDefinitiveRejections)
    await command.execute({ expected_revision: 2 }, async () => { throw { status, data: { detail: { code } } } }, () => {})
    assert.ok(command.intent.value, `${status} ${code}`)
  }
  const modeChange = useOrderSalesCommand('mode-change-after-timeout', '321', utils.fiscalDefinitiveRejections)
  const sends = []
  await modeChange.execute({ expected_revision: 2, confirm: true }, async (body, key) => { sends.push({ body, key }); throw new Error('network timeout after acceptance') }, () => {})
  await modeChange.execute({ expected_revision: 99 }, async (body, key) => { sends.push({ body, key }); throw { status: 409, data: { detail: { code: 'mock_fiscal_disabled' } } } }, () => {})
  assert.ok(modeChange.intent.value)
  await modeChange.execute({ expected_revision: 100 }, async (body, key) => { sends.push({ body, key }); return { id: 9 } }, () => modeChange.clear())
  assert.deepEqual(sends[0], sends[1])
  assert.deepEqual(sends[0], sends[2])
  assert.equal(modeChange.intent.value, null)
  const previousCaller = useOrderSalesCommand('old-default-caller', '321')
  await previousCaller.execute({}, async () => { throw { status: 409, data: { detail: { code: 'stale_preview' } } } }, () => {})
  assert.ok(previousCaller.intent.value)
})
