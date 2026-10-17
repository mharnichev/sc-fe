import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../pages/inventory/index.vue', import.meta.url), 'utf8')
const script = ts.transpileModule(source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText

test('clear search cancels pending debounce, immediately resets query, retains filter and restores focus', async () => {
  const timers = new Map()
  const navigations = []
  let timerId = 0
  let focused = false
  const ref = value => ({ value })
  const noop = () => {}
  const globals = {
    provide: () => {},
    ref, computed: getter => ({ get value() { return getter() } }), watch: noop,
    onBeforeUnmount: noop, onBeforeRouteLeave: noop,
    useAuthStore: () => ({ user: { is_superuser: true } }),
    useBackofficeApi: () => ({}), useAssetUrl: () => value => value,
    useRoute: () => ({ query: { search: 'Shampoo', stock: 'available', page: '2', context: 'keep' } }),
    useRouter: () => ({ replace: async location => { navigations.push(location) } }),
    useAsyncData: async () => ({ data: ref(null), pending: ref(false), error: ref(null), refresh: noop }),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId },
    clearTimeout: id => timers.delete(id),
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const state = await new AsyncFunction(...Object.keys(globals), `${script}; return { search, searchInput, clearSearch, searchAsYouType };`)(...Object.values(globals))
  state.searchInput.value = { focus: () => { focused = true } }
  state.searchAsYouType('Pending text')
  assert.equal(timers.size, 1)
  const result = state.clearSearch()
  assert.equal(state.search.value, '')
  assert.equal(timers.size, 0)
  assert.deepEqual(navigations, [{ query: { stock: 'available', context: 'keep' } }])
  await result
  assert.equal(focused, true)
})

