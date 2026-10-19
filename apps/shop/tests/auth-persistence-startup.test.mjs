import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const pinia = await import(pathToFileURL(require.resolve('pinia')).href)
let sequence = 0
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}#${sequence++}`)
const original = { accessToken: 'fixture-A', tokenType: 'Bearer', customer: { id: 42, phone: '+380990000001' } }
for (const scenario of ['first restore', 'middleware restored', 'logout before idle', 'new login before idle']) {
  test(`actual persistence plugin preserves the ${scenario} session and saves its current state`, async () => {
    pinia.setActivePinia(pinia.createPinia())
    const storage = new Map([['shop-customer-auth', JSON.stringify(original)]])
    const cart = { $state: {}, $patch() {}, $subscribe() {}, prepareSession() {}, syncFromServer: async () => {} }
    const favorites = { $state: {}, $patch() {}, $subscribe() {}, prepareSession() {}, syncFromServer: async () => {} }
    let ready, auth
    Object.assign(globalThis, { defineStore: pinia.defineStore, defineNuxtPlugin: setup => setup, onNuxtReady: callback => { ready = callback },
      useApi: () => async () => ({ ...auth.customer }), useCartStore: () => cart, useFavoritesStore: () => favorites,
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
    const authSource = await readFile(new URL('../stores/customerAuth.ts', import.meta.url), 'utf8')
    const { useCustomerAuthStore } = await importSource(authSource)
    auth = useCustomerAuthStore()
    Object.assign(globalThis, { useCustomerAuthStore: () => auth })
    const plugin = await importSource(await readFile(new URL('../plugins/persist.client.ts', import.meta.url), 'utf8'))
    plugin.default()
    if (scenario !== 'first restore') auth.hydrate(original)
    if (scenario === 'logout before idle') auth.logout()
    if (scenario === 'new login before idle') auth.setSession({ access_token: 'fixture-B', token_type: 'Bearer', customer: { id: 43, phone: '+380990000002' } })
    const beforeRevision = auth.sessionRevision, beforeToken = auth.accessToken, beforeCustomer = auth.customer?.id
    ready()
    assert.equal(auth.sessionRevision, scenario === 'first restore' ? 1 : beforeRevision)
    assert.equal(auth.accessToken, scenario === 'first restore' ? original.accessToken : beforeToken)
    assert.equal(auth.customer?.id, scenario === 'first restore' ? original.customer.id : beforeCustomer)
    assert.deepEqual(JSON.parse(storage.get('shop-customer-auth')), { accessToken: auth.accessToken, tokenType: auth.tokenType, customer: auth.customer })
    pinia.disposePinia(pinia.getActivePinia())
  })
}
