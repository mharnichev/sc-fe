<script setup lang="ts">
import type { Customer } from '~/composables/useBackofficeApi'
import type { MessagingCampaign } from '~/types/messaging'
import type { CampaignReadiness, CampaignOfferAnalytics, CampaignQueueProgress } from '~/types/newMaster'
import type { CampaignAudiencePreview, CampaignRun, CampaignRunDetail, CampaignRunMember } from '~/types/segments'
import { deliveryReasonLabel } from '~/utils/campaignAudience.mjs'
import { kyivLocalToIso, newMasterLaunchFingerprint } from '~/utils/newMasterCampaign.mjs'

const props = defineProps<{ campaign: MessagingCampaign; dirty: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const api = useBackofficeApi()
const { apiErrorMessage } = useBookingFormatting()
const { canSendMessagingCampaigns, canViewMessagingAnalytics } = useBackofficeAccess()
const preview = ref<CampaignAudiencePreview | null>(null)
const previewLoading = ref(false)
const previewError = ref('')
const readiness = ref<CampaignReadiness | null>(null)
const readinessLoading = ref(false)
const readinessError = ref('')
const previewStale = ref(true)
const runs = ref<CampaignRun[]>([])
const runsPage = ref(1)
const runsTotal = ref(0)
const runsLoading = ref(false)
let runsRequest = 0
const runsError = ref('')
const run = ref<CampaignRunDetail | null>(null)
const members = ref<CampaignRunMember[]>([])
const memberPage = ref(1)
const memberTotal = ref(0)
const runLoading = ref(false)
const queue = ref<CampaignQueueProgress | null>(null)
const showLaunch = ref(false)
const showTestLaunch = ref(false)
const testCustomerId = ref(0)
const testCustomer = ref<Customer | null>(null)
const testCustomerLoading = ref(false)
let customerRequest = 0
const testLaunchKey = ref('')
const testLaunchFingerprint = ref('')
watch(testCustomerId, () => { testLaunchKey.value = ''; testLaunchFingerprint.value = ''; ++customerRequest; testCustomer.value = null; showTestLaunch.value = false; testCustomerLoading.value = false })
const loadTestCustomer = async () => {
  if (!canSendMessagingCampaigns.value || !Number.isSafeInteger(testCustomerId.value) || testCustomerId.value <= 0) return
  const request = ++customerRequest
  const id = testCustomerId.value
  testCustomerLoading.value = true
  actionError.value = ''
  try {
    const customer = await api.getCustomer(id)
    if (request === customerRequest && id === testCustomerId.value) { testCustomer.value = customer; testLaunchKey.value = sessionStorage.getItem(`${launchStorageKey.value}-test-${id}`) || ''; testLaunchFingerprint.value = sessionStorage.getItem(`${launchStorageKey.value}-test-${id}-fingerprint`) || '' }
  } catch (cause) { if (request === customerRequest) actionError.value = apiErrorMessage(cause, 'Не вдалося перевірити тестового отримувача.') }
  finally { if (request === customerRequest) testCustomerLoading.value = false }
}
const launching = ref(false)
const actionPending = ref(false)
const actionError = ref('')
const analytics = ref<CampaignOfferAnalytics | null>(null)
const analyticsError = ref('')
const filterRunId = ref(0)
const periodFrom = ref('')
const periodTo = ref('')
const launchKey = ref('')
const launchFingerprint = ref('')
const launchConditionsFingerprint = computed(() => newMasterLaunchFingerprint(props.campaign))
const launchStorageKey = computed(() => `new-master-launch-${props.campaign.id}`)
const offerReadyForReview = computed(() => !!props.campaign.offer_starts_at && !!props.campaign.offer_expires_at)
const canLaunch = computed(() => canSendMessagingCampaigns.value && !props.dirty && !previewStale.value && !!preview.value && !!preview.value.communication_eligible_recipients && !!readiness.value?.ready && !previewLoading.value && !readinessLoading.value && !launching.value && offerReadyForReview.value)
const runStatusLabels: Record<string, string> = { scheduled: 'Очікує часу відправки', snapshotted: 'Аудиторію зафіксовано', completed: 'Завершено', cancelled: 'Скасовано', failed: 'Помилка', queued: 'У черзі', pending: 'Очікує', dispatching: 'Відправляється', accepted: 'Прийнято провайдером', sent: 'Прийнято провайдером', delivered: 'Доставлено', skipped: 'Пропущено', processing: 'В обробці' }
const statusLabel = (status: string) => runStatusLabels[status] || status
const canRetryLaunch = computed(() => canSendMessagingCampaigns.value && !props.dirty && !launching.value && !!launchKey.value && launchFingerprint.value === launchConditionsFingerprint.value)
const canRetryTestLaunch = computed(() => canSendMessagingCampaigns.value && !props.dirty && !launching.value && !!testLaunchKey.value && testLaunchFingerprint.value === launchConditionsFingerprint.value)
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) : '—'
const money = (value: number) => `${value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`
const serviceNames = ref<Record<number, string>>({})
const masterLabel = ref('')
const promotionLabel = ref('')
const servicesLabel = computed(() => (props.campaign.offer_service_ids || []).map(id => serviceNames.value[id] || `Послуга #${id}`).join(', ') || '—')
const loadLabels = async () => {
  const id = props.campaign.offer_master_id
  if (!id) return
  try {
    const [services, masters, promotions] = await Promise.all([api.getMasterServices(id), api.adminGetMasters(1, 200), api.adminGetPromotions(1, 200)])
    if (props.campaign.offer_master_id !== id) return
    serviceNames.value = Object.fromEntries((Array.isArray(services) ? services : services.items).map(item => [item.id, item.title_uk || item.name]))
    const master = (Array.isArray(masters) ? masters : masters.items).find(item => item.id === id)
    masterLabel.value = master?.full_name_uk || master?.full_name || master?.name || `#${id}`
    promotionLabel.value = promotions.items.find(item => item.id === props.campaign.offer_promotion_id)?.name_uk || `#${props.campaign.offer_promotion_id}`
  } catch { serviceNames.value = {} }
}
const sample = computed(() => preview.value?.items.find(item => item.rendered_message) || null)
const renderedLength = computed(() => sample.value?.rendered_message?.length ?? null)
const exclusionCounts = computed(() => preview.value?.items.reduce<Record<string, number>>((result, item) => {
  if (!item.eligible) result[item.exclusion_reason || 'unknown'] = (result[item.exclusion_reason || 'unknown'] || 0) + 1
  return result
}, {}) || {})
const launchContext = computed(() => [
  { label: 'Кампанія', value: props.campaign.name },
  { label: 'Майстер', value: `${masterLabel.value || props.campaign.offer_master_id} · ${props.campaign.master_name_for_message || '—'}` },
  { label: 'Акція', value: `30% · ${promotionLabel.value || props.campaign.offer_promotion_id || '—'}` },
  { label: 'Послуги', value: servicesLabel.value },
  { label: 'Період', value: `${formatDate(props.campaign.offer_starts_at)} — ${formatDate(props.campaign.offer_expires_at)}` },
  { label: 'Канали', value: props.campaign.channel_strategy === 'telegram_then_sms' ? 'Telegram → SMS' : 'SMS' },
  { label: 'Аудиторія', value: `${preview.value?.total ?? '—'} загалом; ${preview.value?.communication_eligible_recipients ?? '—'} доступні до зв’язку` },
  { label: 'SMS', value: sample.value?.rendered_message || props.campaign.message_body || '—' },
  { label: 'Відправка', value: `${props.campaign.sending_window?.start || '10:00'}–${props.campaign.sending_window?.end || '18:00'} Europe/Kyiv · ${props.campaign.sms_recipients_per_minute || 20}/хв` },
  { label: 'Оцінка вартості', value: preview.value?.estimated_cost?.amount == null ? 'Недоступна у провайдера' : String(preview.value.estimated_cost.amount) },
])

let generation = 0
let previewRequest = 0
let readinessRequest = 0
const campaignFingerprint = computed(() => JSON.stringify(props.campaign))
const invalidate = () => {
  ++generation
  ++previewRequest
  ++readinessRequest
  previewLoading.value = false
  readinessLoading.value = false
  previewStale.value = true
  preview.value = null
  readiness.value = null
  showLaunch.value = false
  showTestLaunch.value = false
}
watch(() => props.dirty, value => { if (value) invalidate() }, { flush: 'sync' })
watch(campaignFingerprint, () => { invalidate(); void loadLabels() }, { flush: 'sync' })
const loadPreview = async () => {
  if (props.dirty || previewLoading.value) return
  const request = ++previewRequest
  const version = generation
  const fingerprint = campaignFingerprint.value
  const current = () => request === previewRequest && version === generation && fingerprint === campaignFingerprint.value && !props.dirty
  previewLoading.value = true
  previewError.value = ''
  preview.value = null
  previewStale.value = true
  try {
    const result = await api.previewCampaignAudience(props.campaign.id, 1, 50)
    if (!current()) return
    preview.value = result
    previewStale.value = false
    await loadReadiness()
  }
  catch (cause) { if (current()) previewError.value = apiErrorMessage(cause, 'Не вдалося створити попередній перегляд.') }
  finally { if (request === previewRequest) previewLoading.value = false }
}
const loadReadiness = async () => {
  const request = ++readinessRequest
  const version = generation
  const fingerprint = campaignFingerprint.value
  const current = () => request === readinessRequest && version === generation && fingerprint === campaignFingerprint.value && !props.dirty
  readinessLoading.value = true
  readinessError.value = ''
  try {
    const result = await api.getCampaignReadiness(props.campaign.id)
    if (current()) readiness.value = result
  }
  catch (cause) { if (current()) { readiness.value = null; readinessError.value = apiErrorMessage(cause, 'Не вдалося перевірити готовність.') } }
  finally { if (request === readinessRequest) readinessLoading.value = false }
}
const loadRuns = async (page = runsPage.value) => {
  const request = ++runsRequest
  runsLoading.value = true
  runsError.value = ''
  try {
    const result = await api.getCampaignRuns(props.campaign.id, page, 50)
    if (request !== runsRequest) return
    runs.value = result.items
    runsTotal.value = result.total ?? result.items.length
    runsPage.value = page
  }
  catch (cause) { if (request === runsRequest) runsError.value = apiErrorMessage(cause, 'Не вдалося завантажити запуски.') }
  finally { if (request === runsRequest) runsLoading.value = false }
}
let runRequest = 0
const inspectRun = async (id: number, page = 1) => {
  const request = ++runRequest
  runLoading.value = true
  actionError.value = ''
  try {
    const [detail, result, progress] = await Promise.all([
      api.getCampaignRun(props.campaign.id, id), api.getCampaignRunMembers(props.campaign.id, id, page, 50), api.getCampaignQueue(props.campaign.id, id),
    ])
    if (request !== runRequest) return
    run.value = detail
    members.value = result.items
    memberPage.value = page
    memberTotal.value = result.total ?? result.items.length
    queue.value = progress
  }
  catch (cause) { if (request === runRequest) actionError.value = apiErrorMessage(cause, 'Не вдалося завантажити стан запуску.') }
  finally { if (request === runRequest) runLoading.value = false }
}
const loadAnalytics = async () => {
  if (!canViewMessagingAnalytics.value) return
  analyticsError.value = ''
  const from = periodFrom.value ? kyivLocalToIso(periodFrom.value) : null
  const to = periodTo.value ? kyivLocalToIso(periodTo.value) : null
  if ((periodFrom.value && !from) || (periodTo.value && !to) || (from && to && from >= to)) { analyticsError.value = 'Вкажіть коректний період: початок раніше кінця.'; return }
  try {
    analytics.value = await api.getCampaignOfferAnalytics({
      campaign_id: Number(props.campaign.id),
      ...(filterRunId.value ? { run_id: filterRunId.value } : {}),
      ...(periodFrom.value && kyivLocalToIso(periodFrom.value) ? { date_from: kyivLocalToIso(periodFrom.value)! } : {}),
      ...(periodTo.value && kyivLocalToIso(periodTo.value) ? { date_to: kyivLocalToIso(periodTo.value)! } : {}),
    })
  }
  catch (cause) { analyticsError.value = apiErrorMessage(cause, 'Не вдалося завантажити аналітику.') }
}
const testLaunchContext = computed(() => [
  { label: 'Тестовий отримувач', value: testCustomer.value ? `${testCustomer.value.name || 'Клієнт'} · #${testCustomer.value.id} · ${testCustomer.value.phone || 'без телефону'}` : '—' },
  { label: 'Обсяг', value: 'Один явно вибраний клієнт; сервер перевіряє його придатність і згоду.' },
  ...launchContext.value,
])
const launch = async (test = false) => {
  const retry = test ? canRetryTestLaunch.value : canRetryLaunch.value
  if ((!canLaunch.value && !retry) || (test && (!testCustomer.value || testCustomer.value.id !== testCustomerId.value))) return
  const customerId = test ? testCustomer.value!.id : null
  const key = test ? testLaunchKey : launchKey
  const fingerprint = test ? testLaunchFingerprint : launchFingerprint
  const storageKey = test ? `${launchStorageKey.value}-test-${customerId}` : launchStorageKey.value
  launching.value = true
  actionError.value = ''
  try {
    // A server check immediately before mutation catches worker/provider changes.
    if (!retry) await loadReadiness()
    if (props.dirty || (!retry && (!readiness.value?.ready || previewStale.value || !preview.value))) { actionError.value = 'Готовність змінилася. Оновіть перевірку й перегляд.'; return }
    if (test && (testCustomer.value?.id !== customerId || testCustomerId.value !== customerId)) return
    key.value ||= sessionStorage.getItem(storageKey) || crypto.randomUUID()
    fingerprint.value = launchConditionsFingerprint.value
    sessionStorage.setItem(storageKey, key.value)
    sessionStorage.setItem(`${storageKey}-fingerprint`, fingerprint.value)
    const result = await api.createCampaignRun(props.campaign.id, { idempotency_key: key.value, ...(customerId ? { test_customer_id: customerId } : {}) })
    sessionStorage.removeItem(storageKey)
    sessionStorage.removeItem(`${storageKey}-fingerprint`)
    fingerprint.value = ''
    key.value = ''
    showLaunch.value = false
    invalidate()
    await Promise.all([loadRuns(), loadAnalytics()])
    await inspectRun(result.id)
    emit('changed')
  }
  catch (cause) { actionError.value = apiErrorMessage(cause, 'Не вдалося запустити кампанію. Повторіть з тим самим ключем.') }
  finally { launching.value = false }
}
const lifecycle = async (action: 'pause' | 'resume' | 'cancel') => {
  if (!canSendMessagingCampaigns.value || actionPending.value) return
  actionPending.value = true
  actionError.value = ''
  try {
    if (action === 'cancel' && run.value) await api.cancelCampaignRunUnsent(props.campaign.id, run.value.id)
    if (action === 'pause') await api.pauseCampaign(props.campaign.id)
    if (action === 'resume') await api.resumeCampaign(props.campaign.id)
    await loadRuns()
    if (run.value) await inspectRun(run.value.id)
    await loadAnalytics()
    emit('changed')
  }
  catch (cause) { actionError.value = apiErrorMessage(cause, 'Не вдалося змінити стан кампанії.') }
  finally { actionPending.value = false }
}
onMounted(() => { launchKey.value = sessionStorage.getItem(launchStorageKey.value) || ''; launchFingerprint.value = sessionStorage.getItem(`${launchStorageKey.value}-fingerprint`) || ''; loadReadiness(); loadRuns(); loadAnalytics(); loadLabels() })
</script>

<template>
  <div class="space-y-6" data-testid="new-master-review">
    <section class="base-card space-y-4 rounded-3xl p-5">
      <h2 class="text-xl font-semibold">Перегляд і готовність</h2>
      <p class="text-sm text-ui-muted">Для запуску збережіть усі зміни, задайте дати та створіть свіжий перегляд. Сервер повторно перевіряє аудиторію і виконання.</p>
      <button data-testid="generate-preview" class="rounded-full border px-4 py-2 disabled:opacity-50" :disabled="previewLoading || dirty" @click="loadPreview">{{ previewLoading ? 'Обчислення…' : 'Створити свіжий перегляд' }}</button>
      <p v-if="previewError" role="alert" class="text-sm text-red-500">{{ previewError }}</p>
      <p v-if="previewStale" class="text-sm text-amber-500">Перегляд відсутній або застарів після зміни умов.</p>
      <template v-if="preview">
        <div class="grid gap-3 sm:grid-cols-3"><div class="rounded-xl bg-ui-subtle p-3">Аудиторія <strong class="block text-xl">{{ preview.total }}</strong></div><div class="rounded-xl bg-ui-subtle p-3">Доступні до зв’язку <strong data-testid="eligible-count" class="block text-xl">{{ preview.communication_eligible_recipients ?? '—' }}</strong></div><div class="rounded-xl bg-ui-subtle p-3">SMS / Telegram <strong class="block text-xl">{{ preview.sms_eligible_recipients ?? '—' }} / {{ preview.telegram_eligible_recipients ?? '—' }}</strong></div></div>
        <div class="grid gap-3 sm:grid-cols-3"><div>SMS частин: {{ preview.estimated_sms_parts ?? '—' }}</div><div>Оцінка вартості: {{ preview.estimated_cost?.amount == null ? 'недоступна' : preview.estimated_cost.amount }}</div><div>Баланс: {{ preview.balance?.amount == null ? 'не підтримується провайдером' : preview.balance.amount }}</div></div>
        <div v-if="sample" class="rounded-xl bg-ui-subtle p-4"><h3 class="font-medium">Реальний персоналізований приклад</h3><p data-testid="rendered-sms" class="mt-2 whitespace-pre-wrap">{{ sample.rendered_message }}</p><p class="text-xs text-ui-muted">{{ renderedLength }} символів · {{ sample.sms_parts ?? '—' }} SMS частин</p></div>
        <p v-if="!sample" class="text-sm text-amber-500">Персоналізований приклад недоступний. Перевірте дати, ім’я майстра та шаблон.</p>
        <div v-if="Object.keys(exclusionCounts).length"><h3 class="font-medium">Причини виключення на цій сторінці</h3><p v-for="(count, reason) in exclusionCounts" :key="reason" class="text-sm">{{ deliveryReasonLabel(reason) }}: {{ count }}</p></div>
        <p class="text-xs text-ui-muted">Причини деталізовані для перших {{ preview.items.length }} клієнтів; загальна кількість придатних надана сервером для всієї аудиторії.</p>
      </template>
      <div class="border-t pt-4"><div class="flex items-center gap-3"><h3 class="font-semibold">Перевірки готовності</h3><button class="text-sm text-ui-accent underline" :disabled="readinessLoading" @click="loadReadiness">Оновити</button></div><p v-if="readinessError" role="alert" class="text-red-500">{{ readinessError }}</p><p v-if="readiness" data-testid="readiness-status" :class="readiness.ready ? 'text-emerald-500' : 'text-red-500'">{{ readiness.ready ? 'Готово до запуску' : 'Не готово до запуску' }} · {{ readiness.runtime_verification }}</p><div v-for="check in readiness?.checks || []" :key="check.code" class="mt-1 flex gap-2 text-sm"><span :class="check.status === 'ok' || check.status === 'ready' ? 'text-emerald-500' : 'text-red-500'">{{ check.status }}</span><span>{{ check.code }}: {{ check.detail }}</span></div></div>
      <div class="grid gap-2 text-sm sm:grid-cols-2"><p>Майстер {{ masterLabel || campaign.offer_master_id }} · {{ campaign.master_name_for_message }}</p><p>Акція {{ promotionLabel || campaign.offer_promotion_id }} · 30%</p><p>Послуги {{ servicesLabel }}</p><p>Період: {{ formatDate(campaign.offer_starts_at) }} — {{ formatDate(campaign.offer_expires_at) }}</p><p>Вікно: {{ campaign.sending_window?.start }}–{{ campaign.sending_window?.end }} Europe/Kyiv</p><p>Швидкість: {{ campaign.sms_recipients_per_minute }} SMS/хв</p></div>
      <div v-if="canSendMessagingCampaigns" class="space-y-3 border-t pt-4">
        <h3 class="font-semibold">Тест на одному отримувачі</h3>
        <p class="text-sm text-ui-muted">Вкажіть ID тестового клієнта й перевірте ім’я та контакт. Це реальний обмежений запуск: він активує кампанію, видає персональну пропозицію та враховується у ліміті контактів і аналітиці. Чинні згода, аудиторія та денне вікно. Після тесту створіть копію кампанії для змінених умов.</p>
        <div class="flex flex-wrap gap-3"><label class="grid gap-1 text-sm">ID тестового клієнта<input v-model.number="testCustomerId" data-testid="test-customer-id" type="number" min="1" class="new-master-control rounded-xl border p-2" /></label><button :disabled="testCustomerLoading || !testCustomerId" class="text-ui-accent underline disabled:opacity-50" data-testid="load-test-customer" @click="loadTestCustomer">Перевірити отримувача</button></div>
        <p v-if="testCustomer" data-testid="test-customer-summary">{{ testCustomer.name || 'Клієнт' }} · #{{ testCustomer.id }} · {{ testCustomer.phone || 'без телефону' }}</p>
        <button data-testid="open-test-launch-confirm" :disabled="(!canLaunch && !canRetryTestLaunch) || !testCustomer || testCustomer.id !== testCustomerId" class="rounded-full border px-4 py-2 disabled:opacity-50" @click="showTestLaunch = true">{{ canRetryTestLaunch ? 'Перевірити результат попереднього тесту' : 'Перевірити й надіслати тест одному клієнту' }}</button>
      </div>
      <button data-testid="open-launch-confirm" class="rounded-full bg-cyan-700 px-5 py-3 text-white disabled:opacity-50" :disabled="!canLaunch && !canRetryLaunch" @click="showLaunch = true">{{ canRetryLaunch ? 'Перевірити результат попереднього запуску' : 'Перевірити та запустити' }}</button>
    </section>

    <section class="base-card space-y-4 rounded-3xl p-5" data-testid="campaign-runs">
      <div class="flex flex-wrap justify-between gap-2"><h2 class="text-xl font-semibold">Запуски й доставка</h2><button class="text-ui-accent underline" @click="loadRuns()">Оновити</button></div>
      <p v-if="runsError" role="alert" class="text-red-500">{{ runsError }}</p>
      <p v-if="!runs.length" class="text-sm text-ui-muted">Запусків ще немає.</p>
      <div v-for="item in runs" :key="item.id" class="flex flex-wrap items-center gap-3 border-b pb-2 text-sm"><button class="text-ui-accent underline" @click="inspectRun(item.id)">Запуск #{{ item.id }}</button><span>{{ statusLabel(item.status) }}</span><span>{{ item.status === 'scheduled' ? 'Очікує часу/вікна відправки' : formatDate(item.evaluated_at) }}</span><span>Аудиторія: {{ item.audience_count }}</span></div>
      <div v-if="runsTotal > 50" class="flex items-center gap-3 text-sm"><button :disabled="runsLoading || runsPage === 1" class="text-ui-accent underline disabled:opacity-50" @click="loadRuns(runsPage - 1)">Попередні запуски</button><span>Сторінка {{ runsPage }} · {{ runsTotal }} запусків</span><button :disabled="runsLoading || runsPage * 50 >= runsTotal" class="text-ui-accent underline disabled:opacity-50" @click="loadRuns(runsPage + 1)">Наступні запуски</button></div>
      <article v-if="run" class="space-y-3 rounded-xl bg-ui-subtle p-4"><h3 class="font-semibold">Запуск #{{ run.id }} · {{ statusLabel(run.status) }}</h3><div v-if="run.campaign_snapshot.message_body" class="space-y-1 text-sm"><p>Зафіксований текст шаблону</p><p class="whitespace-pre-wrap">{{ run.campaign_snapshot.message_body }}</p><p>Майстер: {{ run.campaign_snapshot.master_name_for_message }} · Акція: {{ run.campaign_snapshot.promotion_name_uk || run.campaign_snapshot.offer_promotion_id }}</p><p v-if="run.campaign_snapshot.test_customer_id">Тестовий запуск для клієнта #{{ run.campaign_snapshot.test_customer_id }}</p></div><p>Поточні статуси: прийнято провайдером (sent): {{ run.delivery_counts.sent || 0 }} · Доставлено: {{ run.delivery_counts.delivered || 0 }} · Помилки: {{ run.delivery_counts.failed || 0 }} · Пропущено: {{ run.delivery_counts.skipped || 0 }}</p><p class="text-xs text-ui-muted">Статуси відображають поточний стан. Прийняття провайдером не означає доставку. Сукупне прийняття, включно з подальшими помилками доставки, наведене в аналітиці.</p><div v-if="queue" class="space-y-2 text-sm"><p>Черга: {{ queue.total }} · {{ queue.paused ? 'На паузі' : queue.cancelled ? 'Скасована' : 'Обробка дозволена' }}</p><div class="flex flex-wrap gap-3"><span v-for="(value, key) in queue.counts" :key="key">{{ statusLabel(String(key)) }}: {{ value }}</span></div><p>Орієнтовне завершення відправки: {{ formatDate(queue.estimated_completion_at) }}</p><p v-if="queue.next_window_at">Наступне вікно відправки: {{ formatDate(queue.next_window_at) }}</p><p class="text-xs text-ui-muted">Оцінка не враховує майбутні пріоритетні повідомлення, повторні спроби та час доставки провайдером.</p></div><div class="flex gap-3"><button v-if="canSendMessagingCampaigns && campaign.status === 'active'" :disabled="actionPending" class="text-ui-accent underline" @click="lifecycle('pause')">Пауза</button><button v-if="canSendMessagingCampaigns && campaign.status === 'paused'" :disabled="actionPending" class="text-ui-accent underline" @click="lifecycle('resume')">Поновити</button><button v-if="canSendMessagingCampaigns && !['cancelled', 'completed'].includes(run.status)" :disabled="actionPending" class="text-red-500 underline" @click="lifecycle('cancel')">Скасувати невідправлені</button></div><div v-for="member in members" :key="member.id" class="border-t pt-2 text-sm"><NuxtLink :to="`/customers/${member.customer_id}`" class="text-ui-accent underline">Клієнт #{{ member.customer_id }}</NuxtLink> · {{ statusLabel(member.status) }} · {{ member.last_error ? deliveryReasonLabel(member.last_error) : 'без помилки' }}</div><div v-if="memberTotal > 50" class="flex flex-wrap items-center gap-3 text-sm"><button :disabled="runLoading || memberPage === 1" class="text-ui-accent underline disabled:opacity-50" @click="inspectRun(run.id, memberPage - 1)">Попередні отримувачі</button><span>Сторінка {{ memberPage }} · {{ memberTotal }} отримувачів</span><button :disabled="runLoading || memberPage * 50 >= memberTotal" class="text-ui-accent underline disabled:opacity-50" @click="inspectRun(run.id, memberPage + 1)">Наступні отримувачі</button></div></article>
    </section>

    <section v-if="canViewMessagingAnalytics" class="base-card space-y-4 rounded-3xl p-5" data-testid="campaign-analytics">
      <h2 class="text-xl font-semibold">Результати пропозиції</h2>
      <div class="grid gap-3 sm:grid-cols-3"><label class="grid gap-1 text-sm">Запуск<select v-model.number="filterRunId" class="new-master-control rounded-xl border p-2"><option :value="0">Усі запуски</option><option v-for="item in runs" :key="item.id" :value="item.id">#{{ item.id }}</option></select></label><label class="grid gap-1 text-sm">Від (Europe/Kyiv)<input v-model="periodFrom" type="datetime-local" class="new-master-control rounded-xl border p-2" /></label><label class="grid gap-1 text-sm">До, виключно (Europe/Kyiv)<input v-model="periodTo" type="datetime-local" class="new-master-control rounded-xl border p-2" /></label></div>
      <p class="text-xs text-ui-muted">Період відбирає когорту запусків за часом фіксації аудиторії (або створення, якщо ще не зафіксована). Метрики цієї когорти накопичуються й після кінця вибраного періоду.</p>
      <button class="text-ui-accent underline" :disabled="!!(periodFrom && !kyivLocalToIso(periodFrom)) || !!(periodTo && !kyivLocalToIso(periodTo))" @click="loadAnalytics">Застосувати фільтри</button>
      <p v-if="analyticsError" role="alert" class="text-red-500">{{ analyticsError }}</p>
      <div v-if="analytics" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm"><div>Аудиторія: <strong>{{ analytics.audience_size }}</strong></div><div>Доступні до зв’язку: <strong>{{ analytics.communication_eligible_recipients }}</strong></div><div>Прийнято провайдером: <strong>{{ analytics.provider_accepted }}</strong></div><div>Доставлено: <strong>{{ analytics.delivered }}</strong></div><div>Технічні запити посилань: <strong>{{ analytics.raw_link_requests }}</strong></div><div>Підтверджені відкриття: <strong>{{ analytics.confirmed_page_opens }}</strong></div><div>Унікальні відвідувачі: <strong>{{ analytics.unique_confirmed_openers }}</strong></div><div>Створено бронювань: <strong>{{ analytics.bookings_created }}</strong></div><div>Скасовано / no-show: <strong>{{ analytics.cancelled_bookings }} / {{ analytics.no_show }}</strong></div><div>Завершено візитів зі знижкою: <strong>{{ analytics.completed_visits }}</strong></div><div>Унікальні клієнти, що скористалися: <strong>{{ analytics.unique_customers_redeemed }}</strong></div><div>Загальна знижка: <strong>{{ money(analytics.total_discount_amount) }}</strong></div><div>Виручка завершених візитів: <strong>{{ money(analytics.observed_completed_revenue) }}</strong></div><div>Конверсія у бронювання: <strong>{{ analytics.booking_conversion_percent == null ? '—' : `${analytics.booking_conversion_percent}%` }}</strong></div><div>Конверсія у використання: <strong>{{ analytics.redemption_conversion_percent == null ? '—' : `${analytics.redemption_conversion_percent}%` }}</strong></div></div>
      <p class="text-xs text-ui-muted">Конверсія бронювання = створені бронювання / доступні до зв’язку. Конверсія використання = унікальні клієнти із завершеним візитом / доступні до зв’язку. Скасування та no-show не є використанням. Виручка спостережена, не додаткова.</p>
      <p class="text-xs text-ui-muted">Фільтри за майстром та акцією доступні у загальній аналітиці; тут вони визначені кампанією. Технічні запити посилань не входять у підтверджені відкриття.</p>
    </section>
    <p v-if="actionError" role="alert" class="text-sm text-red-500">{{ actionError }}</p>
    <ConfirmActionModal v-model="showLaunch" title="Підтвердити реальний запуск?" message="Сервер створить один запуск із наведеними умовами. Повідомлення можуть бути відправлені реальним клієнтам у дозволене вікно." confirm-label="Запустити кампанію" :context-items="launchContext" :pending="launching" @confirm="launch()" />
    <ConfirmActionModal v-model="showTestLaunch" title="Надіслати тест вибраному клієнту?" message="Сервер створить запуск тільки для одного зазначеного отримувача. Контакт зараховується до маркетингового ліміту." confirm-label="Надіслати тест" :context-items="testLaunchContext" :pending="launching" @confirm="launch(true)" />
  </div>
</template>

<style scoped>
.new-master-control:not([type="checkbox"]) {
  color: var(--bo-text-primary);
  background: var(--input-bg);
  border-color: var(--input-border);
  color-scheme: dark;
}
.new-master-control option { background: var(--select-menu-bg); color: var(--select-menu-item-text); }
:global([data-backoffice-theme="light"]) .new-master-control { color-scheme: light; }
.new-master-control:focus-visible { outline: 2px solid var(--bo-focus-border); outline-offset: 2px; }
</style>
