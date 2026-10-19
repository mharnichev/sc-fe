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
Object.assign(globalThis, await importSource(await readFile(new URL('../composables/useBackofficeAccess.ts', import.meta.url), 'utf8')))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const ready = { mode: 'mock_only', available: true, cash_registers: [{ id: 'MOCK-KASA-1', credential_kind: 'mock', shift_status: 'open' }] }
const attempt = (id = 7, order_id = 321) => ({ id, order_id, revision: 1, mode: 'mock_only', simulation: true, amount_minor: 12345, currency: 'UAH', payment_status: 'waiting', receipt_status: 'pending', allowed_actions: ['refresh', 'cancel', 'simulate'], snapshot: {}, local_payment_path: `/orders/qr-simulator/${id}` })
const setup = async (api, values = new Map()) => {
  const auth = vue.reactive({ user: { id: 1, is_active: true, can_record_sales: true, can_accept_qr_payments: true }, accessToken: 'token-A' })
  const props = vue.reactive({ order: { id: 321, revision: 1, simulation: true, payment_status: 'unpaid' } })
  const unmount = [], events = []
  const sales = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  const sandbox = await importSource(await readFile(new URL('../utils/qrProviderSandbox.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, sales, sandbox, {
    useAuthStore: () => auth, useBackofficeApi: () => api,
    defineProps: () => props, defineEmits: () => (...event) => events.push(event), onBeforeUnmount: fn => unmount.push(fn),
    window: { location: { origin: 'http://127.0.0.1:6090' } },
    qrMockLocalUrl: (path, origin, id) => path === `/orders/qr-simulator/${id}` ? `${origin}${path}` : null,
    qrMockOwnsSale: item => !!item && !['cancelled', 'expired', 'declined'].includes(item.payment_status),
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  })
  Object.assign(globalThis, await importSource((await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')))
  const component = await readFile(new URL('../components/orders/OrderQrMock.vue', import.meta.url), 'utf8')
  const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const page = await scope.run(() => importSource(script + '\nexport { attempt, create, transition, confirmed, prepare, load, run, canCreate, canHandover, accept, selectedSource, sandboxReadiness, providerSandbox };'))
  await page.load()
  return { page, auth, props, values, events, stop: () => { unmount.forEach(fn => fn()); scope.stop() } }
}
for (const change of ['actor', 'order', 'token', 'rights', 'inactive', 'unmount']) test(`actual QR component fences accepted late create on ${change}`, async () => {
  const response = deferred(); let reads = 0
  const api = { getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => [], createOrderQrMockAttempt: async () => response.promise, getQrMockAttempt: async () => { reads++; return attempt() } }
  const state = await setup(api)
  state.page.confirmed.value = true
  const pending = state.page.prepare()
  if (change === 'actor') state.auth.user.id = 2
  if (change === 'order') state.props.order.id = 322
  if (change === 'token') state.auth.accessToken = 'token-B'
  if (change === 'rights') state.auth.user.can_accept_qr_payments = false
  if (change === 'inactive') state.auth.user.is_active = false
  if (change === 'unmount') state.stop()
  response.resolve(attempt()); await pending
  assert.equal(state.page.attempt.value, null)
  assert.equal(reads, 0)
  assert.equal(state.events.filter(event => event[0] === 'changed').length, 0)
  state.stop()
})
test('actual QR create recovery retains exact accepted body/key across reload and changed server revision', async () => {
  const values = new Map(), sent = []; let accepted = false
  const api = { getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => accepted ? [attempt()] : [], getQrMockAttempt: async () => attempt(), createOrderQrMockAttempt: async (id, body, key) => { sent.push({ id, body, key }); if (!accepted) { accepted = true; throw new Error('response lost') } return attempt() } }
  const first = await setup(api, values); first.page.confirmed.value = true; await first.page.prepare(); first.stop()
  const second = await setup(api, values); second.props.order.revision = 90; await second.page.prepare()
  assert.deepEqual(sent[1], sent[0]); assert.equal(second.page.attempt.value.id, 7); assert.equal(second.page.create.intent.value, null)
  second.stop()
})
test('actual QR component separates paid from receipt readiness and rejects stale revisions', async () => {
  const state = await setup({ getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => [] })
  state.page.accept({ ...attempt(), revision: 4, payment_status: 'paid', receipt_status: 'error' })
  assert.equal(state.page.canHandover.value, false); assert.equal(state.page.canCreate.value, false)
  state.page.accept({ ...attempt(), revision: 5, payment_status: 'paid', receipt_status: 'issued' }); assert.equal(state.page.canHandover.value, true)
  state.page.accept(attempt()); assert.equal(state.page.attempt.value.revision, 5)
  state.stop()
})

test('actual QR simulator replays the same event UUID, revision and body after an accepted timeout and reload', async () => {
  const values = new Map(), sent = []; let accepted = false
  const api = { getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => [{ ...attempt(), revision: accepted ? 5 : 1 }], getQrMockAttempt: async () => ({ ...attempt(), revision: 5 }), runQrMockAttempt: async (id, operation, body, key) => { sent.push({ id, operation, body, key }); if (!accepted) { accepted = true; throw new Error('lost accepted simulator response') } return { ...attempt(), revision: 5 } } }
  const first = await setup(api, values); first.props.simulator = true; await first.page.run('simulate'); first.stop()
  const second = await setup(api, values); second.props.simulator = true; await second.page.run('simulate')
  assert.deepEqual(sent[1], sent[0]); assert.match(sent[0].body.event_id, /^[a-f0-9-]{36}$/); assert.equal(sent[0].body.expected_revision, 1)
  assert.equal(second.page.transition.intent.value, null); second.stop()
})

test('actual QR initial read failure keeps manual fallback blocked until a successful reload', async () => {
  let offline = true
  const recovered = deferred()
  const state = await setup({
    getQrMockReadiness: async () => ready,
    getOrderQrMockAttempts: async () => { if (offline) throw new Error('offline'); return recovered.promise },
  })
  const owners = () => state.events.filter(event => event[0] === 'owner').map(event => event[1])
  assert.equal(state.page.attempt.value, null)
  assert.equal(owners().at(-1), true)
  assert.ok(owners().every(Boolean), 'failed initial reads must not release ownership to manual payment')
  offline = false
  const pending = state.page.load()
  assert.equal(owners().at(-1), true)
  recovered.resolve([])
  await pending
  assert.equal(owners().at(-1), false, 'only a successful empty attempt read releases ownership')
  state.stop()
})

test('actual QR recovery read failure preserves a known uncertain attempt and blocks a new QR', async () => {
  let failed = false
  const state = await setup({ getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => { if (failed) throw new Error('offline'); return [{ ...attempt(), payment_status: 'unknown' }] } })
  failed = true; await state.page.load()
  assert.equal(state.page.attempt.value.id, 7); assert.equal(state.page.canCreate.value, false)
  assert.equal(state.events.at(-1)?.[1], true)
  state.stop()
})


test('actual QR master component refuses a synthetic payment even when server advertises simulate', async () => {
  let commands = 0
  const state = await setup({ getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => [attempt()], runQrMockAttempt: async () => { commands++; return attempt() } })
  state.auth.user.role = 'barber'; state.auth.user.master_id = 11; state.props.simulator = true
  await state.page.run('simulate')
  assert.equal(commands, 0)
  assert.equal(state.page.transition.intent.value, null)
  state.stop()
})

const sandboxReady = { mode: 'provider_sandbox', available: true, blocking_reasons: [], verification: { monobank_provider_confirmed: false, monobank_policy: 'operator_attested_test_token_with_pinned_sha256', checkbox_provider_confirmed: true } }
const sandboxAttempt = (extra = {}) => ({ ...attempt(), mode: 'provider_sandbox', local_payment_path: '', payment_url: 'https://pay.mbnk.biz/testInvoice123', allowed_actions: ['refresh'], ...extra })
test('sandbox source requires separate available readiness; denial leaves local mock usable', async () => {
  const state = await setup({ getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => [], getProviderSandboxReadiness: async () => ({ ...sandboxReady, available: false }) })
  assert.equal(state.page.canCreate.value, true)
  state.page.selectedSource.value = 'provider_sandbox'; assert.equal(state.page.canCreate.value, false)
  state.stop()
})
test('sandbox source sends only the explicit sandbox endpoint and existing consent/revision payload', async () => {
  const sent = []
  const state = await setup({ getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => [], getProviderSandboxReadiness: async () => sandboxReady, createOrderSandboxQrAttempt: async (id, body, key) => { sent.push({ id, body, key }); return sandboxAttempt() }, getQrMockAttempt: async () => sandboxAttempt(), createOrderQrMockAttempt: async () => { throw new Error('mock fallback forbidden') } })
  state.page.selectedSource.value = 'provider_sandbox'; state.page.confirmed.value = true; await state.page.prepare()
  assert.equal(sent.length, 1); assert.deepEqual(sent[0].body, { expected_revision: 1, confirm: true, cash_register_id: 'MOCK-KASA-1' }); assert.ok(sent[0].key)
  assert.equal(state.page.attempt.value.mode, 'provider_sandbox'); state.stop()
})
test('lost sandbox create is reconciled by GET after reload without repeating any create POST', async () => {
  const values = new Map(); let sent = 0, accepted = false
  const api = { getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => accepted ? [sandboxAttempt({ payment_status: 'unknown', payment_url: null })] : [], getProviderSandboxReadiness: async () => sandboxReady, createOrderSandboxQrAttempt: async () => { sent++; accepted = true; throw new Error('lost create response') } }
  const first = await setup(api, values); first.page.selectedSource.value = 'provider_sandbox'; first.page.confirmed.value = true; await first.page.prepare(); first.stop()
  const second = await setup(api, values); await second.page.prepare()
  assert.equal(sent, 1); assert.equal(second.page.create.intent.value, null); assert.equal(second.page.attempt.value.payment_status, 'unknown'); assert.equal(second.page.canCreate.value, false); second.stop()
})
test('sandbox refresh recovers exact key and revision while synthetic mutation remains blocked', async () => {
  const values = new Map(), sent = []; let lost = true
  const api = { getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => [sandboxAttempt({ allowed_actions: ['refresh', 'cancel', 'simulate'], revision: lost ? 1 : 4 })], getProviderSandboxReadiness: async () => sandboxReady, getQrMockAttempt: async () => sandboxAttempt({ revision: 4 }), refreshSandboxQrAttempt: async (id, body, key) => { sent.push({ id, body, key }); if (lost) { lost = false; throw new Error('lost refresh') } return sandboxAttempt({ revision: 4 }) }, runQrMockAttempt: async () => { throw new Error('local mutation forbidden') } }
  const first = await setup(api, values); first.props.simulator = true; await first.page.run('simulate'); await first.page.run('cancel'); await first.page.run('refresh'); first.stop()
  const second = await setup(api, values); await second.page.run('refresh')
  assert.equal(sent.length, 2); assert.deepEqual(sent[0], sent[1]); assert.deepEqual(sent[0].body, { expected_revision: 1 }); second.stop()
})
for (const change of ['actor', 'order', 'token', 'rights', 'inactive', 'unmount']) test(`sandbox component fences late create on ${change}`, async () => {
  const response = deferred(); let reads = 0
  const state = await setup({ getQrMockReadiness: async () => ready, getOrderQrMockAttempts: async () => [], getProviderSandboxReadiness: async () => sandboxReady, createOrderSandboxQrAttempt: async () => response.promise, getQrMockAttempt: async () => { reads++; return sandboxAttempt() } })
  state.page.selectedSource.value = 'provider_sandbox'; state.page.confirmed.value = true; const pending = state.page.prepare()
  if (change === 'actor') state.auth.user.id = 2
  if (change === 'order') state.props.order.id = 322
  if (change === 'token') state.auth.accessToken = 'token-B'
  if (change === 'rights') state.auth.user.can_accept_qr_payments = false
  if (change === 'inactive') state.auth.user.is_active = false
  if (change === 'unmount') state.stop()
  response.resolve(sandboxAttempt()); await pending
  assert.equal(state.page.attempt.value, null); assert.equal(reads, 0); state.stop()
})
test('sandbox paid pending receipt retains ownership and blocks new invoice and handover', async () => {
  const state = await setup({ getQrMockReadiness: async () => ready, getProviderSandboxReadiness: async () => sandboxReady, getOrderQrMockAttempts: async () => [sandboxAttempt({ payment_status: 'paid', receipt_status: 'pending' })] })
  assert.equal(state.page.canCreate.value, false); assert.equal(state.page.canHandover.value, false)
  state.page.accept(sandboxAttempt({ payment_status: 'paid', receipt_status: 'issued', revision: 2 })); assert.equal(state.page.canHandover.value, true); state.stop()
})
