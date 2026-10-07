import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')
// Exercise the actual adapter without Nuxt bootstrapping. Unrelated parser imports
// are unused by these API operations and removed after TypeScript compilation.
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/^import .* from .*;\n/gm, '')
const calls = []
let response = {}
const mockApi = () => async (path, options = {}) => {
  calls.push({ path, ...options })
  return response
}
const useBackofficeApi = vm.compileFunction(
  `${compiled.replace('export const useBackofficeApi', 'const useBackofficeApi')}; return useBackofficeApi`,
  ['useApi', 'useRuntimeConfig'],
)(mockApi, () => ({ public: { apiBase: 'http://test.invalid/api/v1' } }))
const api = useBackofficeApi()
const reset = (next = {}) => { calls.length = 0; response = next }
const rules = { combine: 'all', conditions: [{ type: 'last_visit_age', min: 3, max: 12, unit: 'calendar_months' }], exclusions: [{ type: 'upcoming_booking', present: true }] }

test('segment lifecycle uses documented verbs, revision and offset pagination', async () => {
  reset({ id: 4, rules })
  await api.createSegment({ name: 'Return', rules })
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].path, '/backoffice/segments')
  await api.updateSegment(4, { expected_revision: 2, name: 'Updated' })
  assert.deepEqual(calls[1], { path: '/backoffice/segments/4', method: 'PATCH', body: { expected_revision: 2, name: 'Updated' } })
  await api.archiveSegment(4)
  assert.equal(calls[2].path, '/backoffice/segments/4/archive')
  await api.getSegments({ status: 'archived', offset: 20, limit: 20 })
  assert.deepEqual(calls[3].query, { status: 'archived', offset: 20, limit: 20 })
})

test('preview and subsequent members pass server evaluation timestamps unchanged', async () => {
  reset({ evaluated_at: '2026-09-06T12:00:00+03:00', total: 0, items: [] })
  const result = await api.previewSegment({ rules, limit: 25, offset: 0 })
  assert.deepEqual(result, response)
  assert.deepEqual(calls[0].body, { rules, limit: 25, offset: 0 })
  await api.getSegmentMembers(4, { evaluated_at: result.evaluated_at, limit: 25, offset: 25 })
  assert.equal(calls[1].query.evaluated_at, result.evaluated_at)
})

test('segment campaign drafts never carry competing inline audience filters', async () => {
  reset({ id: 9, name: 'Return', segment_ids: [4, 5], status: 'draft' })
  const campaign = await api.createMessagingCampaign({ name: 'Return', type: 'manual', segment_ids: [4, 5], channel_strategy: 'telegram_then_sms', exclude_upcoming_booking: true, marketing_frequency_days: 14 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].body.status, 'draft')
  assert.deepEqual(calls[0].body.segment_ids, [4, 5])
  assert.equal(calls[0].body.channel_strategy, 'telegram_then_sms')
  assert.equal(calls[0].body.exclude_upcoming_booking, true)
  assert.equal(calls[0].body.marketing_frequency_days, 14)
  assert.ok(!('audience' in calls[0].body))
  assert.deepEqual(campaign.segment_ids, [4, 5])
  assert.ok(calls.every(call => !call.path.includes('/runs') && !call.path.includes('/start')))
})

test('campaign rate and automation delay use typed backend fields, including sparse updates', async () => {
  reset({ id: 9, status: 'draft' })
  await api.createMessagingCampaign({ name: 'Review reminder', type: 'post_visit_review_request', max_messages_per_minute: 77, automation_delay: '1h' })
  assert.equal(calls[0].body.sms_recipients_per_minute, 77)
  assert.equal(calls[0].body.review_delay_minutes, 60)
  await api.updateMessagingCampaign(9, { max_messages_per_minute: 40 })
  assert.equal(calls.at(-1).body.sms_recipients_per_minute, 40)
  assert.ok(!('review_delay_minutes' in calls.at(-1).body))
  await api.updateMessagingCampaign(9, { name: 'Rename only' })
  assert.ok(!('sms_recipients_per_minute' in calls.at(-1).body))
  await api.updateMessagingCampaign(9, { automation_delay: 'immediate' })
  assert.equal(calls.at(-1).body.review_delay_minutes, 0)
  await api.updateMessagingCampaign(9, { automation_delay: '24h' })
  assert.equal(calls.at(-1).body.review_delay_minutes, 1440)
  const priorCalls = calls.length
  await assert.rejects(api.createMessagingCampaign({ name: 'Bad delay', automation_delay: 'custom', message_body: 'Hello' }), /Невідомий інтервал/)
  assert.equal(calls.length, priorCalls, 'invalid delay must be rejected before template creation')
})

test('unsupported specific customer IDs never create a template or broad campaign', async () => {
  reset({ id: 1 })
  const payload = { name: 'Narrow list', message_body: 'Hello', audience_rules: [{ type: 'specific_clients', client_ids: [12] }], segment_ids: [] }
  await assert.rejects(api.createMessagingCampaign(payload), /конкретними ID/)
  await assert.rejects(api.createSmsCampaign(payload), /конкретними ID/)
  assert.equal(calls.length, 0)
})

test('incomplete inline rules cannot silently broaden an audience or create a template', async () => {
  const invalidRules = [
    [{ type: 'selected_barber' }],
    [{ type: 'selected_barber', barber_id: -1 }],
    [{ type: 'selected_service' }],
    [{ type: 'selected_service', service_id: 0 }],
    [{ type: 'visited_date_range' }],
    [{ type: 'visited_date_range', date_from: 'not-a-date' }],
    [{ type: 'visited_date_range', date_from: '2026-10-12', date_to: '2026-10-11' }],
    [{ type: 'inactive_clients', inactive_days: 0 }],
    [{ type: 'inactive_clients', inactive_days: 1.5 }],
    [{ type: 'unknown_rule' }],
  ]
  for (const audience_rules of invalidRules) {
    reset({ id: 1 })
    await assert.rejects(api.createMessagingCampaign({ name: 'Targeted', message_body: 'Hello', audience_rules, segment_ids: [] }))
    assert.equal(calls.length, 0, `${JSON.stringify(audience_rules)} must fail before any write`)
  }
})

test('explicit all-clients and legacy empty rules keep their existing audience meaning', async () => {
  for (const audience_rules of [[{ type: 'all_clients' }], []]) {
    reset({ id: 1 })
    await api.createMessagingCampaign({ name: 'All clients', audience_rules, segment_ids: [] })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].body.audience.all_clients, true)
  }
})

test('generated template names stay within the backend length limit', async () => {
  reset({ id: 1 })
  await api.createMessagingCampaign({ name: 'N'.repeat(255), message_body: 'Hello' })
  assert.equal(calls[0].path, '/backoffice/messaging/templates')
  assert.ok(calls[0].body.name.length <= 255)
  assert.match(calls[0].body.name, /^N+ template \d+$/)
})

test('legacy inline campaigns remain compatible and clearing segments is explicit', async () => {
  reset({ id: 9, metadata_json: { segment_ids: [4], channel_strategy: 'sms_then_telegram' } })
  const campaign = await api.getMessagingCampaign(9)
  assert.deepEqual(campaign.segment_ids, [4])
  assert.equal(campaign.channel_strategy, 'sms_then_telegram')
  await api.updateMessagingCampaign(9, { segment_ids: [], audience_rules: [{ type: 'inactive_clients', inactive_days: 90 }] })
  assert.deepEqual(calls.at(-1).body.segment_ids, [])
  assert.equal(calls.at(-1).body.audience.inactive_days, 90)
  await api.updateMessagingCampaign(9, { name: 'Rename' })
  assert.ok(!('audience' in calls.at(-1).body))
  assert.ok(!('segment_ids' in calls.at(-1).body))
  assert.ok(!('status' in calls.at(-1).body))
  assert.ok(!('template_id' in calls.at(-1).body))
  assert.ok(!('review_delay_minutes' in calls.at(-1).body))
  await api.updateMessagingCampaign(9, { segment_ids: [] })
  assert.deepEqual(calls.at(-1).body.segment_ids, [])
  assert.ok(!('audience' in calls.at(-1).body), 'clearing segment refs must preserve the exact stored legacy filter')
})

test('campaign edits preserve metadata, audience and shared templates without creating templates', async () => {
  reset({ id: 9, status: 'active', template_id: 12, audience: { inactive_days: 180 }, metadata_json: {
    audience_rules: [], language_versions: { uk: 'Текст' }, quiet_hours_enabled: true, inline_button_text: 'Записатися',
  } })
  const existing = await api.getMessagingCampaign(9)
  assert.deepEqual(existing.audience_rules, [{ type: 'inactive_clients', inactive_days: 180 }])
  await api.updateMessagingCampaign(9, { message_body: 'Campaign-local text' })
  const update = calls.at(-1)
  assert.equal(update.method, 'PUT')
  assert.equal(update.path, '/backoffice/messaging/campaigns/9')
  assert.equal(update.body.metadata_json.message_body, 'Campaign-local text')
  assert.equal(update.body.metadata_json.quiet_hours_enabled, true)
  assert.equal(update.body.metadata_json.inline_button_text, 'Записатися')
  assert.deepEqual(update.body.metadata_json.language_versions, { uk: 'Текст' })
  assert.ok(!('template_id' in update.body))
  assert.ok(!('audience' in update.body))
  assert.ok(!('review_platform' in update.body))
  assert.ok(calls.every(call => !call.path.includes('/templates')))
  reset({ id: 10, template_id: 12 })
  await api.createMessagingCampaign({ name: 'Draft', template_id: 12, message_body: 'Local override' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].body.template_id, 12)
})

test('view separation preserves omitted view and run launch retains retry identity', async () => {
  reset({ items: [], total: 0 })
  await api.getMessagingCampaigns(1, 50, { view: 'notifications' })
  assert.equal(calls[0].query.view, 'notifications')
  await api.getMessagingCampaigns()
  assert.equal(calls[1].query.view, undefined)
  await api.previewCampaignAudience(9, 2, 500)
  assert.deepEqual(calls[2], { path: '/backoffice/messaging/campaigns/9/audience-preview', method: 'POST', query: { page: 2, page_size: 100 } })
  const launch = { idempotency_key: 'stable-retry-key', scheduled_at: '2026-09-10T10:00:00+03:00' }
  await api.createCampaignRun(9, launch)
  await api.createCampaignRun(9, launch)
  assert.deepEqual(calls[3].body, calls[4].body)
  await api.getCampaignRunMembers(9, 2, 3, 25)
  assert.deepEqual(calls[5], { path: '/backoffice/messaging/campaigns/9/runs/2/members', query: { page: 3, page_size: 25 } })
})

test('journal retains actual channel and source instead of implying Telegram delivery', async () => {
  reset({ items: [{ id: 1, customer_id: 3, campaign_id: 9, channel: 'sms', status: 'sent', created_at: '2026-09-06T10:00:00Z', error_reason: null }], total: 1 })
  const logs = await api.getMessagingCampaignLogs(9)
  assert.equal(logs.items[0].channel, 'sms')
  assert.equal(logs.items[0].campaign_id, 9)
  assert.equal(logs.items[0].client_id, 3)
  assert.equal(logs.items[0].client_name, 'Клієнт №3')
})

test('revoking marketing consent is explicit even when global opt-out remains unchecked', async () => {
  reset()
  await api.updateCustomerCommunication(3, { marketing_consent: false, opt_out: false })
  assert.equal(calls.at(-1).body.marketing_consent, 'opted_out')
  assert.equal(calls.at(-1).body.do_not_contact, false)
  await api.updateCustomerCommunication(3, { marketing_consent: true, opt_out: false })
  assert.equal(calls.at(-1).body.marketing_consent, 'opted_in')
  await api.updateCustomerCommunication(3, { preferred_language: 'uk' })
  assert.equal(calls.at(-1).body.marketing_consent, undefined)
})

test('offer campaign adapter preserves typed delivery settings and explicitly clears validity', async () => {
  const body = { name: 'New Master', channel: 'sms', channel_strategy: 'telegram_then_sms', status: 'draft', sending_window: { start: '10:00', end: '18:00', days: [0, 1, 2, 3, 4, 5, 6] }, sms_recipients_per_minute: 20, offer_master_id: 4, offer_promotion_id: 5, offer_service_ids: [18], offer_starts_at: null, offer_expires_at: null, master_name_for_message: 'Майстра' }
  reset({ id: 9, ...body })
  const created = await api.createNewMasterCampaign(body)
  assert.deepEqual(calls[0], { path: '/backoffice/messaging/campaigns', method: 'POST', body })
  assert.equal(created.sms_recipients_per_minute, 20)
  assert.deepEqual(created.sending_window, body.sending_window)
  await api.updateNewMasterCampaign(9, { offer_starts_at: null, offer_expires_at: null })
  assert.deepEqual(calls[1], { path: '/backoffice/messaging/campaigns/9', method: 'PATCH', body: { offer_starts_at: null, offer_expires_at: null } })
  await api.getCampaignReadiness(9)
  assert.equal(calls[2].path, '/backoffice/messaging/campaigns/9/readiness')
  await api.createCampaignRun(9, { idempotency_key: 'test-key', test_customer_id: 4 })
  assert.deepEqual(calls[3].body, { idempotency_key: 'test-key', test_customer_id: 4 })
  const filters = { campaign_id: 9, run_id: 2, master_id: 4, promotion_id: 5, date_from: '2026-10-05T10:00:00+03:00', date_to: '2026-10-06T10:00:00+03:00' }
  await api.getCampaignOfferAnalytics(filters)
  assert.deepEqual(calls[4], { path: '/backoffice/messaging/campaign-offer-analytics', query: filters })
})
