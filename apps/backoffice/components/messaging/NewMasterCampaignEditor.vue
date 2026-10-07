<script setup lang="ts">
import { ChatBubbleLeftRightIcon, UserIcon, TagIcon, ScissorsIcon, CheckIcon, DocumentTextIcon } from '@heroicons/vue/24/outline'
import BaseCard from '~/components/BaseCard.vue'
import type { MessagingCampaign, MessageTemplate } from '~/types/messaging'
import type { NewMasterCampaignInput } from '~/types/newMaster'
import { DEFAULT_NEW_MASTER_SMS, validateNewMasterTemplate, renderOfferPreview, kyivLocalToIso, isoToKyivLocal } from '~/utils/newMasterCampaign.mjs'

const props = defineProps<{ campaign?: MessagingCampaign | null; duplicated?: boolean; step?: number; initialSegmentIds?: number[]; readonly?: boolean }>()
const emit = defineEmits<{ saved: [campaign: MessagingCampaign]; dirty: [value: boolean]; busy: [value: boolean]; 'step-valid': [value: Record<number, boolean>] }>()
const api = useBackofficeApi()
const { apiErrorMessage } = useBookingFormatting()
const { canCreateMessagingDrafts } = useBackofficeAccess()
const masters = ref<Array<{ id: number; name: string }>>([])
const promotions = ref<Array<{ id: number; name_uk: string; name_en?: string; discount_percent: number; is_active: boolean; recipient_offer_only?: boolean; discount_type: string }>>([])
const services = ref<Array<{ id: number; name: string; is_active: boolean; duration_minutes: number; price: string | number }>>([])
const loading = ref(false)
const servicesLoading = ref(false)
const segmentValid = ref(false)
let servicesRequest = 0
const isEditable = computed(() => !props.readonly && canCreateMessagingDrafts.value && (!props.campaign || props.campaign.status === 'draft'))
const saving = ref(false)
watch(saving, value => emit('busy', value), { immediate: true })
const error = ref('')
const masterConfirmed = ref(false)
const name = ref('')
const campaignType = ref<'manual' | 're_engagement'>('manual')
const masterId = ref(0)
const promotionId = ref(0)
const serviceIds = ref<number[]>([])
const segmentIds = ref<number[]>(props.campaign ? [] : [...(props.initialSegmentIds || [])])
const masterNameForMessage = ref('')
const startsLocal = ref('')
const expiresLocal = ref('')
const channelStrategy = ref<'single' | 'telegram_then_sms'>('single')
const channel = ref<'sms' | 'telegram'>('sms')
const audienceMode = computed(() => !props.campaign || (props.campaign.offer_audience_mode ?? props.campaign.metadata_json?.offer_audience_mode) === 'segments' ? 'segments' : 'last_visit_3_12')
const eligiblePromotion = (item: typeof promotions.value[number]) => item.is_active && item.recipient_offer_only && item.discount_type === 'percent' && item.discount_percent >= 1 && item.discount_percent <= 100 && (audienceMode.value !== 'last_visit_3_12' || item.discount_percent === 30)
const windowStart = ref('10:00')
const windowEnd = ref('18:00')
const windowDays = ref([0, 1, 2, 3, 4, 5, 6])
const rate = ref<number | null>(20)
const frequency = ref<number | null>(7)
const maxContacts = ref<number | null>(1)
const capDays = ref<number | null>(7)
const template = ref('')
const persistedTemplate = ref<MessageTemplate | null>(null)
const baseline = ref('')
const selectedMaster = computed(() => masters.value.find(item => item.id === masterId.value))
const selectedPromotion = computed(() => promotions.value.find(item => item.id === promotionId.value))
const selectedServices = computed(() => services.value.filter(item => serviceIds.value.includes(item.id)))
const masterOptions = computed(() => [{ value: 0, label: 'Оберіть майстра' }, ...masters.value.map(item => ({ value: item.id, label: item.name }))])
const promotionOptions = computed(() => [{ value: 0, label: 'Оберіть акцію' }, ...promotions.value.filter(item => eligiblePromotion(item)).map(item => ({ value: item.id, label: item.name_uk }))])
const channelOptions = [{ value: 'single', label: 'SMS' }, { value: 'telegram_then_sms', label: 'Telegram → SMS, якщо Telegram недоступний' }]
const channelLabel = computed(() => channelStrategy.value === 'telegram_then_sms' ? 'Telegram, інакше SMS' : channel.value === 'telegram' ? 'Telegram' : 'SMS')
const disabled = computed(() => loading.value || saving.value || !isEditable.value)
const shown = (step: number) => props.step === undefined || props.step === step
const numberValue = (value: string | number | null) => value === null ? null : Number(value)
const validNumber = (value: number | null, min: number, max: number) => Number.isInteger(value) && value !== null && value >= min && value <= max
const serviceSelection = computed({
  get: () => serviceIds.value.map(String),
  set: (values: string[]) => { serviceIds.value = [...new Set(values.map(Number))] },
})
const previewSample = computed(() => ({
  master_name: masterNameForMessage.value || selectedMaster.value?.name || 'Майстер',
  offer_expires_short: expiresLocal.value ? expiresLocal.value.slice(0, 10).split('-').reverse().join('.') : 'дата завершення',
  offer_link: 'https://soulcuts.com.ua/booking?offer=preview',
  discount_percent: String(selectedPromotion.value?.discount_percent ?? '—'),
  promotion_name_uk: selectedPromotion.value?.name_uk || 'Акція',
  promotion_name_en: selectedPromotion.value?.name_en || '',
}))
const previewBody = computed(() => renderOfferPreview(template.value, previewSample.value))
const toggleDay = (day: number, checked: boolean) => { windowDays.value = checked ? [...new Set([...windowDays.value, day])] : windowDays.value.filter(value => value !== day) }
const templateValidation = computed(() => validateNewMasterTemplate(template.value))
const startsAt = computed(() => kyivLocalToIso(startsLocal.value))
const expiresAt = computed(() => kyivLocalToIso(expiresLocal.value))
const serialized = computed(() => JSON.stringify([name.value, campaignType.value, masterId.value, promotionId.value, serviceIds.value, segmentIds.value, masterNameForMessage.value, startsLocal.value, expiresLocal.value, channelStrategy.value, windowStart.value, windowEnd.value, windowDays.value, rate.value, frequency.value, maxContacts.value, capDays.value, template.value, channel.value]))
const dirty = computed(() => serialized.value !== baseline.value)
watch(dirty, value => emit('dirty', value), { immediate: true })
const stepIssues = computed<Record<number, string[]>>(() => {
  const result: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  if (name.value.trim().length < 2 || name.value.trim().length > 255) result[1]!.push('Назва кампанії: від 2 до 255 символів.')
  if (!segmentIds.value.length || !segmentValid.value) result[2]!.push('Виберіть активний сегмент аудиторії.')
  if (!validNumber(frequency.value, 1, 365)) result[2]!.push('Інтервал маркетингових повідомлень: від 1 до 365 днів.')
  if (!masterNameForMessage.value.trim() || masterNameForMessage.value.trim().length > 255) result[3]!.push('Вкажіть ім’я майстра для тексту після «до».')
  if (!template.value.trim()) result[3]!.push('Вкажіть SMS шаблон.')
  if (templateValidation.value.unknown.length) result[3]!.push(`Невідомі змінні: ${templateValidation.value.unknown.join(', ')}.`)
  if (templateValidation.value.malformed) result[3]!.push('Некоректні дужки змінних у шаблоні.')
  if ((channel.value === 'sms' || channelStrategy.value === 'telegram_then_sms') && templateValidation.value.unsupported.length) result[3]!.push(`Непідтримувані символи поза BMP: ${templateValidation.value.unsupported.join(' ')}.`)
  if (!masterId.value || !selectedMaster.value) result[4]!.push('Виберіть активного майстра.')
  if (props.duplicated && !masterConfirmed.value) result[4]!.push('Підтвердіть вибраного майстра у копії.')
  if (!promotionId.value || !selectedPromotion.value || !eligiblePromotion(selectedPromotion.value)) result[4]!.push('Виберіть активну персональну акцію з відсотковою знижкою.')
  if (!serviceIds.value.length || selectedServices.value.length !== serviceIds.value.length) result[4]!.push('Виберіть послуги цього майстра.')
  if ((startsLocal.value && !startsAt.value) || (expiresLocal.value && !expiresAt.value)) result[4]!.push('Некоректний час Europe/Kyiv (можливо, перехід на літній час).')
  if (startsAt.value && expiresAt.value && startsAt.value >= expiresAt.value) result[4]!.push('Дата завершення повинна бути пізніше початку.')
  if (!validNumber(rate.value, 1, 480)) result[5]!.push('Швидкість SMS: від 1 до 480 за хвилину.')
  if (!validNumber(maxContacts.value, 1, 100) || !validNumber(capDays.value, 1, 365)) result[5]!.push('Ліміт контактів або період поза дозволеними межами.')
  if (windowStart.value < '10:00' || windowEnd.value > '18:00' || windowStart.value >= windowEnd.value || !windowDays.value.length) result[5]!.push('Вікно відправки має бути в межах 10:00–18:00 та містити дні.')
  return result
})
const issues = computed(() => Object.values(stepIssues.value).flat())
const stepValid = computed<Record<number, boolean>>(() => {
  const ready = !loading.value && !servicesLoading.value
  const value: Record<number, boolean> = Object.fromEntries([1, 2, 3, 4, 5].map(step => [step, ready && !stepIssues.value[step]!.length]))
  value[6] = ready && !issues.value.length
  return value
})
watch(stepValid, value => emit('step-valid', value), { immediate: true })

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [masterResult, promotionResult] = await Promise.all([
      api.adminGetMasters(1, 200, { is_active: true }),
      api.adminGetPromotions(1, 200, { is_active: true }),
    ])
    masters.value = (Array.isArray(masterResult) ? masterResult : masterResult.items).map(item => ({ id: item.id, name: item.full_name_uk || item.full_name || item.name || `#${item.id}` }))
    promotions.value = promotionResult.items
    if (props.campaign) {
      const campaign = props.campaign
      name.value = campaign.name
      campaignType.value = campaign.type === 're_engagement' ? 're_engagement' : 'manual'
      masterId.value = campaign.offer_master_id || 0
      promotionId.value = campaign.offer_promotion_id || 0
      serviceIds.value = [...(campaign.offer_service_ids || [])]
      segmentIds.value = [...(campaign.segment_ids || [])]
      masterNameForMessage.value = campaign.master_name_for_message || ''
      startsLocal.value = isoToKyivLocal(campaign.offer_starts_at)
      expiresLocal.value = isoToKyivLocal(campaign.offer_expires_at)
      channel.value = campaign.channel === 'telegram' ? 'telegram' : 'sms'
      channelStrategy.value = campaign.channel_strategy === 'telegram_then_sms' ? 'telegram_then_sms' : 'single'
      windowStart.value = campaign.sending_window?.start || '10:00'
      windowEnd.value = campaign.sending_window?.end || '18:00'
      windowDays.value = [...(campaign.sending_window?.days || [0, 1, 2, 3, 4, 5, 6])]
      rate.value = campaign.sms_recipients_per_minute ?? 20
      frequency.value = campaign.marketing_frequency_days ?? 7
      maxContacts.value = campaign.marketing_max_contacts ?? 1
      capDays.value = campaign.marketing_cap_days ?? 7
      if (campaign.template_id) persistedTemplate.value = await api.getMessageTemplate(campaign.template_id)
      template.value = persistedTemplate.value?.message_body || campaign.message_body || (audienceMode.value === 'last_visit_3_12' ? DEFAULT_NEW_MASTER_SMS : '')
    }
    if (masterId.value) await loadServices(masterId.value)
    baseline.value = serialized.value
  }
  catch (cause) { error.value = apiErrorMessage(cause, 'Не вдалося завантажити довідники кампанії.') }
  finally { loading.value = false }
}
const loadServices = async (id: number) => {
  const request = ++servicesRequest
  servicesLoading.value = true
  try {
    const result = await api.getMasterServices(id)
    if (request !== servicesRequest || masterId.value !== id) return
    services.value = (Array.isArray(result) ? result : result.items).filter(item => item.is_active).map(item => ({ id: Number(item.id), name: item.title_uk || item.name, is_active: item.is_active, duration_minutes: item.duration_minutes, price: item.price }))
  } finally { if (request === servicesRequest) servicesLoading.value = false }
}
const retryServices = async () => {
  if (!masterId.value) return
  error.value = ''
  try { await loadServices(masterId.value) }
  catch (cause) { error.value = apiErrorMessage(cause, 'Не вдалося завантажити послуги майстра.') }
}
watch(masterId, async (id, oldId) => {
  if (id === oldId || loading.value) return
  ++servicesRequest
  servicesLoading.value = false
  masterConfirmed.value = false
  serviceIds.value = []
  services.value = []
  try { if (id) await loadServices(id) }
  catch (cause) { if (masterId.value === id) error.value = apiErrorMessage(cause, 'Не вдалося завантажити послуги майстра.') }
})
onMounted(load)

const save = async () => {
  if ((props.step !== undefined && props.step !== 6) || !isEditable.value || saving.value || !stepValid.value[6]) return
  saving.value = true
  error.value = ''
  try {
    // A new template version keeps other campaigns and issued snapshots unchanged.
    let templateId = persistedTemplate.value?.id
    if (!templateId || persistedTemplate.value?.message_body !== template.value || persistedTemplate.value?.channel !== channel.value) {
      const created = await api.createMessageTemplate({
        name: `${name.value.trim().slice(0, 200)} · ${new Date().toISOString()}`,
        campaign_type: campaignType.value, channel: channel.value, language: 'uk',
        message_body: template.value, variables: [], is_active: true, is_default: false,
      })
      persistedTemplate.value = created
      templateId = created.id
    }
    const body: NewMasterCampaignInput = {
      name: name.value.trim(), type: campaignType.value, status: 'draft', channel: channel.value,
      channel_strategy: channelStrategy.value, offer_audience_mode: audienceMode.value, purpose: 'marketing', recipient: 'customer', timezone: 'Europe/Kyiv',
      template_id: Number(templateId), segment_ids: segmentIds.value, offer_master_id: masterId.value,
      offer_promotion_id: promotionId.value, offer_service_ids: serviceIds.value,
      master_name_for_message: masterNameForMessage.value.trim(),
      sending_window: { start: windowStart.value, end: windowEnd.value, days: [...windowDays.value].sort() },
      sms_recipients_per_minute: Number(rate.value), marketing_frequency_days: Number(frequency.value),
      marketing_max_contacts: Number(maxContacts.value), marketing_cap_days: Number(capDays.value),
      exclude_upcoming_booking: true, exclude_returned_since_snapshot: true,
      offer_starts_at: startsAt.value,
      offer_expires_at: expiresAt.value,
    }
    const result = props.campaign
      ? await api.updateNewMasterCampaign(props.campaign.id, body)
      : await api.createNewMasterCampaign(body)
    baseline.value = serialized.value
    emit('saved', result)
  }
  catch (cause) { error.value = apiErrorMessage(cause, 'Не вдалося зберегти чернетку.') }
  finally { saving.value = false }
}
</script>

<template>
  <component :is="step === undefined ? BaseCard : 'section'" class="space-y-3" data-testid="new-master-editor">
    <h2 class="text-xl font-semibold">Персональна пропозиція</h2>
    <p v-if="audienceMode === 'last_visit_3_12'" class="text-sm text-ui-muted">У цій кампанії збережені умови: 30% знижки та останній візит 3–12 місяців тому.</p>
    <p v-if="campaign && campaign.status !== 'draft'" class="text-sm text-ui-muted">Умови запущеної кампанії доступні для перегляду. Створіть копію для нової пропозиції.</p>
    <BaseLoader v-if="loading" label="Завантаження довідників…" />
    <div v-if="props.readonly" class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" data-testid="campaign-view">
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt class="text-ui-muted">Майстер</dt><dd class="font-medium text-ui-primary">{{ selectedMaster?.name || `#${campaign?.offer_master_id}` }}</dd></div>
        <div><dt class="text-ui-muted">Акція</dt><dd class="font-medium text-ui-primary">{{ selectedPromotion?.name_uk || `#${campaign?.offer_promotion_id}` }} · {{ selectedPromotion?.discount_percent ?? '—' }}%</dd></div>
        <div><dt class="text-ui-muted">Послуги</dt><dd class="font-medium text-ui-primary">{{ selectedServices.map(item => item.name).join(', ') || serviceIds.map(id => `#${id}`).join(', ') || '—' }}</dd></div>
        <div><dt class="text-ui-muted">Аудиторія</dt><dd>{{ segmentIds.length }} сегментів · інтервал {{ frequency }} днів</dd></div>
        <div><dt class="text-ui-muted">Пропозиція · Europe/Kyiv</dt><dd>{{ startsLocal || 'Без початку' }} — {{ expiresLocal || 'Без завершення' }}</dd></div>
        <div><dt class="text-ui-muted">Відправка</dt><dd>{{ windowStart }}–{{ windowEnd }} · {{ rate }} SMS/хв · {{ windowDays.map(day => ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'][day]).join(', ') }}</dd></div>
        <div><dt class="text-ui-muted">Канал</dt><dd>{{ channelStrategy === 'telegram_then_sms' ? 'Telegram, інакше SMS' : channel === 'telegram' ? 'Telegram' : 'SMS' }}</dd></div>
        <div><dt class="text-ui-muted">Ліміт контактів</dt><dd>{{ maxContacts }} за {{ capDays }} днів</dd></div>
      </dl>
      <div class="min-w-0 space-y-2"><h3 class="inline-flex items-center gap-2 font-medium"><ChatBubbleLeftRightIcon class="h-5 w-5" aria-hidden="true" />Повідомлення</h3>
      <MessagingMessagePreview :body="previewBody" /></div>
    </div>
    <template v-else>
    <div v-show="shown(1)" class="space-y-3">
      <BaseInput v-model="name" label="Назва" data-testid="campaign-name" :disabled="disabled"><template #label><MessagingCampaignFieldHelp label="Назва" /></template><template #icon><DocumentTextIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
      <BaseSelect v-model="campaignType" :options="[{ value: 'manual', label: 'Ручна кампанія' }, { value: 're_engagement', label: 'Повернення клієнтів' }]" label="Тип кампанії" :disabled="disabled" ><template #label><MessagingCampaignFieldHelp label="Тип кампанії" /></template></BaseSelect>
      <MessagingCampaignChannelSelector v-if="audienceMode === 'segments'" v-model:channel="channel" v-model:strategy="channelStrategy" :disabled="disabled" />
      <BaseSelect v-else :model-value="channelStrategy" :options="channelOptions" label="Канал" data-testid="campaign-channel" :disabled="disabled" @update:model-value="channelStrategy = $event === 'telegram_then_sms' ? 'telegram_then_sms' : 'single'"><template #label><MessagingCampaignFieldHelp label="Канал" /></template><template #icon><ChatBubbleLeftRightIcon class="h-4 w-4" aria-hidden="true" /></template></BaseSelect>
    </div>
    <div v-show="shown(2)" class="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)]">
      <p v-if="audienceMode === 'last_visit_3_12'" class="text-xs text-ui-muted lg:col-span-2">Збережене правило 3–12 місяців діє разом із сегментом.</p>
      <MessagingSegmentCampaignAudience v-model="segmentIds" :disabled="disabled" @valid="segmentValid = $event" />
      <BaseInput :model-value="frequency" type="number" min="1" max="365" label="Мінімум днів між маркетинговими контактами" :disabled="disabled" @update:model-value="frequency = numberValue($event)" ><template #label><MessagingCampaignFieldHelp label="Мінімум днів між маркетинговими контактами" /></template></BaseInput>
    </div>
    <div v-show="shown(3)" class="space-y-3">
      <BaseInput v-model="masterNameForMessage" label="Ім’я у повідомленні після «до» (наприклад, Андрія Віканова)" data-testid="marketing-master-name" :disabled="disabled"><template #label><MessagingCampaignFieldHelp label="Ім’я у повідомленні після «до» (наприклад, Андрія Віканова)" /></template><template #icon><UserIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
      <BaseTextarea v-model="template" label="Текст повідомлення" data-testid="sms-template" :rows="5" :disabled="disabled"><template #label><MessagingCampaignFieldHelp label="Текст повідомлення" /></template><template #icon><ChatBubbleLeftRightIcon class="h-4 w-4" aria-hidden="true" /></template></BaseTextarea>
      <div class="flex flex-wrap gap-2"><BaseButton v-for="variable in ['master_name', 'discount_percent', 'promotion_name_uk', 'offer_expires_short', 'offer_link']" :key="variable" type="button" variant="neutral" size="sm" :disabled="disabled" @click="template += `${template ? ' ' : ''}{{${variable}}}`">{{ variable }}</BaseButton></div>
    </div>
    <div v-show="shown(4)" class="space-y-3">
      <div class="grid gap-3 md:grid-cols-2">
        <BaseSelect :model-value="masterId" :options="masterOptions" label="Майстер" data-testid="campaign-master" :disabled="disabled" @update:model-value="masterId = Number($event)"><template #label><MessagingCampaignFieldHelp label="Майстер" /></template><template #icon><UserIcon class="h-4 w-4" aria-hidden="true" /></template></BaseSelect>
        <BaseSelect :model-value="promotionId" :options="promotionOptions" label="Акція" data-testid="campaign-promotion" :disabled="disabled" @update:model-value="promotionId = Number($event)"><template #label><MessagingCampaignFieldHelp label="Акція" /></template><template #icon><TagIcon class="h-4 w-4" aria-hidden="true" /></template></BaseSelect>
      </div>
      <p v-if="!loading && promotionOptions.length === 1" class="text-sm text-ui-muted">Активних персональних акцій із відсотковою знижкою немає. <NuxtLink to="/promotions" class="text-ui-accent underline">Переглянути акції</NuxtLink></p>
      <BaseCheckbox v-if="duplicated" v-model="masterConfirmed" data-testid="confirm-master" :disabled="disabled"><MessagingCampaignFieldHelp :label="`Підтверджую вибір майстра: ${selectedMaster?.name || '—'}`" help="Перевірте майстра перед збереженням копії: персональні посилання та доступні послуги будуть прив’язані саме до нього." /></BaseCheckbox>
      <BaseField as="div" label="Послуги цього майстра">
        <template #label><MessagingCampaignFieldHelp label="Послуги цього майстра" /></template>
        <template #icon><ScissorsIcon class="h-4 w-4" aria-hidden="true" /></template>
        <BaseLoader v-if="servicesLoading" label="Завантаження послуг…" />
        <div v-else-if="services.length" data-testid="campaign-services"><ServiceMultiSelect v-model="serviceSelection" :services="services" :show-limit="false" :disabled="disabled" /></div>
        <div v-else-if="masterId && !loading" class="space-y-2 text-sm text-ui-muted"><p>Активних послуг цього майстра немає або їх не вдалося завантажити.</p><BaseButton type="button" variant="neutral" size="sm" :disabled="disabled" @click="retryServices">Повторити</BaseButton></div>
      </BaseField>
      <div class="grid gap-3 md:grid-cols-2"><BaseCalendar v-model="startsLocal" mode="datetime" label="Початок пропозиції · Europe/Kyiv" data-testid="offer-start" :disabled="disabled" ><template #label><MessagingCampaignFieldHelp label="Початок пропозиції · Europe/Kyiv" /></template></BaseCalendar><BaseCalendar v-model="expiresLocal" mode="datetime" label="Кінець пропозиції · Europe/Kyiv" data-testid="offer-end" :disabled="disabled" ><template #label><MessagingCampaignFieldHelp label="Кінець пропозиції · Europe/Kyiv" /></template></BaseCalendar></div>
      <p class="text-xs text-ui-muted">Дати можна залишити порожніми в чернетці. До запуску обидві обов’язкові. Візит має початися до кінця пропозиції.</p>
    </div>
    <div v-show="shown(5)" class="space-y-3">
      <div class="grid gap-3 sm:grid-cols-3"><BaseInput v-model="windowStart" type="time" min="10:00" max="18:00" label="Початок відправки" data-testid="window-start" :disabled="disabled" ><template #label><MessagingCampaignFieldHelp label="Початок відправки" /></template></BaseInput><BaseInput v-model="windowEnd" type="time" min="10:00" max="18:00" label="Кінець відправки" data-testid="window-end" :disabled="disabled" ><template #label><MessagingCampaignFieldHelp label="Кінець відправки" /></template></BaseInput><BaseInput :model-value="rate" type="number" min="1" max="480" label="SMS за хвилину" data-testid="sms-rate" :disabled="disabled" @update:model-value="rate = numberValue($event)" ><template #label><MessagingCampaignFieldHelp label="SMS за хвилину" /></template></BaseInput></div>
      <div><MessagingCampaignFieldHelp label="Дні відправки" /><div class="mt-2 flex flex-wrap gap-3"><BaseCheckbox v-for="(day, index) in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']" :key="index" :model-value="windowDays.includes(index)" :disabled="disabled" @update:model-value="toggleDay(index, Boolean($event))">{{ day }}</BaseCheckbox></div></div>
      <div class="grid gap-3 sm:grid-cols-2"><BaseInput :model-value="maxContacts" type="number" min="1" max="100" label="Максимум контактів" :disabled="disabled" @update:model-value="maxContacts = numberValue($event)" ><template #label><MessagingCampaignFieldHelp label="Максимум контактів" /></template></BaseInput><BaseInput :model-value="capDays" type="number" min="1" max="365" label="За період, днів" :disabled="disabled" @update:model-value="capDays = numberValue($event)" ><template #label><MessagingCampaignFieldHelp label="За період, днів" /></template></BaseInput></div>
    </div>
    <div v-if="step === 6" class="space-y-3 text-sm">
      <h3 class="text-lg font-semibold">Перевірка кампанії</h3>
      <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <dl class="grid gap-3 sm:grid-cols-2">
      <div><dt class="text-ui-muted">Назва:</dt><dd class="font-medium text-ui-primary">{{ name }} · <strong>Канал:</strong> {{ channelLabel }}</dd></div>
      <div><dt class="text-ui-muted">Сегментів:</dt><dd class="font-medium text-ui-primary">{{ segmentIds.length }} · <strong>Інтервал:</strong> {{ frequency ?? '—' }} днів</dd></div>
      <div><dt class="text-ui-muted">Майстер:</dt><dd class="font-medium text-ui-primary">{{ selectedMaster?.name || '—' }} · <strong>Акція:</strong> {{ selectedPromotion?.name_uk || '—' }}</dd></div>
      <div><dt class="text-ui-muted">Ім’я у тексті:</dt><dd class="font-medium text-ui-primary">{{ masterNameForMessage || '—' }}</dd></div>
      <div><dt class="text-ui-muted">Послуги:</dt><dd class="font-medium text-ui-primary">{{ selectedServices.map(item => item.name).join(', ') || '—' }} · <strong>Пропозиція:</strong> {{ startsLocal || 'Без початку' }} — {{ expiresLocal || 'Без завершення' }}</dd></div>
      <div><dt class="text-ui-muted">Відправка:</dt><dd class="font-medium text-ui-primary">{{ windowStart }}–{{ windowEnd }} · {{ rate ?? '—' }} SMS/хв · {{ windowDays.length }} днів тижня</dd></div>
      <div><dt class="text-ui-muted">Контакти:</dt><dd class="font-medium text-ui-primary">{{ maxContacts ?? '—' }} за {{ capDays ?? '—' }} днів</dd></div>
      </dl>
      <MessagingMessagePreview :body="previewBody" />
      </div>
    </div>
    <ul v-if="(step === 6 || step === undefined ? issues : stepIssues[step] || []).length" class="list-inside list-disc text-sm text-red-500"><li v-for="item in step === 6 || step === undefined ? issues : stepIssues[step] || []" :key="item">{{ item }}</li></ul>
    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    <p v-if="step === undefined || step === 6" class="text-sm text-ui-muted">{{ campaign ? 'Зміни буде збережено без відправки повідомлень.' : 'Кампанію буде створено як чернетку. Запуск розсилки підтверджується окремо після створення.' }}</p>
    <BaseButton v-if="step === undefined || step === 6" data-testid="save-campaign" type="button" variant="primary" :loading="saving" :disabled="!isEditable || !stepValid[6] || (!!campaign && !dirty)" @click="save"><CheckIcon class="h-4 w-4" aria-hidden="true" />{{ campaign ? 'Зберегти зміни' : 'Створити кампанію' }}</BaseButton>
    </template>
    <p v-if="props.readonly && error" role="alert" class="ui-status-danger text-sm">{{ error }}</p>
  </component>
</template>
