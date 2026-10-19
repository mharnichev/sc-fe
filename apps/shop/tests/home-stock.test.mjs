import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

test('home requests in-stock goods on initial load and load more', async () => {
  const source = await readFile(new URL('../pages/index.vue', import.meta.url), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const calls = []
  const page = { items: [{ id: 1 }], total: 3 }
  const context = {
    useCatalogDomain: () => ({
      getProductsPage: async query => { calls.push(query); return page },
      getBrands: async () => [],
    }),
    useShopLocale: () => ({ terms: { value: {} } }),
    useAsyncData: async (_key, load) => ({ data: { value: await load() }, pending: { value: false } }),
    ref: value => ({ value }),
    reactive: value => value,
    computed: getter => ({ get value() { return getter() } }),
    watch: (data, callback) => callback(data.value),
    useSeo: () => {},
  }
  const compiled = ts.transpileModule(script.replace(/^import .*$/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/export \{\};?/, '')
  await vm.runInNewContext(`(async () => { ${compiled}; await fetchGoods() })()`, context)
  const goodsCalls = calls.filter(query => !query.is_top)
  assert.equal(goodsCalls.length, 2)
  assert.equal(goodsCalls[0].in_stock, true)
  assert.equal(goodsCalls[0].offset, 0)
  assert.equal(goodsCalls[1].in_stock, true)
  assert.equal(goodsCalls[1].offset, 1)
})
