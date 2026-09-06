import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { ref, computed, reactive, watch, nextTick } = createRequire(require.resolve('nuxt/package.json'))('vue')
import { previewPageSummary, isNotificationType, channelStrategyLabel, deliveryReasonLabel } from '../utils/campaignAudience.mjs'

const runSource = await readFile(new URL('../components/messaging/CampaignRunPanel.vue', import.meta.url), 'utf8')
const runScript = runSource.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiledRun = ts.transpileModule(runScript, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^import .*?;\s*$/gm, '').replace(/^export \{\};\s*$/gm, '')
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const page = (total, items = []) => ({ evaluated_at: '2026-09-06T10:00:00Z', total, items, page: 1, page_size: 50 })
const member = (id, eligible, channel) => ({ customer_id: id, eligible, channel, reachability: { sms: true, telegram: true } })
function runHarness(apiOverrides = {}) {
  const props = reactive({ campaign: { id: 1, name: 'Тестова кампанія', channel: 'telegram', status: 'draft', updated_at: '2026-09-06T10:00:00Z', segment_ids: [12], message_body: 'Тест', promo_code: 'RETURN' }, dirty: false })
  const watchers = []
  const api = { getCampaignRuns: async () => ({ items: [], total: 0 }), getCampaignRun: async () => ({ id: 5, campaign_snapshot: {}, segment_snapshots: [], delivery_counts: {} }), getCampaignRunMembers: async () => ({ items: [], total: 0 }), ...apiOverrides }
  const globals = { ref, computed, watch: (...args) => { const stop = watch(...args); watchers.push(stop); return stop }, onMounted: () => {}, defineProps: () => props, defineEmits: () => () => {}, useBackofficeApi: () => api, useBookingFormatting: () => ({ apiErrorMessage: (_cause, fallback) => fallback }), useBackofficeAccess: () => ({ canSendMessagingCampaigns: ref(true) }), useBaseToastNotification: () => ({ success: () => {} }), summarizeRules: () => '', channelStrategyLabel, deliveryReasonLabel, previewPageSummary, crypto: { randomUUID: () => 'isolated-test-key' } }
  const result = new Function(...Object.keys(globals), `${compiledRun}\nreturn { preview, previewError, previewLoading, previewStale, loadPreview, launch, launchKey, launchError, run, inspectRun, runError };`)(...Object.values(globals))
  return { ...result, props, cleanup: () => watchers.forEach(stop => stop()) }
}

test('audience total is separate from sendable counts on a paginated response', () => {
  const summary = previewPageSummary(page(1000, [member(1, true, 'telegram'), member(2, false, 'sms'), member(3, true, 'sms')]))
  assert.deepEqual(summary, { audience: 1000, shown: 3, eligible: 2, excluded: 1, sms: 1, telegram: 1 })
  assert.equal(previewPageSummary(null).audience, null)
  assert.equal(previewPageSummary(page(0)).audience, 0)
})

test('notification classification preserves service events and separates legacy marketing types', () => {
  for (const type of ['booking_confirmation', 'appointment_reminder', 'post_visit_review_request', 'master_schedule_reminder', 'master_booking_created', 'master_booking_cancelled']) assert.equal(isNotificationType(type), true)
  for (const type of ['manual', 're_engagement', 'birthday_greeting', 'first_visit_follow_up', 'loyalty_vip']) assert.equal(isNotificationType(type), false)
  assert.equal(deliveryReasonLabel('channel_unreachable'), 'Немає доступної адреси каналу')
  assert.equal(deliveryReasonLabel('provider_specific_reason'), 'provider_specific_reason')
})

test('slower earlier campaign preview cannot overwrite newer recipients or loading state', async () => {
  const first = deferred(), second = deferred()
  let count = 0
  const harness = runHarness({ previewCampaignAudience: () => ++count === 1 ? first.promise : second.promise })
  try {
    const one = harness.loadPreview(1)
    const two = harness.loadPreview(2)
    assert.equal(harness.previewLoading.value, true)
    second.resolve(page(20, [member(2, true, 'telegram')]))
    await two
    first.resolve(page(99, [member(1, true, 'sms')]))
    await one
    assert.equal(harness.preview.value.total, 20)
    assert.equal(harness.preview.value.items[0].customer_id, 2)
    assert.equal(harness.previewLoading.value, false)
  }
  finally { harness.cleanup() }
})

test('preview errors clear earlier audience and edits invalidate in-flight preview', async () => {
  const pending = deferred()
  const harness = runHarness({ previewCampaignAudience: () => pending.promise })
  try {
    const loading = harness.loadPreview()
    harness.props.dirty = true
    await nextTick()
    pending.resolve(page(10))
    await loading
    assert.equal(harness.preview.value, null)
    assert.equal(harness.previewStale.value, true)
    assert.equal(harness.previewLoading.value, false)
  }
  finally { harness.cleanup() }
  const failed = runHarness({ previewCampaignAudience: async () => { throw new Error('API unavailable') } })
  try {
    await failed.loadPreview()
    assert.equal(failed.preview.value, null)
    assert.ok(failed.previewError.value)
    assert.equal(failed.previewLoading.value, false)
  }
  finally { failed.cleanup() }
})

test('run retries reuse idempotency key and stale/dirty drafts cannot launch', async () => {
  const keys = []
  const harness = runHarness({ previewCampaignAudience: async () => page(1, [member(1, true, 'telegram')]), createCampaignRun: async (_id, input) => { keys.push(input.idempotency_key); if (keys.length === 1) throw new Error('uncertain network'); return { id: 5 } } })
  try {
    await harness.loadPreview()
    await harness.launch()
    assert.equal(harness.launchKey.value, 'isolated-test-key')
    assert.ok(harness.launchError.value)
    await harness.launch()
    assert.deepEqual(keys, ['isolated-test-key', 'isolated-test-key'])
    assert.equal(harness.launchKey.value, '')
    harness.props.dirty = true
    await nextTick()
    await harness.launch()
    assert.equal(keys.length, 2)
  }
  finally { harness.cleanup() }
})

test('frozen run template stays literal and unknown queue aggregate is not fabricated', () => {
  assert.match(runSource, /Зафіксований текст шаблону/)
  assert.doesNotMatch(runSource, /MessagingMessagePreview/)
  assert.match(runSource, /run\.delivery_counts\[status\] \?\? 'Немає даних'/)
  assert.match(runSource, /@confirm="launch"/)
  assert.match(runSource, /:context-items="launchContext"/)
})

const editorSource = await readFile(new URL('../components/messaging/CampaignAudienceEditor.vue', import.meta.url), 'utf8')
const editorScript = editorSource.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiledEditor = ts.transpileModule(editorScript, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^import .*?;\s*$/gm, '').replace(/^export \{\};\s*$/gm, '')
function editorHarness(segmentIds = []) {
  const writes = []
  const stops = []
  const props = reactive({ campaign: { id: 7, name: 'Legacy audience', type: 'manual', channel: 'telegram', status: 'draft', segment_ids: segmentIds, audience_rules: [{ type: 'all_clients' }], message_body: 'Original', metadata_json: { custom_delivery_setting: 'preserved' } } })
  const globals = { ref, computed, watch: (...args) => { const stop = watch(...args); stops.push(stop); return stop }, defineProps: () => props, defineEmits: () => () => {}, useBackofficeApi: () => ({ updateMessagingCampaign: async (_id, payload) => writes.push(payload) }), useBaseToastNotification: () => ({ success: () => {} }), useBookingFormatting: () => ({ apiErrorMessage: (_error, fallback) => fallback }), useBackofficeAccess: () => ({ canCreateMessagingDrafts: ref(true) }) }
  const result = new Function(...Object.keys(globals), `${compiledEditor}\nreturn { message, save, useSegments, segmentIds, valid, confirmInlineAudience };`)(...Object.values(globals))
  return { ...result, writes, cleanup: () => stops.forEach(stop => stop()) }
}

test('editing a legacy campaign message does not reconstruct its lossy inline audience', async () => {
  const harness = editorHarness()
  try {
    harness.message.value = 'Updated message'
    await harness.save()
    assert.equal(harness.writes.length, 1)
    assert.equal(harness.writes[0].message_body, 'Updated message')
    assert.equal(Object.hasOwn(harness.writes[0], 'audience_rules'), false)
    assert.equal(Object.hasOwn(harness.writes[0], 'segment_ids'), false)
    assert.equal(harness.writes[0].metadata_json.custom_delivery_setting, 'preserved')
  }
  finally { harness.cleanup() }
})

test('switching off segments requires acknowledgement and restores inline filters without overwriting them', async () => {
  const harness = editorHarness([12])
  try {
    harness.useSegments.value = false
    await harness.save()
    assert.equal(harness.writes.length, 0)
    harness.confirmInlineAudience.value = true
    await harness.save()
    assert.deepEqual(harness.writes[0].segment_ids, [])
    assert.equal(Object.hasOwn(harness.writes[0], 'audience_rules'), false)
  }
  finally { harness.cleanup() }
})
