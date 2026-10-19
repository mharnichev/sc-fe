import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
let moduleId = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source + `\n// runtime ${moduleId++}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`)
const safe = { mode: 'mock_only', provider_contract: 'unknown', simulation: true, is_sent_dps: false }
const original = { key: 'original-accepted-approval', body: { preview_id: 7, expected_revision: 2, snapshot_hash: 'original-hash', cash_register_id: 'MOCK-KASA-1', confirm: true, mock_outcome: 'accepted' } }
const load = async (component, operation, api, { actor = 1, pending = true } = {}) => {
  const auth = vue.reactive({ user: { id: actor, is_superuser: true } }), props = vue.reactive({ order: { id: 321, revision: 8, simulation: true, shipments: [] } })
  const cleanup = []
  const storage = new Map(pending ? [[`sc-sales:v1:1:${operation}:321`, JSON.stringify(original)]] : [])
  const fiscal = await importSource(await readFile(new URL('../utils/fiscalMock.ts', import.meta.url), 'utf8'))
  const utils = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, fiscal, utils, { useAuthStore: () => auth, defineProps: () => props, defineEmits: () => () => {}, useBackofficeApi: () => api,
    onBeforeUnmount: callback => cleanup.push(callback), localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
  const command = (await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  Object.assign(globalThis, await importSource(command))
  const source = await readFile(new URL(`../components/orders/${component}.vue`, import.meta.url), 'utf8')
  const script = source.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const exports = component === 'OrderFiscalMock' ? 'queue, submit, transition, runDocument, unresolved, canFiscalize, documents' : 'approve, arm, transition, run, unresolved, state'
  const scope = vue.effectScope()
  const state = await scope.run(() => importSource(script + `\nexport { ${exports} };`))
  await new Promise(resolve => setTimeout(resolve, 0))
  return { state, storage, stop: () => { cleanup.forEach(callback => callback()); scope.stop() } }
}

test('actual fiscal panel recovers an accepted submission with its exact key when new approvals are disabled', async () => {
  const sends = [], commands = [], document = { id: 9, status: 'unknown', kind: 'sale', allowed_actions: ['process'] }
  const api = {
    getFiscalMockReadiness: async () => ({ mode: 'mock_only', available: false, blocking_reasons: ['mock_fiscal_disabled'], cash_registers: [{ id: 'MOCK-KASA-1', credential_kind: 'mock', shift_status: 'open', shift_revision: 1 }] }),
    getFiscalMockDocuments: async () => [document],
    submitFiscalMock: async (id, body, key) => { sends.push({ id, body, key }); return { id: 9 } },
    runFiscalMockDocument: async (id, operation, body, key) => { commands.push({ id, operation, body, key }); return { id } },
  }
  const page = await load('OrderFiscalMock', 'fiscal-submit', api)
  assert.equal(page.state.unresolved.value, true)
  assert.equal(page.state.canFiscalize.value, false)
  await page.state.queue()
  assert.deepEqual(sends, [{ id: 321, body: original.body, key: original.key }])
  assert.equal(page.state.submit.intent.value, null)
  await page.state.runDocument('process', document)
  assert.equal(commands.length, 1)
  await page.state.queue()
  assert.equal(sends.length, 1, 'flag-off recovery must not permit a fresh fiscal approval')
  page.stop()
})

test('actual ETTN panel retains unknown consent on disabled rejection and recovers only its original approval', async () => {
  const sends = [], commands = [], project = { ...safe, id: 9, status: 'armed', revision: 2, allowed_actions: ['cancel', 'reconcile'] }
  let replayAvailable = false
  const api = {
    getEttnMockProjects: async () => ({ ...safe, owner: 'checkbox_ettn', available: false, blocking_reasons: ['mock_automation_disabled'], allowed_actions: [], items: [project] }),
    armEttnMock: async (id, body, key) => { sends.push({ id, body, key }); if (!replayAvailable) throw { status: 409, data: { detail: { code: 'mock_automation_disabled' } } }; return { id: 9 } },
    runEttnMockProject: async (id, operation, body, key) => { commands.push({ id, operation, body, key }); return { id } },
  }
  const page = await load('OrderEttnMock', 'ettn-arm', api)
  await page.state.approve()
  assert.deepEqual(page.state.arm.intent.value, original)
  assert.equal(commands.length, 0)
  replayAvailable = true
  await page.state.approve()
  assert.deepEqual(sends[1], sends[0])
  assert.equal(page.state.arm.intent.value, null)
  await page.state.run('cancel', project)
  assert.equal(commands.length, 1)
  await page.state.approve()
  assert.equal(sends.length, 2, 'flag-off recovery must not permit fresh ETTN consent')
  page.stop()
})


for (const component of ['OrderFiscalMock', 'OrderEttnMock']) {
  for (const blocked of ['actor', 'mode', 'fresh']) {
    test(`actual ${component} recovery blocks ${blocked} context while approvals are disabled`, async () => {
      const sends = []
      const api = {
        getFiscalMockReadiness: async () => ({ mode: blocked === 'mode' ? 'live' : 'mock_only', available: false, cash_registers: [{ id: 'MOCK-KASA-1', credential_kind: 'mock' }] }),
        getFiscalMockDocuments: async () => [],
        getEttnMockProjects: async () => ({ ...safe, mode: blocked === 'mode' ? 'live' : 'mock_only', available: false, items: [], allowed_actions: [], blocking_reasons: [], owner: null }),
        submitFiscalMock: async (...args) => { sends.push(args); return { id: 9 } },
        armEttnMock: async (...args) => { sends.push(args); return { id: 9 } },
      }
      const fiscal = component === 'OrderFiscalMock'
      const page = await load(component, fiscal ? 'fiscal-submit' : 'ettn-arm', api, { actor: blocked === 'actor' ? 2 : 1, pending: blocked !== 'fresh' })
      if (fiscal) await page.state.queue()
      else await page.state.approve()
      assert.equal(sends.length, 0)
      if (blocked === 'mode') assert.deepEqual(fiscal ? page.state.submit.intent.value : page.state.arm.intent.value, original)
      page.stop()
    })
  }
}


for (const component of ['OrderFiscalMock', 'OrderEttnMock']) {
  test(`actual ${component} ignores delayed reads after unmount`, async () => {
    let complete
    const response = new Promise(resolve => { complete = resolve })
    const api = {
      getFiscalMockReadiness: async () => ({ mode: 'mock_only', available: false, cash_registers: [] }),
      getFiscalMockDocuments: async () => response,
      getEttnMockProjects: async () => response,
    }
    const fiscal = component === 'OrderFiscalMock'
    const page = await load(component, fiscal ? 'fiscal-submit' : 'ettn-arm', api, { pending: false })
    page.stop()
    complete(fiscal ? [{ id: 9, kind: 'sale' }] : { ...safe, available: false, items: [], allowed_actions: [], owner: 'checkbox_ettn' })
    await new Promise(resolve => setTimeout(resolve, 0))
    if (fiscal) assert.deepEqual(page.state.documents.value, [])
    else assert.equal(page.state.state.value, null)
  })
}
