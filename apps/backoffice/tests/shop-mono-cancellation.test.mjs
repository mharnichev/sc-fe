import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vue = createRequire(require.resolve('nuxt/package.json'))('vue')
const source = readFileSync(new URL('../components/orders/OrderShopMonoCancellation.vue', import.meta.url), 'utf8')
  .split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

function setup(t, { archived = false, permitted = true, revision = 7, reject, orderPatch } = {}) {
  const order = vue.reactive({
    id: 42, revision: 7, channel: 'shop', payment_method: 'onlineCard', payment_status: 'unpaid',
    archived, status: archived ? 'cancelled' : 'pending', ...orderPatch,
  })
  const auth = vue.reactive({ user: { id: 12, can_manage_fiscal_settings: permitted }, sessionRevision: 0 })
  const requests = [], events = []
  const context = {
    ...vue, defineProps: () => ({ order }), defineEmits: () => (...args) => events.push(args),
    useAuthStore: () => auth, salesErrorDetail: cause => cause,
    useApi: settings => async (path, options) => {
      requests.push({ path, options, settings })
      if (options.method !== 'POST') return {
        order_id: 42, revision, order_status: order.status,
        status: archived ? 'cancelled' : 'reconciliation_required', reason: 'invoice_reconciliation_required',
      }
      if (reject) throw reject
      return { order_id: 42, order_status: 'cancelled', invoice_status: 'deactivated' }
    },
  }
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  scope.run(() => runInNewContext(js + '\nglobalThis.view = { action, open, outcome, submit };', context))
  const view = context.view
  const confirm = () => { view.open.value = true; return view.submit() }
  return { ...view, confirm, requests, events, auth }
}

for (const archived of [false, true]) {
  test(archived ? 'archive only closes the bank invoice' : 'active unpaid order uses the reserve-aware cancellation', async t => {
    const view = setup(t, { archived, orderPatch: { payment_status: archived ? 'legacy_unknown' : 'failed' } })
    await view.submit()
    assert.equal(view.requests.length, 0)
    await Promise.all([view.confirm(), view.submit()])
    const [read, write] = view.requests
    assert.equal(view.requests.length, 2)
    assert.match(read.path, /\/online-payment\/cancellation$/)
    assert.equal(write.path.split('/').at(-1), archived ? 'deactivate-archived-invoice' : 'deactivate-unpaid')
    assert.equal(write.options.body.expected_revision, 7)
    assert.equal(write.options.retry, 0)
    assert.equal(write.settings.refreshOnUnauthorized, false)
    assert.equal(view.outcome.value, 'confirmed')
    assert.equal(view.events[0][0], 'changed')
  })
}

test('a stale order revision is refreshed without a mutation', async t => {
  const view = setup(t, { revision: 8 })
  await view.confirm()
  assert.equal(view.requests.length, 1)
  assert.equal(view.events[0][0], 'changed')
})

test('uncertain bank outcome blocks another submission from the same card', async t => {
  const view = setup(t, { reject: { code: 'invoice_removal_unconfirmed' } })
  await view.confirm()
  assert.equal(view.outcome.value, 'review')
  await view.confirm()
  assert.equal(view.requests.length, 2)
})

test('permissions and paid status suppress the action', async t => {
  for (const options of [{ permitted: false }, { orderPatch: { payment_status: 'paid_production' } }]) {
    const view = setup(t, options)
    assert.equal(view.action.value, null)
    await view.confirm()
    assert.equal(view.requests.length, 0)
  }
})
