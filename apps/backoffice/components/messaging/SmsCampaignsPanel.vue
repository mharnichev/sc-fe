<script setup lang="ts">
import {
  ArrowPathIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  EyeIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  PlayCircleIcon,
  PlusIcon,
  TagIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import type { Component } from 'vue'
import type { AudienceRule, CampaignPayload, CampaignStatus, CampaignType, MessagingCampaign } from '~/types/messaging'

const api = useBackofficeApi()
const { statusLabel, statusClass, campaignTypeLabel, sampleClient } = useMessagingUi()
const { canCreateMessagingDrafts, canSendMessagingCampaigns } = useBackofficeAccess()
const { apiErrorMessage } = useBookingFormatting()
const toast = useBaseToastNotification()
const emit = defineEmits<{ changed: [] }>()

type SmsScenarioKey = 'booking_confirmation' | 'two_hour_reminder'
type SmsJob = 'pending' | 'reminders'

interface SmsScenarioDefinition {
  key: SmsScenarioKey
  name: string
  type: CampaignType
  locationKey: string
  trigger: string
  defaultBody: string
  metadata: Record<string, unknown>
  icon: Component
  toneClass: string
}

const scenarioDefinitions: SmsScenarioDefinition[] = [
  {
    key: 'booking_confirmation',
    name: 'SMS підтвердження запису',
    type: 'booking_confirmation',
    locationKey: 'sms_booking_confirmation',
    trigger: 'Одразу після створення запису',
    defaultBody: 'Ви записані до майстра {master_name} на {appointment_date} о {appointment_time}. Чекаємо у {barbershop_name}.',
    metadata: { recipient: 'customer', trigger: 'booking_created' },
    icon: CheckCircleIcon,
    toneClass: 'messaging-tone-success',
  },
  {
    key: 'two_hour_reminder',
    name: 'SMS нагадування за 2 години',
    type: 'appointment_reminder',
    locationKey: 'sms_booking_two_hour_reminder',
    trigger: 'За 2 години до запису, вікно 30 хв',
    defaultBody: 'Нагадуємо, сьогодні о {appointment_time} у вас візит до майстра {master_name}. Будемо раді бачити вас у {barbershop_name}.',
    metadata: { recipient: 'customer', trigger: 'booking_upcoming', lead_hours: 2, window_minutes: 30 },
    icon: BellAlertIcon,
    toneClass: 'messaging-tone-warning',
  },
]

const page = ref(1)
const pageSize = 20
const statusFilter = ref('')
const saving = ref(false)
const runningJob = ref<SmsJob | null>(null)
const editing = ref<{ definition: SmsScenarioDefinition, campaign: MessagingCampaign | null } | null>(null)

const form = reactive<{
  name: string
  type: CampaignType
  status: Extract<CampaignStatus, 'draft' | 'active' | 'paused'>
  message_body: string
  location_key: string
  lead_hours: number
  window_minutes: number
}>({
  name: '',
  type: 'booking_confirmation',
  status: 'active',
  message_body: '',
  location_key: '',
  lead_hours: 2,
  window_minutes: 30,
})

const { data, pending, error, refresh } = await useAsyncData(
  'messaging-sms-campaigns',
  () => api.getSmsCampaigns(page.value, pageSize, { status: statusFilter.value }),
  { watch: [page] },
)

const campaigns = computed(() => data.value?.items || [])
const scenarioByLocation = computed(() => new Map(campaigns.value.map(campaign => [campaign.location_key, campaign])))
const scenarioByName = computed(() => new Map(campaigns.value.map(campaign => [campaign.name, campaign])))
const smsScenarios = computed(() =>
  scenarioDefinitions.map(definition => ({
    definition,
    campaign:
      scenarioByLocation.value.get(definition.locationKey)
      || scenarioByName.value.get(definition.name)
      || null,
  })),
)

const statusOptions = [
  { value: '', label: 'Усі статуси' },
  { value: 'draft', label: 'Чернетка' },
  { value: 'active', label: 'Активна' },
  { value: 'paused', label: 'На паузі' },
  { value: 'completed', label: 'Завершена' },
  { value: 'archived', label: 'Архів' },
]
const editorStatusOptions = [
  { value: 'draft', label: 'Чернетка' },
  { value: 'active', label: 'Активна' },
  { value: 'paused', label: 'На паузі' },
]
const smsTypeOptions = [
  { value: 'booking_confirmation', label: 'Підтвердження запису' },
  { value: 'appointment_reminder', label: 'Нагадування про запис' },
]

const scenarioBody = (definition: SmsScenarioDefinition, campaign: MessagingCampaign | null) =>
  campaign?.message_body || definition.defaultBody

const scenarioMetaNumber = (campaign: MessagingCampaign | null, key: 'lead_hours' | 'window_minutes', fallback: number) => {
  const raw = campaign?.metadata_json?.[key]
  const value = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const campaignScenarioDefinition = (campaign: MessagingCampaign) =>
  scenarioDefinitions.find(item => item.locationKey === campaign.location_key || item.name === campaign.name) || null

const openEditor = (definition: SmsScenarioDefinition, campaign: MessagingCampaign | null) => {
  editing.value = { definition, campaign }
  form.name = campaign?.name || definition.name
  form.type = campaign?.type || definition.type
  form.status = campaign?.status === 'draft' || campaign?.status === 'paused' ? campaign.status : 'active'
  form.message_body = scenarioBody(definition, campaign)
  form.location_key = campaign?.location_key || definition.locationKey
  form.lead_hours = scenarioMetaNumber(campaign, 'lead_hours', Number(definition.metadata.lead_hours || 2))
  form.window_minutes = scenarioMetaNumber(campaign, 'window_minutes', Number(definition.metadata.window_minutes || 30))
}

const openCampaignEditor = (campaign: MessagingCampaign) => {
  const definition = campaignScenarioDefinition(campaign)
  if (definition) openEditor(definition, campaign)
}

const closeEditor = () => {
  editing.value = null
}

const handleEditorModelUpdate = (value: boolean) => {
  if (!value) closeEditor()
}

const buildPayload = (): CampaignPayload => {
  const definition = editing.value!.definition
  const existingMetadata = editing.value!.campaign?.metadata_json || {}
  const metadata: Record<string, unknown> = {
    ...existingMetadata,
    ...definition.metadata,
    message_body: form.message_body,
    audience_rules: editing.value!.campaign?.audience_rules || [{ type: 'all_clients' }],
  }
  if (definition.key === 'two_hour_reminder') {
    metadata.lead_hours = Math.max(1, Number(form.lead_hours) || 2)
    metadata.window_minutes = Math.max(1, Number(form.window_minutes) || 30)
  }

  return {
    name: form.name,
    type: form.type,
    channel: 'sms',
    status: form.status,
    template_id: editing.value!.campaign?.template_id || null,
    message_body: form.message_body,
    audience_rules: editing.value!.campaign?.audience_rules || [{ type: 'all_clients' } as AudienceRule],
    schedule_mode: 'automated',
    timezone: editing.value!.campaign?.timezone || 'Europe/Kyiv',
    max_messages_per_minute: 20,
    quiet_hours_enabled: false,
    duplicate_protection_days: 0,
    location_key: form.location_key,
    metadata_json: metadata,
  }
}

const saveScenario = async () => {
  if (!editing.value || !canCreateMessagingDrafts.value) return
  saving.value = true
  try {
    const payload = buildPayload()
    if (editing.value.campaign) {
      await api.updateSmsCampaign(editing.value.campaign.id, payload)
      toast.success('SMS сценарій оновлено.')
    }
    else {
      await api.createSmsCampaign(payload)
      toast.success('SMS сценарій створено.')
    }
    closeEditor()
    await refresh()
    emit('changed')
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося зберегти SMS сценарій.'))
  }
  finally {
    saving.value = false
  }
}

const applyFilters = async () => {
  page.value = 1
  await refresh()
}

const runJob = async (job: SmsJob) => {
  if (!canSendMessagingCampaigns.value) return
  runningJob.value = job
  try {
    if (job === 'pending') {
      const result = await api.processPendingMessages()
      toast.success(`Оброблено повідомлень: ${result.processed}.`)
    }
    else {
      const result = await api.sendBookingSmsReminders()
      toast.success(`SMS нагадувань відправлено: ${result.sent}.`)
    }
    await refresh()
    emit('changed')
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося виконати SMS дію.'))
  }
  finally {
    runningJob.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="text-xl font-semibold text-slate-900">SMS сценарії</h2>
            <MessagingChannelBadge channel="sms" />
          </div>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Транзакційні SMS для підтверджень запису та нагадувань перед візитом.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <BaseButton class="messaging-secondary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium" :disabled="pending" @click="refresh()">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Оновити
          </BaseButton>
          <BaseButton
            v-if="canSendMessagingCampaigns"
            class="messaging-secondary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
            :disabled="Boolean(runningJob)"
            @click="runJob('reminders')"
          >
            <ClockIcon class="h-4 w-4" aria-hidden="true" />
            {{ runningJob === 'reminders' ? 'Відправляємо...' : 'Нагадування 2г' }}
          </BaseButton>
          <BaseButton
            v-if="canSendMessagingCampaigns"
            class="messaging-primary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
            :disabled="Boolean(runningJob)"
            @click="runJob('pending')"
          >
            <PlayCircleIcon class="h-4 w-4" aria-hidden="true" />
            {{ runningJob === 'pending' ? 'Обробляємо...' : 'Обробити чергу' }}
          </BaseButton>
        </div>
      </div>

      <div v-if="pending" class="mt-5 grid gap-4 lg:grid-cols-2">
        <div v-for="index in 2" :key="index" class="h-56 animate-pulse rounded-[1.25rem] bg-slate-100" />
      </div>
      <div v-else-if="error" class="mt-5 rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Не вдалося завантажити SMS кампанії. <BaseButton class="font-semibold underline" @click="refresh()">Спробувати ще раз</BaseButton>
      </div>
      <div v-else class="mt-5 grid gap-4 lg:grid-cols-2">
        <article
          v-for="item in smsScenarios"
          :key="item.definition.key"
          class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center rounded-full" :class="item.definition.toneClass">
                <component :is="item.definition.icon" class="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 class="font-semibold text-slate-900">{{ item.definition.name }}</h3>
                <p class="mt-1 text-xs text-slate-500">{{ item.definition.trigger }}</p>
              </div>
            </div>
            <span class="rounded-full px-3 py-1 text-xs font-medium" :class="item.campaign ? statusClass(item.campaign.status) : 'bg-rose-50 text-rose-700'">
              {{ item.campaign ? statusLabel(item.campaign.status) : 'Не створено' }}
            </span>
          </div>

          <div class="mt-4 space-y-3 text-sm">
            <div class="flex justify-between gap-3">
              <span class="text-slate-500">Тип</span>
              <span class="font-medium text-slate-900">{{ campaignTypeLabel(item.campaign?.type || item.definition.type) }}</span>
            </div>
            <div v-if="item.definition.key === 'two_hour_reminder'" class="flex justify-between gap-3">
              <span class="text-slate-500">Lead / window</span>
              <span class="font-medium text-slate-900">
                {{ scenarioMetaNumber(item.campaign, 'lead_hours', 2) }}г / {{ scenarioMetaNumber(item.campaign, 'window_minutes', 30) }}хв
              </span>
            </div>
            <div v-if="item.campaign" class="flex justify-between gap-3">
              <span class="text-slate-500">Sent / failed</span>
              <span class="font-medium text-slate-900">{{ item.campaign.sent_count }} / {{ item.campaign.failed_count }}</span>
            </div>
            <div>
              <p class="text-slate-500">Повідомлення</p>
              <p class="mt-1 min-h-16 whitespace-pre-line rounded-2xl bg-white p-3 leading-6 text-slate-800">
                {{ scenarioBody(item.definition, item.campaign) }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <BaseButton
              v-if="canCreateMessagingDrafts"
              class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-900"
              :aria-label="item.campaign ? 'Редагувати SMS сценарій' : 'Створити SMS сценарій'"
              :title="item.campaign ? 'Редагувати' : 'Створити'"
              @click="openEditor(item.definition, item.campaign)"
            >
              <PencilIcon v-if="item.campaign" class="h-4 w-4" aria-hidden="true" />
              <PlusIcon v-else class="h-4 w-4" aria-hidden="true" />
            </BaseButton>
            <NuxtLink
              v-if="item.campaign"
              :to="`/messaging/campaigns/${item.campaign.id}`"
              class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-900"
              aria-label="Деталі SMS кампанії"
              title="Деталі"
            >
              <EyeIcon class="h-4 w-4" aria-hidden="true" />
            </NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Усі SMS кампанії</h2>
          <p class="mt-1 text-sm text-slate-500">SMS кампанії з загального списку повідомлень.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <BaseSelect v-model="statusFilter" :options="statusOptions" menu-class="z-[220]" />
          <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" @click="applyFilters">
            Застосувати
          </BaseButton>
        </div>
      </div>

      <div class="mt-5 overflow-hidden rounded-[1.25rem] border border-slate-200">
        <div v-if="pending" class="p-6 text-sm text-slate-500">Завантажуємо SMS кампанії...</div>
        <table v-else-if="campaigns.length" class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Назва</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Тип</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Канал</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Location</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Sent / failed</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Оновлено</th>
              <th class="px-4 py-3 text-left font-medium text-slate-500">Дії</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="campaign in campaigns" :key="campaign.id">
              <td data-label="Назва" class="px-4 py-3 font-medium text-slate-900">{{ campaign.name }}</td>
              <td data-label="Тип" class="px-4 py-3"><CampaignTypeBadge :type="campaign.type" /></td>
              <td data-label="Канал" class="px-4 py-3"><MessagingChannelBadge :channel="campaign.channel" /></td>
              <td data-label="Статус" class="px-4 py-3"><CampaignStatusBadge :status="campaign.status" /></td>
              <td data-label="Location" class="px-4 py-3 text-slate-700">{{ campaign.location_key || '—' }}</td>
              <td data-label="Sent / failed" class="px-4 py-3 text-slate-700">{{ campaign.sent_count }} / {{ campaign.failed_count }}</td>
              <td data-label="Оновлено" class="px-4 py-3 text-slate-700">{{ campaign.updated_at ? new Date(campaign.updated_at).toLocaleString('uk-UA') : '—' }}</td>
              <td data-label="Дії" class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <BaseButton
                    v-if="canCreateMessagingDrafts && campaignScenarioDefinition(campaign)"
                    class="rounded-full border border-slate-300 p-2"
                    title="Редагувати"
                    @click="openCampaignEditor(campaign)"
                  >
                    <PencilIcon class="h-4 w-4" aria-hidden="true" />
                  </BaseButton>
                  <NuxtLink :to="`/messaging/campaigns/${campaign.id}`" class="rounded-full border border-slate-300 p-2" title="Деталі">
                    <EyeIcon class="h-4 w-4" aria-hidden="true" />
                  </NuxtLink>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="p-8 text-center text-sm text-slate-500">SMS кампаній за цими фільтрами немає.</p>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <BaseButton :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="page = Math.max(1, page - 1)">Попередня</BaseButton>
        <span class="text-sm text-slate-500">Сторінка {{ page }}</span>
        <BaseButton :disabled="!data || page * pageSize >= data.total" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="page += 1">Наступна</BaseButton>
      </div>
    </section>

    <BaseModal :model-value="Boolean(editing)" max-width-class="max-w-5xl" @update:model-value="handleEditorModelUpdate">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm uppercase tracking-[0.24em] text-cyan-700">SMS</p>
            <h2 class="mt-1 text-2xl font-semibold text-slate-900">{{ editing?.campaign ? 'Редагувати сценарій' : 'Створити сценарій' }}</h2>
          </div>
          <ModalCloseButton @click="close" />
        </div>
      </template>
      <template #body>
        <div v-if="editing" class="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div class="space-y-5">
            <label class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                <PencilIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                Назва
              </span>
              <BaseInput v-model="form.name" class="rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
              <label class="grid gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <TagIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  Тип
                </span>
                <BaseSelect v-model="form.type" :options="smsTypeOptions" menu-class="z-[260]" />
              </label>
              <label class="grid gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <CheckCircleIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  Статус
                </span>
                <BaseSelect v-model="form.status" :options="editorStatusOptions" :disabled="!canSendMessagingCampaigns" menu-class="z-[260]" />
              </label>
              <label class="grid gap-2 text-sm lg:col-span-2">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <MapPinIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  Location key
                </span>
                <BaseInput v-model="form.location_key" class="rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
            </div>

            <div v-if="editing.definition.key === 'two_hour_reminder'" class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  За скільки годин до запису
                </span>
                <BaseInput v-model.number="form.lead_hours" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
              <label class="grid gap-2 text-sm">
                <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                  <ClockIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                  Вікно пошуку, хв
                </span>
                <BaseInput v-model.number="form.window_minutes" min="1" type="number" class="rounded-2xl border border-slate-300 px-4 py-3" />
              </label>
            </div>

            <label class="grid gap-2 text-sm">
              <span class="inline-flex items-center gap-2 font-medium text-slate-700">
                <DocumentTextIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
                Текст SMS
              </span>
              <BaseTextarea v-model="form.message_body" class="min-h-44 rounded-2xl border border-slate-300 px-4 py-3 leading-6" />
              <span class="text-xs text-slate-500">{{ form.message_body.length }} символів</span>
            </label>

            <div class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Доступні SMS змінні: <span class="font-medium text-slate-900">{master_name}</span>,
              <span class="font-medium text-slate-900">{customer_name}</span>,
              <span class="font-medium text-slate-900">{appointment_date}</span>,
              <span class="font-medium text-slate-900">{appointment_time}</span>,
              <span class="font-medium text-slate-900">{appointment_end_time}</span>,
              <span class="font-medium text-slate-900">{barbershop_name}</span>.
            </div>

            <div class="flex flex-wrap gap-3">
              <BaseButton
                class="backoffice-modal-action-button backoffice-modal-action-success"
                :disabled="saving || !form.name.trim() || !form.message_body.trim() || !canCreateMessagingDrafts"
                @click="saveScenario"
              >
                <CheckCircleIcon class="h-4 w-4" aria-hidden="true" />
                {{ saving ? 'Збереження...' : 'Зберегти сценарій' }}
              </BaseButton>
              <BaseButton class="backoffice-modal-action-button backoffice-modal-action-danger-outline" :disabled="saving" @click="closeEditor">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Скасувати
              </BaseButton>
            </div>
          </div>
          <div class="space-y-4">
            <div class="flex items-center gap-2 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-900">
              <PhoneIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
              SMS preview
            </div>
            <MessagePreview :body="form.message_body" :sample="sampleClient" />
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
