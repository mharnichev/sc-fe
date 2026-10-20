import { useShopRuntimeDisplay } from './runtime-localization-harness.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
let moduleId = 0
for (const change of ['actor', 'order', 'unmount']) {
  test(`actual customer preliminary print closes pending popup on ${change}`, async () => {
    const props = vue.reactive({ orderId: 321, guest: false }), auth = vue.reactive({ customer: { id: 1 }, sessionRevision: 1, accessToken: 'fixture-A' })
    const popups = [], cleanup = []
    let complete
    const response = new Promise(resolve => { complete = resolve })
    Object.assign(globalThis, vue, { useShopRuntimeDisplay,
      defineProps: () => props, useCustomerAuthStore: () => auth, useApi: () => async () => response,
      onBeforeUnmount: callback => cleanup.push(callback),
      window: { open: () => { const popup = { closed: false, close() { this.closed = true }, location: { replacements: [], replace(url) { this.replacements.push(url) } } }; popups.push(popup); return popup }, setTimeout: () => 0 },
    })
    const component = await readFile(new URL('../components/OrderDocuments.vue', import.meta.url), 'utf8')
    const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
    const compiled = ts.transpileModule(script + `\nexport { openDocument, busy, error }; // runtime ${moduleId++}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    const scope = vue.effectScope()
    const state = await scope.run(() => import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`))
    const pending = state.openDocument({ id: 9, print_url: '/api/v1/public/orders/me/321/preliminary-documents/9/print' })
    if (change === 'actor') { auth.customer = { id: 2 }; auth.sessionRevision++; auth.accessToken = 'fixture-B' }
    else if (change === 'order') props.orderId = 322
    else cleanup.forEach(callback => callback())
    complete('<h1>Private order A</h1>'); await pending
    assert.equal(popups[0].closed, true)
    assert.deepEqual(popups[0].location.replacements, [])
    cleanup.forEach(callback => callback()); scope.stop()
  })
}
