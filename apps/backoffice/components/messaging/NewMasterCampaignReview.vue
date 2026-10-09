<script setup lang="ts">
import { ArrowPathIcon, EyeIcon, PlayIcon, UserIcon, FunnelIcon, CheckCircleIcon, ExclamationTriangleIcon, ClockIcon, ChartBarIcon } from '@heroicons/vue/24/outline'
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
const blockedChecks = computed(() => readiness.value?.checks.filter(check => check.status !== 'ready' && check.status !== 'ok') || [])
const readinessCheckLabels: Record<string, string> = {
  campaign_scheduler: 'Планувальник кампаній', sms_worker: 'Черга SMS', sms_provider: 'SMS провайдер',
  sms_template: 'SMS шаблон', template: 'Шаблон повідомлення', master: 'Майстер',
  promotion: 'Акція', master_name: 'Ім’я майстра в повідомленні', sending_window: 'Час відправки',
  campaign_type: 'Тип кампанії', campaign_recipient: 'Отримувачі', channel_strategy: 'Стратегія каналів',
  telegram_provider: 'Telegram бот', campaign_channel: 'Канал кампанії', saved_segments: 'Збережені сегменти',
  offer_validity: 'Термін пропозиції', services: 'Послуги майстра', audience: 'Аудиторія',
  sms_eligible_audience: 'Доступні до зв’язку', personalized_sms: 'Персоналізований текст',
}
const readinessCheckLabel = (code: string) => readinessCheckLabels[code] || code.replaceAll('_', ' ')
const readinessCheckHelp: Record<string, string> = {
  campaign_scheduler: 'Попросіть адміністратора перевірити планувальник кампаній.',
  sms_worker: 'Попросіть адміністратора перевірити чергу відправки SMS.',
  sms_provider: 'Перевірте підключення SMS провайдера.',
  telegram_provider: 'Перевірте підключення Telegram бота.',
  sms_template: 'Перевірте текст і дозволені символи SMS.',
  template: 'Заповніть текст повідомлення.',
  master: 'Виберіть активного майстра.',
  promotion: 'Виберіть активну акцію для отримувачів.',
  master_name: 'Вкажіть ім’я майстра для підстановки у текст.',
  sending_window: 'Вкажіть денне вікно відправки за Києвом.',
  saved_segments: 'Виберіть збережені сегменти аудиторії.',
  offer_validity: 'Вкажіть чинний термін пропозиції.',
  services: 'Виберіть активні послуги цього майстра.',
  audience: 'Перевірте умови сегментів: аудиторія має містити клієнтів.',
  sms_eligible_audience: 'Потрібен хоча б один клієнт, якому можна написати.',
  personalized_sms: 'Перевірте персоналізований текст SMS.',
}
const readinessCheckHelpText = (code: string) => readinessCheckHelp[code] || 'Перевірте відповідні умови кампанії та повторіть перевірку.'
const launchGuidance = computed(() => {
  if (!canSendMessagingCampaigns.value) return 'Для запуску потрібен доступ до відправки кампаній.'
  if (props.dirty) return 'Збережіть зміни, перш ніж перевіряти аудиторію і запускати кампанію.'
  if (canRetryLaunch.value) return 'Попередній запит міг дійти до сервера. Перевірте його результат із тим самим ключем.'
  if (props.campaign.status !== 'draft') return runsTotal.value ? 'Кампанію вже запускали. Результати та доставка наведені нижче. Свіжий перегляд потрібен лише для додаткового запуску.' : 'Кампанія вже не чернетка. Перевірте історію запусків нижче; свіжий перегляд потрібен лише для додаткового запуску.'
  if (!offerReadyForReview.value) return 'Задайте початок і кінець пропозиції в умовах кампанії.'
  if (previewLoading.value || readinessLoading.value) return 'Триває перевірка аудиторії та готовності.'
  if (previewStale.value || !preview.value) return 'Створіть свіжий перегляд аудиторії, щоб побачити отримувачів і перевірки.'
  if (!preview.value.communication_eligible_recipients) return 'Немає клієнтів, доступних до зв’язку. Перевірте аудиторію та умови пропозиції.'
  if (readinessError.value) return 'Не вдалося перевірити готовність. Оновіть перевірки.'
  if (blockedChecks.value.length) return 'Усуньте наведені нижче перешкоди та оновіть перевірки.'
  if (!readiness.value?.ready) return 'Оновіть перевірки готовності перед запуском.'
  return 'Аудиторія і налаштування готові. Перед відправкою ви ще раз підтвердите умови запуску.'
})
const runStatusLabels: Record<string, string> = { scheduled: 'Очікує часу відправки', snapshotted: 'Аудиторію зафіксовано', completed: 'Завершено', cancelled: 'Скасовано', failed: 'Помилка', queued: 'У черзі', pending: 'Очікує', dispatching: 'Відправляється', accepted: 'Прийнято провайдером', sent: 'Прийнято провайдером', delivered: 'Доставлено', skipped: 'Пропущено', processing: 'В обробці' }
const statusLabel = (status: string) => runStatusLabels[status] || status
const canRetryLaunch = computed(() => canSendMessagingCampaigns.value && !props.dirty && !launching.value && !!launchKey.value && launchFingerprint.value === launchConditionsFingerprint.value)
const canRetryTestLaunch = computed(() => canSendMessagingCampaigns.value && !props.dirty && !launching.value && !!testLaunchKey.value && testLaunchFingerprint.value === launchConditionsFingerprint.value)
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) : '—'
const money = (value: number) => `${value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`
const providerAmount = (value: { amount: number | null; currency?: string | null } | undefined, fallback: string) => value?.amount == null ? fallback : `${value.amount.toLocaleString('uk-UA')}${value.currency ? ` ${value.currency}` : ''}`
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
  { label: 'Акція', value: `${promotionLabel.value || props.campaign.offer_promotion_id || '—'}` },
  { label: 'Послуги', value: servicesLabel.value },
  { label: 'Період', value: `${formatDate(props.campaign.offer_starts_at)} — ${formatDate(props.campaign.offer_expires_at)}` },
  { label: 'Канали', value: props.campaign.channel_strategy === 'telegram_then_sms' ? 'Telegram, інакше SMS' : props.campaign.channel === 'telegram' ? 'Telegram' : 'SMS' },
  { label: 'Аудиторія', value: `${preview.value?.total ?? '—'} загалом; ${preview.value?.communication_eligible_recipients ?? '—'} доступні до зв’язку` },
  { label: 'SMS', value: sample.value?.rendered_message || props.campaign.message_body || '—' },
  { label: 'Відправка', value: `${props.campaign.sending_window?.start || '10:00'}–${props.campaign.sending_window?.end || '18:00'} Europe/Kyiv · ${props.campaign.sms_recipients_per_minute || 20}/хв` },
  { label: 'Оцінка вартості', value: providerAmount(preview.value?.estimated_cost, 'Недоступна у провайдера') },
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
    <BaseCard as="section" class="space-y-5" data-testid="campaign-launch">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1"><h2 class="flex items-center gap-2 text-xl font-semibold text-ui-primary"><PlayIcon class="h-5 w-5 text-ui-accent" aria-hidden="true" />Запуск кампанії</h2><p class="text-sm text-ui-muted">Перевірте аудиторію та умови перед окремим підтвердженням відправки.</p></div>
        <BaseBadge :tone="canLaunch || canRetryLaunch ? 'success' : 'warning'">{{ canLaunch || canRetryLaunch ? 'Можна продовжити' : 'Потребує перевірки' }}</BaseBadge>
      </div>
      <p class="rounded-xl bg-ui-subtle p-3 text-sm text-ui-primary">{{ launchGuidance }}</p>
      <p class="text-sm text-ui-muted">{{ masterLabel || `Майстер #${campaign.offer_master_id || '—'}` }} · Пропозиція до {{ formatDate(campaign.offer_expires_at) }}</p>
      <div class="flex flex-wrap items-center gap-3">
        <BaseButton type="button" variant="primary" data-testid="open-launch-confirm" :disabled="!canLaunch && !canRetryLaunch" @click="showLaunch = true"><PlayIcon class="h-4 w-4" aria-hidden="true" />{{ canRetryLaunch ? 'Перевірити результат попереднього запуску' : 'Перевірити та запустити' }}</BaseButton>
        <span class="text-xs text-ui-muted">Перед запуском сервер ще раз перевірить готовність.</span>
      </div>
      <div class="space-y-3 border-t border-ui pt-4">
        <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="flex items-center gap-2 font-semibold text-ui-primary"><CheckCircleIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />Готовність</h3><BaseButton type="button" variant="neutral" size="sm" :disabled="readinessLoading" @click="loadReadiness"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" />Оновити перевірки</BaseButton></div>
        <p v-if="readinessError" role="alert" class="text-sm text-red-500">{{ readinessError }}</p>
        <p v-if="readiness" data-testid="readiness-status" class="text-sm font-medium" :class="readiness.ready ? 'text-emerald-600' : 'text-amber-700'">{{ readiness.ready ? 'Готово до запуску' : 'Не готово до запуску' }}</p>
        <p v-else-if="readinessLoading" class="text-sm text-ui-muted">Перевіряємо умови запуску…</p>
        <div v-if="blockedChecks.length" class="grid gap-2 sm:grid-cols-2"><div v-for="check in blockedChecks" :key="check.code" class="rounded-xl bg-ui-subtle p-3 text-sm"><p class="flex items-center gap-2 font-medium text-ui-primary"><ExclamationTriangleIcon class="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />{{ readinessCheckLabel(check.code) }}</p><p class="mt-1 text-ui-muted">{{ readinessCheckHelpText(check.code) }}</p></div></div>
        <details v-if="readiness" class="text-sm text-ui-muted"><summary class="cursor-pointer text-ui-accent">Усі технічні перевірки</summary><div class="mt-3 space-y-2"><p class="text-xs">Перевірка під час запуску: {{ readiness.runtime_verification }}</p><div v-for="check in readiness.checks" :key="check.code" class="flex items-start gap-2"><BaseBadge :tone="check.status === 'ready' || check.status === 'ok' ? 'success' : 'danger'">{{ check.status === 'ready' || check.status === 'ok' ? 'Готово' : 'Блокує' }}</BaseBadge><p><strong class="text-ui-primary">{{ readinessCheckLabel(check.code) }}</strong> · {{ check.detail }} <span class="text-xs">({{ check.code }})</span></p></div></div></details>
      </div>
    </BaseCard>

    <BaseCard as="section" class="space-y-4" data-testid="campaign-preview">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="flex items-center gap-2 text-xl font-semibold text-ui-primary"><EyeIcon class="h-5 w-5 text-ui-accent" aria-hidden="true" />Аудиторія і повідомлення</h2><p class="mt-1 text-sm text-ui-muted">Перегляд показує поточну придатність клієнтів і приклад персоналізованого тексту.</p></div><BaseButton type="button" variant="neutral" data-testid="generate-preview" :disabled="previewLoading || dirty" @click="loadPreview"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" />{{ previewLoading ? 'Обчислення…' : 'Створити свіжий перегляд' }}</BaseButton></div>
      <p v-if="previewError" role="alert" class="text-sm text-red-500">{{ previewError }}</p>
      <p v-if="previewStale" class="text-sm text-amber-700">Перегляд відсутній або застарів після зміни умов.</p>
      <template v-if="preview">
        <div class="grid gap-3 sm:grid-cols-3"><div class="rounded-xl bg-ui-subtle p-4"><span class="text-sm text-ui-muted">Аудиторія</span><strong class="mt-1 block text-2xl text-ui-primary">{{ preview.total }}</strong></div><div class="rounded-xl bg-ui-subtle p-4"><span class="text-sm text-ui-muted">Доступні до зв’язку</span><strong data-testid="eligible-count" class="mt-1 block text-2xl text-ui-primary">{{ preview.communication_eligible_recipients ?? '—' }}</strong></div><div class="rounded-xl bg-ui-subtle p-4"><span class="text-sm text-ui-muted">SMS / Telegram</span><strong class="mt-1 block text-2xl text-ui-primary">{{ preview.sms_eligible_recipients ?? '—' }} / {{ preview.telegram_eligible_recipients ?? '—' }}</strong></div></div>
        <div v-if="sample" class="rounded-xl border border-ui p-4"><h3 class="font-semibold text-ui-primary">Приклад персоналізованого повідомлення</h3><p data-testid="rendered-sms" class="mt-2 whitespace-pre-wrap text-sm text-ui-primary">{{ sample.rendered_message }}</p><p class="mt-2 text-xs text-ui-muted">{{ renderedLength }} символів · {{ sample.sms_parts ?? '—' }} SMS частин</p></div>
        <p v-else class="text-sm text-amber-700">Персоналізований приклад недоступний. Перевірте дати, ім’я майстра та шаблон.</p>
        <div v-if="Object.keys(exclusionCounts).length" class="space-y-1"><h3 class="font-medium text-ui-primary">Причини виключення серед показаних клієнтів</h3><p v-for="(count, reason) in exclusionCounts" :key="reason" class="text-sm text-ui-secondary">{{ deliveryReasonLabel(reason) }}: {{ count }}</p></div>
        <p class="text-xs text-ui-muted">Причини деталізовані для перших {{ preview.items.length }} клієнтів; загальну кількість придатних сервер рахує для всієї аудиторії.</p>
        <details class="text-sm text-ui-muted"><summary class="cursor-pointer text-ui-accent">Технічна оцінка відправки</summary><div class="mt-3 grid gap-2 sm:grid-cols-3"><p>SMS частин: {{ preview.estimated_sms_parts ?? '—' }}</p><p>Оцінка вартості: {{ providerAmount(preview.estimated_cost, 'недоступна') }}</p><p>Баланс: {{ providerAmount(preview.balance, 'не підтримується провайдером') }}</p></div></details>
      </template>
    </BaseCard>

    <BaseCard v-if="canSendMessagingCampaigns" as="section" class="space-y-3">
      <details><summary class="flex cursor-pointer items-center gap-2 font-semibold text-ui-primary"><UserIcon class="h-5 w-5 text-ui-accent" aria-hidden="true" />Тест на одному отримувачі <BaseBadge tone="warning">Реальний запуск</BaseBadge></summary>
        <div class="mt-4 space-y-3"><p class="text-sm text-ui-muted">Вкажіть ID тестового клієнта й перевірте ім’я та контакт. Це реальний обмежений запуск: він активує кампанію, видає персональну пропозицію та враховується у ліміті контактів і аналітиці. Чинні згода, аудиторія та денне вікно. Після тесту створіть копію кампанії для змінених умов.</p>
          <div class="flex flex-wrap items-end gap-3"><BaseInput v-model.number="testCustomerId" data-testid="test-customer-id" type="number" min="1" label="ID тестового клієнта" /><BaseButton type="button" variant="neutral" :disabled="testCustomerLoading || !testCustomerId" data-testid="load-test-customer" @click="loadTestCustomer"><UserIcon class="h-4 w-4" aria-hidden="true" />Перевірити отримувача</BaseButton></div>
          <p v-if="testCustomer" data-testid="test-customer-summary" class="text-sm text-ui-primary">{{ testCustomer.name || 'Клієнт' }} · #{{ testCustomer.id }} · {{ testCustomer.phone || 'без телефону' }}</p>
          <BaseButton type="button" variant="neutral" data-testid="open-test-launch-confirm" :disabled="(!canLaunch && !canRetryTestLaunch) || !testCustomer || testCustomer.id !== testCustomerId" @click="showTestLaunch = true"><PlayIcon class="h-4 w-4" aria-hidden="true" />{{ canRetryTestLaunch ? 'Перевірити результат попереднього тесту' : 'Перевірити й надіслати тест одному клієнту' }}</BaseButton>
        </div>
      </details>
    </BaseCard>

    <BaseCard as="section" class="space-y-4" data-testid="campaign-runs">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="flex items-center gap-2 text-xl font-semibold text-ui-primary"><ClockIcon class="h-5 w-5 text-ui-accent" aria-hidden="true" />Запуски й доставка</h2><p class="mt-1 text-sm text-ui-muted">Кожен запуск зберігає умови та результати для перевірки.</p></div><BaseButton type="button" variant="neutral" size="sm" :disabled="runsLoading" @click="loadRuns()"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" />Оновити</BaseButton></div>
      <p v-if="runsError" role="alert" class="text-sm text-red-500">{{ runsError }}</p>
      <p v-if="!runs.length" class="rounded-xl bg-ui-subtle p-4 text-sm text-ui-muted">Запусків ще немає. Після підтвердження запуск з’явиться тут.</p>
      <div v-for="item in runs" :key="item.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui p-3 text-sm"><div class="flex flex-wrap items-center gap-2"><BaseButton type="button" variant="neutral" size="sm" @click="inspectRun(item.id)">Запуск #{{ item.id }}</BaseButton><BaseBadge :tone="item.status === 'completed' ? 'success' : item.status === 'failed' || item.status === 'cancelled' ? 'danger' : 'info'">{{ statusLabel(item.status) }}</BaseBadge></div><p class="text-ui-muted">{{ item.status === 'scheduled' ? 'Очікує часу/вікна відправки' : formatDate(item.evaluated_at) }} · Аудиторія: {{ item.audience_count }}</p></div>
      <div v-if="runsTotal > 50" class="flex flex-wrap items-center gap-3 text-sm"><BaseButton type="button" variant="neutral" :disabled="runsLoading || runsPage === 1" @click="loadRuns(runsPage - 1)">Попередні запуски</BaseButton><span>Сторінка {{ runsPage }} · {{ runsTotal }} запусків</span><BaseButton type="button" variant="neutral" :disabled="runsLoading || runsPage * 50 >= runsTotal" @click="loadRuns(runsPage + 1)">Наступні запуски</BaseButton></div>
      <article v-if="run" class="space-y-4 rounded-xl bg-ui-subtle p-4">
        <div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold text-ui-primary">Запуск #{{ run.id }}</h3><BaseBadge :tone="run.status === 'completed' ? 'success' : run.status === 'failed' || run.status === 'cancelled' ? 'danger' : 'info'">{{ statusLabel(run.status) }}</BaseBadge></div>
        <div class="grid gap-3 text-sm sm:grid-cols-4"><p>Прийнято провайдером <strong class="block text-xl text-ui-primary">{{ run.delivery_counts.sent || 0 }}</strong></p><p>Доставлено <strong class="block text-xl text-ui-primary">{{ run.delivery_counts.delivered || 0 }}</strong></p><p>Помилки <strong class="block text-xl text-ui-primary">{{ run.delivery_counts.failed || 0 }}</strong></p><p>Пропущено <strong class="block text-xl text-ui-primary">{{ run.delivery_counts.skipped || 0 }}</strong></p></div>
        <p class="text-xs text-ui-muted">Прийняття провайдером не означає доставку. Сукупне прийняття, включно з подальшими помилками доставки, наведене в аналітиці.</p>
        <div v-if="run.campaign_snapshot.message_body" class="space-y-1 rounded-xl border border-ui p-3 text-sm"><p class="font-medium text-ui-primary">Зафіксований текст шаблону</p><p class="whitespace-pre-wrap">{{ run.campaign_snapshot.message_body }}</p><p class="text-ui-muted">Майстер: {{ run.campaign_snapshot.master_name_for_message }} · Акція: {{ run.campaign_snapshot.promotion_name_uk || run.campaign_snapshot.offer_promotion_id }}</p><p v-if="run.campaign_snapshot.test_customer_id" class="text-ui-muted">Тестовий запуск для клієнта #{{ run.campaign_snapshot.test_customer_id }}</p></div>
        <details v-if="queue" class="text-sm"><summary class="cursor-pointer font-medium text-ui-accent">Стан черги та прогноз відправки</summary><div class="mt-2 space-y-2 text-ui-secondary"><p>Черга: {{ queue.total }} · {{ queue.paused ? 'На паузі' : queue.cancelled ? 'Скасована' : 'Обробка дозволена' }}</p><div class="flex flex-wrap gap-3"><span v-for="(value, key) in queue.counts" :key="key">{{ statusLabel(String(key)) }}: {{ value }}</span></div><p>Орієнтовне завершення відправки: {{ formatDate(queue.estimated_completion_at) }}</p><p v-if="queue.next_window_at">Наступне вікно відправки: {{ formatDate(queue.next_window_at) }}</p><p class="text-xs text-ui-muted">Оцінка не враховує майбутні пріоритетні повідомлення, повторні спроби та час доставки провайдером.</p></div></details>
        <div class="flex flex-wrap gap-2"><BaseButton v-if="canSendMessagingCampaigns && campaign.status === 'active'" type="button" variant="neutral" size="sm" :disabled="actionPending" @click="lifecycle('pause')">Пауза</BaseButton><BaseButton v-if="canSendMessagingCampaigns && campaign.status === 'paused'" type="button" variant="neutral" size="sm" :disabled="actionPending" @click="lifecycle('resume')">Поновити</BaseButton><BaseButton v-if="canSendMessagingCampaigns && !['cancelled', 'completed'].includes(run.status)" type="button" variant="danger-outline" size="sm" :disabled="actionPending" @click="lifecycle('cancel')">Скасувати невідправлені</BaseButton></div>
        <div v-if="members.length" class="space-y-2 border-t border-ui pt-3"><h4 class="text-sm font-medium text-ui-primary">Отримувачі</h4><div v-for="member in members" :key="member.id" class="text-sm"><NuxtLink :to="`/customers/${member.customer_id}`" class="text-ui-accent underline">Клієнт #{{ member.customer_id }}</NuxtLink> · {{ statusLabel(member.status) }} · {{ member.last_error ? deliveryReasonLabel(member.last_error) : 'без помилки' }}</div></div>
        <div v-if="memberTotal > 50" class="flex flex-wrap items-center gap-3 text-sm"><BaseButton type="button" variant="neutral" size="sm" :disabled="runLoading || memberPage === 1" @click="inspectRun(run.id, memberPage - 1)">Попередні отримувачі</BaseButton><span>Сторінка {{ memberPage }} · {{ memberTotal }} отримувачів</span><BaseButton type="button" variant="neutral" size="sm" :disabled="runLoading || memberPage * 50 >= memberTotal" @click="inspectRun(run.id, memberPage + 1)">Наступні отримувачі</BaseButton></div>
      </article>
    </BaseCard>

    <BaseCard v-if="canViewMessagingAnalytics" id="campaign-analytics" as="section" class="space-y-4" data-testid="campaign-analytics">
      <div><h2 class="flex items-center gap-2 text-xl font-semibold text-ui-primary"><ChartBarIcon class="h-5 w-5 text-ui-accent" aria-hidden="true" />Результати пропозиції</h2><p class="mt-1 text-sm text-ui-muted">Відстежуйте доставку, бронювання і використання знижки.</p></div>
      <div class="grid gap-3 sm:grid-cols-3"><BaseSelect :model-value="filterRunId" label="Запуск" :options="[{ value: 0, label: 'Усі запуски' }, ...runs.map(item => ({ value: item.id, label: `#${item.id}` }))]" @update:model-value="filterRunId = Number($event)" /><BaseCalendar v-model="periodFrom" mode="datetime" label="Від (Europe/Kyiv)" /><BaseCalendar v-model="periodTo" mode="datetime" label="До, виключно (Europe/Kyiv)" /></div>
      <div class="flex flex-wrap items-center gap-3"><BaseButton type="button" variant="neutral" :disabled="!!(periodFrom && !kyivLocalToIso(periodFrom)) || !!(periodTo && !kyivLocalToIso(periodTo))" @click="loadAnalytics"><FunnelIcon class="h-4 w-4" aria-hidden="true" />Застосувати фільтри</BaseButton><p class="text-xs text-ui-muted">Період відбирає запуски за фіксацією аудиторії; їхні результати можуть зростати пізніше.</p></div>
      <p v-if="analyticsError" role="alert" class="text-sm text-red-500">{{ analyticsError }}</p>
      <template v-if="analytics"><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div class="rounded-xl bg-ui-subtle p-4"><span class="text-sm text-ui-muted">Доставлено</span><strong class="mt-1 block text-2xl text-ui-primary">{{ analytics.delivered }}</strong></div><div class="rounded-xl bg-ui-subtle p-4"><span class="text-sm text-ui-muted">Створено бронювань</span><strong class="mt-1 block text-2xl text-ui-primary">{{ analytics.bookings_created }}</strong></div><div class="rounded-xl bg-ui-subtle p-4"><span class="text-sm text-ui-muted">Завершено візитів зі знижкою</span><strong class="mt-1 block text-2xl text-ui-primary">{{ analytics.completed_visits }}</strong></div><div class="rounded-xl bg-ui-subtle p-4"><span class="text-sm text-ui-muted">Загальна знижка</span><strong class="mt-1 block text-2xl text-ui-primary">{{ money(analytics.total_discount_amount) }}</strong></div></div>
        <div class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3"><p>Доступні до зв’язку: <strong>{{ analytics.communication_eligible_recipients }}</strong></p><p>Прийнято провайдером: <strong>{{ analytics.provider_accepted }}</strong></p><p>Унікальні клієнти, що скористалися: <strong>{{ analytics.unique_customers_redeemed }}</strong></p><p>Конверсія у бронювання: <strong>{{ analytics.booking_conversion_percent == null ? '—' : `${analytics.booking_conversion_percent}%` }}</strong></p><p>Конверсія у використання: <strong>{{ analytics.redemption_conversion_percent == null ? '—' : `${analytics.redemption_conversion_percent}%` }}</strong></p><p>Виручка завершених візитів: <strong>{{ money(analytics.observed_completed_revenue) }}</strong></p></div>
        <details class="text-sm text-ui-muted"><summary class="cursor-pointer text-ui-accent">Додаткові метрики та пояснення</summary><div class="mt-3 grid gap-2 sm:grid-cols-2"><p>Аудиторія: <strong>{{ analytics.audience_size }}</strong></p><p>Технічні запити посилань: <strong>{{ analytics.raw_link_requests }}</strong></p><p>Підтверджені відкриття: <strong>{{ analytics.confirmed_page_opens }}</strong></p><p>Унікальні відвідувачі: <strong>{{ analytics.unique_confirmed_openers }}</strong></p><p>Скасовано / no-show: <strong>{{ analytics.cancelled_bookings }} / {{ analytics.no_show }}</strong></p></div><p class="mt-3 text-xs">Конверсія бронювання = створені бронювання / доступні до зв’язку. Конверсія використання = унікальні клієнти із завершеним візитом / доступні до зв’язку. Скасування та no-show не є використанням. Виручка спостережена, не додаткова.</p><p class="mt-2 text-xs">Фільтри за майстром та акцією доступні у загальній аналітиці; тут вони визначені кампанією. Технічні запити посилань не входять у підтверджені відкриття.</p></details>
      </template>
    </BaseCard>
    <p v-if="actionError" role="alert" class="text-sm text-red-500">{{ actionError }}</p>
    <ConfirmActionModal v-model="showLaunch" title="Підтвердити реальний запуск?" message="Сервер створить один запуск із наведеними умовами. Повідомлення можуть бути відправлені реальним клієнтам у дозволене вікно." confirm-label="Запустити кампанію" :context-items="launchContext" :pending="launching" @confirm="launch()" />
    <ConfirmActionModal v-model="showTestLaunch" title="Надіслати тест вибраному клієнту?" message="Сервер створить запуск тільки для одного зазначеного отримувача. Контакт зараховується до маркетингового ліміту." confirm-label="Надіслати тест" :context-items="testLaunchContext" :pending="launching" @confirm="launch(true)" />
  </div>
</template>
