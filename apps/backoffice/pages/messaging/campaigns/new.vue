<script setup lang="ts">
import { isNotificationType, channelStrategyLabel } from '~/utils/campaignAudience.mjs'
import { loadSegmentServiceOptions } from '~/utils/segmentRules.mjs'
import type { AudienceEstimate, CampaignPayload, MessageTemplate, RecipientPreview } from '~/types/messaging'

const api = useBackofficeApi()
const router = useRouter()
const route = useRoute()
const notificationDraft = route.query.kind === 'notifications'
const initialSegmentId = Number(route.query.segment_id)
const audienceMode = ref(Number.isSafeInteger(initialSegmentId) && initialSegmentId > 0 ? 'segments' : 'inline')
const segmentsValid = ref(false)
const toast = useBaseToastNotification()
const {
  campaignTypes,
  channels,
  variables,
  sampleClient,
  bookingActivityVariableNames,
  missingTemplateVariables,
} = useMessagingUi()
const { apiErrorMessage, masterName, serviceName } = useBookingFormatting()
const { canSendMessagingCampaigns, canCreateMessagingDrafts } = useBackofficeAccess()

const step = ref(1)
const saving = ref(false)
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
  language_versions: { uk: '', en: '' },
  audience_rules: [{ type: 'all_clients' }],
  review_platform: 'google',
  review_link: '',
  promo_code: '',
  inline_button_text: 'Залишити відгук',
  follow_up_after_days: null,
  schedule_mode: 'now',
  scheduled_at: '',
  timezone: 'Europe/Kyiv',
  automation_delay: '24h',
  max_messages_per_minute: 20,
  quiet_hours_enabled: true,
  quiet_hours_from: '21:00',
  quiet_hours_to: '09:00',
  duplicate_protection_days: 30,
})

const [{ data: templates }, { data: masters }] = await Promise.all([
  useAsyncData('campaign-wizard-templates', () => api.getMessageTemplates(1, 100)),
  useAsyncData('campaign-wizard-masters', async () => {
    const items = []
    for (let page = 1; ; page += 1) {
      const response = await api.adminGetMasters(page, 100)
      items.push(...(Array.isArray(response) ? response : response.items))
      if (Array.isArray(response) || page * 100 >= response.total || !response.items.length) return items
    }
  }),
])

const templateItems = computed(() => templates.value?.items || [])
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
const selectedTemplate = computed(() => templateItems.value.find(template => String(template.id) === String(form.template_id)))

watch(selectedTemplate, (template?: MessageTemplate) => {
  if (!template) return
  form.message_body = template.message_body
  form.type = template.campaign_type
  form.channel = template.channel
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
const validationErrors = computed(() => {
  const errors: string[] = []
  if (audienceMode.value === 'segments' && !frequencyValid.value) errors.push('Мінімум днів між повідомленнями: ціле число від 1 до 365.')
  if (!form.name.trim()) errors.push('Вкажіть назву кампанії.')
  if (!form.message_body.trim()) errors.push('Додайте текст повідомлення.')
  if (!notificationDraft && (audienceMode.value === 'segments' ? !segmentsValid.value : !estimate.value?.eligible)) errors.push(audienceMode.value === 'segments' ? 'Виберіть принаймні один активний сегмент.' : 'Аудиторія має містити хоча б одного доступного клієнта.')
  if (requiredMissingVariables.value.length) errors.push(`Додайте обовʼязкові змінні: ${requiredMissingVariables.value.join(', ')}.`)
  if (form.schedule_mode === 'later' && !form.scheduled_at) errors.push('Вкажіть дату та час відправки.')
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
  if (!canCreateMessagingDrafts.value) return
  if (!form.name.trim() || (audienceMode.value === 'segments' && (!segmentsValid.value || !frequencyValid.value))) return
  if (activate && (!canSendMessagingCampaigns.value || validationErrors.value.length)) return
  saving.value = true
  try {
    const payload = { ...form, segment_ids: audienceMode.value === 'segments' ? form.segment_ids : [], status: activate && notificationDraft ? 'active' as const : 'draft' as const }
    const campaign = await api.createMessagingCampaign(payload)
    toast.success(activate ? 'Кампанію активовано.' : 'Чернетку збережено.')
    await router.push(`/messaging/campaigns/${campaign.id}`)
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, activate ? 'Не вдалося активувати кампанію.' : 'Не вдалося зберегти чернетку.'))
  }
  finally {
    saving.value = false
    showSendConfirm.value = false
  }
}

const stepValid = computed(() => ({
  1: Boolean(form.name.trim() && form.channel),
  2: notificationDraft || (audienceMode.value === 'segments' ? segmentsValid.value && frequencyValid.value : Boolean(estimate.value?.eligible)),
  3: Boolean(form.message_body.trim() && !requiredMissingVariables.value.length),
  4: true,
  5: form.schedule_mode !== 'later' || Boolean(form.scheduled_at),
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
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">{{ notificationDraft ? 'Нове сповіщення' : 'Нова кампанія' }}</h1>
      </div>
      <NuxtLink :to="notificationDraft ? '/messaging/notifications' : '/messaging/campaigns'" class="messaging-secondary-action rounded-full px-5 py-3 text-sm">До списку</NuxtLink>
    </div>

    <div class="grid gap-6 xl:grid-cols-[260px_1fr]">
      <aside class="messaging-wizard-steps rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <BaseButton
          v-for="item in 6"
          :key="item"
          :aria-label="`Крок ${item}: ${['Основи', 'Аудиторія', 'Повідомлення', 'Відгук / промо', 'Розклад', 'Фінальна перевірка'][item - 1]}`"
          :aria-current="step === item ? 'step' : undefined"
          type="button"
          class="mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm"
          :class="step === item ? 'messaging-choice-active font-semibold' : 'messaging-choice-idle'"
          @click="step = item"
        >
          <span class="messaging-step-number flex h-7 w-7 items-center justify-center rounded-full text-xs">{{ item }}</span>
          <span class="messaging-step-label">{{ ['Основи', 'Аудиторія', 'Повідомлення', 'Відгук / промо', 'Розклад', 'Фінальна перевірка'][item - 1] }}</span>
        </BaseButton>
      </aside>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div v-if="step === 1" class="space-y-5">
          <h2 class="text-xl font-semibold text-slate-900">Основи кампанії</h2>
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-slate-700">Назва кампанії</span>
            <BaseInput v-model="form.name" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="Наприклад: Відгук після візиту" />
          </label>
          <div class="grid gap-3 md:grid-cols-2">
            <label v-for="type in availableCampaignTypes" :key="type.value" class="cursor-pointer rounded-[1.25rem] border p-4" :class="form.type === type.value ? 'messaging-choice-active' : 'messaging-choice-idle'">
              <BaseRadioButton v-model="form.type" class="sr-only" :value="type.value" />
              <span class="block text-sm font-semibold text-slate-900">{{ type.label }}</span>
              <span class="mt-1 block text-xs leading-5 text-slate-500">{{ type.helper }}</span>
            </label>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-700">Канал</p>
            <div class="mt-2 grid gap-3 sm:grid-cols-4">
              <label v-for="channel in channels" :key="channel.value" class="rounded-2xl border p-4 text-sm" :class="form.channel === channel.value ? 'messaging-choice-active' : 'messaging-choice-idle'">
                <BaseRadioButton v-model="form.channel" class="sr-only" :value="channel.value" :disabled="!channel.enabled" />
                <MessagingChannelBadge :channel="channel.value" />
                <span v-if="!channel.enabled" class="mt-1 block text-xs text-slate-500">Скоро</span>
              </label>
            </div>
          </div>
          <label v-if="notificationDraft" class="grid max-w-xs gap-2 text-sm">
            <span class="font-medium text-slate-700">Початковий статус</span>
            <BaseSelect native v-model="form.status" class="rounded-2xl border border-slate-300 px-4 py-3">
              <option value="draft">Чернетка</option>
              <option value="active" :disabled="!canSendMessagingCampaigns">Активна</option>
            </BaseSelect>
          </label>
        </div>

        <div v-else-if="step === 2" class="space-y-5">
          <h2 class="text-xl font-semibold text-slate-900">Аудиторія</h2>
          <fieldset v-if="!notificationDraft" class="flex flex-wrap gap-4 text-sm"><legend class="mb-2 font-medium text-slate-700">Джерело аудиторії</legend><label class="flex items-center gap-2"><BaseRadioButton v-model="audienceMode" value="segments" /> Збережені сегменти</label><label class="flex items-center gap-2"><BaseRadioButton v-model="audienceMode" value="inline" /> Фільтри цієї кампанії</label></fieldset>
          <MessagingSegmentCampaignAudience v-if="audienceMode === 'segments'" :model-value="form.segment_ids || []" @update:model-value="form.segment_ids = $event" @valid="segmentsValid = $event" />
          <p v-else-if="notificationDraft" class="base-card rounded-xl p-4 text-sm">Сповіщення створюються за подіями: {{ availableCampaignTypes.find(item => item.value === form.type)?.helper }} Аудиторія визначається подією, а не маркетинговими сегментами.</p>
          <MessagingAudienceFilterBuilder v-else v-model="form.audience_rules" :masters="masterItems" :services="serviceItems" :estimate="estimate" :loading="audienceLoading" @preview="previewRecipients" />
          <p v-if="needsServices && servicesLoading" role="status" class="text-sm text-ui-muted">Завантаження послуг майстрів…</p>
          <div v-if="needsServices && servicesError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ servicesError }} <BaseButton variant="neutral" :loading="servicesLoading" @click="loadServices">Повторити завантаження послуг</BaseButton></div>
          <p v-if="audienceError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ audienceError }}</p>
          <template v-if="audienceMode === 'segments'">
            <label class="grid gap-2 text-sm"><span>Стратегія каналів</span><BaseSelect native v-model="form.channel_strategy"><option value="single">Лише вибраний канал</option><option value="telegram_then_sms">Telegram, інакше SMS</option><option value="sms_then_telegram">SMS, інакше Telegram</option></BaseSelect></label>
            <p class="text-xs text-slate-500">Один клієнт — один вибраний канал. Резервний канал використовується лише за недоступності адреси основного; помилка чи непрочитане повідомлення не спричиняють повторної відправки іншим каналом.</p>
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
            <h2 class="text-xl font-semibold text-slate-900">Повідомлення</h2>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Шаблон</span>
              <BaseSelect native v-model="form.template_id" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option :value="null">Кастомне повідомлення</option>
                <option v-for="template in templateItems.filter(item => availableCampaignTypes.some(type => type.value === item.campaign_type))" :key="template.id" :value="template.id">{{ template.name }}</option>
              </BaseSelect>
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Текст</span>
              <BaseTextarea v-model="form.message_body" class="min-h-52 rounded-2xl border border-slate-300 px-4 py-3 leading-6" />
              <span class="text-xs text-slate-500">{{ form.message_body.length }} символів</span>
            </label>
            <MessagingVariablePicker @select="insertVariable" />
            <div v-if="requiredMissingVariables.length" class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
              Не вистачає змінних: {{ requiredMissingVariables.join(', ') }}
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="grid gap-2 text-sm">
                <span class="font-medium text-slate-700">Українська версія</span>
                <BaseTextarea v-model="form.language_versions!.uk" class="min-h-28 rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
              <label class="grid gap-2 text-sm">
                <span class="font-medium text-slate-700">English version</span>
                <BaseTextarea v-model="form.language_versions!.en" class="min-h-28 rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
            </div>
          </div>
          <MessagingMessagePreview :body="form.message_body" :button-text="form.inline_button_text" :sample="sampleClient" />
        </div>

        <div v-else-if="step === 4" class="space-y-5">
          <h2 class="text-xl font-semibold text-slate-900">Відгук та промо</h2>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Платформа відгуку</span>
              <BaseSelect native v-model="form.review_platform" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option value="google">Google Reviews</option>
                <option value="instagram">Instagram</option>
                <option value="internal">Внутрішня сторінка</option>
                <option value="custom">Custom URL</option>
              </BaseSelect>
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Посилання</span>
              <BaseInput v-model="form.review_link" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="https://..." />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Промокод</span>
              <BaseInput v-model="form.promo_code" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="SOUL10" />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Текст кнопки Telegram</span>
              <BaseInput v-model="form.inline_button_text" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Follow-up через N днів</span>
              <BaseInput v-model.number="form.follow_up_after_days" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
          </div>
        </div>

        <div v-else-if="step === 5" class="space-y-5">
          <h2 class="text-xl font-semibold text-slate-900">Розклад та правила</h2>
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="rounded-2xl border p-4" :class="form.schedule_mode === 'now' ? 'messaging-choice-active' : 'messaging-choice-idle'"><BaseRadioButton v-model="form.schedule_mode" value="now" /> Надіслати зараз</label>
            <label class="rounded-2xl border p-4" :class="form.schedule_mode === 'later' ? 'messaging-choice-active' : 'messaging-choice-idle'"><BaseRadioButton v-model="form.schedule_mode" value="later" /> Запланувати</label>
            <label v-if="audienceMode !== 'segments'" class="rounded-2xl border p-4" :class="form.schedule_mode === 'automated' ? 'messaging-choice-active' : 'messaging-choice-idle'"><BaseRadioButton v-model="form.schedule_mode" value="automated" /> Автоматично</label>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label v-if="form.schedule_mode === 'later'" class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Дата і час</span>
              <BaseCalendar v-model="form.scheduled_at" class="rounded-2xl border border-slate-300 px-4 py-3" mode="datetime" />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Timezone</span>
              <BaseSelect native v-model="form.timezone" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option value="Europe/Kyiv">Europe/Kyiv</option>
                <option value="Europe/Warsaw">Europe/Warsaw</option>
                <option value="UTC">UTC</option>
              </BaseSelect>
            </label>
            <label v-if="form.schedule_mode === 'automated'" class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Після завершення візиту</span>
              <BaseSelect native v-model="form.automation_delay" class="rounded-2xl border border-slate-300 px-4 py-3">
                <option value="immediate">Одразу</option>
                <option value="1h">1 година</option>
                <option value="24h">24 години</option>
                <option value="custom">Custom</option>
              </BaseSelect>
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Макс. повідомлень за хвилину</span>
              <BaseInput v-model.number="form.max_messages_per_minute" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
            <label class="grid gap-2 text-sm">
              <span class="font-medium text-slate-700">Не дублювати протягом днів</span>
              <BaseInput v-model.number="form.duplicate_protection_days" min="0" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-slate-700">
            <BaseCheckbox v-model="form.quiet_hours_enabled" /> Не надсилати вночі
          </label>
          <div v-if="form.quiet_hours_enabled" class="grid max-w-md gap-4 sm:grid-cols-2">
            <BaseInput v-model="form.quiet_hours_from" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" />
            <BaseInput v-model="form.quiet_hours_to" type="time" class="rounded-2xl border border-slate-300 px-4 py-3" />
          </div>
        </div>

        <div v-else class="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div class="space-y-5">
            <h2 class="text-xl font-semibold text-slate-900">Фінальна перевірка</h2>
            <dl class="grid gap-3 rounded-[1.25rem] bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div><dt class="text-slate-500">Назва</dt><dd class="font-medium text-slate-900">{{ form.name || '—' }}</dd></div>
              <div><dt class="text-slate-500">Аудиторія</dt><dd class="font-medium text-slate-900">{{ notificationDraft ? 'Отримувачі відповідної сервісної події' : audienceMode === 'segments' ? `${form.segment_ids?.length || 0} сегментів; кількість і канали перевіряються після збереження` : `${estimate?.eligible || 0} доступних, ${estimate?.excluded || 0} виключено` }}</dd></div>
              <div><dt class="text-slate-500">Канали</dt><dd class="mt-1">{{ channelStrategyLabel(form.channel_strategy, form.channel) }}</dd></div>
              <div><dt class="text-slate-500">Розклад</dt><dd class="font-medium text-slate-900">{{ form.schedule_mode }}</dd></div>
            </dl>
            <div v-if="validationErrors.length" class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
              <p v-for="item in validationErrors" :key="item">{{ item }}</p>
            </div>
            <p v-if="!notificationDraft" class="text-sm text-slate-500">Збереження створює чернетку без відправки. На сторінці кампанії перевірте конкретну аудиторію та підтвердьте запуск окремою дією.</p>
            <div class="flex flex-wrap gap-3">
              <BaseButton class="messaging-secondary-action rounded-full px-5 py-3 text-sm font-medium" :disabled="saving || !canCreateMessagingDrafts || !form.name.trim() || (audienceMode === 'segments' && (!segmentsValid || !frequencyValid))" @click="save(false)">Зберегти чернетку</BaseButton>
              <BaseButton v-if="notificationDraft" class="messaging-primary-action rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50" :disabled="saving || validationErrors.length > 0 || !canSendMessagingCampaigns" @click="showSendConfirm = true">
                {{ form.schedule_mode === 'later' ? 'Запланувати кампанію' : 'Активувати кампанію' }}
              </BaseButton>
            </div>
          </div>
          <MessagingMessagePreview :body="form.message_body" :button-text="form.inline_button_text" />
        </div>

        <div class="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
          <BaseButton class="messaging-secondary-action rounded-full px-5 py-3 text-sm" :disabled="step === 1" @click="step -= 1">Назад</BaseButton>
          <BaseButton v-if="step < 6" class="messaging-primary-action rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50" :disabled="!stepValid[step as keyof typeof stepValid]" @click="nextStep">Далі</BaseButton>
        </div>
      </section>
    </div>

    <BaseModal v-model="showRecipients" max-width-class="max-w-5xl">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-2xl font-semibold text-slate-900">Попередній список отримувачів</h2>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <MessagingRecipientPreviewTable :recipients="recipients" :pending="recipientLoading" :error="recipientError" />
      </template>
    </BaseModal>

    <ConfirmActionModal
      v-model="showSendConfirm"
      title="Запустити реальну кампанію?"
      message="Повідомлення буде надіслано доступним клієнтам згідно з аудиторією та правилами. Перевірте текст, посилання та час відправки."
      confirm-label="Запустити"
      :pending="saving"
      @confirm="save(true)"
    />
  </div>
</template>
