import assert from 'node:assert/strict'
import { readFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(await realpath(new URL('../node_modules/nuxt/package.json', import.meta.url)))
const { reactive, ref, computed, watch, nextTick } = require('vue')
const component = await readFile(new URL('../components/ui/MasterRatingBlock.vue', import.meta.url), 'utf8')
const cacheSource = await readFile(new URL('../utils/masterTrustCache.ts', import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const cache = await import(`data:text/javascript;base64,${Buffer.from(compile(cacheSource)).toString('base64')}`)
const script = compile(component.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .*$/gm, '').replaceAll('import.meta.client', 'true')).replace(/export \{\};?/, '')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); await nextTick() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

const harness = () => {
  const app = { payload: { data: {} }, static: { data: {} }, isHydrating: false }
  const entries = new Map()
  const stops = []
  let id = 0
  const useAsyncData = (key, handler, options) => {
    const ensure = (value, previous) => {
      if (!entries.has(value)) entries.set(value, {
        data: ref(previous), pending: ref(false), error: ref(null), handler, options,
      })
      return entries.get(value)
    }
    const execute = async (value, cause = 'initial') => {
      const entry = ensure(value)
      const cached = entry.options.getCachedData(value, app, { cause })
      if (cached) { entry.data.value = cached; return }
      entry.pending.value = true
      try { entry.data.value = await entry.handler(); entry.error.value = null }
      catch (error) { entry.error.value = error; entry.data.value = undefined }
      finally { entry.pending.value = false }
    }
    ensure(key.value)
    void execute(key.value)
    stops.push(watch(key, (value, previous) => {
      ensure(value, entries.get(previous)?.data.value)
      void execute(value)
    }, { flush: 'sync' }))
    return Promise.resolve({
      data: computed(() => entries.get(key.value).data.value),
      pending: computed(() => entries.get(key.value).pending.value),
      error: computed(() => entries.get(key.value).error.value),
      refresh: () => execute(key.value, 'refresh:manual'),
    })
  }
  const mount = async (masterId, domain) => {
    const props = reactive({ masterId, showReviews: false, reviewLimit: 2, rotateReviews: false })
    const unmount = []
    const dependencies = {
      defineProps: () => props, withDefaults: (value, defaults) => Object.assign(value, defaults, { masterId }),
      useTerms: () => ({ locale: ref('en') }), useBarbershopDomain: () => domain,
      useNuxtApp: () => app, useId: () => ++id, useAsyncData, ref, computed,
      watch: (...args) => { const stop = watch(...args); stops.push(stop); return stop },
      onMounted: () => {}, onBeforeUnmount: callback => unmount.push(callback),
      document: { removeEventListener: () => {} }, ...cache,
    }
    const run = new AsyncFunction(...Object.keys(dependencies), `${script}\nreturn { props, trust, summaryData, reviewsData, loadDialogReviews, dialogReviews, dialogPending, dialogError, dialogPage, dialogTotal };`)
    const result = await run(...Object.values(dependencies))
    return { ...result, unmount: () => unmount.forEach(callback => callback()) }
  }
  return { mount, dispose: () => stops.forEach(stop => stop()) }
}

test('master switches hide inherited data and do not retarget another consumer handler', async () => {
  const h = harness()
  const pending = deferred()
  const calls = []
  const domain = {
    getMasterRatingSummary: async id => {
      calls.push(id)
      if (id === 2) return pending.promise
      return { average_rating: id, approved_review_count: id }
    },
  }
  try {
    const first = await h.mount(1, domain)
    const second = await h.mount(1, domain)
    await settle()
    first.props.masterId = 2
    assert.equal(first.trust.value.summary, undefined)
    await settle()
    await second.summaryData.refresh()
    assert.equal(second.trust.value.summary.average_rating, 1)
    assert.equal(calls.at(-1), 1)
    pending.resolve({ average_rating: 5, approved_review_count: 20 })
    await settle()
    assert.equal(first.trust.value.summary.average_rating, 5)
    assert.equal(second.trust.value.summary.average_rating, 1)
  }
  finally { h.dispose() }
})

test('dialog pagination retries the same page and ignores master-change and unmount completions', async () => {
  const h = harness()
  const pending = deferred()
  const calls = []
  let failPageTwo = true
  const domain = {
    getMasterRatingSummary: async () => ({ average_rating: 5, approved_review_count: 40 }),
    getMasterReviews: async (id, limit, page) => {
      calls.push([id, limit, page])
      if (id === 2 || page === 3) return pending.promise
      if (page === 2 && failPageTwo) { failPageTwo = false; throw new Error('offline') }
      return { items: [{ id: page }], page, total: 40 }
    },
  }
  try {
    const component = await h.mount(1, domain)
    await component.loadDialogReviews()
    await component.loadDialogReviews()
    assert.equal(component.dialogError.value, true)
    assert.equal(component.dialogPage.value, 1)
    await component.loadDialogReviews()
    assert.deepEqual(calls.slice(0, 3), [[1, 20, 1], [1, 20, 2], [1, 20, 2]])
    const oldMaster = component.loadDialogReviews()
    await component.loadDialogReviews()
    assert.equal(calls.length, 4)
    component.props.masterId = 2
    assert.equal(component.dialogReviews.value.length, 0)
    const newMaster = component.loadDialogReviews()
    component.unmount()
    pending.resolve({ items: [{ id: 99 }], page: 3, total: 40 })
    await Promise.all([oldMaster, newMaster])
    assert.equal(component.dialogReviews.value.length, 0)
    assert.equal(component.dialogPage.value, 0)
  }
  finally { h.dispose() }
})

test('only the visible responsive team branch mounts ratings', async () => {
  const source = await readFile(new URL('../components/sections/TeamSection.vue', import.meta.url), 'utf8')
  assert.match(source, /v-if="isTeamVisible && isMobile"/)
  assert.match(source, /v-if="isTeamVisible && !isMobile"/)
})

test('Escape is consumed by the focused modal before it can reach its parent', async () => {
  const source = await readFile(new URL('../components/ui/BaseModal.vue', import.meta.url), 'utf8')
  const body = source.match(/if \(event.key === 'Escape'\) \{([\s\S]*?)\n  \}/)[1]
  const calls = []
  new Function('event', 'close', body)({
    preventDefault: () => calls.push('prevent'), stopPropagation: () => calls.push('stop'),
  }, () => calls.push('close'))
  assert.deepEqual(calls, ['prevent', 'stop', 'close'])
})

test('Escape outside the modal subtree closes only the topmost open modal', async () => {
  const source = await readFile(new URL('../components/ui/BaseModal.vue', import.meta.url), 'utf8')
  const body = source.match(/const onDocumentKeydown = \(event: KeyboardEvent\) => \{([\s\S]*?)\n\}/)[1]
  const current = {}
  const other = {}
  let top = current
  let handled = 0
  const props = { modelValue: true }
  const handler = new Function('event', 'props', 'dialog', 'document', 'onKeydown', body)
  const dispatch = key => handler({ key }, props, { value: current }, {
    querySelectorAll: () => ({ length: 1, item: () => top }),
  }, () => { handled++ })
  dispatch('Escape')
  assert.equal(handled, 1)
  top = other
  dispatch('Escape')
  dispatch('Tab')
  props.modelValue = false
  top = current
  dispatch('Escape')
  assert.equal(handled, 1)
})
