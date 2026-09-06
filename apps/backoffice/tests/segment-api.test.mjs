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
