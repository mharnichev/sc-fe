import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'))
const vue = await import(pathToFileURL(nuxtRequire.resolve('vue')).href)
const compiler = await import(pathToFileURL(nuxtRequire.resolve('@vue/compiler-sfc')).href)
let sequence = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}#${sequence++}`)
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const fixture = extra => ({ order_id: 321, revision: 1, mode: 'mono_checkbox', enabled: true, paid: false, receipt_accepted: false, status: 'not_started', amount_minor: 12345, invoice_id: null, payment_url: null, receipt_pdf_path: null, can_handover: false, blocking_reasons: [], ...extra })
const source = await readFile(new URL('../components/orders/OrderMasterMono.vue', import.meta.url), 'utf8')
test('master provider URL renders as a decodable QR, not a simulator payload', async () => {
  const zxing = require('@zxing/library')
  Object.assign(globalThis, zxing)
  const utils = await importSource((await readFile(new URL('../utils/qrMock.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
  const url = 'https://pay.mbnk.biz/invoice-321'
  const { size, path } = utils.qrMockCode(url)
  const pixels = new Int32Array(size * size).fill(0xffffff)
  for (const match of path.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) pixels[Number(match[2]) * size + Number(match[1])] = 0
  const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(pixels, size, size)))
  // These are generated, axis-aligned modules, not a camera image.
  assert.equal(new zxing.QRCodeReader().decode(bitmap, new Map([[zxing.DecodeHintType.PURE_BARCODE, true]])).getText(), url)
})
const setup = async (api, values = new Map()) => {
  const auth = vue.reactive({ user: { id: 1, is_active: true, can_record_sales: true, can_accept_qr_payments: true, role: 'barber', master_id: 11 }, accessToken: 'token-A' })
  const props = vue.reactive({ order: { id: 321, revision: 1, simulation: false, channel: 'backoffice_pos', status: 'pending' }, blocked: false })
  const unmount = [], events = [], timers = new Map(); let timerSequence = 0
  const sales = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, sales, {
    qrCode: value => ({ size: 21, path: value }),
    useAuthStore: () => auth, useBackofficeApi: () => api, useBackofficeAccess: () => ({ isBarber: vue.computed(() => auth.user.role === 'barber') }),
    defineProps: () => props, defineEmits: () => (...event) => events.push(event), onBeforeUnmount: fn => unmount.push(fn),
    setTimeout: (fn, ms) => { assert.equal(ms, 3000); timers.set(++timerSequence, fn); return timerSequence }, clearTimeout: id => timers.delete(id),
    window: { open: () => ({ close() {}, location: { replace() {} } }) },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  })
  Object.assign(globalThis, await importSource((await readFile(new URL('../utils/masterMono.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '')))
  Object.assign(globalThis, await importSource((await readFile(new URL('../composables/useOrderSalesCommand.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')))
  const script = source.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope()
  const page = await scope.run(() => importSource(script + '\nexport { state, selected, start, refresh, canStart, run, load, accept, print, readError, ready, paymentUrl, paymentQr, canPrint, handoverAllowed, creationUnknown };'))
  await page.load()
  return { page, auth, props, values, events, timers, stop: () => { unmount.forEach(fn => fn()); scope.stop() } }
}
test('Vue compiles direct panel and integration page', async () => {
  for (const [filename, content] of [['OrderMasterMono.vue', source], ['order-page.vue', await readFile(new URL('../pages/orders/[id].vue', import.meta.url), 'utf8')]]) {
    const { descriptor, errors } = compiler.parse(content, { filename }); assert.deepEqual(errors, [])
    const script = compiler.compileScript(descriptor, { id: filename })
    assert.deepEqual(compiler.compileTemplate({ source: descriptor.template.content, filename, id: filename, compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
  }
})
test('lost start response replays exact key and body across remount and changed revision', async () => {
  const values = new Map(), sent = []; let accepted = false
  const api = { getMasterMonoState: async () => fixture({ revision: 1 }), startMasterMono: async (id, body, key) => { sent.push({ id, body, key }); if (!accepted) { accepted = true; throw new Error('response lost') } return fixture({ revision: 3, invoice_id: 'synthetic-1' }) } }
  const first = await setup(api, values); await first.page.run('start'); assert.ok(first.page.start.intent.value); first.stop()
  const second = await setup(api, values); second.props.order.revision = 90; await second.page.run('start')
  assert.deepEqual(sent[1], sent[0]); assert.equal(sent[0].body.expected_revision, 1); assert.ok(sent[0].key); assert.equal(second.page.start.intent.value, null); second.stop()
})
for (const change of ['actor', 'order', 'token', 'rights', 'inactive', 'unmount']) test(`late start is fenced on ${change}`, async () => {
  const response = deferred()
  const state = await setup({ getMasterMonoState: async () => fixture(), startMasterMono: async () => response.promise })
  const pending = state.page.run('start')
  if (change === 'actor') state.auth.user.id = 2
  if (change === 'order') state.props.order.id = 322
  if (change === 'token') state.auth.accessToken = 'token-B'
  if (change === 'rights') state.auth.user.can_accept_qr_payments = false
  if (change === 'inactive') state.auth.user.is_active = false
  if (change === 'unmount') state.stop()
  response.resolve(fixture({ invoice_id: 'stale-invoice' })); await pending
  assert.notEqual(state.page.state.value?.invoice_id, 'stale-invoice'); assert.equal(state.events.filter(event => event[0] === 'changed').length, 0)
  if (change !== 'unmount') state.stop()
})
test('polls GET only, coalesces concurrent reads, and stops on unmount', async () => {
  let count = 0, pending = null
  const state = await setup({ getMasterMonoState: async () => { count++; return pending ? pending.promise : fixture({ invoice_id: 'synthetic' }) } })
  const initialReads = count; assert.equal(state.timers.size, 1)
  pending = deferred(); const tick = [...state.timers.values()][0]; state.timers.clear(); tick()
  const one = state.page.load(), two = state.page.load(); assert.equal(one, two); assert.equal(count, initialReads + 1); assert.equal(state.timers.size, 0)
  pending.resolve(fixture({ invoice_id: 'synthetic', revision: 2 })); await one
  assert.equal(state.timers.size, 1); state.stop(); assert.equal(state.timers.size, 0)
})
test('disabled state retains live ownership without a simulator fallback', async () => {
  const state = await setup({ getMasterMonoState: async () => fixture({ enabled: false }) })
  assert.equal(state.page.selected.value, true); assert.equal(state.page.ready.value, true); assert.equal(state.page.canStart.value, false)
  state.page.accept(fixture({ enabled: false, invoice_id: 'existing', paid: true, revision: 2 }))
  assert.equal(state.page.selected.value, true); assert.equal(state.page.canStart.value, false); state.stop()
})
test('paid pending receipt never creates another invoice, and unsafe concurrent actions are blocked', async () => {
  let starts = 0, refreshes = 0
  const state = await setup({ getMasterMonoState: async () => fixture({ invoice_id: 'existing', paid: true }), startMasterMono: async () => { starts++; return fixture() }, refreshMasterMono: async () => { refreshes++; return fixture() } })
  assert.equal(state.page.canStart.value, false); await state.page.run('start'); assert.equal(starts, 0)
  state.props.blocked = true; await state.page.run('refresh'); assert.equal(refreshes, 0)
  state.page.accept(fixture({ revision: 4, invoice_id: 'existing', paid: true, receipt_accepted: true, can_handover: true })); state.page.accept(fixture({ revision: 2 }))
  assert.equal(state.page.state.value.revision, 4); assert.equal(state.page.state.value.can_handover, true); state.stop()
})
test('read failure cannot release ownership or start a payment; recovery uses GET', async () => {
  let failed = false, starts = 0
  const state = await setup({ getMasterMonoState: async () => { if (failed) throw new Error('offline'); return fixture() }, startMasterMono: async () => { starts++; return fixture() } })
  failed = true; await state.page.load(); await state.page.run('start')
  assert.equal(starts, 0); assert.equal(state.page.selected.value, true); assert.ok(state.page.readError.value)
  failed = false; await state.page.load(); assert.equal(state.page.readError.value, ''); state.stop()
})
test('API PDF uses fixed authenticated order route and blob response', async () => {
  const api = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')
  assert.match(api, /getMasterMonoReceiptPdf = \(id: number\) => api<Blob>\(`\/backoffice\/master-mono\/orders\/\$\{id\}\/receipt\/pdf`, \{ responseType: 'blob', retry: 0 \}\)/)
  assert.doesNotMatch(source, /fetch\(|receipt_pdf_path\s*\)|location\.replace\(state/)
})

test('lost manual refresh replays exact key, revision and body', async () => {
  const values = new Map(), sent = []; let accepted = false
  const api = { getMasterMonoState: async () => fixture({ revision: 1, invoice_id: 'fixture-invoice' }), refreshMasterMono: async (id, body, key) => { sent.push({ id, body, key }); if (!accepted) { accepted = true; throw new Error('response lost') } return fixture({ revision: 5, invoice_id: 'synthetic' }) } }
  const first = await setup(api, values); await first.page.run('refresh'); first.stop()
  const second = await setup(api, values); await second.page.run('refresh')
  assert.deepEqual(sent[1], sent[0]); assert.equal(sent[0].body.expected_revision, 1); assert.equal(second.page.refresh.intent.value, null); second.stop()
})
test('permission removal clears state and stops poll without accepting late GET', async () => {
  let pending = null
  const state = await setup({ getMasterMonoState: async () => pending ? pending.promise : fixture({ invoice_id: 'synthetic' }) })
  pending = deferred(); const reading = state.page.load(); state.auth.user.can_accept_qr_payments = false
  pending.resolve(fixture({ invoice_id: 'stale' })); await reading
  assert.equal(state.page.state.value, null); assert.equal(state.timers.size, 0); assert.equal(state.page.selected.value, false); state.stop()
})

test('QR only encodes the exact canonical provider URL and PDF requires the fixed order path', async () => {
  const state = await setup({ getMasterMonoState: async () => fixture({ status: 'waiting', invoice_id: 'invoice-1', payment_url: 'https://pay.mbnk.biz/invoice-1' }) })
  assert.equal(state.page.paymentUrl.value, 'https://pay.mbnk.biz/invoice-1'); assert.equal(state.page.paymentQr.value.path, 'https://pay.mbnk.biz/invoice-1')
  for (const payment_url of ['https://evil.test/invoice-1', 'https://pay.mbnk.biz/invoice-2', 'https://user@pay.mbnk.biz/invoice-1', 'https://pay.mbnk.biz:443/invoice-1', 'https://pay.mbnk.biz:/invoice-1', 'https://pay.mbnk.biz/invoice-1?q=1', 'https://pay.mbnk.biz/invoice-1#x', 'http://pay.mbnk.biz/invoice-1', 'https://pay.mbnk.biz/invoice-1/', 'https://pay.mbnk.biz/invoice-1\n', null]) {
    state.page.accept(fixture({ revision: 2, status: 'waiting', invoice_id: 'invoice-1', payment_url })); assert.equal(state.page.paymentQr.value, null)
  }
  state.page.accept(fixture({ revision: 3, invoice_id: 'invoice-1', paid: true, receipt_accepted: true, receipt_pdf_path: 'https://evil.test/check.pdf' }))
  assert.equal(state.page.canPrint.value, false)
  state.page.accept(fixture({ revision: 4, invoice_id: 'invoice-1', paid: true, receipt_accepted: true, receipt_pdf_path: '/api/v1/backoffice/master-mono/orders/322/receipt/pdf' }))
  assert.equal(state.page.canPrint.value, false)
  state.page.accept(fixture({ revision: 5, invoice_id: 'invoice-1', paid: true, receipt_accepted: true, receipt_pdf_path: '/api/v1/backoffice/master-mono/orders/321/receipt/pdf' }))
  assert.equal(state.page.canPrint.value, true); assert.equal(state.page.paymentQr.value, null)
  state.page.accept(fixture({ revision: 6, invoice_id: 'invoice-1\n', payment_url: 'https://pay.mbnk.biz/invoice-1\n' })); assert.equal(state.page.paymentQr.value, null); state.stop()
})
test('unknown invoice creation never sends another POST or enables handover', async () => {
  const calls = []
  const state = await setup({ getMasterMonoState: async () => fixture({ status: 'creation_unknown', can_handover: true }), startMasterMono: async () => { calls.push('start') }, refreshMasterMono: async () => { calls.push('refresh') } })
  assert.equal(state.page.creationUnknown.value, true); assert.equal(state.page.canStart.value, false); assert.equal(state.page.handoverAllowed.value, false)
  await state.page.run('start'); await state.page.run('refresh'); assert.deepEqual(calls, []); state.stop()
})
test('server-observed invoice resolves lost start without another POST or key', async () => {
  const values = new Map(); let created = false, starts = 0
  const api = { getMasterMonoState: async () => created ? fixture({ revision: 2, invoice_id: 'invoice-1', payment_url: 'https://pay.mbnk.biz/invoice-1', status: 'waiting' }) : fixture(), startMasterMono: async () => { starts++; created = true; throw new Error('reply lost') } }
  const first = await setup(api, values); await first.page.run('start'); assert.ok(first.page.start.intent.value); first.stop()
  const second = await setup(api, values); assert.equal(second.page.start.intent.value, null); await second.page.run('start'); assert.equal(starts, 1); assert.equal(second.page.paymentUrl.value, 'https://pay.mbnk.biz/invoice-1'); second.stop()
})
test('handover requires current payment and accepted receipt, and read errors revoke it', async () => {
  let offline = false
  const state = await setup({ getMasterMonoState: async () => { if (offline) throw new Error('offline'); return fixture({ paid: true, receipt_accepted: true, can_handover: true }) } })
  assert.equal(state.page.handoverAllowed.value, true)
  state.page.accept(fixture({ revision: 2, paid: true, receipt_accepted: false, can_handover: true })); assert.equal(state.page.handoverAllowed.value, false)
  offline = true; await state.page.load(); assert.equal(state.page.handoverAllowed.value, false); state.stop()
})
for (const change of ['admin', 'simulation', 'channel', 'sales-rights']) test(`panel cannot act after ${change}`, async () => {
  let starts = 0
  const state = await setup({ getMasterMonoState: async () => fixture(), startMasterMono: async () => { starts++; return fixture() } })
  if (change === 'admin') state.auth.user.role = 'admin'
  if (change === 'simulation') state.props.order.simulation = true
  if (change === 'channel') state.props.order.channel = 'shop'
  if (change === 'sales-rights') state.auth.user.can_record_sales = false
  await state.page.run('start'); assert.equal(starts, 0); assert.equal(state.page.state.value, null); assert.equal(state.page.paymentQr.value, null); assert.equal(state.timers.size, 0); state.stop()
})
test('production master panel has no simulator command, selector or synthetic payload', async () => {
  const api = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /simulateMasterMono|runSimulation|BaseSelect|synthetic|soulcuts-mono-mock/)
  assert.doesNotMatch(source.split('<template>')[1], /MOCK|тестов/i)
  assert.doesNotMatch(api, /MasterMonoSimulate|MasterMonoMockOutcome|simulateMasterMono/)
})
test('master direct panel and readiness lock do not intercept administrator legacy POS', async () => {
  const page = await readFile(new URL('../pages/orders/[id].vue', import.meta.url), 'utf8')
  assert.match(page, /<OrderMasterMono v-if="isBarber && order.channel === 'backoffice_pos' && !order.simulation"/)
  assert.match(page, /isBarber.value && \(masterMonoSelected.value \|\| \(isPosSale.value && !masterMonoReady.value\)\)/)
  assert.match(page, /<OrderQrMock v-if="order.channel === 'backoffice_pos' && order.simulation && !isBarber"/)
})


test('changing from barber to administrator releases stale master ownership and busy state', async () => {
  const page = await readFile(new URL('../pages/orders/[id].vue', import.meta.url), 'utf8')
  const expression = page.match(/const qrOwnsSale = computed\(\(\) => (.+)\)/)[1]
  const evaluate = new Function('legacyQrOwnsSale', 'isBarber', 'masterMonoSelected', 'isPosSale', 'masterMonoReady', `return ${expression}`)
  const ref = value => ({ value })
  assert.equal(evaluate(ref(false),ref(true),ref(true),ref(true),ref(false)), true)
  assert.equal(evaluate(ref(false),ref(false),ref(true),ref(true),ref(false)), false)
  assert.match(page, /handoverCommand.busy.value \|\| \(isBarber.value && masterMonoBusy.value\)/)
})

const setupPos = async ({ live = true, actor = 'barber' } = {}) => {
  const auth = vue.reactive({ user: { id: 1, role: actor, is_active: true, can_record_sales: true, can_accept_qr_payments: true }, accessToken: 'token-A' })
  const calls = [], values = new Map(), unmount = []
  Object.assign(globalThis, vue, {
    useAuthStore: () => auth, useAssetUrl: () => String,
    useBackofficeAccess: () => ({ isBarber: vue.computed(() => auth.user.role === 'barber'), isAdmin: vue.computed(() => auth.user.role === 'admin') }),
    useBackofficeApi: () => ({ getPosCapabilities: async () => ({ mode: 'mono_checkbox', can_prepare: true, simulation_available: true, live_qr_available: live }), createPosOrder: async (body, key) => { calls.push({ body, key }); return { id: 321 } } }),
    useAsyncData: async (_key, handler) => ({ data: vue.ref(await handler()), error: vue.ref(null), refresh: async () => {} }),
    navigateTo: async () => {}, onBeforeUnmount: fn => unmount.push(fn),
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  })
  const source = await readFile(new URL('../pages/orders/pos.vue', import.meta.url), 'utf8')
  const script = source.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope(), page = await scope.run(() => importSource(script + '\nexport { rows, simulation, saleSimulation, canPrepare, prepare };'))
  page.rows.value.push({ product: { id: 8 }, quantity: 1 })
  return { page, calls, stop: () => { unmount.forEach(fn => fn()); scope.stop() } }
}
test('master POS prepares a real order and requires explicit live capability', async () => {
  const disabled = await setupPos({ live: false }); await disabled.page.prepare(); assert.deepEqual(disabled.calls, []); disabled.stop()
  const state = await setupPos(); state.page.simulation.value = true
  assert.equal(state.page.saleSimulation.value, false); await state.page.prepare()
  assert.equal(state.calls.length, 1); assert.equal(state.calls[0].body.simulation, false); assert.ok(state.calls[0].key); state.stop()
})

const setupHandoverPage = async ({ lostReply = false } = {}) => {
  const auth = vue.reactive({ user: { id: 1, role: 'barber', master_id: 11, is_active: true, can_record_sales: true, can_accept_qr_payments: true }, accessToken: 'token-A' })
  const values = new Map(), unmount = [], calls = [], route = vue.reactive({ params: { id: '321' } })
  let order = { id: 321, revision: 2, simulation: false, channel: 'backoffice_pos', status: 'confirmed', items: [], sales_actions: { can_handover: true } }
  const sales = await importSource(await readFile(new URL('../utils/orderSales.ts', import.meta.url), 'utf8'))
  const fiscal = await importSource(await readFile(new URL('../utils/shopFiscal.ts', import.meta.url), 'utf8'))
  Object.assign(globalThis, vue, sales, fiscal, {
    useAuthStore: () => auth, useAssetUrl: () => String, useRoute: () => route,
    useBackofficeAccess: () => ({ isBarber: vue.computed(() => auth.user.role === 'barber'), isAdmin: vue.computed(() => auth.user.role === 'admin') }),
    useBackofficeApi: () => ({ getOrder: async () => order, getOrderFulfillment: async () => ({ items: [] }), handoverOrder: async (_id, body, key) => {
      calls.push({ id: _id, body, key })
      if (lostReply && calls.length === 1) {
        order = { ...order, revision: 3, status: 'completed', sales_actions: { can_handover: false } }
        throw new Error('committed handover reply lost')
      }
      return { id: 321 }
    } }),
    useApi: () => async () => ({}), useBaseToastNotification: () => ({ success() {}, error() {} }),
    useBookingFormatting: () => ({ apiErrorMessage: () => 'error', formatDateTime: String, formatMoney: String }),
    useAsyncData: async (_key, handler) => ({ data: vue.ref(await handler()), pending: vue.ref(false), error: vue.ref(null) }),
    onBeforeUnmount: fn => unmount.push(fn),
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  })
  const source = await readFile(new URL('../pages/orders/[id].vue', import.meta.url), 'utf8')
  const script = source.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '').replace(/import\.meta\.client/g, 'true')
  const scope = vue.effectScope(), page = await scope.run(() => importSource(script + '\nexport { order, masterMonoHandoverAllowed, handoverEvidence, handover, handoverCommand, canUseHandover, reloadSales };'))
  return { page, auth, route, calls, values, stop: () => { unmount.forEach(fn => fn()); scope.stop() } }
}
test('actual order handover ignores stale sales flags until the live panel confirms both facts', async () => {
  const { page, auth, calls, stop } = await setupHandoverPage()
  page.handoverEvidence.value = 'explicit handover'
  await page.handover(); assert.equal(calls.length, 0)
  page.masterMonoHandoverAllowed.value = true
  auth.user.can_accept_qr_payments = false; await page.handover(); assert.equal(calls.length, 0)
  auth.user.can_accept_qr_payments = true; page.order.value.simulation = true; await page.handover(); assert.equal(calls.length, 0)
  page.order.value.simulation = false; await page.handover(); assert.equal(calls.length, 1); assert.equal(calls[0].body.expected_revision, 2); assert.ok(calls[0].key)
  stop()
})

test('lost committed handover replays its saved body and key after completed GET, under current authorization and order scope', async () => {
  const { page, auth, route, calls, values, stop } = await setupHandoverPage({ lostReply: true })
  page.masterMonoHandoverAllowed.value = true; page.handoverEvidence.value = 'original explicit handover'
  await page.handover(); assert.equal(calls.length, 1); assert.ok(page.handoverCommand.intent.value)
  await page.reloadSales(); page.masterMonoHandoverAllowed.value = false
  assert.equal(page.order.value.status, 'completed'); assert.equal(page.order.value.sales_actions.can_handover, false)
  assert.equal(page.canUseHandover.value, true)
  page.handoverEvidence.value = 'changed evidence must not replace saved request'
  for (const field of ['is_active', 'can_record_sales', 'can_accept_qr_payments']) {
    auth.user[field] = false; await page.handover(); assert.equal(calls.length, 1); auth.user[field] = true
  }
  auth.accessToken = ''; await page.handover(); assert.equal(calls.length, 1); auth.accessToken = 'token-B'
  auth.user.role = 'admin'; await page.handover(); assert.equal(calls.length, 1); auth.user.role = 'barber'
  auth.user.id = 2; await page.handover(); assert.equal(calls.length, 1); assert.equal(page.handoverCommand.intent.value, null); auth.user.id = 1
  // Even an intent for the next route cannot execute against a stale visible order.
  values.set(salesIntentStorageKey(1, 'handover', '322'), JSON.stringify({ key: 'next-order-intent', body: { expected_revision: 9, evidence: 'next order' } }))
  route.params.id = '322'; await page.handover(); assert.equal(calls.length, 1); assert.equal(page.canUseHandover.value, false)
  route.params.id = '321'; await page.handover()
  assert.equal(calls.length, 2); assert.deepEqual(calls[1], calls[0]); assert.equal(calls[1].body.expected_revision, 2)
  assert.equal(page.handoverCommand.intent.value, null)
  await page.handover(); assert.equal(calls.length, 2); stop()
})


test('polling a newer revision refreshes parent handover revision even when payment facts are unchanged', async () => {
  let revision = 1
  const state = await setup({ getMasterMonoState: async () => fixture({ revision, paid: true, receipt_accepted: true, can_handover: true }) })
  const initial = state.events.filter(event => event[0] === 'changed').length
  revision = 2; await state.page.load()
  assert.equal(state.page.handoverAllowed.value, false)
  assert.equal(state.events.filter(event => event[0] === 'changed').length, initial + 1)
  state.props.order.revision = 2
  assert.equal(state.page.handoverAllowed.value, true)
  await state.page.load(); assert.equal(state.events.filter(event => event[0] === 'changed').length, initial + 1)
  revision = 1; await state.page.load(); assert.equal(state.page.state.value.revision, 2)
  assert.equal(state.events.filter(event => event[0] === 'changed').length, initial + 1); state.stop()
})
