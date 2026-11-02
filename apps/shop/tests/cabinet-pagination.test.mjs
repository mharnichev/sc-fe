import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { vue } from './runtime-localization-harness.mjs'

const source = await readFile(new URL('../pages/cabinet/purchase-history.vue', import.meta.url), 'utf8')
const script = source.split('<script setup lang="ts">')[1].split('</script>')[0]
  .replace("import FeedbackState from '~/components/ui/FeedbackState.vue'", '')
const compiled = ts.transpileModule(`${script}\nglobalThis.result = { changePage, loadOrders, pagination, state, requestedPage }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/export \{\};?/, '')
const settle = async () => { for (let i = 0; i < 8; i++) { await vue.nextTick(); await Promise.resolve() } }

function setup(page = '1') {
  const auth = vue.reactive({ isAuthenticated: true, customer: { id: 10 }, sessionRevision: 1, accessToken: 'fixture' })
  const route = vue.reactive({ query: { page, filter: 'kept' }, fullPath: `/cabinet/purchase-history?page=${page}` })
  const requests = [], pushes = []
  let response
  const context = vm.createContext({
    useCustomerAuthStore: () => auth, useRoute: () => route,
    useRouter: () => ({ push: async ({ query }) => { pushes.push(query); route.query = query } }),
    useApi: () => async (_path, options) => {
      requests.push(options.query.page)
      return response ? await response : { items: [], total: 30, page: options.query.page, page_size: 10 }
    },
    useShopRuntimeDisplay: () => ({}), useShopLocale: () => ({ terms: { value: { cabinet: { ordersErrorTitle: 'Orders unavailable' } } } }),
    useShopPriceFormatter: () => ({}), useSeo: () => {},
    ref: vue.ref, reactive: vue.reactive, computed: vue.computed, watch: vue.watch,
    onBeforeUnmount: () => {}, nextTick: vue.nextTick,
  })
  vm.runInContext(compiled, context)
  return { auth, route, requests, pushes, result: context.result, defer: value => { response = value } }
}

test('history initializes from query, keeps filters, and restores page on back/forward', async () => {
  const app = setup('2')
  await settle()
  assert.deepEqual(app.requests, [2])
  await app.result.changePage(3)
  assert.equal(app.pushes[0].page, '3')
  assert.equal(app.pushes[0].filter, 'kept')
  app.route.query.page = '2'; await settle()
  assert.equal(app.result.pagination.page, 2)
  app.route.query.page = '3'; await settle()
  assert.equal(app.result.pagination.page, 3)
})

test('invalid page is normalized and logout never causes a private history fetch', async () => {
  const app = setup('-2')
  await settle()
  assert.deepEqual(app.requests, [1])
  app.auth.isAuthenticated = false
  app.route.query.page = '2'; await settle()
  assert.deepEqual(app.requests, [1])
})

test('logout invalidates a pending response without changing the requested URL', async () => {
  const app = setup()
  await settle()
  let resolve
  app.defer(new Promise(done => { resolve = done }))
  await app.result.changePage(2)
  app.auth.isAuthenticated = false
  app.auth.sessionRevision++
  await settle()
  resolve({ items: [{ id: 'private' }], total: 30, page: 2, page_size: 10 })
  await settle()
  assert.equal(app.result.pagination.total, 0)
  assert.equal(app.pushes.length, 1)
})

test('back during a pending query fetch invalidates the abandoned page response', async () => {
  const app = setup()
  await settle()
  let resolve
  app.defer(new Promise(done => { resolve = done }))
  app.route.query.page = '2'; await settle()
  assert.equal(app.requests.at(-1), 2)
  app.defer(undefined)
  app.route.query.page = '1'; await settle()
  resolve({ items: [], total: 30, page: 2, page_size: 10 })
  await settle()
  assert.equal(app.result.pagination.page, 1)
})

for (const source of ['button', 'history']) test(`retry keeps the requested page after a failed ${source} navigation`, async () => {
  const app = setup()
  await settle()
  app.defer(Promise.reject(new Error('unavailable')))
  if (source === 'button') await app.result.changePage(2)
  else app.route.query.page = '2'
  await settle()
  assert.ok(app.result.state.error)
  assert.equal(app.route.query.page, '2')
  app.defer(undefined)
  await app.result.loadOrders(app.result.requestedPage())
  assert.equal(app.result.pagination.page, 2)
  assert.equal(app.requests.at(-1), 2)
})

test('Back to the last successful page clears a later-page error', async () => {
  const app = setup()
  await settle()
  app.defer(Promise.reject(new Error('unavailable')))
  app.route.query.page = '2'
  await settle()
  assert.ok(app.result.state.error)
  app.defer(undefined)
  app.route.query.page = '1'
  await settle()
  assert.equal(app.result.pagination.page, 1)
  assert.equal(app.result.state.error, '')
})
