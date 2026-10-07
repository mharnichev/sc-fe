import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { summarizeRules } from '../utils/segmentRules.mjs'

const require = createRequire(import.meta.url)
const { ref, computed, reactive, watch, nextTick } = createRequire(require.resolve('nuxt/package.json'))('vue')
const source = await readFile(new URL('../components/messaging/SegmentCampaignAudience.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpileModule(script, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/^import .*?;\s*$/gm, '').replace(/^export \{\};\s*$/gm, '')
const segment = (id, status = 'active') => ({
  id, name: 'Segment ' + id, status, revision: 2,
  rules: { combine: 'all', conditions: [{ type: 'upcoming_booking', present: false }], exclusions: [] },
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { await nextTick(); await new Promise(setImmediate); await nextTick() }

function harness({ ids = [], disabled = false, api: overrides = {} } = {}) {
  const props = reactive({ modelValue: ids, disabled })
  const events = []
  const stops = []
  const api = {
    getSegments: async () => ({ items: [], total: 0 }),
    getSegment: async id => segment(id),
    ...overrides,
  }
  const globals = {
    ref, computed,
    watch: (...args) => { const stop = watch(...args); stops.push(stop); return stop },
    onMounted: () => {},
    defineProps: () => props,
    withDefaults: value => value,
    defineEmits: () => (name, value) => events.push({ name, value }),
    useBackofficeApi: () => api,
    useBookingFormatting: () => ({ apiErrorMessage: (_cause, fallback) => fallback }),
    summarizeRules,
  }
  const result = new Function(...Object.keys(globals), compiled + '\nreturn { load, loadSelected, setValue, remove, segments, selected, selectedSummaries, options, loading, error, total };')(...Object.values(globals))
  return {
    ...result, props, events,
    updates: () => events.filter(event => event.name === 'update:modelValue').map(event => event.value),
    valid: () => events.filter(event => event.name === 'valid').at(-1)?.value,
    cleanup: () => stops.forEach(stop => stop()),
  }
}

test('picker uses existing searchable multi-select, field help and unframed summaries', () => {
  assert.match(source, /<BaseMultiSelect/)
  assert.match(source, /:max-selected="20"/)
  assert.match(source, /:show-limit="true"/)
  assert.match(source, /:show-selected-chips="false"/)
  assert.match(source, /<template #label>\s*<MessagingCampaignFieldHelp/)
  assert.match(source, /search-placeholder=/)
  assert.match(source, /grid gap-x-4 gap-y-3 sm:grid-cols-2/)
  assert.match(source, /:disabled="disabled"[\s\S]*?@click="remove\(item.id\)"/)
  assert.doesNotMatch(source, /<BaseInput|<BaseCheckbox|<BaseCard|base-card|visibleSegments/)
  assert.doesNotMatch(source, /api\.(?:create|update|delete|launch|send)\w*\(/)
})

test('all active segment pages load at limit 100 with names and rule descriptions', async () => {
  const items = Array.from({ length: 205 }, (_, index) => segment(index + 1))
  const calls = []
  const h = harness({ api: { getSegments: async query => {
    calls.push(query)
    return { total: items.length, items: items.slice(query.offset, query.offset + query.limit) }
  } } })
  try {
    await h.load()
    assert.deepEqual(calls, [0, 100, 200].map(offset => ({ status: 'active', limit: 100, offset })))
    assert.equal(h.options.value.length, 205)
    assert.equal(h.total.value, 205)
    assert.equal(h.options.value[204].label, 'Segment 205')
    assert.equal(h.options.value[204].description, summarizeRules(items[204].rules))
    assert.equal(h.loading.value, false)
    assert.deepEqual(h.updates(), [])
  }
  finally { h.cleanup() }
})

test('empty pages terminate safely and overlapping catalog loads do not start a second request', async () => {
  const pending = deferred()
  let calls = 0
  const h = harness({ api: { getSegments: () => { calls++; return pending.promise } } })
  try {
    const first = h.load()
    await h.load()
    assert.equal(calls, 1)
    pending.resolve({ items: [], total: 1000 })
    await first
    assert.equal(h.loading.value, false)
    assert.equal(h.options.value.length, 0)
  }
  finally { h.cleanup() }
})

test('local selection is numeric, deduplicated and rejects unknown or archived additions', async () => {
  const h = harness({ api: { getSegments: async () => ({ items: [segment(1), segment(2), segment(9, 'archived')], total: 3 }) } })
  try {
    await h.load()
    assert.deepEqual(h.options.value.map(option => option.value), [1, 2])
    h.setValue(['1', 1, 2])
    assert.deepEqual(h.updates(), [[1, 2]])
    for (const value of [[99], [9], [0], [-1], [1.5], ['not-an-id']]) h.setValue(value)
    assert.deepEqual(h.updates(), [[1, 2]])
  }
  finally { h.cleanup() }
})

test('20-id limit counts unresolved selections and permits explicit removal, not additions', async () => {
  const ids = Array.from({ length: 20 }, (_, index) => index + 100)
  const h = harness({ ids, api: { getSegments: async () => ({ items: [segment(1)], total: 1 }) } })
  try {
    await h.load()
    assert.equal(h.options.value[0].disabled, true)
    h.setValue([...ids, 1])
    assert.deepEqual(h.updates(), [])
    h.remove(100)
    assert.deepEqual(h.updates(), [ids.slice(1)])
    h.props.modelValue = ids.slice(1)
    await flush()
    assert.equal(h.options.value[0].disabled, false)
    h.setValue([...h.props.modelValue, 1])
    assert.equal(h.updates().at(-1).length, 20)
  }
  finally { h.cleanup() }
})

test('disabled picker guards removal and updates even when an already-open base menu emits', async () => {
  const h = harness({ ids: [1], disabled: true, api: { getSegments: async () => ({ items: [segment(1), segment(2)], total: 2 }) } })
  try {
    await h.load()
    h.remove(1)
    h.setValue([])
    h.setValue([1, 2])
    assert.deepEqual(h.updates(), [])
    assert.ok(h.options.value.every(option => option.disabled))
    h.props.disabled = false
    h.remove(1)
    assert.deepEqual(h.updates(), [[]])
  }
  finally { h.cleanup() }
})

test('selected archived segments remain visible but invalid and removable', async () => {
  const h = harness({ ids: [9], api: { getSegment: async id => segment(id, 'archived') } })
  try {
    await flush()
    assert.equal(h.valid(), false)
    assert.equal(h.selectedSummaries.value[0].segment.status, 'archived')
    assert.equal(h.selectedSummaries.value[0].name, 'Segment 9')
    h.remove(9)
    assert.deepEqual(h.updates(), [[]])
  }
  finally { h.cleanup() }
})

test('unknown selection errors retain IDs and unresolved summaries; retry revalidates', async () => {
  let fail = true
  const h = harness({ ids: [99], api: { getSegment: async id => {
    if (fail) throw new Error('unavailable')
    return segment(id)
  } } })
  try {
    await flush()
    assert.equal(h.valid(), false)
    assert.ok(h.error.value)
    assert.deepEqual(h.props.modelValue, [99])
    assert.equal(h.selectedSummaries.value[0].id, 99)
    assert.equal(h.selectedSummaries.value[0].segment, undefined)
    h.remove(99)
    assert.deepEqual(h.updates(), [[]])
    fail = false
    await h.load()
    await h.loadSelected()
    assert.equal(h.valid(), true)
    assert.equal(h.error.value, '')
    assert.equal(h.selectedSummaries.value[0].name, 'Segment 99')
  }
  finally { h.cleanup() }
})

test('catalog errors retain loaded pages and retry fetches all pages again', async () => {
  let fail = true
  const firstPage = Array.from({ length: 100 }, (_, index) => segment(index + 1))
  const calls = []
  const h = harness({ api: { getSegments: async query => {
    calls.push(query.offset)
    if (query.offset === 100 && fail) throw new Error('offline')
    return { items: query.offset === 0 ? firstPage : [segment(101)], total: 101 }
  } } })
  try {
    await h.load()
    assert.ok(h.error.value)
    assert.equal(h.options.value.length, 100)
    assert.equal(h.loading.value, false)
    fail = false
    await h.load()
    assert.equal(h.error.value, '')
    assert.equal(h.options.value.length, 101)
    assert.deepEqual(calls, [0, 100, 0, 100])
  }
  finally { h.cleanup() }
})

for (const staleFailure of [false, true]) {
  test('stale selected ' + (staleFailure ? 'failure' : 'success') + ' cannot replace newer selection or validity', async () => {
    const first = deferred(), second = deferred()
    const h = harness({ ids: [1], api: { getSegment: id => id === 1 ? first.promise : second.promise } })
    try {
      h.props.modelValue = [2]
      await nextTick()
      second.resolve(segment(2))
      await flush()
      assert.equal(h.valid(), true)
      if (staleFailure) first.reject(new Error('old failure'))
      else first.resolve(segment(1, 'archived'))
      await flush()
      assert.deepEqual(h.selected.value.map(item => item.id), [2])
      assert.equal(h.valid(), true)
      assert.equal(h.error.value, '')
    }
    finally { h.cleanup() }
  })
}
