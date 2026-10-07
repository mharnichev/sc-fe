<script setup lang="ts">
import { isNotificationType, channelStrategyLabel } from '~/utils/campaignAudience.mjs'
import { localDateTimeToIso } from '~/utils/newMasterCampaign.mjs'
import { loadSegmentServiceOptions } from '~/utils/segmentRules.mjs'
import type { AudienceEstimate, CampaignPayload, MessageTemplate, MessagingCampaign, RecipientPreview } from '~/types/messaging'

const api = useBackofficeApi()
const router = useRouter()
const route = useRoute()
const notificationDraft = route.query.kind === 'notifications'
const scenario = ref(route.query.kind === 'new-master' ? 'new-master' : 'broadcast')
const newMasterDraft = computed(() => !notificationDraft && scenario.value === 'new-master')
const offerEditorMounted = ref(route.query.kind === 'new-master')
const offerStepValid = ref<Record<number, boolean>>({})
watch(newMasterDraft, value => { if (value) offerEditorMounted.value = true })
onMounted(() => {
  if (route.query.kind !== 'new-master') return
  const { kind: _kind, ...query } = route.query
  void router.replace({ path: route.path, query })
})
const openSavedCampaign = (campaign: { id: number | string }) => router.push(`/messaging/campaigns/${campaign.id}`)
const initialSegmentId = Number(route.query.segment_id)
const initialSegmentIds = Number.isSafeInteger(initialSegmentId) && initialSegmentId > 0 ? [initialSegmentId] : []
const audienceMode = ref(notificationDraft ? 'inline' : 'segments')
const segmentsValid = ref(false)
const toast = useBaseToastNotification()
const {
  campaignTypes,
  channels,
  sampleClient,
  bookingActivityVariableNames,
  missingTemplateVariables,
} = useMessagingUi()
const { apiErrorMessage, masterName, serviceName } = useBookingFormatting()
const { canSendMessagingCampaigns, canCreateMessagingDrafts } = useBackofficeAccess()

const step = ref(1)
const saving = ref(false)
const existingNotification = ref<MessagingCampaign | null>(null)
const showSendConfirm = ref(false)
const showRecipients = ref(false)
const audienceLoading = ref(false)
const recipientLoading = ref(false)
const recipientError = ref('')
const estimate = ref<AudienceEstimate | null>(null)
const recipients = ref<RecipientPreview[]>([])

const form = reactive<CampaignPayload>({
  name: '',
  type: notificationDraft ? 'booking_confirmation' : 'manual',
  purpose: notificationDraft ? 'transactional' : 'marketing',
  segment_ids: Number.isSafeInteger(initialSegmentId) && initialSegmentId > 0 ? [initialSegmentId] : [],
  channel_strategy: 'single',
  exclude_upcoming_booking: true,
  exclude_returned_since_snapshot: true,
  marketing_frequency_days: 7,
  channel: 'telegram',
  status: 'draft',
  recipient: 'customer',
  template_id: null,
  message_body: '',
  audience_rules: [{ type: 'all_clients' }],
  review_platform: 'google',
  review_link: '',
  promo_code: '',
  schedule_mode: notificationDraft ? 'automated' : 'now',
  scheduled_at: '',
  timezone: 'Europe/Kyiv',
  max_messages_per_minute: 20,
  quiet_hours_enabled: true,
  quiet_hours_from: '21:00',
  quiet_hours_to: '09:00',
  duplicate_protection_days: 30,
})

watch([() => form.type, () => form.channel], () => {
  form.recipient = form.type.startsWith('master_') ? 'master' : 'customer'
  form.purpose = form.type === 'post_visit_review_request' ? 'review_request' : isNotificationType(form.type) ? 'transactional' : 'marketing'
  if (form.recipient === 'master' && form.channel === 'sms') form.channel = 'telegram'
  if (form.type === 'booking_confirmation') { form.channel = 'sms'; form.location_key = 'sms_booking_confirmation' }
  else form.location_key = null
}, { immediate: true })
const availableChannels = computed(() => channels.map(channel => ({
  ...channel, enabled: channel.enabled && !(form.recipient === 'master' && channel.value === 'sms') && !(form.type === 'booking_confirmation' && channel.value !== 'sms'),
})))

const [{ data: templates }, { data: masters }] = await Promise.all([
  useAsyncData('campaign-wizard-templates', async () => {
    const items: MessageTemplate[] = []
    for (let page = 1; ; page += 1) {
      const response = await api.getMessageTemplates(page, 100)
      items.push(...response.items)
      if (page * 100 >= response.total || !response.items.length) return items
    }
  }),
  useAsyncData('campaign-wizard-masters', async () => {
    const items = []
    for (let page = 1; ; page += 1) {
      const response = await api.adminGetMasters(page, 100)
      items.push(...(Array.isArray(response) ? response : response.items))
      if (Array.isArray(response) || page * 100 >= response.total || !response.items.length) return items
    }
  }),
])

const templateItems = computed(() => templates.value || [])
const masterItems = computed(() => masters.value || [])
const serviceItems = ref<Array<{ id: number; name: string }>>([])
const servicesLoading = ref(false)
const servicesLoaded = ref(false)
const servicesError = ref('')
const needsServices = computed(() => !notificationDraft && audienceMode.value === 'inline' && form.audience_rules.some(rule => rule.type === 'selected_service'))
async function loadServices() {
  if (servicesLoading.value) return
  servicesLoading.value = true
  servicesError.value = ''
  try {
    const options = await loadSegmentServiceOptions(masterItems.value.map(master => ({ value: master.id, label: masterName(master) })), api.getMasterServices, serviceName)
    serviceItems.value = options.map(option => ({ id: option.value, name: option.label }))
    servicesLoaded.value = true
  } catch (reason) { servicesError.value = apiErrorMessage(reason, 'Не вдалося завантажити послуги майстрів.') }
  finally { servicesLoading.value = false }
}
watch(needsServices, needed => { if (needed && !servicesLoaded.value) void loadServices() }, { immediate: true })
watch(() => form.channel, channel => { if (!notificationDraft && channel === 'sms') audienceMode.value = 'segments' })
const selectedTemplate = computed(() => templateItems.value.find(template => String(template.id) === String(form.template_id)))

watch(selectedTemplate, (template?: MessageTemplate) => {
  if (!template) return
  form.message_body = template.message_body
  form.type = template.campaign_type
  form.channel = template.channel
})

watch(() => form.type, type => {
  existingNotification.value = null
  if (selectedTemplate.value && selectedTemplate.value.campaign_type !== type) form.template_id = null
})

const availableCampaignTypes = computed(() => campaignTypes.filter(type => notificationDraft
  ? isNotificationType(type.value)
  : audienceMode.value === 'segments' ? ['manual', 're_engagement'].includes(type.value) : !isNotificationType(type.value)))
watch(audienceMode, mode => {
  if (mode === 'segments') {
    if (!['manual', 're_engagement'].includes(form.type)) form.type = 'manual'
    if (form.schedule_mode === 'automated') form.schedule_mode = 'now'
  }
})
const audienceError = ref('')
let estimateRequest = 0
watch(
  [() => form.audience_rules, audienceMode],
  async () => {
    const current = ++estimateRequest
    estimate.value = null
    audienceError.value = ''
    if (notificationDraft || audienceMode.value === 'segments') { audienceLoading.value = false; return }
    audienceLoading.value = true
    try {
      const result = await api.estimateMessagingAudience(form.audience_rules)
      if (current === estimateRequest) estimate.value = result
    }
    catch { if (current === estimateRequest) audienceError.value = 'Не вдалося оцінити аудиторію. Спробуйте змінити правила або зберегти чернетку та перевірити її пізніше.' }
    finally { if (current === estimateRequest) audienceLoading.value = false }
  },
  { deep: true, immediate: true },
)

const requiredMissingVariables = computed(() => {
  if (form.type === 'booking_confirmation' && form.channel === 'sms') {
    return missingTemplateVariables(form.message_body, bookingActivityVariableNames)
      .map(name => `{${name}}`)
  }
  if (form.type === 'post_visit_review_request') {
    return ['{{client_name}}', '{{review_link}}'].filter(variable => !form.message_body.includes(variable))
  }
  return []
})

const frequencyValid = computed(() => Number.isInteger(Number(form.marketing_frequency_days)) && Number(form.marketing_frequency_days) >= 1 && Number(form.marketing_frequency_days) <= 365)
const nameValid = computed(() => form.name.trim().length >= 2 && form.name.trim().length <= 255)
const integerInRange = (value: unknown, min: number, max: number) => value !== null && value !== '' && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max
const reviewNotification = computed(() => form.type === 'post_visit_review_request')
const scheduledInstant = computed(() => localDateTimeToIso(form.scheduled_at || '', form.timezone))
const inlineAudienceValid = computed(() => form.audience_rules.every(rule => {
  if (rule.type === 'selected_barber') return Number(rule.barber_id) > 0
  if (rule.type === 'selected_service') return Number(rule.service_id) > 0
  if (rule.type === 'inactive_clients') return integerInRange(rule.inactive_days, 1, 3650)
  if (rule.type === 'visited_date_range') return Boolean((rule.date_from || rule.date_to) && (!rule.date_from || !rule.date_to || rule.date_from <= rule.date_to))
  return ['all_clients', 'first_time_clients', 'vip_clients', 'birthday_this_month'].includes(rule.type)
}))
const scheduleErrors = computed(() => {
  const errors: string[] = []
  if (form.schedule_mode === 'later' && (!scheduledInstant.value || Date.parse(scheduledInstant.value) <= Date.now())) errors.push('Вкажіть дійсну майбутню дату та час відправки.')
  if (!notificationDraft && !integerInRange(form.max_messages_per_minute, 1, 480)) errors.push('Швидкість відправки: ціле число від 1 до 480 за хвилину.')
  if (reviewNotification.value && form.quiet_hours_enabled && (!form.quiet_hours_from || !form.quiet_hours_to || form.quiet_hours_from === form.quiet_hours_to)) errors.push('Вкажіть різний час початку та завершення тихих годин.')
  return errors
})
const validationErrors = computed(() => {
  const errors: string[] = []
  if (audienceMode.value === 'segments' && !frequencyValid.value) errors.push('Мінімум днів між повідомленнями: ціле число від 1 до 365.')
  if (!nameValid.value) errors.push('Назва кампанії має містити від 2 до 255 символів.')
  if (!form.message_body.trim()) errors.push('Додайте текст повідомлення.')
  if (!notificationDraft && (audienceMode.value === 'segments' ? !segmentsValid.value : !inlineAudienceValid.value || !estimate.value?.eligible)) errors.push(audienceMode.value === 'segments' ? 'Виберіть принаймні один активний сегмент.' : 'Аудиторія має містити хоча б одного доступного клієнта.')
  if (requiredMissingVariables.value.length) errors.push(`Додайте обовʼязкові змінні: ${requiredMissingVariables.value.join(', ')}.`)
  errors.push(...scheduleErrors.value)
  return errors
})

const insertVariable = (variable: string) => {
  form.message_body = `${form.message_body}${form.message_body ? ' ' : ''}${variable}`
}

const previewRecipients = async () => {
  showRecipients.value = true
  recipientLoading.value = true
  recipientError.value = ''
  try {
    recipients.value = await api.previewMessagingRecipients(form.audience_rules, 50)
  }
  catch {
    recipientError.value = 'Не вдалося завантажити список отримувачів.'
  }
  finally {
    recipientLoading.value = false
  }
}

const save = async (activate = false) => {
  if (!canCreateMessagingDrafts.value || saving.value) return
  if (!nameValid.value || scheduleErrors.value.length || (audienceMode.value === 'segments' && (!segmentsValid.value || !frequencyValid.value))) return
  if (!notificationDraft && audienceMode.value === 'inline' && !inlineAudienceValid.value) return
  if (activate && (!canSendMessagingCampaigns.value || validationErrors.value.length)) return
  saving.value = true
  try {
    if (notificationDraft) {
      const items: MessagingCampaign[] = []
      for (let page = 1; ; page += 1) {
        const response = await api.getMessagingCampaigns(page, 100, { type: form.type, view: 'notifications' })
        items.push(...response.items)
        if (page * 100 >= response.total || !response.items.length) break
      }
      if (items.length) {
        existingNotification.value = items.sort((a, b) => Number(a.id) - Number(b.id))[0] || null
        toast.error('Сповіщення цього типу вже налаштовано. Відкрийте наявне правило.')
        return
      }
    }
    const payload = { ...form, review_platform: reviewNotification.value ? 'internal' : form.review_platform, review_link: reviewNotification.value ? null : form.review_link, automation_delay: undefined, metadata_json: reviewNotification.value ? { ...form.metadata_json, primary_channel: form.channel, fallback_channel: null } : form.metadata_json, scheduled_at: form.schedule_mode === 'later' ? scheduledInstant.value : null, segment_ids: audienceMode.value === 'segments' ? form.segment_ids : [], status: activate && notificationDraft ? 'active' as const : 'draft' as const }
    const campaign = await api.createMessagingCampaign(payload)
    toast.success(activate ? 'Кампанію активовано.' : 'Чернетку збережено.')
    await openSavedCampaign(campaign)
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, activate ? 'Не вдалося активувати кампанію.' : 'Не вдалося зберегти чернетку.'))
  }
  finally {
    saving.value = false
    showSendConfirm.value = false
  }
}

const stepLabels = computed(() => ['Основи', 'Аудиторія', 'Повідомлення', newMasterDraft.value ? 'Майстер та акція' : 'Відгук / промо', 'Розклад', 'Фінальна перевірка'])
const stepValid = computed<Record<number, boolean>>(() => newMasterDraft.value ? offerStepValid.value : ({
  1: Boolean(nameValid.value && form.channel),
  2: notificationDraft || (audienceMode.value === 'segments' ? segmentsValid.value && frequencyValid.value : Boolean(inlineAudienceValid.value && estimate.value?.eligible)),
  3: Boolean(form.message_body.trim() && !requiredMissingVariables.value.length),
  4: true,
  5: scheduleErrors.value.length === 0,
  6: validationErrors.value.length === 0,
}))

const nextStep = () => {
  if (step.value < 6) step.value += 1
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Комунікації</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">{{ notificationDraft ? 'Нове сповіщення' : 'Нова кампанія' }}</h1>
      </div>
      <NuxtLink :to="notificationDraft ? '/messaging/notifications' : '/messaging/campaigns'" class="messaging-secondary-action rounded-full px-5 py-3 text-sm">До списку</NuxtLink>
    </div>

    <div class="grid gap-6 xl:grid-cols-[260px_1fr]">
      <BaseCard as="aside" padding="sm" class="messaging-wizard-steps">
        <BaseButton
          v-for="item in 6"
          :key="item"
          :aria-label="`Крок ${item}: ${stepLabels[item - 1]}`"
          :aria-current="step === item ? 'step' : undefined"
          type="button"
          class="mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm"
          :class="step === item ? 'messaging-choice-active font-semibold' : 'messaging-choice-idle'"
          @click="step = item"
        >
          <span class="messaging-step-number flex h-7 w-7 items-center justify-center rounded-full text-xs">{{ item }}</span>
          <span class="messaging-step-label">{{ stepLabels[item - 1] }}</span>
        </BaseButton>
      </BaseCard>

      <BaseCard as="section">
        <fieldset v-if="step === 1 && !notificationDraft" class="mb-6 space-y-3">
          <legend class="mb-2 text-sm font-medium text-ui-primary">Сценарій розсилки</legend>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="cursor-pointer rounded-2xl border p-4" :class="!newMasterDraft ? 'messaging-choice-active' : 'messaging-choice-idle'">
              <BaseRadioButton v-model="scenario" value="broadcast" name="campaign-scenario" />
              <span class="ml-2 font-medium">Звичайна розсилка</span>
              <span class="mt-2 block text-xs text-ui-muted">Повідомлення для вибраних сегментів без персональної пропозиції.</span>
            </label>
            <label class="cursor-pointer rounded-2xl border p-4" :class="newMasterDraft ? 'messaging-choice-active' : 'messaging-choice-idle'">
              <BaseRadioButton v-model="scenario" value="new-master" name="campaign-scenario" />
              <span class="ml-2 font-medium">Новий майстер · акція 30%</span>
              <span class="mt-2 block text-xs text-ui-muted">Майстер, акція та персональне посилання для клієнтів, які були 3–12 місяців тому.</span>
            </label>
          </div>
        </fieldset>
        <MessagingNewMasterCampaignEditor
          v-if="offerEditorMounted"
          v-show="newMasterDraft"
          :step="step"
          :initial-segment-ids="initialSegmentIds"
          @step-valid="offerStepValid = $event"
          @saved="openSavedCampaign"
        />
        <template v-if="!newMasterDraft">
        <div v-if="step === 1" class="space-y-5">
          <h2 class="text-xl font-semibold text-ui-primary">Основи кампанії</h2>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-ui-primary">Назва кампанії</span>
            <BaseInput v-model="form.name" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Наприклад: Відгук після візиту" />
          </label>
          <div class="grid gap-3 md:grid-cols-2">
            <label v-for="type in availableCampaignTypes" :key="type.value" class="cursor-pointer rounded-[1.25rem] border p-4" :class="form.type === type.value ? 'messaging-choice-active' : 'messaging-choice-idle'">
              <BaseRadioButton v-model="form.type" class="sr-only" :value="type.value" />
              <span class="block text-sm font-semibold text-ui-primary">{{ type.label }}</span>
              <span class="mt-1 block text-xs leading-5 text-ui-muted">{{ type.helper }}</span>
            </label>
          </div>
          <div>
            <p class="text-sm font-medium text-ui-primary">Канал</p>
            <div class="mt-2 grid gap-3 sm:grid-cols-4">
              <label v-for="channel in availableChannels" :key="channel.value" class="rounded-2xl border p-4 text-sm" :class="form.channel === channel.value ? 'messaging-choice-active' : 'messaging-choice-idle'">
                <BaseRadioButton v-model="form.channel" class="sr-only" :value="channel.value" :disabled="!channel.enabled" />
                <MessagingChannelBadge :channel="channel.value" />
                <span v-if="!channel.enabled" class="mt-1 block text-xs text-ui-muted">{{ form.recipient === 'master' && channel.value === 'sms' ? 'Недоступно для майстрів' : form.type === 'booking_confirmation' && channel.value === 'telegram' ? 'Цей тип сповіщення використовує SMS' : 'Скоро' }}</span>
              </label>
            </div>
          </div>

        </div>

        <div v-else-if="step === 2" class="space-y-5">
          <h2 class="text-xl font-semibold text-ui-primary">Аудиторія</h2>
          <p v-if="!notificationDraft && form.channel === 'sms'" class="text-sm text-ui-muted">Для SMS виберіть збережений сегмент: доступність телефону перевіряється сервером після збереження.</p>
          <fieldset v-if="!notificationDraft" class="flex flex-wrap gap-4 text-sm"><legend class="mb-2 font-medium text-ui-primary">Джерело аудиторії</legend><label class="flex items-center gap-2"><BaseRadioButton v-model="audienceMode" value="segments" /> Збережені сегменти</label><label class="flex items-center gap-2"><BaseRadioButton v-model="audienceMode" value="inline" :disabled="form.channel === 'sms'" /> Фільтри цієї кампанії</label></fieldset>
          <MessagingSegmentCampaignAudience v-if="!notificationDraft && audienceMode === 'segments'" :model-value="form.segment_ids || []" @update:model-value="form.segment_ids = $event" @valid="segmentsValid = $event" />
          <p v-else-if="notificationDraft" class="base-card rounded-xl p-4 text-sm">Сповіщення створюються за подіями: {{ availableCampaignTypes.find(item => item.value === form.type)?.helper }} Аудиторія визначається подією, а не маркетинговими сегментами.</p>
          <MessagingAudienceFilterBuilder v-else v-model="form.audience_rules" :masters="masterItems" :services="serviceItems" :estimate="estimate" :loading="audienceLoading" @preview="previewRecipients" />
          <p v-if="needsServices && servicesLoading" role="status" class="text-sm text-ui-muted">Завантаження послуг майстрів…</p>
          <div v-if="needsServices && servicesError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ servicesError }} <BaseButton variant="neutral" :loading="servicesLoading" @click="loadServices">Повторити завантаження послуг</BaseButton></div>
          <p v-if="audienceError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ audienceError }}</p>
          <template v-if="!notificationDraft && audienceMode === 'segments'">
            <label class="grid gap-2 text-sm"><span>Стратегія каналів</span><BaseSelect native v-model="form.channel_strategy"><option value="single">Лише вибраний канал</option><option value="telegram_then_sms">Telegram, інакше SMS</option><option value="sms_then_telegram">SMS, інакше Telegram</option></BaseSelect></label>
            <p class="text-xs text-ui-muted">Один клієнт — один вибраний канал. Резервний канал використовується лише за недоступності адреси основного; помилка чи непрочитане повідомлення не спричиняють повторної відправки іншим каналом.</p>
            <label class="flex items-center gap-2 text-sm"><BaseCheckbox v-model="form.exclude_upcoming_booking" /> Виключити клієнтів із майбутніми бронюваннями</label>
            <label class="flex items-center gap-2 text-sm"><BaseCheckbox v-model="form.exclude_returned_since_snapshot" /> Виключити клієнтів, які повернулися після фіксації аудиторії</label>
            <label class="grid max-w-sm gap-2 text-sm"><span>Мінімум днів між маркетинговими повідомленнями</span><BaseInput v-model.number="form.marketing_frequency_days" type="number" min="1" max="365" /></label>
          </template>
          <p v-if="audienceMode === 'inline' && estimate?.excluded" class="messaging-tone-warning rounded-2xl p-4 text-sm">
            {{ estimate.excluded }} клієнтів буде виключено через відсутній Telegram chat_id або відмову від маркетингу.
          </p>
        </div>

        <div v-else-if="step === 3" class="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div class="space-y-5">
            <h2 class="text-xl font-semibold text-ui-primary">Повідомлення</h2>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-ui-primary">Шаблон</span>
              <BaseSelect native v-model="form.template_id" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option :value="null">Кастомне повідомлення</option>
                <option v-for="template in templateItems.filter(item => availableCampaignTypes.some(type => type.value === item.campaign_type))" :key="template.id" :value="template.id">{{ template.name }}</option>
              </BaseSelect>
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-ui-primary">Текст</span>
              <BaseTextarea v-model="form.message_body" class="min-h-52 rounded-2xl border border-slate-300 px-4 py-3 leading-6" />
              <span class="text-xs text-ui-muted">{{ form.message_body.length }} символів</span>
            </label>
            <MessagingVariablePicker @select="insertVariable" />
            <div v-if="requiredMissingVariables.length" class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
              Не вистачає змінних: {{ requiredMissingVariables.join(', ') }}
            </div>

          </div>
          <MessagingMessagePreview :body="form.message_body" :sample="sampleClient" />
        </div>

        <div v-else-if="step === 4" class="space-y-5">
          <h2 class="text-xl font-semibold text-ui-primary">Відгук та промо</h2>
          <p v-if="reviewNotification" class="text-sm text-ui-muted">Сервіс автоматично створює персональне посилання на внутрішню сторінку відгуку.</p>
          <div class="grid gap-4 md:grid-cols-2">
            <label v-if="!reviewNotification" class="grid gap-2 text-sm">
              <span class="font-medium text-ui-primary">Платформа відгуку</span>
              <BaseSelect native v-model="form.review_platform" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option value="google">Google Reviews</option>
                <option value="instagram">Instagram</option>
                <option value="internal">Внутрішня сторінка</option>
                <option value="custom">Custom URL</option>
              </BaseSelect>
            </label>
            <label v-if="!reviewNotification" class="grid gap-2 text-sm">
              <span class="font-medium text-ui-primary">Посилання</span>
              <BaseInput v-model="form.review_link" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="https://..." />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-ui-primary">Промокод</span>
              <BaseInput v-model="form.promo_code" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="SOUL10" />
            </label>


          </div>
        </div>

        <div v-else-if="step === 5" class="space-y-5">
          <h2 class="text-xl font-semibold text-ui-primary">Розклад та правила</h2>
          <p v-if="reviewNotification" class="text-sm text-ui-muted">Запити відгуку плануються на наступний день після візиту за налаштуваннями сервісу.</p>
          <p v-if="notificationDraft" class="text-sm text-ui-muted">Сповіщення надсилається автоматично після відповідної події. Активація вмикає це правило.</p>
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <label class="rounded-2xl border p-4" :class="form.schedule_mode === 'now' ? 'messaging-choice-active' : 'messaging-choice-idle'"><BaseRadioButton v-model="form.schedule_mode" value="now" /> Надіслати зараз</label>
            <label class="rounded-2xl border p-4" :class="form.schedule_mode === 'later' ? 'messaging-choice-active' : 'messaging-choice-idle'"><BaseRadioButton v-model="form.schedule_mode" value="later" /> Запланувати</label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label v-if="form.schedule_mode === 'later'" class="grid gap-2 text-sm">
              <span class="font-medium text-ui-primary">Дата і час</span>
              <BaseCalendar v-model="form.scheduled_at" class="rounded-2xl border border-slate-300 px-4 py-3" mode="datetime" />
            </label>
            <label v-if="!notificationDraft" class="grid gap-2 text-sm">
              <span class="font-medium text-ui-primary">Timezone</span>
              <BaseSelect native v-model="form.timezone" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option value="Europe/Kyiv">Europe/Kyiv</option>
                <option value="Europe/Warsaw">Europe/Warsaw</option>
                <option value="UTC">UTC</option>
              </BaseSelect>
            </label>

            <label v-if="!notificationDraft" class="grid gap-2 text-sm">
              <span class="font-medium text-ui-primary">Макс. повідомлень за хвилину</span>
              <BaseInput v-model.number="form.max_messages_per_minute" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>

          </div>
          <p v-for="issue in scheduleErrors" :key="issue" role="alert" class="text-sm text-red-500">{{ issue }}</p>
          <BaseToggle v-if="reviewNotification" v-model="form.quiet_hours_enabled" label="Не надсилати вночі" />
          <div v-if="reviewNotification && form.quiet_hours_enabled" class="grid max-w-md gap-4 sm:grid-cols-2">
            <BaseInput v-model="form.quiet_hours_from" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" />
            <BaseInput v-model="form.quiet_hours_to" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" />
          </div>
        </div>

        <div v-else class="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div class="space-y-5">
            <h2 class="text-xl font-semibold text-ui-primary">Фінальна перевірка</h2>
            <p v-if="existingNotification" role="alert" class="text-sm text-ui-muted">Сповіщення цього типу вже існує. <NuxtLink :to="`/messaging/campaigns/${existingNotification.id}`" class="text-ui-accent underline">Налаштувати {{ existingNotification.name }}</NuxtLink></p>
            <dl class="grid gap-3 rounded-[1.25rem] bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div><dt class="text-ui-muted">Назва</dt><dd class="font-medium text-ui-primary">{{ form.name || '—' }}</dd></div>
              <div><dt class="text-ui-muted">Аудиторія</dt><dd class="font-medium text-ui-primary">{{ notificationDraft ? 'Отримувачі відповідної сервісної події' : audienceMode === 'segments' ? `${form.segment_ids?.length || 0} сегментів; кількість і канали перевіряються після збереження` : `${estimate?.eligible || 0} доступних, ${estimate?.excluded || 0} виключено` }}</dd></div>
              <div><dt class="text-ui-muted">Канали</dt><dd class="mt-1">{{ channelStrategyLabel(form.channel_strategy, form.channel) }}</dd></div>
              <div><dt class="text-ui-muted">Розклад</dt><dd class="font-medium text-ui-primary">{{ form.schedule_mode }}</dd></div>
            </dl>
            <div v-if="validationErrors.length" class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
              <p v-for="item in validationErrors" :key="item">{{ item }}</p>
            </div>
            <p v-if="!notificationDraft" class="text-sm text-ui-muted">Збереження створює чернетку без відправки. На сторінці кампанії перевірте конкретну аудиторію та підтвердьте запуск окремою дією.</p>
            <div class="flex flex-wrap gap-3">
              <BaseButton class="messaging-secondary-action rounded-full px-5 py-3 text-sm font-medium" :disabled="saving || !canCreateMessagingDrafts || !nameValid || scheduleErrors.length > 0 || (audienceMode === 'segments' && (!segmentsValid || !frequencyValid))" @click="save(false)">Зберегти чернетку</BaseButton>
              <BaseButton v-if="notificationDraft" class="messaging-primary-action rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50" :disabled="saving || validationErrors.length > 0 || !canSendMessagingCampaigns" @click="showSendConfirm = true">
                {{ form.schedule_mode === 'later' ? 'Запланувати кампанію' : 'Активувати кампанію' }}
              </BaseButton>
            </div>
          </div>
          <MessagingMessagePreview :body="form.message_body" />
        </div>

        </template>
        <div class="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
          <BaseButton class="messaging-secondary-action rounded-full px-5 py-3 text-sm" :disabled="step === 1" @click="step -= 1">Назад</BaseButton>
          <BaseButton v-if="step < 6" class="messaging-primary-action rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50" :disabled="!stepValid[step]" @click="nextStep">Далі</BaseButton>
        </div>
      </BaseCard>
    </div>

    <BaseModal v-model="showRecipients" max-width-class="max-w-5xl">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-2xl font-semibold text-ui-primary">Попередній список отримувачів</h2>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <MessagingRecipientPreviewTable :recipients="recipients" :pending="recipientLoading" :error="recipientError" />
      </template>
    </BaseModal>

    <ConfirmActionModal
      v-model="showSendConfirm"
      title="Активувати сповіщення?"
      message="Правило надсилатиме повідомлення після відповідної сервісної події. Перевірте тип сповіщення, канал та текст."
      confirm-label="Активувати"
      :pending="saving"
      @confirm="save(true)"
    />
  </div>
</template>
