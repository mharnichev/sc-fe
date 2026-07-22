<script setup lang="ts">
import {
  ArchiveBoxIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  LinkIcon,
  PaperAirplaneIcon,
  PauseIcon,
  PencilIcon,
  PlusIcon,
  PlayIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import type { AudienceRule, CampaignPayload, CampaignStatus, CampaignType, MessagingCampaign, MessagingChannel } from '~/types/messaging'

const api = useBackofficeApi()
const { campaignTypes, channels, variables, sampleClient } = useMessagingUi()
const { canCreateMessagingDrafts, canSendMessagingCampaigns } = useBackofficeAccess()
const { apiErrorMessage } = useBookingFormatting()
const toast = useBaseToastNotification()

const { data, pending, error, refresh } = await useAsyncData('messaging-dashboard', () => api.getMessagingDashboard())
const route = useRoute()
const campaignsPage = ref(1)
const campaignsPageSize = 20
const campaignsSectionRef = ref<HTMLElement | null>(null)
const campaignStatusOptions = [
  { value: '', label: 'Усі статуси' },
  { value: 'draft', label: 'Чернетка' },
  { value: 'active', label: 'Активна' },
  { value: 'scheduled', label: 'Запланована' },
  { value: 'paused', label: 'На паузі' },
  { value: 'completed', label: 'Завершена' },
  { value: 'failed', label: 'Помилка' },
]
const campaignFilters = reactive({
  status: String(route.query.status || ''),
  type: '',
  channel: '',
  date_from: '',
  date_to: '',
  barber_id: null as number | null,
})
const [
  { data: campaignsData, pending: campaignsPending, error: campaignsError, refresh: refreshCampaigns },
  { data: masters },
] = await Promise.all([
  useAsyncData('messaging-main-campaigns', () => api.getMessagingCampaigns(campaignsPage.value, campaignsPageSize, campaignFilters), { watch: [campaignsPage] }),
  useAsyncData('messaging-main-campaign-masters', () => api.adminGetMasters(1, 100)),
])
const telegramAudienceRules: AudienceRule[] = [{ type: 'all_clients' }]
const telegramAudiencePreviewLimit = 1000
const { data: telegramAudience, pending: telegramAudiencePending, error: telegramAudienceError, refresh: refreshTelegramAudience } = await useAsyncData(
  'messaging-telegram-audience',
  async () => {
    const [estimate, recipients] = await Promise.all([
      api.estimateMessagingAudience(telegramAudienceRules),
      api.previewMessagingRecipients(telegramAudienceRules, telegramAudiencePreviewLimit),
    ])
    return { estimate, recipients }
  },
)

type CampaignMessageEditor = {
  name: string
  type: CampaignType
  channel: MessagingChannel
  status: Extract<CampaignStatus, 'draft' | 'active' | 'paused'>
  message_body: string
  review_link: string
  lead_hours: number
  window_minutes: number
  location_key: string
}

const cards = computed(() => [
  { label: 'Активні кампанії', value: data.value?.active_campaigns || 0 },
  { label: 'Заплановані', value: data.value?.scheduled_campaigns || 0 },
  { label: 'Надіслано', value: data.value?.messages_sent || 0 },
  { label: 'Помилки', value: data.value?.failed_messages || 0 },
  { label: 'Доставка', value: `${data.value?.delivery_rate || 0}%` },
  { label: 'Запити відгуків', value: data.value?.review_requests_sent || 0 },
])

const telegramConnectedTotal = computed(() =>
  Math.max((telegramAudience.value?.estimate.total || 0) - (telegramAudience.value?.estimate.missing_chat_id || 0), 0),
)
const telegramConnectedRecipients = computed(() =>
  (telegramAudience.value?.recipients || []).filter(recipient => Boolean(recipient.telegram_chat_id)),
)
const masterItems = computed(() => Array.isArray(masters.value) ? masters.value : masters.value?.items || [])
const campaignTypeOptions = computed(() => [
  { value: '', label: 'Усі типи' },
  ...campaignTypes.map(type => ({ value: type.value, label: type.label })),
])
const campaignChannelOptions = computed(() => [
  { value: '', label: 'Усі канали' },
  ...channels.map(channel => ({ value: channel.value, label: channel.label })),
])
const campaignEditorTypeOptions = computed(() => campaignTypes.map(type => ({ value: type.value, label: type.label })))
const campaignEditorStatusOptions = [
  { value: 'draft', label: 'Чернетка' },
  { value: 'active', label: 'Активна' },
  { value: 'paused', label: 'На паузі' },
]

const campaignActionPending = ref(false)
const confirmCampaignAction = ref<{ campaign: MessagingCampaign, action: 'archived' | 'delete' | 'paused' | 'active' } | null>(null)
const campaignEditing = ref<MessagingCampaign | null>(null)
const campaignEditorSaving = ref(false)
const campaignEditor = reactive<CampaignMessageEditor>({
  name: '',
  type: 'manual',
  channel: 'telegram',
  status: 'draft',
  message_body: '',
  review_link: '',
  lead_hours: 24,
  window_minutes: 60,
  location_key: '',
})
const metadataNumber = (campaign: MessagingCampaign, key: 'lead_hours' | 'window_minutes', fallback: number) => {
  const raw = campaign.metadata_json?.[key]
  const value = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const metadataText = (campaign: MessagingCampaign | null | undefined, key: string) => {
  const value = campaign?.metadata_json?.[key]
  return typeof value === 'string' && value.trim() ? value : ''
}

const campaignMessageBody = (campaign?: MessagingCampaign | null) =>
  campaign?.message_body
  || metadataText(campaign, 'message_body')
  || metadataText(campaign, 'body')
  || ''

const openCampaignEditor = (campaign: MessagingCampaign) => {
  campaignEditing.value = campaign
  campaignEditor.name = campaign.name
  campaignEditor.type = campaign.type
  campaignEditor.channel = campaign.channel
  campaignEditor.status = campaign.status === 'active' || campaign.status === 'paused' ? campaign.status : 'draft'
  campaignEditor.message_body = campaignMessageBody(campaign)
  campaignEditor.review_link = campaign.review_link || ''
  campaignEditor.lead_hours = metadataNumber(campaign, 'lead_hours', 24)
  campaignEditor.window_minutes = metadataNumber(campaign, 'window_minutes', 60)
  campaignEditor.location_key = campaign.location_key || ''
}

const closeCampaignEditor = () => {
  campaignEditing.value = null
}

const handleCampaignEditorModelUpdate = (value: boolean) => {
  if (!value) closeCampaignEditor()
}

const saveCampaignEditor = async () => {
  if (!campaignEditing.value || !canCreateMessagingDrafts.value) return
  campaignEditorSaving.value = true
  try {
    const campaign = campaignEditing.value
    const metadata: Record<string, unknown> = {
      ...(campaign.metadata_json || {}),
      message_body: campaignEditor.message_body,
      audience_rules: campaign.audience_rules || [{ type: 'all_clients' }],
    }
    if (campaignEditor.type === 'appointment_reminder') {
      metadata.lead_hours = Math.max(1, Number(campaignEditor.lead_hours) || 24)
      metadata.window_minutes = Math.max(1, Number(campaignEditor.window_minutes) || 60)
    }
    const payload: Partial<CampaignPayload> = {
      name: campaignEditor.name,
      type: campaignEditor.type,
      channel: campaignEditor.channel,
      status: campaignEditor.status,
      purpose: campaign.purpose || undefined,
      template_id: campaign.template_id || null,
      message_body: campaignEditor.message_body,
      audience_rules: campaign.audience_rules || [{ type: 'all_clients' }],
      review_link: campaignEditor.review_link || null,
      schedule_mode: 'automated',
      timezone: campaign.timezone || 'Europe/Kyiv',
      max_messages_per_minute: 20,
      quiet_hours_enabled: campaign.channel !== 'sms',
      duplicate_protection_days: campaign.channel === 'sms' ? 0 : 30,
      location_key: campaignEditor.location_key || null,
      metadata_json: metadata,
    }
    if (campaign.channel === 'sms') await api.updateSmsCampaign(campaign.id, payload)
    else await api.updateMessagingCampaign(campaign.id, payload)
    toast.success('Повідомлення кампанії оновлено.')
    closeCampaignEditor()
    await refreshMessagingData()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося зберегти повідомлення.'))
  }
  finally {
    campaignEditorSaving.value = false
  }
}

const refreshMessagingData = async () => {
  await Promise.all([refresh(), refreshCampaigns(), refreshTelegramAudience()])
}

const applyCampaignFilters = async () => {
  campaignsPage.value = 1
  await refreshCampaigns()
}

const clearCampaignFilters = async () => {
  campaignFilters.status = ''
  campaignFilters.type = ''
  campaignFilters.channel = ''
  campaignFilters.date_from = ''
  campaignFilters.date_to = ''
  campaignFilters.barber_id = null
  campaignsPage.value = 1
  await refreshCampaigns()
}

const viewFailedCampaigns = async () => {
  campaignFilters.status = 'failed'
  campaignFilters.type = ''
  campaignFilters.channel = ''
  campaignFilters.date_from = ''
  campaignFilters.date_to = ''
  campaignFilters.barber_id = null
  campaignsPage.value = 1
  await refreshCampaigns()
  await nextTick()
  campaignsSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const duplicateCampaign = async (campaign: MessagingCampaign) => {
  await api.duplicateMessagingCampaign(campaign.id)
  await refreshMessagingData()
}

const runCampaignAction = async () => {
  if (!confirmCampaignAction.value) return
  campaignActionPending.value = true
  try {
    const { campaign, action } = confirmCampaignAction.value
    if (action === 'delete') await api.deleteMessagingCampaign(campaign.id)
    else await api.updateMessagingCampaignStatus(campaign.id, action)
    confirmCampaignAction.value = null
    await refreshMessagingData()
  }
  finally {
    campaignActionPending.value = false
  }
}

const closeCampaignConfirm = (value: boolean) => {
  if (!value) confirmCampaignAction.value = null
}

const insertCampaignVariable = (variable: string) => {
  const separator = campaignEditor.message_body && !campaignEditor.message_body.endsWith(' ') ? ' ' : ''
  campaignEditor.message_body = `${campaignEditor.message_body}${separator}${variable}`
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Комунікації з клієнтами</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Telegram та SMS сценарії, автоматичні запити відгуків, шаблони та контроль відправок.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/messaging/campaigns/new" class="messaging-primary-action inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium">
          <PlusIcon class="h-5 w-5" />
          Створити кампанію
        </NuxtLink>
      </div>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <div v-for="index in 6" :key="index" class="h-28 animate-pulse rounded-[1.25rem] bg-slate-100" />
    </div>
    <div v-else-if="error" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
      Не вдалося завантажити dashboard. <BaseButton class="font-semibold underline" @click="refresh()">Спробувати ще раз</BaseButton>
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <div v-for="card in cards" :key="card.label" class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ card.label }}</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">{{ card.value }}</p>
      </div>
    </div>

    <MessagingSmsCampaignsPanel @changed="refreshMessagingData" />

    <section id="campaigns" ref="campaignsSectionRef" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Кампанії</h2>
          <p class="mt-1 text-sm text-slate-500">Усі Telegram та SMS кампанії з фільтрами, статусами й діями.</p>
        </div>
      </div>

      <div class="mt-5 grid gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-3 xl:grid-cols-6">
        <BaseSelect v-model="campaignFilters.status" :options="campaignStatusOptions" menu-class="z-[220]" />
        <BaseSelect v-model="campaignFilters.type" :options="campaignTypeOptions" menu-class="z-[220]" />
        <BaseSelect v-model="campaignFilters.channel" :options="campaignChannelOptions" menu-class="z-[220]" />
        <BaseDateRange
          v-model:date-from="campaignFilters.date_from"
          v-model:date-to="campaignFilters.date_to"
          from-label=""
          to-label=""
          from-placeholder="Початок дати"
          to-placeholder="Кінець дати"
          input-class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
          class="md:col-span-2 xl:col-span-2"
        />
        <MasterSelect v-model="campaignFilters.barber_id" :masters="masterItems" value-type="number" all-label="Усі майстри" compact menu-class="z-[220]" />
        <div class="flex flex-wrap gap-3 md:col-span-3 xl:col-span-6">
          <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" @click="applyCampaignFilters">
            <FunnelIcon class="h-4 w-4" aria-hidden="true" />
            <span>Застосувати</span>
          </BaseButton>
          <BaseButton class="backoffice-modal-action-button backoffice-modal-action-neutral" @click="clearCampaignFilters">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            <span>Очистити</span>
          </BaseButton>
        </div>
      </div>

      <div v-if="campaignsError" class="mt-5 rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Не вдалося завантажити кампанії.
      </div>
      <div class="mt-5 overflow-hidden rounded-[1.25rem] border border-slate-200">
        <div v-if="campaignsPending" class="p-6 text-sm text-slate-500">Завантажуємо кампанії...</div>
        <table v-else-if="campaignsData?.items.length" class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Назва</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Тип</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Канал</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Аудиторія</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Sent / failed</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Заплановано</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Автор</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Дії</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="campaign in campaignsData.items" :key="campaign.id">
              <td data-label="Назва" class="px-4 py-3 font-medium text-slate-900">{{ campaign.name }}</td>
              <td data-label="Тип" class="px-4 py-3"><CampaignTypeBadge :type="campaign.type" /></td>
              <td data-label="Канал" class="px-4 py-3"><MessagingChannelBadge :channel="campaign.channel" /></td>
              <td data-label="Статус" class="px-4 py-3"><CampaignStatusBadge :status="campaign.status" /></td>
              <td data-label="Аудиторія" class="px-4 py-3 text-slate-700">{{ campaign.audience_size }}</td>
              <td data-label="Sent / failed" class="px-4 py-3 text-slate-700">{{ campaign.sent_count }} / {{ campaign.failed_count }}</td>
              <td data-label="Заплановано" class="px-4 py-3 text-slate-700">{{ campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('uk-UA') : '—' }}</td>
              <td data-label="Автор" class="px-4 py-3 text-slate-700">{{ campaign.created_by }}</td>
              <td data-label="Дії" class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <NuxtLink :to="`/messaging/campaigns/${campaign.id}`" class="rounded-full border border-slate-300 p-2" title="Деталі"><EyeIcon class="h-4 w-4" /></NuxtLink>
                  <BaseButton v-if="canCreateMessagingDrafts" class="rounded-full border border-slate-300 p-2" title="Редагувати повідомлення" @click="openCampaignEditor(campaign)"><PencilIcon class="h-4 w-4" /></BaseButton>
                  <BaseButton v-if="canCreateMessagingDrafts" class="rounded-full border border-slate-300 p-2" title="Дублювати" @click="duplicateCampaign(campaign)"><DocumentDuplicateIcon class="h-4 w-4" /></BaseButton>
                  <BaseButton v-if="canSendMessagingCampaigns" class="rounded-full border border-slate-300 p-2" :title="campaign.status === 'paused' ? 'Активувати' : 'Пауза'" @click="confirmCampaignAction = { campaign, action: campaign.status === 'paused' ? 'active' : 'paused' }">
                    <PlayIcon v-if="campaign.status === 'paused'" class="h-4 w-4" /><PauseIcon v-else class="h-4 w-4" />
                  </BaseButton>
                  <BaseButton v-if="canSendMessagingCampaigns" class="rounded-full border border-slate-300 p-2" title="Архів" @click="confirmCampaignAction = { campaign, action: 'archived' }"><ArchiveBoxIcon class="h-4 w-4" /></BaseButton>
                  <BaseButton v-if="canSendMessagingCampaigns" class="rounded-full border border-rose-200 p-2 text-rose-700" title="Видалити" @click="confirmCampaignAction = { campaign, action: 'delete' }"><TrashIcon class="h-4 w-4" /></BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="p-8 text-center text-sm text-slate-500">Кампаній за цими фільтрами немає.</p>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <BaseButton :disabled="campaignsPage === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="campaignsPage = Math.max(1, campaignsPage - 1)">Попередня</BaseButton>
        <span class="text-sm text-slate-500">Сторінка {{ campaignsPage }}</span>
        <BaseButton :disabled="!campaignsData || campaignsPage * campaignsPageSize >= campaignsData.total" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="campaignsPage += 1">Наступна</BaseButton>
      </div>
    </section>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Telegram підключення клієнтів</h2>
          <p class="mt-1 text-sm text-slate-500">Актуальний зріз клієнтів, які мають chat_id, маркетингову згоду або відписку.</p>
        </div>
        <BaseButton class="messaging-secondary-action rounded-full px-4 py-2 text-sm font-medium" :disabled="telegramAudiencePending" @click="refreshTelegramAudience()">
          Оновити
        </BaseButton>
      </div>

      <div v-if="telegramAudiencePending" class="mt-5 grid gap-3 md:grid-cols-4">
        <div v-for="index in 4" :key="index" class="h-24 animate-pulse rounded-[1.25rem] bg-slate-100" />
      </div>
      <div v-else-if="telegramAudienceError" class="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
        Не вдалося завантажити Telegram статистику.
      </div>
      <template v-else>
        <div class="mt-5 grid gap-3 md:grid-cols-4">
          <div class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Усього клієнтів</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ telegramAudience?.estimate.total || 0 }}</p>
          </div>
          <div class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">TG підключено</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ telegramConnectedTotal }}</p>
          </div>
          <div class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Готові до маркетингу</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ telegramAudience?.estimate.eligible || 0 }}</p>
          </div>
          <div class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Без TG / opt-out</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">
              {{ telegramAudience?.estimate.missing_chat_id || 0 }} / {{ telegramAudience?.estimate.opted_out || 0 }}
            </p>
          </div>
        </div>

        <div class="mt-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 class="font-semibold text-slate-900">Підключені TG-акаунти</h3>
            <p class="text-xs text-slate-500">
              Показано {{ telegramConnectedRecipients.length }} із {{ telegramConnectedTotal }} підключених.
            </p>
          </div>
          <RecipientPreviewTable
            :recipients="telegramConnectedRecipients"
            empty-label="Підключених Telegram акаунтів у поточному зрізі немає."
          />
        </div>
      </template>
    </section>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Швидкі дії</h2>
        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <NuxtLink to="/messaging/campaigns/new" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <PaperAirplaneIcon class="h-5 w-5 text-cyan-700" /> Створити кампанію
          </NuxtLink>
          <NuxtLink to="/messaging/templates" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <DocumentDuplicateIcon class="h-5 w-5 text-cyan-700" /> Створити шаблон
          </NuxtLink>
          <NuxtLink to="/messaging/settings" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <ChatBubbleLeftRightIcon class="h-5 w-5 text-cyan-700" /> Тестовий отримувач
          </NuxtLink>
          <BaseButton
            type="button"
            class="flex items-center gap-3 rounded-2xl bg-rose-50 p-4 text-left text-sm font-medium text-rose-800"
            @click="viewFailedCampaigns"
          >
            <ExclamationTriangleIcon class="h-5 w-5" /> Переглянути помилки
          </BaseButton>
        </div>
    </section>

    <BaseModal :model-value="Boolean(campaignEditing)" max-width-class="max-w-5xl" @update:model-value="handleCampaignEditorModelUpdate">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <MessagingChannelBadge v-if="campaignEditing" :channel="campaignEditing.channel" />
            </div>
            <h2 class="mt-1 text-2xl font-semibold text-slate-900">Редагувати повідомлення</h2>
          </div>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <div v-if="campaignEditing" class="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div class="space-y-5">
            <label class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                <PencilIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                Назва
              </span>
              <BaseInput v-model="campaignEditor.name" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>

            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
              <label class="grid min-w-0 gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <TagIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  Тип
                </span>
                <BaseSelect v-model="campaignEditor.type" :options="campaignEditorTypeOptions" menu-class="z-[260]" />
              </label>
              <label class="grid min-w-0 gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <CheckCircleIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  Статус
                </span>
                <BaseSelect v-model="campaignEditor.status" :options="campaignEditorStatusOptions" :disabled="!canSendMessagingCampaigns" menu-class="z-[260]" />
              </label>
            </div>

            <div v-if="campaignEditor.type === 'appointment_reminder'" class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  За скільки годин до запису
                </span>
                <BaseInput v-model.number="campaignEditor.lead_hours" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
              <label class="grid gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  Вікно пошуку, хв
                </span>
                <BaseInput v-model.number="campaignEditor.window_minutes" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
            </div>

            <label v-if="campaignEditor.channel === 'sms'" class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                <TagIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                Location key
              </span>
              <BaseInput v-model="campaignEditor.location_key" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>

            <label class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                <DocumentTextIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                Повідомлення
              </span>
              <BaseTextarea v-model="campaignEditor.message_body" class="min-h-44 rounded-2xl border border-slate-300 px-4 py-3 leading-6" />
              <span class="text-xs text-slate-500">{{ campaignEditor.message_body.length }} символів</span>
            </label>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
                <TagIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                Доступні теги
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <BaseButton
                  v-for="variable in variables"
                  :key="variable"
                  type="button"
                  class="rounded-full border border-cyan-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
                  @click="insertCampaignVariable(variable)"
                >
                  {{ variable }}
                </BaseButton>
              </div>
            </div>

            <label v-if="campaignEditor.type === 'post_visit_review_request'" class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                <LinkIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                Review link
              </span>
              <BaseInput v-model="campaignEditor.review_link" class="rounded-2xl border border-slate-300 px-4 py-3" placeholder="https://..." />
            </label>

            <div class="flex flex-wrap gap-3">
              <BaseButton
                class="backoffice-modal-action-button backoffice-modal-action-success"
                :disabled="campaignEditorSaving || !campaignEditor.name.trim() || !campaignEditor.message_body.trim() || !canCreateMessagingDrafts"
                @click="saveCampaignEditor"
              >
                <CheckCircleIcon class="h-4 w-4" aria-hidden="true" />
                {{ campaignEditorSaving ? 'Збереження...' : 'Зберегти повідомлення' }}
              </BaseButton>
              <BaseButton class="backoffice-modal-action-button backoffice-modal-action-danger-outline" :disabled="campaignEditorSaving" @click="closeCampaignEditor">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </BaseButton>
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex items-center gap-2 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-900">
              <PaperAirplaneIcon v-if="campaignEditor.channel === 'telegram'" class="h-5 w-5 text-cyan-700" aria-hidden="true" />
              <ChatBubbleLeftRightIcon v-else class="h-5 w-5 text-cyan-700" aria-hidden="true" />
              Preview
            </div>
            <MessagePreview :body="campaignEditor.message_body" :sample="sampleClient" />
          </div>
        </div>
      </template>
    </BaseModal>

    <ConfirmActionModal
      :model-value="Boolean(confirmCampaignAction)"
      :title="confirmCampaignAction?.action === 'delete' ? 'Видалити кампанію?' : 'Підтвердити дію'"
      :message="confirmCampaignAction?.action === 'delete' ? 'Кампанію буде видалено. Цю дію не можна скасувати.' : 'Статус кампанії буде змінено.'"
      :confirm-label="confirmCampaignAction?.action === 'delete' ? 'Видалити' : 'Підтвердити'"
      :pending="campaignActionPending"
      :destructive="confirmCampaignAction?.action === 'delete'"
      @update:model-value="closeCampaignConfirm"
      @confirm="runCampaignAction"
    />

  </div>
</template>
