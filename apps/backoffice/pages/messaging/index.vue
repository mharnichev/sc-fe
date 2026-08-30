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
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import type { AudienceRule, CampaignPayload, CampaignStatus, CampaignType, MessagingCampaign, MessagingChannel } from '~/types/messaging'

const api = useBackofficeApi()
const {
  campaignTypes,
  channels,
  variables,
  sampleClient,
  bookingActivityVariableNames,
  missingTemplateVariables,
  formatTemplateVariables,
} = useMessagingUi()
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

const campaignEditorRequiredMissingVariables = computed(() =>
  campaignEditor.type === 'booking_confirmation' && campaignEditor.channel === 'sms'
    ? missingTemplateVariables(campaignEditor.message_body, bookingActivityVariableNames)
    : [],
)

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
      recipient: campaign.recipient,
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
        <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Комунікації з клієнтами</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ui-muted">
          Telegram та SMS сценарії, автоматичні запити відгуків, шаблони та контроль відправок.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/messaging/campaigns/new" class="base-button base-button--primary min-h-11 gap-2 px-5 py-3 text-sm">
          <PlusIcon class="h-5 w-5" />
          Створити кампанію
        </NuxtLink>
      </div>
    </div>

    <BaseLoader v-if="pending" label="Завантаження комунікацій…" />
    <div v-else-if="error" class="ui-status-danger rounded-[1.25rem] p-5 text-sm">
      Не вдалося завантажити dashboard. <BaseButton class="font-semibold underline" @click="refresh()">Спробувати ще раз</BaseButton>
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <BaseCard v-for="card in cards" :key="card.label" padding="sm">
        <p class="text-xs uppercase tracking-[0.18em] text-ui-muted">{{ card.label }}</p>
        <p class="mt-2 text-2xl font-semibold text-ui-primary">{{ card.value }}</p>
      </BaseCard>
    </div>

    <MessagingSmsCampaignsPanel @changed="refreshMessagingData" />

    <section id="campaigns" ref="campaignsSectionRef" class="base-card rounded-[1.5rem] p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-ui-primary">Кампанії</h2>
          <p class="mt-1 text-sm text-ui-muted">Усі Telegram та SMS кампанії з фільтрами, статусами й діями.</p>
        </div>
      </div>

      <BaseCard variant="subtle" padding="sm" class="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
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
          input-class="base-control px-4 py-3 text-sm"
          class="md:col-span-2 xl:col-span-2"
        />
        <MasterSelect v-model="campaignFilters.barber_id" :masters="masterItems" value-type="number" all-label="Усі майстри" compact menu-class="z-[220]" />
        <div class="flex flex-wrap gap-3 md:col-span-3 xl:col-span-6">
          <BaseButton variant="primary" @click="applyCampaignFilters">
            <FunnelIcon class="h-4 w-4" aria-hidden="true" />
            <span>Застосувати</span>
          </BaseButton>
          <BaseButton variant="neutral" @click="clearCampaignFilters">
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            <span>Очистити</span>
          </BaseButton>
        </div>
      </BaseCard>

      <div v-if="campaignsError" class="ui-status-danger mt-5 rounded-[1.25rem] p-5 text-sm">
        Не вдалося завантажити кампанії.
      </div>
      <BaseTable
        wrapper-class="mt-5"
        caption="Кампанії"
        min-width="72rem"
        :loading="campaignsPending"
        loading-label="Завантаження кампаній…"
        :empty="!campaignsData?.items.length"
        empty-title="Кампаній за цими фільтрами немає"
      >
        <template #head>
          <tr>
            <th>Назва</th><th>Тип</th><th>Канал</th><th>Статус</th><th>Аудиторія</th><th>Sent / failed</th><th>Заплановано</th><th>Автор</th><th>Дії</th>
          </tr>
        </template>
            <tr v-for="campaign in campaignsData?.items || []" :key="campaign.id">
              <td data-label="Назва" class="font-medium text-ui-primary">{{ campaign.name }}</td>
              <td data-label="Тип" class="px-4 py-3"><MessagingCampaignTypeBadge :type="campaign.type" /></td>
              <td data-label="Канал" class="px-4 py-3"><MessagingChannelBadge :channel="campaign.channel" /></td>
              <td data-label="Статус" class="px-4 py-3"><MessagingCampaignStatusBadge :status="campaign.status" /></td>
              <td data-label="Аудиторія" class="text-ui-secondary">{{ campaign.audience_size }}</td>
              <td data-label="Sent / failed" class="text-ui-secondary">{{ campaign.sent_count }} / {{ campaign.failed_count }}</td>
              <td data-label="Заплановано" class="text-ui-secondary">{{ campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('uk-UA') : '—' }}</td>
              <td data-label="Автор" class="text-ui-secondary">{{ campaign.created_by }}</td>
              <td data-label="Дії" class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <NuxtLink :to="`/messaging/campaigns/${campaign.id}`" class="base-button base-button--icon h-9 w-9 p-0" title="Деталі"><EyeIcon class="h-4 w-4" /></NuxtLink>
                  <BaseButton v-if="canCreateMessagingDrafts" variant="icon" class="h-9 w-9" title="Редагувати повідомлення" @click="openCampaignEditor(campaign)"><PencilIcon class="h-4 w-4" /></BaseButton>
                  <BaseButton v-if="canCreateMessagingDrafts" variant="icon" class="h-9 w-9" title="Дублювати" @click="duplicateCampaign(campaign)"><DocumentDuplicateIcon class="h-4 w-4" /></BaseButton>
                  <BaseButton v-if="canSendMessagingCampaigns" variant="icon" class="h-9 w-9" :title="campaign.status === 'paused' ? 'Активувати' : 'Пауза'" @click="confirmCampaignAction = { campaign, action: campaign.status === 'paused' ? 'active' : 'paused' }">
                    <PlayIcon v-if="campaign.status === 'paused'" class="h-4 w-4" /><PauseIcon v-else class="h-4 w-4" />
                  </BaseButton>
                  <BaseButton v-if="canSendMessagingCampaigns" variant="icon" class="h-9 w-9" title="Архів" @click="confirmCampaignAction = { campaign, action: 'archived' }"><ArchiveBoxIcon class="h-4 w-4" /></BaseButton>
                  <BaseButton v-if="canSendMessagingCampaigns" variant="danger-icon" class="h-9 w-9 p-0" title="Видалити" @click="confirmCampaignAction = { campaign, action: 'delete' }"><TrashIcon class="h-4 w-4" /></BaseButton>
                </div>
              </td>
            </tr>
      </BaseTable>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <BaseButton variant="neutral" :disabled="campaignsPage === 1" @click="campaignsPage = Math.max(1, campaignsPage - 1)">Попередня</BaseButton>
        <span class="text-sm text-ui-muted">Сторінка {{ campaignsPage }}</span>
        <BaseButton variant="neutral" :disabled="!campaignsData || campaignsPage * campaignsPageSize >= campaignsData.total" @click="campaignsPage += 1">Наступна</BaseButton>
      </div>
    </section>

    <BaseCard as="section">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-ui-primary">Telegram підключення клієнтів</h2>
          <p class="mt-1 text-sm text-ui-muted">Актуальний зріз клієнтів, які мають chat_id, маркетингову згоду або відписку.</p>
        </div>
        <BaseButton class="messaging-secondary-action rounded-full px-4 py-2 text-sm font-medium" :disabled="telegramAudiencePending" @click="refreshTelegramAudience()">
          Оновити
        </BaseButton>
      </div>

      <BaseLoader v-if="telegramAudiencePending" class="mt-5" label="Завантаження Telegram статистики…" />
      <div v-else-if="telegramAudienceError" class="ui-status-danger mt-5 rounded-2xl p-4 text-sm">
        Не вдалося завантажити Telegram статистику.
      </div>
      <template v-else>
        <div class="mt-5 grid gap-3 md:grid-cols-4">
          <BaseCard v-for="metric in [
            { label: 'Усього клієнтів', value: telegramAudience?.estimate.total || 0 },
            { label: 'TG підключено', value: telegramConnectedTotal },
            { label: 'Готові до маркетингу', value: telegramAudience?.estimate.eligible || 0 },
          ]" :key="metric.label" variant="subtle" padding="sm">
            <p class="text-xs uppercase tracking-[0.18em] text-ui-muted">{{ metric.label }}</p>
            <p class="mt-2 text-2xl font-semibold text-ui-primary">{{ metric.value }}</p>
          </BaseCard>
          <BaseCard variant="subtle" padding="sm">
            <p class="text-xs uppercase tracking-[0.18em] text-ui-muted">Без TG / opt-out</p>
            <p class="mt-2 text-2xl font-semibold text-ui-primary">
              {{ telegramAudience?.estimate.missing_chat_id || 0 }} / {{ telegramAudience?.estimate.opted_out || 0 }}
            </p>
          </BaseCard>
        </div>

        <div class="mt-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 class="font-semibold text-ui-primary">Підключені TG-акаунти</h3>
            <p class="text-xs text-ui-muted">
              Показано {{ telegramConnectedRecipients.length }} із {{ telegramConnectedTotal }} підключених.
            </p>
          </div>
          <MessagingRecipientPreviewTable
            :recipients="telegramConnectedRecipients"
            empty-label="Підключених Telegram акаунтів у поточному зрізі немає."
          />
        </div>
      </template>
    </BaseCard>

    <BaseCard as="section">
        <h2 class="text-xl font-semibold text-ui-primary">Швидкі дії</h2>
        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <NuxtLink to="/messaging/campaigns/new" class="base-card base-card--interactive flex items-center gap-3 rounded-2xl bg-ui-subtle p-4 text-sm font-medium text-ui-primary">
            <PaperAirplaneIcon class="h-5 w-5 text-ui-accent" /> Створити кампанію
          </NuxtLink>
          <NuxtLink to="/messaging/templates" class="base-card base-card--interactive flex items-center gap-3 rounded-2xl bg-ui-subtle p-4 text-sm font-medium text-ui-primary">
            <DocumentDuplicateIcon class="h-5 w-5 text-ui-accent" /> Створити шаблон
          </NuxtLink>
          <NuxtLink to="/messaging/settings" class="base-card base-card--interactive flex items-center gap-3 rounded-2xl bg-ui-subtle p-4 text-sm font-medium text-ui-primary">
            <ChatBubbleLeftRightIcon class="h-5 w-5 text-ui-accent" /> Тестовий отримувач
          </NuxtLink>
          <BaseButton
            type="button"
            class="ui-status-danger flex items-center gap-3 rounded-2xl p-4 text-left text-sm font-medium"
            @click="viewFailedCampaigns"
          >
            <ExclamationTriangleIcon class="h-5 w-5" /> Переглянути помилки
          </BaseButton>
        </div>
    </BaseCard>

    <BaseModal :model-value="Boolean(campaignEditing)" max-width-class="max-w-5xl" @update:model-value="handleCampaignEditorModelUpdate">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <MessagingChannelBadge v-if="campaignEditing" :channel="campaignEditing.channel" />
            </div>
            <h2 class="mt-1 text-2xl font-semibold text-ui-primary">Редагувати повідомлення</h2>
          </div>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <div v-if="campaignEditing" class="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div class="space-y-5">
            <label class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-ui-secondary">
                <PencilIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                Назва
              </span>
              <BaseInput v-model="campaignEditor.name" />
            </label>

            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
              <label class="grid min-w-0 gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-ui-secondary">
                  <TagIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                  Тип
                </span>
                <BaseSelect v-model="campaignEditor.type" :options="campaignEditorTypeOptions" menu-class="z-[260]" />
              </label>
              <label class="grid min-w-0 gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-ui-secondary">
                  <CheckCircleIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                  Статус
                </span>
                <BaseSelect v-model="campaignEditor.status" :options="campaignEditorStatusOptions" :disabled="!canSendMessagingCampaigns" menu-class="z-[260]" />
              </label>
            </div>

            <div v-if="campaignEditor.type === 'appointment_reminder'" class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-ui-secondary">
                  <ClockIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                  За скільки годин до запису
                </span>
                <BaseInput v-model.number="campaignEditor.lead_hours" min="1" type="number" />
              </label>
              <label class="grid gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-ui-secondary">
                  <ClockIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                  Вікно пошуку, хв
                </span>
                <BaseInput v-model.number="campaignEditor.window_minutes" min="1" type="number" />
              </label>
            </div>

            <label v-if="campaignEditor.channel === 'sms'" class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-ui-secondary">
                <TagIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                Location key
              </span>
              <BaseInput v-model="campaignEditor.location_key" />
            </label>

            <label class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-ui-secondary">
                <DocumentTextIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                Повідомлення
              </span>
              <BaseTextarea v-model="campaignEditor.message_body" class="min-h-44 leading-6" />
              <span class="text-xs text-ui-muted">{{ campaignEditor.message_body.length }} символів</span>
            </label>

            <BaseCard variant="subtle" padding="sm" class="rounded-2xl">
              <div class="flex items-center gap-2 text-sm font-medium text-ui-secondary">
                <TagIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                Доступні теги
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <BaseButton
                  v-for="variable in variables"
                  :key="variable"
                  type="button"
                  variant="outline"
                  size="sm"
                  class="font-mono"
                  @click="insertCampaignVariable(variable)"
                >
                  {{ variable }}
                </BaseButton>
              </div>
            </BaseCard>

            <BaseCard
              v-if="campaignEditorRequiredMissingVariables.length"
              variant="subtle"
              padding="sm"
              class="rounded-2xl text-sm text-rose-700"
            >
              Для підтвердження запису додайте:
              {{ formatTemplateVariables(campaignEditorRequiredMissingVariables) }}.
            </BaseCard>

            <label v-if="campaignEditor.type === 'post_visit_review_request'" class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-ui-secondary">
                <LinkIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
                Review link
              </span>
              <BaseInput v-model="campaignEditor.review_link" placeholder="https://..." />
            </label>

            <div class="flex flex-wrap gap-3">
              <BaseButton
                variant="success"
                :loading="campaignEditorSaving"
                :disabled="campaignEditorSaving || !campaignEditor.name.trim() || !campaignEditor.message_body.trim() || campaignEditorRequiredMissingVariables.length > 0 || !canCreateMessagingDrafts"
                @click="saveCampaignEditor"
              >
                <CheckCircleIcon class="h-4 w-4" aria-hidden="true" />
                {{ campaignEditorSaving ? 'Збереження...' : 'Зберегти повідомлення' }}
              </BaseButton>
              <BaseButton variant="danger-outline" :disabled="campaignEditorSaving" @click="closeCampaignEditor">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </BaseButton>
            </div>
          </div>

          <div class="space-y-4">
            <BaseCard variant="subtle" padding="sm" class="flex items-center gap-2 text-sm font-medium text-ui-primary">
              <PaperAirplaneIcon v-if="campaignEditor.channel === 'telegram'" class="h-5 w-5 text-ui-accent" aria-hidden="true" />
              <ChatBubbleLeftRightIcon v-else class="h-5 w-5 text-ui-accent" aria-hidden="true" />
              Preview
            </BaseCard>
            <MessagingMessagePreview :body="campaignEditor.message_body" :sample="sampleClient" />
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
