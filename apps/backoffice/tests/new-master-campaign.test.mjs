import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { deliveryReasonLabel } from '../utils/campaignAudience.mjs'
import { DEFAULT_NEW_MASTER_SMS, validateNewMasterTemplate, renderOfferPreview, localDateTimeToIso, kyivLocalToIso, isoToKyivLocal, newMasterLaunchFingerprint } from '../utils/newMasterCampaign.mjs'
const require = createRequire(import.meta.url)
const { ref, computed, reactive, watch, nextTick } = createRequire(require.resolve('nuxt/package.json'))('vue')
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const source = await readFile(new URL('../components/messaging/NewMasterCampaignReview.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^import .*?;\s*$/gm, '').replace(/^export \{\};\s*$/gm, '')
function reviewHarness(overrides = {}, authorized = true) {
  const props = reactive({ campaign: { id: 5, name: 'Offer', status: 'draft', offer_master_id: 4, offer_promotion_id: 3, offer_service_ids: [18], offer_starts_at: '2026-10-05T10:00:00+03:00', offer_expires_at: '2026-10-15T18:00:00+03:00' }, dirty: false })
  const stops = []
  const storage = new Map()
  const api = { previewCampaignAudience: async () => ({ total: 1, communication_eligible_recipients: 1, items: [{ rendered_message: 'Preview' }] }), getCampaignReadiness: async () => ({ ready: true, checks: [] }), getCampaignRuns: async () => ({ items: [] }), getCampaignOfferAnalytics: async () => ({}), getCampaignRun: async () => ({ id: 6, delivery_counts: {} }), getCampaignRunMembers: async () => ({ items: [] }), getCampaignQueue: async () => ({}), getMasterServices: async () => [{ id: 18, name: 'Стрижка' }], adminGetMasters: async () => [{ id: 4, name: 'Майстер' }], adminGetPromotions: async () => ({ items: [{ id: 3, name_uk: 'Новий майстер' }] }), ...overrides }
  const globals = { ref, computed, watch: (...args) => { const stop = watch(...args); stops.push(stop); return stop }, onMounted: () => {}, defineProps: () => props, defineEmits: () => () => {}, useBackofficeApi: () => api, useBookingFormatting: () => ({ apiErrorMessage: (_error, fallback) => fallback }), useBackofficeAccess: () => ({ canSendMessagingCampaigns: ref(authorized), canViewMessagingAnalytics: ref(authorized) }), kyivLocalToIso, newMasterLaunchFingerprint, deliveryReasonLabel, crypto: { randomUUID: () => 'stable-test-key' }, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } }
  const result = new Function(...Object.keys(globals), `${compiled}\nreturn { preview, readiness, previewStale, previewLoading, canLaunch, loadPreview, loadReadiness, launch, launchKey, lifecycle, money, loadLabels, launchContext, testCustomerId, testCustomer, loadTestCustomer, inspectRun, members, memberPage, memberTotal, runsPage, runsTotal, loadRuns };`)(...Object.values(globals))
  return { ...result, props, cleanup: () => stops.forEach(stop => stop()) }
}

test('marketing template variables match appointment-free backend context and BMP support', () => {
  assert.deepEqual(validateNewMasterTemplate(DEFAULT_NEW_MASTER_SMS), { unknown: [], malformed: false, unsupported: [] })
  assert.deepEqual(validateNewMasterTemplate('{{customer_name}} {client_name} #barbershop_name').unknown, [])
  assert.deepEqual(validateNewMasterTemplate('{{discount_percent}}% {{promotion_name_uk}} {{promotion_name_en}}').unknown, [])
  assert.deepEqual(validateNewMasterTemplate('{{appointment_time}} {service_name} #manage_url').unknown, ['appointment_time', 'service_name', 'manage_url'])
  assert.equal(validateNewMasterTemplate('{{master_name}').malformed, true)
  assert.deepEqual(validateNewMasterTemplate('🎉').unsupported, ['🎉'])
})

test('offer preview substitutes every supported token format without touching unknown tokens', () => {
  const sample = { discount_percent: '15', promotion_name_en: 'Personal', master_name: 'Андрія' }
  assert.equal(renderOfferPreview('{{ discount_percent }}% {promotion_name_en} #master_name {{unknown}}', sample), '15% Personal Андрія {{unknown}}')
  assert.equal(renderOfferPreview('{{__proto__}}', sample), '{{__proto__}}')
})

test('Kyiv dates preserve winter and summer offsets and reject nonexistent wall times', () => {
  assert.equal(kyivLocalToIso('2026-01-05T10:00'), '2026-01-05T08:00:00.000Z')
  assert.equal(kyivLocalToIso('2026-07-05T10:00'), '2026-07-05T07:00:00.000Z')
  assert.equal(isoToKyivLocal('2026-07-05T07:00:00Z'), '2026-07-05T10:00')
  for (const invalid of ['', '2026-03-29T03:30', '2026-02-31T10:00', '2026-07-05T24:00']) assert.equal(kyivLocalToIso(invalid), null)
})

test('late preview after edit/save cannot restore launch eligibility', async () => {
  const pending = deferred()
  const harness = reviewHarness({ previewCampaignAudience: () => pending.promise })
  try {
    const work = harness.loadPreview()
    harness.props.dirty = true
    harness.props.dirty = false
    pending.resolve({ total: 8, communication_eligible_recipients: 8, items: [] })
    await work
    assert.equal(harness.preview.value, null)
    assert.equal(harness.previewStale.value, true)
    assert.equal(harness.canLaunch.value, false)
    assert.equal(harness.previewLoading.value, false)
  } finally { harness.cleanup() }
})

test('saved campaign changes discard late readiness even with unchanged updated_at', async () => {
  const pending = deferred()
  const harness = reviewHarness({ getCampaignReadiness: () => pending.promise })
  try {
    const work = harness.loadReadiness()
    harness.props.campaign.offer_service_ids = [19]
    pending.resolve({ ready: true })
    await work
    assert.equal(harness.readiness.value, null)
    assert.equal(harness.canLaunch.value, false)
  } finally { harness.cleanup() }
})

test('launch rechecks readiness and retains retry idempotency after uncertain network', async () => {
  const keys = []
  const harness = reviewHarness({ createCampaignRun: async (_id, body) => { keys.push(body.idempotency_key); if (keys.length === 1) throw Error('timeout'); return { id: 6 } } })
  try {
    await harness.loadPreview()
    assert.equal(harness.canLaunch.value, true)
    await harness.launch()
    assert.equal(harness.launchKey.value, 'stable-test-key')
    harness.readiness.value = { ready: false }
    await harness.launch()
    assert.deepEqual(keys, ['stable-test-key', 'stable-test-key'])
    assert.equal(harness.previewStale.value, true)
  } finally { harness.cleanup() }
})

test('dirty changes during final readiness check prevent launch mutation', async () => {
  const pending = deferred()
  let readinessCalls = 0, writes = 0
  const harness = reviewHarness({ getCampaignReadiness: () => ++readinessCalls === 1 ? Promise.resolve({ ready: true }) : pending.promise, createCampaignRun: async () => { ++writes } })
  try {
    await harness.loadPreview()
    const work = harness.launch()
    harness.props.dirty = true
    pending.resolve({ ready: true })
    await work
    assert.equal(writes, 0)
  } finally { harness.cleanup() }
})

test('lifecycle calls require administrator access; review retains UAH units and service names', async () => {
  let writes = 0
  const denied = reviewHarness({ pauseCampaign: () => ++writes }, false)
  try { await denied.lifecycle('pause'); assert.equal(writes, 0) } finally { denied.cleanup() }
  const harness = reviewHarness()
  try {
    assert.match(harness.money(560), /560/)
    await harness.loadLabels()
    assert.equal(harness.launchContext.value.find(item => item.label === 'Послуги').value, 'Стрижка')
  } finally { harness.cleanup() }
})

test('test launch requires a looked-up recipient and restricts run to that customer', async () => {
  const writes = []
  const harness = reviewHarness({ getCustomer: async id => ({ id, name: 'Тест', phone: '+380000000001' }), createCampaignRun: async (_id, body) => { writes.push(body); return { id: 6 } } })
  try {
    await harness.loadPreview()
    harness.testCustomerId.value = 15
    await nextTick()
    await harness.launch(true)
    assert.equal(writes.length, 0)
    await harness.loadTestCustomer()
    await harness.launch(true)
    assert.equal(writes.length, 1)
    assert.equal(writes[0].test_customer_id, 15)
  } finally { harness.cleanup() }
})

const editorSource = await readFile(new URL('../components/messaging/NewMasterCampaignEditor.vue', import.meta.url), 'utf8')
const editorScript = editorSource.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiledEditor = ts.transpileModule(editorScript, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^import .*?;\s*$/gm, '').replace(/^export \{\};\s*$/gm, '')
function editorHarness(overrides = {}, status = 'draft', extraProps = {}) {
  const writes = [], stops = [], emissions = [], createdTemplates = []
  const props = reactive({ campaign: { id: 5, name: 'Offer', type: 're_engagement', status, offer_master_id: 4, offer_promotion_id: 3, offer_service_ids: [18], segment_ids: [1], template_id: 7, master_name_for_message: 'Майстра', offer_starts_at: '2026-10-05T10:00:00+03:00', offer_expires_at: '2026-10-15T18:00:00+03:00' }, ...extraProps })
  const api = { adminGetMasters: async () => [{ id: 4, name: 'Майстер' }, { id: 6, name: 'Інший' }], adminGetPromotions: async () => ({ items: [{ id: 3, name_uk: 'Новий майстер', discount_percent: 30, discount_type: 'percent', is_active: true, recipient_offer_only: true }] }), getSegments: async () => ({ items: [{ id: 1, name: 'Сегмент', status: 'active' }] }), getMessageTemplate: async () => ({ id: 7, message_body: DEFAULT_NEW_MASTER_SMS, channel: 'sms', campaign_type: 're_engagement' }), createMessageTemplate: async body => { createdTemplates.push(body); return { id: 8, ...body } }, getMasterServices: async () => [{ id: 18, name: 'Стрижка', is_active: true }], updateNewMasterCampaign: async (_id, body) => { writes.push(body); return { id: 5, ...body } }, ...overrides }
  const globals = { ref, computed, watch: (...args) => { const stop = watch(...args); stops.push(stop); return stop }, onMounted: () => {}, defineProps: () => props, defineEmits: () => (name, value) => emissions.push([name, value]), useBackofficeApi: () => api, useBookingFormatting: () => ({ apiErrorMessage: (_error, fallback) => fallback }), useBackofficeAccess: () => ({ canCreateMessagingDrafts: ref(true) }), DEFAULT_NEW_MASTER_SMS, validateNewMasterTemplate, renderOfferPreview, kyivLocalToIso, isoToKyivLocal, newMasterLaunchFingerprint }
  const result = new Function(...Object.keys(globals), `${compiledEditor}\nreturn { load, save, startsLocal, expiresLocal, masterId, serviceIds, serviceSelection, services, issues, isEditable, segmentValid, segmentIds, stepValid, rate, name, masterNameForMessage, promotionId, template, previewBody, channel, channelStrategy, campaignType, audienceMode };`)(...Object.values(globals))
  return { ...result, props, writes, emissions, createdTemplates, cleanup: () => stops.forEach(stop => stop()) }
}

test('clearing saved offer dates sends explicit null PATCH values; active campaigns stay read-only', async () => {
  const harness = editorHarness()
  try {
    await harness.load()
    harness.segmentValid.value = true // The mounted audience picker verifies the selected active segment.
    harness.startsLocal.value = ''
    harness.expiresLocal.value = ''
    await harness.save()
    assert.equal(harness.writes.length, 1)
    assert.equal(harness.writes[0].offer_starts_at, null)
    assert.equal(harness.writes[0].offer_expires_at, null)
    assert.equal(harness.writes[0].sms_recipients_per_minute, 20)
    assert.equal(Object.hasOwn(harness.writes[0], 'metadata_json'), false)
  } finally { harness.cleanup() }
  const active = editorHarness({}, 'active')
  try { await active.load(); await active.save(); assert.equal(active.isEditable.value, false); assert.equal(active.writes.length, 0) }
  finally { active.cleanup() }
})

test('switching master discards service response from previously selected master', async () => {
  const first = deferred(), second = deferred()
  let count = 0
  const harness = editorHarness({ getMasterServices: () => ++count === 1 ? Promise.resolve([{ id: 18, name: 'Initial', is_active: true }]) : count === 2 ? first.promise : second.promise })
  try {
    await harness.load()
    harness.masterId.value = 6
    await nextTick()
    harness.masterId.value = 4
    await nextTick()
    second.resolve([{ id: 18, name: 'Correct', is_active: true }])
    await nextTick(); await nextTick()
    first.resolve([{ id: 99, name: 'Wrong master', is_active: true }])
    await nextTick(); await nextTick()
    assert.deepEqual(harness.services.value.map(item => item.id), [18])
    assert.deepEqual(harness.serviceIds.value, [])
  } finally { harness.cleanup() }
})

test('ordinary publicly redeemable promotions cannot authorize offer campaign drafts', async () => {
  const harness = editorHarness({ adminGetPromotions: async () => ({ items: [{ id: 3, name_uk: 'Public discount', discount_percent: 30, discount_type: 'percent', is_active: true, recipient_offer_only: false }] }) })
  try { await harness.load(); await harness.save(); assert.equal(harness.writes.length, 0); assert.ok(harness.issues.value.some(issue => issue.includes('акцію'))) }
  finally { harness.cleanup() }
})

test('wizard readiness waits for audience validation, rejects empty numeric inputs, and saves only on review', async () => {
  const harness = editorHarness({}, 'draft', { step: 5 })
  try {
    await harness.load()
    assert.equal(harness.stepValid.value[2], false)
    assert.equal(harness.stepValid.value[6], false)
    harness.segmentValid.value = true
    await nextTick()
    assert.equal(harness.stepValid.value[6], true)
    harness.rate.value = null
    await nextTick()
    assert.equal(harness.stepValid.value[5], false)
    assert.equal(harness.stepValid.value[6], false)
    harness.rate.value = 20
    await nextTick()
    await harness.save()
    assert.equal(harness.writes.length, 0)
    harness.props.step = 6
    await harness.save()
    assert.equal(harness.writes.length, 1)
    assert.ok(harness.emissions.some(([event, value]) => event === 'step-valid' && value[6] === true))
  } finally { harness.cleanup() }
})

test('new wizard preselects requested segments and ignores them for an existing campaign', async () => {
  const fresh = editorHarness({}, 'draft', { campaign: null, initialSegmentIds: [12] })
  const existing = editorHarness({}, 'draft', { initialSegmentIds: [12] })
  try {
    assert.deepEqual(fresh.segmentIds.value, [12])
    assert.equal(fresh.name.value, '')
    assert.equal(fresh.template.value, '')
    assert.equal(fresh.audienceMode.value, 'segments')
    await existing.load()
    assert.deepEqual(existing.segmentIds.value, [1])
  } finally { fresh.cleanup(); existing.cleanup() }
})

test('configurable offers accept a selected 100 percent promotion and preserve Telegram fallback', async () => {
  const harness = editorHarness({ adminGetPromotions: async () => ({ items: [{ id: 3, name_uk: 'Free100', discount_percent: 100, discount_type: 'percent', is_active: true, recipient_offer_only: true }] }) })
  try {
    harness.props.campaign.offer_audience_mode = 'segments'
    await harness.load()
    harness.segmentValid.value = true
    harness.channel.value = 'telegram'
    harness.channelStrategy.value = 'telegram_then_sms'
    await harness.save()
    assert.equal(harness.writes.length, 1)
    assert.equal(harness.writes[0].offer_promotion_id, 3)
    assert.equal(harness.writes[0].offer_audience_mode, 'segments')
    assert.equal(harness.writes[0].channel, 'telegram')
    assert.equal(harness.writes[0].channel_strategy, 'telegram_then_sms')
    assert.equal(harness.createdTemplates[0].channel, 'telegram')
    assert.equal(harness.createdTemplates[0].campaign_type, 're_engagement')
  } finally { harness.cleanup() }
  const legacy = editorHarness({ adminGetPromotions: async () => ({ items: [{ id: 3, name_uk: 'Free100', discount_percent: 100, discount_type: 'percent', is_active: true, recipient_offer_only: true }] }) })
  try { await legacy.load(); legacy.segmentValid.value = true; await legacy.save(); assert.equal(legacy.writes.length, 0) }
  finally { legacy.cleanup() }
})

test('view-only offer editor cannot persist changed fields', async () => {
  const harness = editorHarness({}, 'draft', { readonly: true })
  try {
    await harness.load()
    harness.segmentValid.value = true
    harness.name.value = 'Changed from view'
    assert.equal(harness.isEditable.value, false)
    await harness.save()
    assert.equal(harness.writes.length, 0)
  } finally { harness.cleanup() }
})

test('Telegram-only message accepts emoji but SMS fallback retains provider validation', async () => {
  const harness = editorHarness()
  try {
    harness.props.campaign.offer_audience_mode = 'segments'
    await harness.load()
    harness.channel.value = 'telegram'
    harness.template.value = 'Привіт 🎉'
    assert.equal(harness.stepValid.value[3], true)
    harness.channelStrategy.value = 'telegram_then_sms'
    assert.equal(harness.stepValid.value[3], false)
  } finally { harness.cleanup() }
})

test('booking service select preserves numeric IDs and preview does not modify the SMS template', async () => {
  const harness = editorHarness()
  try {
    await harness.load()
    harness.serviceSelection.value = ['18', '18', '21']
    assert.deepEqual(harness.serviceIds.value, [18, 21])
    harness.masterNameForMessage.value = 'Андрія'
    harness.template.value = 'До {{master_name}}: {{offer_link}}'
    assert.equal(harness.previewBody.value, 'До Андрія: https://soulcuts.com.ua/booking?offer=preview')
    assert.equal(harness.template.value, 'До {{master_name}}: {{offer_link}}')
    assert.equal(harness.writes.length, 0)
  } finally { harness.cleanup() }
})

test('uncertain key cannot bypass preview after changed configuration; runtime status preserves safe retry', async () => {
  const keys = []
  const harness = reviewHarness({ createCampaignRun: async (_id, body) => { keys.push(body.idempotency_key); if (keys.length === 1) throw Error('never reached backend'); return { id: 6 } } })
  try {
    await harness.loadPreview()
    await harness.launch()
    harness.props.campaign.offer_service_ids = [19]
    await harness.launch()
    assert.deepEqual(keys, ['stable-test-key'])
    assert.equal(harness.launchKey.value, 'stable-test-key')
    await harness.loadPreview()
    harness.props.campaign.status = 'active'
    // The stored attempt was for the previous service scope. Even runtime status
    // changes cannot make that older scope match newly saved conditions.
    await harness.launch()
    assert.equal(keys.length, 1)
    await harness.loadPreview()
    await harness.launch()
    assert.deepEqual(keys, ['stable-test-key', 'stable-test-key'])
  } finally { harness.cleanup() }
  let recoveryWrites = 0
  const recovered = reviewHarness({ createCampaignRun: async () => { ++recoveryWrites; throw Error('accepted but client timeout') } })
  try {
    await recovered.loadPreview()
    await recovered.launch()
    recovered.props.campaign.status = 'active'
    recovered.props.campaign.sent_count = 1
    await recovered.launch()
    assert.equal(recovered.launchKey.value, 'stable-test-key')
    assert.equal(recoveryWrites, 2)
  } finally { recovered.cleanup() }
})

test('run and recipient pagination retain totals and ignore late responses from older pages', async () => {
  const first = deferred(), second = deferred(), calls = []
  const harness = reviewHarness({ getCampaignRunMembers: (_campaign, _run, page) => { calls.push(page); return page === 1 ? first.promise : second.promise }, getCampaignRuns: async (_id, page) => ({ items: [{ id: page }], total: 65 }) })
  try {
    const one = harness.inspectRun(6, 1)
    const two = harness.inspectRun(6, 2)
    second.resolve({ items: [{ id: 51 }], total: 81 })
    await two
    first.resolve({ items: [{ id: 1 }], total: 81 })
    await one
    assert.deepEqual(calls, [1, 2])
    assert.equal(harness.members.value[0].id, 51)
    assert.equal(harness.memberPage.value, 2)
    assert.equal(harness.memberTotal.value, 81)
    await harness.loadRuns(2)
    assert.equal(harness.runsPage.value, 2)
    assert.equal(harness.runsTotal.value, 65)
  } finally { harness.cleanup() }
})

test('scheduled wall time respects the selected timezone and rejects DST gaps', () => {
  assert.equal(localDateTimeToIso('2027-01-05T10:00', 'Europe/Warsaw'), '2027-01-05T09:00:00.000Z')
  assert.equal(localDateTimeToIso('2027-07-05T10:00', 'UTC'), '2027-07-05T10:00:00.000Z')
  assert.equal(localDateTimeToIso('2027-03-28T02:30', 'Europe/Warsaw'), null)
})
