import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
test('public document uses unauthenticated minimal DTO, clears revoked display and rejects stale token response', async () => {
  const route = vue.reactive({ params: { token: 'a'.repeat(30) } }), reads = []
  const good = { kind: 'return', items: [{ name: '<script>private</script>', quantity: 1, total_minor: 1234, product_id: 999 }], amount_minor: 1234, currency: 'UAH', notice: 'MOCK', simulation: true, is_sent_dps: false, customer: 'hidden', provider_uuid: 'hidden' }
  Object.assign(globalThis, vue, { definePageMeta: () => {}, useRoute: () => route, useRuntimeConfig: () => ({ public: { apiBase: 'http://127.0.0.1:9/api/v1' } }), useHead: () => {}, onMounted: () => {}, $fetch: (path, options) => new Promise((resolve, reject) => reads.push({ path, options, resolve, reject })) })
  const component = await readFile(new URL('../pages/mock-fiscal-documents/[token].vue', import.meta.url), 'utf8')
  const source = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/import\.meta\.client/g, 'true')
  const compiled = ts.transpileModule(source + '\nexport { document, error, load };', { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const scope = vue.effectScope()
  const state = await scope.run(() => import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`))
  route.params.token = 'b'.repeat(30); await vue.nextTick()
  reads[1].resolve(good); await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(state.document.value.kind, 'return'); assert.equal(state.document.value.customer, undefined); assert.equal(state.document.value.items[0].product_id, undefined)
  reads[0].resolve({ ...good, amount_minor: 9999 }); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(state.document.value.amount_minor, 1234)
  const retry = state.load(); reads[2].reject({ status: 404 }); await retry
  assert.equal(state.document.value, null); assert.match(state.error.value, /відкликане/)
  for (const read of reads) { assert.equal(read.options.credentials, 'omit'); assert.equal(read.options.referrerPolicy, 'no-referrer'); assert.equal(read.options.headers, undefined) }
  scope.stop()
})
