<script setup lang="ts">
import type { MessagingCampaign, MessageTemplate } from '~/types/messaging'
import type { NewMasterCampaignInput } from '~/types/newMaster'
import { DEFAULT_NEW_MASTER_SMS, validateNewMasterTemplate, kyivLocalToIso, isoToKyivLocal } from '~/utils/newMasterCampaign.mjs'

const props = defineProps<{ campaign?: MessagingCampaign | null; duplicated?: boolean }>()
const emit = defineEmits<{ saved: [campaign: MessagingCampaign]; dirty: [value: boolean] }>()
const api = useBackofficeApi()
const { apiErrorMessage } = useBookingFormatting()
const { canCreateMessagingDrafts } = useBackofficeAccess()
const masters = ref<Array<{ id: number; name: string }>>([])
const promotions = ref<Array<{ id: number; name_uk: string; discount_percent: number; is_active: boolean; recipient_offer_only?: boolean; discount_type: string }>>([])
const segments = ref<Array<{ id: number; name: string; status: string }>>([])
const services = ref<Array<{ id: number; name: string; is_active: boolean }>>([])
const loading = ref(false)
const servicesLoading = ref(false)
let servicesRequest = 0
const isEditable = computed(() => canCreateMessagingDrafts.value && (!props.campaign || props.campaign.status === 'draft'))
const saving = ref(false)
const error = ref('')
const masterConfirmed = ref(false)
const name = ref('Новий майстер')
const masterId = ref(0)
const promotionId = ref(0)
const serviceIds = ref<number[]>([])
const segmentIds = ref<number[]>([])
const masterNameForMessage = ref('')
const startsLocal = ref('')
const expiresLocal = ref('')
const channelStrategy = ref<'single' | 'telegram_then_sms'>('single')
const windowStart = ref('10:00')
const windowEnd = ref('18:00')
const windowDays = ref([0, 1, 2, 3, 4, 5, 6])
const rate = ref(20)
const frequency = ref(7)
const maxContacts = ref(1)
const capDays = ref(7)
const template = ref(DEFAULT_NEW_MASTER_SMS)
const persistedTemplate = ref<MessageTemplate | null>(null)
const baseline = ref('')
const selectedMaster = computed(() => masters.value.find(item => item.id === masterId.value))
const selectedPromotion = computed(() => promotions.value.find(item => item.id === promotionId.value))
const selectedServices = computed(() => services.value.filter(item => serviceIds.value.includes(item.id)))
const selectedSegments = computed(() => segments.value.filter(item => segmentIds.value.includes(item.id)))
const templateValidation = computed(() => validateNewMasterTemplate(template.value))
const startsAt = computed(() => kyivLocalToIso(startsLocal.value))
const expiresAt = computed(() => kyivLocalToIso(expiresLocal.value))
const serialized = computed(() => JSON.stringify([name.value, masterId.value, promotionId.value, serviceIds.value, segmentIds.value, masterNameForMessage.value, startsLocal.value, expiresLocal.value, channelStrategy.value, windowStart.value, windowEnd.value, windowDays.value, rate.value, frequency.value, maxContacts.value, capDays.value, template.value]))
const dirty = computed(() => serialized.value !== baseline.value)
watch(dirty, value => emit('dirty', value), { immediate: true })
const issues = computed(() => {
  const result: string[] = []
  if (!name.value.trim()) result.push('Вкажіть назву кампанії.')
  if (!masterId.value || !selectedMaster.value) result.push('Виберіть активного майстра.')
  if (!masterNameForMessage.value.trim()) result.push('Вкажіть ім’я майстра для тексту після «до».')
  if (props.duplicated && !masterConfirmed.value) result.push('Підтвердіть вибраного майстра у копії.')
  if (!promotionId.value || !selectedPromotion.value || selectedPromotion.value.discount_percent !== 30 || !selectedPromotion.value.is_active || !selectedPromotion.value.recipient_offer_only || selectedPromotion.value.discount_type !== 'percent') result.push('Виберіть активну акцію з 30% знижкою.')
  if (!serviceIds.value.length || selectedServices.value.length !== serviceIds.value.length) result.push('Виберіть послуги цього майстра.')
  if (!segmentIds.value.length) result.push('Виберіть сегмент аудиторії.')
  if ((startsLocal.value && !startsAt.value) || (expiresLocal.value && !expiresAt.value)) result.push('Некоректний час Europe/Kyiv (можливо, перехід на літній час).')
  if (startsAt.value && expiresAt.value && startsAt.value >= expiresAt.value) result.push('Дата завершення повинна бути пізніше початку.')
  if (!Number.isInteger(rate.value) || rate.value < 1 || rate.value > 480) result.push('Швидкість SMS: від 1 до 480 за хвилину.')
  if (!Number.isInteger(frequency.value) || frequency.value < 1 || frequency.value > 365) result.push('Інтервал маркетингових повідомлень: від 1 до 365 днів.')
  if (!Number.isInteger(maxContacts.value) || maxContacts.value < 1 || maxContacts.value > 100 || !Number.isInteger(capDays.value) || capDays.value < 1 || capDays.value > 365) result.push('Ліміт контактів або період поза дозволеними межами.')
  if (windowStart.value < '10:00' || windowEnd.value > '18:00' || windowStart.value >= windowEnd.value || !windowDays.value.length) result.push('Вікно відправки має бути в межах 10:00–18:00 та містити дні.')
  if (!template.value.trim()) result.push('Вкажіть SMS шаблон.')
  if (templateValidation.value.unknown.length) result.push(`Невідомі змінні: ${templateValidation.value.unknown.join(', ')}.`)
  if (templateValidation.value.malformed) result.push('Некоректні дужки змінних у шаблоні.')
  if (templateValidation.value.unsupported.length) result.push(`Непідтримувані символи поза BMP: ${templateValidation.value.unsupported.join(' ')}.`)
  return result
})

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [masterResult, promotionResult, segmentResult] = await Promise.all([
      api.adminGetMasters(1, 200, { is_active: true }),
      api.adminGetPromotions(1, 200, { is_active: true }),
      api.getSegments({ status: 'active', limit: 200 }),
    ])
    masters.value = (Array.isArray(masterResult) ? masterResult : masterResult.items).map(item => ({ id: item.id, name: item.full_name_uk || item.full_name || item.name || `#${item.id}` }))
    promotions.value = promotionResult.items
    segments.value = segmentResult.items
    if (props.campaign) {
      const campaign = props.campaign
      name.value = campaign.name
      masterId.value = campaign.offer_master_id || 0
      promotionId.value = campaign.offer_promotion_id || 0
      serviceIds.value = [...(campaign.offer_service_ids || [])]
      segmentIds.value = [...(campaign.segment_ids || [])]
      masterNameForMessage.value = campaign.master_name_for_message || ''
      startsLocal.value = isoToKyivLocal(campaign.offer_starts_at)
      expiresLocal.value = isoToKyivLocal(campaign.offer_expires_at)
      channelStrategy.value = campaign.channel_strategy === 'telegram_then_sms' ? 'telegram_then_sms' : 'single'
      windowStart.value = campaign.sending_window?.start || '10:00'
      windowEnd.value = campaign.sending_window?.end || '18:00'
      windowDays.value = [...(campaign.sending_window?.days || [0, 1, 2, 3, 4, 5, 6])]
      rate.value = campaign.sms_recipients_per_minute ?? 20
      frequency.value = campaign.marketing_frequency_days ?? 7
      maxContacts.value = campaign.marketing_max_contacts ?? 1
      capDays.value = campaign.marketing_cap_days ?? 7
      if (campaign.template_id) persistedTemplate.value = await api.getMessageTemplate(campaign.template_id)
      template.value = persistedTemplate.value?.message_body || campaign.message_body || DEFAULT_NEW_MASTER_SMS
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
    services.value = (Array.isArray(result) ? result : result.items).filter(item => item.is_active).map(item => ({ id: Number(item.id), name: item.title_uk || item.name, is_active: item.is_active }))
  } finally { if (request === servicesRequest) servicesLoading.value = false }
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
  if (!isEditable.value || saving.value || servicesLoading.value || issues.value.length) return
  saving.value = true
  error.value = ''
  try {
    // A new template version keeps other campaigns and issued snapshots unchanged.
    let templateId = persistedTemplate.value?.id
    if (!templateId || persistedTemplate.value?.message_body !== template.value) {
      const created = await api.createMessageTemplate({
        name: `${name.value.trim()} · ${new Date().toISOString()}`,
        campaign_type: 're_engagement', channel: 'sms', language: 'uk',
        message_body: template.value, variables: [], is_active: true, is_default: false,
      })
      persistedTemplate.value = created
      templateId = created.id
    }
    const body: NewMasterCampaignInput = {
      name: name.value.trim(), type: 're_engagement', status: 'draft', channel: 'sms',
      channel_strategy: channelStrategy.value, purpose: 'marketing', recipient: 'customer', timezone: 'Europe/Kyiv',
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
  <section class="base-card space-y-5 rounded-3xl p-5" data-testid="new-master-editor">
    <div><h2 class="text-xl font-semibold">Умови «Новий майстер»</h2><p class="text-sm text-ui-muted">30% знижки для клієнтів, які востаннє були 3–12 календарних місяців тому. Клієнти з майбутнім записом або повторним візитом після фіксації аудиторії виключаються сервером.</p></div>
    <p v-if="campaign && !isEditable" class="text-sm text-ui-muted">Умови запущеної кампанії доступні для перегляду. Створіть копію для нової пропозиції.</p>
    <p v-if="loading">Завантаження довідників…</p>
    <fieldset :disabled="loading || saving || !isEditable" class="space-y-5">
      <label class="grid gap-1"><span>Назва</span><input v-model="name" data-testid="campaign-name" class="new-master-control w-full rounded-xl border p-3" /></label>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-1"><span>Майстер</span><select v-model.number="masterId" data-testid="campaign-master" class="new-master-control rounded-xl border p-3"><option :value="0">Оберіть майстра</option><option v-for="item in masters" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label class="grid gap-1"><span>Акція 30%</span><select v-model.number="promotionId" data-testid="campaign-promotion" class="new-master-control rounded-xl border p-3"><option :value="0">Оберіть акцію</option><option v-for="item in promotions.filter(value => value.discount_percent === 30 && value.is_active && value.recipient_offer_only && value.discount_type === 'percent')" :key="item.id" :value="item.id">{{ item.name_uk }}</option></select></label>
      </div>
      <label v-if="duplicated" class="flex items-center gap-2 rounded-xl bg-ui-subtle p-3"><input v-model="masterConfirmed" type="checkbox" data-testid="confirm-master" /> Підтверджую вибір майстра: {{ selectedMaster?.name || '—' }}</label>
      <label class="grid gap-1"><span>Ім’я у повідомленні після «до» (наприклад, Андрія Віканова)</span><input v-model="masterNameForMessage" data-testid="marketing-master-name" class="new-master-control w-full rounded-xl border p-3" /></label>
      <div><p>Послуги цього майстра</p><div class="mt-2 grid gap-2 sm:grid-cols-2"><label v-for="item in services" :key="item.id" class="flex gap-2"><input v-model="serviceIds" type="checkbox" :value="item.id" :data-testid="`campaign-service-${item.id}`" /> {{ item.name }}</label></div></div>
      <div><p>Додатковий сегмент аудиторії</p><p class="text-xs text-ui-muted">Обов’язкове правило 3–12 календарних місяців діє незалежно від вибраного сегмента.</p><div class="mt-2 grid gap-2 sm:grid-cols-2"><label v-for="item in segments" :key="item.id" class="flex gap-2"><input v-model="segmentIds" type="checkbox" :value="item.id" :data-testid="`campaign-segment-${item.id}`" /> {{ item.name }}</label></div></div>
      <div class="grid gap-4 md:grid-cols-2"><label class="grid gap-1"><span>Початок пропозиції · Europe/Kyiv</span><input v-model="startsLocal" data-testid="offer-start" type="datetime-local" class="new-master-control rounded-xl border p-3" /></label><label class="grid gap-1"><span>Кінець пропозиції · Europe/Kyiv</span><input v-model="expiresLocal" data-testid="offer-end" type="datetime-local" class="new-master-control rounded-xl border p-3" /></label></div>
      <p class="text-xs text-ui-muted">Дати можна залишити порожніми в чернетці. До запуску обидві обов’язкові. Візит має початися до кінця пропозиції.</p>
      <label class="grid gap-1"><span>Канал</span><select v-model="channelStrategy" data-testid="campaign-channel" class="new-master-control rounded-xl border p-3"><option value="single">SMS</option><option value="telegram_then_sms">Telegram → SMS, якщо Telegram недоступний</option></select></label>
      <div class="grid gap-4 sm:grid-cols-3"><label class="grid gap-1"><span>Початок відправки</span><input v-model="windowStart" type="time" min="10:00" max="18:00" data-testid="window-start" class="new-master-control rounded-xl border p-3" /></label><label class="grid gap-1"><span>Кінець відправки</span><input v-model="windowEnd" type="time" min="10:00" max="18:00" data-testid="window-end" class="new-master-control rounded-xl border p-3" /></label><label class="grid gap-1"><span>SMS за хвилину</span><input v-model.number="rate" type="number" min="1" max="480" data-testid="sms-rate" class="new-master-control rounded-xl border p-3" /></label></div>
      <div><p>Дні відправки (понеділок → неділя)</p><div class="mt-2 flex flex-wrap gap-3"><label v-for="(day, index) in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']" :key="index" class="flex gap-1"><input v-model="windowDays" type="checkbox" :value="index" />{{ day }}</label></div></div>
      <div class="grid gap-4 sm:grid-cols-3"><label class="grid gap-1"><span>Мінімум днів між маркетинговими контактами</span><input v-model.number="frequency" type="number" min="1" max="365" class="new-master-control rounded-xl border p-3" /></label><label class="grid gap-1"><span>Максимум контактів</span><input v-model.number="maxContacts" type="number" min="1" max="100" class="new-master-control rounded-xl border p-3" /></label><label class="grid gap-1"><span>За період, днів</span><input v-model.number="capDays" type="number" min="1" max="365" class="new-master-control rounded-xl border p-3" /></label></div>
      <label class="grid gap-1"><span>SMS шаблон</span><textarea v-model="template" data-testid="sms-template" rows="5" class="new-master-control w-full rounded-xl border p-3" /></label>
      <p class="text-xs text-ui-muted">Підстановки: <span v-pre>{{master_name}}, {{offer_expires_short}}, {{offer_link}}</span>. Персоналізований текст і частини SMS надає сервер у перегляді після збереження.</p>
    </fieldset>
    <ul v-if="issues.length" class="list-inside list-disc text-sm text-red-500"><li v-for="item in issues" :key="item">{{ item }}</li></ul>
    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    <button data-testid="save-campaign" type="button" class="rounded-full bg-cyan-700 px-5 py-3 font-medium text-white disabled:opacity-50" :disabled="!isEditable || saving || loading || servicesLoading || !!issues.length || (!!campaign && !dirty)" @click="save">{{ saving ? 'Збереження…' : 'Зберегти чернетку' }}</button>
    <p class="text-sm text-ui-muted">Збереження не надсилає повідомлень. Тест SMS для цієї пропозиції потребує окремого запуску на обмежену тестову аудиторію.</p>
  </section>
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
