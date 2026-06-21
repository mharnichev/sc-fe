<script setup lang="ts">
import {
  BellAlertIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  PlusIcon,
  PlayCircleIcon,
  StarIcon,
  UserIcon,
} from '@heroicons/vue/24/outline'
import type { AudienceRule, MessagingCampaign } from '~/types/messaging'

const api = useBackofficeApi()
const { statusLabel, statusClass, campaignTypeLabel } = useMessagingUi()
const { canCreateMessagingDrafts, canSendMessagingCampaigns } = useBackofficeAccess()
const { apiErrorMessage } = useBookingFormatting()
const toast = useBaseToastNotification()

const { data, pending, error, refresh } = await useAsyncData('messaging-dashboard', () => api.getMessagingDashboard())
const { data: scenarioCampaigns, pending: scenariosPending, refresh: refreshScenarios } = await useAsyncData(
  'messaging-telegram-scenarios',
  () => api.getMessagingCampaigns(1, 100),
)
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

type ScenarioJob = 'review' | 'reminders' | 'pending'

const scenarioDefinitions: Array<{
  name: string
  recipient: string
  trigger: string
  icon: Component
  accentClass: string
}> = [
  {
    name: 'Подяка за візит',
    recipient: 'Клієнт',
    trigger: 'Після завершеного візиту',
    icon: StarIcon,
    accentClass: 'messaging-tone-warning',
  },
  {
    name: 'Сповіщення в момент запису',
    recipient: 'Майстер',
    trigger: 'Одразу після нового запису',
    icon: UserIcon,
    accentClass: 'messaging-tone-accent',
  },
  {
    name: 'Нагадування про візит',
    recipient: 'Клієнт',
    trigger: 'За 24 години до візиту',
    icon: BellAlertIcon,
    accentClass: 'messaging-tone-success',
  },
]

const scenarioByName = computed<Record<string, MessagingCampaign>>(() => {
  const items = scenarioCampaigns.value?.items || []
  return Object.fromEntries(items.map(campaign => [campaign.name, campaign]))
})

const telegramScenarios = computed(() =>
  scenarioDefinitions.map(definition => ({
    ...definition,
    campaign: scenarioByName.value[definition.name] || null,
  })),
)

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

const runningJob = ref<ScenarioJob | null>(null)

const runScenarioJob = async (job: ScenarioJob) => {
  if (!canSendMessagingCampaigns.value) return
  runningJob.value = job
  try {
    if (job === 'review') {
      const result = await api.createReviewRequests()
      toast.success(`Запити відгуків створено: ${result.created}.`)
    }
    else if (job === 'reminders') {
      const result = await api.createAppointmentReminders()
      toast.success(`Нагадування поставлено в чергу: ${result.created}.`)
    }
    else {
      const result = await api.processPendingMessages()
      toast.success(`Оброблено повідомлень: ${result.processed}.`)
    }
    await Promise.all([refresh(), refreshScenarios(), refreshTelegramAudience()])
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося виконати дію.'))
  }
  finally {
    runningJob.value = null
  }
}
</script>

<template>
  <div class="messaging-page space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Messaging</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Комунікації з клієнтами</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Telegram кампанії, автоматичні запити відгуків, шаблони та контроль відправок.
        </p>
      </div>
      <NuxtLink to="/messaging/campaigns/new" class="messaging-primary-action inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium">
        <PlusIcon class="h-5 w-5" />
        Створити кампанію
      </NuxtLink>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <div v-for="index in 6" :key="index" class="h-28 animate-pulse rounded-[1.25rem] bg-slate-100" />
    </div>
    <div v-else-if="error" class="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
      Не вдалося завантажити dashboard. <button class="font-semibold underline" @click="refresh()">Спробувати ще раз</button>
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <div v-for="card in cards" :key="card.label" class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ card.label }}</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">{{ card.value }}</p>
      </div>
    </div>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Telegram підключення клієнтів</h2>
          <p class="mt-1 text-sm text-slate-500">Актуальний зріз клієнтів, які мають chat_id, маркетингову згоду або відписку.</p>
        </div>
        <button class="messaging-secondary-action rounded-full px-4 py-2 text-sm font-medium" :disabled="telegramAudiencePending" @click="refreshTelegramAudience()">
          Оновити
        </button>
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
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Telegram сценарії</h2>
          <p class="mt-1 text-sm text-slate-500">Системні сценарії бота, повідомлення майстрам та автоматичні клієнтські нагадування.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="canSendMessagingCampaigns"
            class="messaging-secondary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
            :disabled="Boolean(runningJob)"
            @click="runScenarioJob('review')"
          >
            <StarIcon class="h-4 w-4" />
            {{ runningJob === 'review' ? 'Створюємо...' : 'Запити відгуків' }}
          </button>
          <button
            v-if="canSendMessagingCampaigns"
            class="messaging-secondary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
            :disabled="Boolean(runningJob)"
            @click="runScenarioJob('reminders')"
          >
            <ClockIcon class="h-4 w-4" />
            {{ runningJob === 'reminders' ? 'Створюємо...' : 'Нагадування 24г' }}
          </button>
          <button
            v-if="canSendMessagingCampaigns"
            class="messaging-primary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
            :disabled="Boolean(runningJob)"
            @click="runScenarioJob('pending')"
          >
            <PlayCircleIcon class="h-4 w-4" />
            {{ runningJob === 'pending' ? 'Обробляємо...' : 'Обробити чергу' }}
          </button>
        </div>
      </div>

      <div v-if="scenariosPending" class="mt-5 grid gap-4 lg:grid-cols-3">
        <div v-for="index in 3" :key="index" class="h-56 animate-pulse rounded-[1.25rem] bg-slate-100" />
      </div>
      <div v-else class="mt-5 grid gap-4 lg:grid-cols-3">
        <article
          v-for="scenario in telegramScenarios"
          :key="scenario.name"
          class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center rounded-full" :class="scenario.accentClass">
                <component :is="scenario.icon" class="h-5 w-5" />
              </span>
              <div>
                <h3 class="font-semibold text-slate-900">{{ scenario.name }}</h3>
                <p class="mt-1 text-xs text-slate-500">{{ scenario.recipient }} · {{ scenario.trigger }}</p>
              </div>
            </div>
            <span
              class="rounded-full px-3 py-1 text-xs font-medium"
              :class="scenario.campaign ? statusClass(scenario.campaign.status) : 'bg-rose-50 text-rose-700'"
            >
              {{ scenario.campaign ? statusLabel(scenario.campaign.status) : 'Не знайдено' }}
            </span>
          </div>

          <div class="mt-4 space-y-3 text-sm">
            <div class="flex justify-between gap-3">
              <span class="text-slate-500">Тип</span>
              <span class="font-medium text-slate-900">{{ scenario.campaign ? campaignTypeLabel(scenario.campaign.type) : '—' }}</span>
            </div>
            <div v-if="scenario.campaign" class="flex justify-between gap-3">
              <span class="text-slate-500">Отримувачі</span>
              <span class="font-medium text-slate-900">{{ scenario.campaign.audience_size }}</span>
            </div>
            <div v-if="scenario.campaign" class="flex justify-between gap-3">
              <span class="text-slate-500">Sent / failed</span>
              <span class="font-medium text-slate-900">{{ scenario.campaign.sent_count }} / {{ scenario.campaign.failed_count }}</span>
            </div>
            <div>
              <p class="text-slate-500">Повідомлення</p>
              <p class="mt-1 min-h-16 rounded-2xl bg-white p-3 leading-6 text-slate-800">
                {{ scenario.campaign?.message_body || 'Сценарій ще не синхронізовано з бекендом.' }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <NuxtLink
              v-if="scenario.campaign"
              :to="`/messaging/campaigns/${scenario.campaign.id}#recipients`"
              class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
            >
              Отримувачі
            </NuxtLink>
            <NuxtLink
              v-if="scenario.campaign"
              :to="`/messaging/campaigns/${scenario.campaign.id}`"
              class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
            >
              Деталі
            </NuxtLink>
            <NuxtLink
              v-if="scenario.campaign && canCreateMessagingDrafts"
              :to="`/messaging/campaigns/${scenario.campaign.id}/edit`"
              class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
            >
              Редагувати
            </NuxtLink>
            <NuxtLink
              v-if="!scenario.campaign"
              to="/messaging/campaigns"
              class="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700"
            >
              Перевірити кампанії
            </NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-semibold text-slate-900">Остання активність</h2>
          <NuxtLink to="/messaging/campaigns" class="text-sm font-medium text-cyan-700">Усі кампанії</NuxtLink>
        </div>
        <div v-if="data?.recent_activity?.length" class="mt-5 space-y-3">
          <article v-for="item in data.recent_activity" :key="item.id" class="rounded-2xl bg-slate-50 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-medium text-slate-900">{{ item.title }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ item.description }}</p>
              </div>
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
            </div>
            <p class="mt-3 text-xs text-slate-500">{{ new Date(item.created_at).toLocaleString('uk-UA') }}</p>
          </article>
        </div>
        <p v-else class="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
          Активності ще немає. Створіть першу кампанію або шаблон.
        </p>
      </div>

      <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Швидкі дії</h2>
        <div class="mt-5 grid gap-3">
          <NuxtLink to="/messaging/campaigns/new" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <PaperAirplaneIcon class="h-5 w-5 text-cyan-700" /> Створити кампанію
          </NuxtLink>
          <NuxtLink to="/messaging/templates" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <DocumentDuplicateIcon class="h-5 w-5 text-cyan-700" /> Створити шаблон
          </NuxtLink>
          <NuxtLink to="/messaging/settings" class="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-900">
            <ChatBubbleLeftRightIcon class="h-5 w-5 text-cyan-700" /> Тестовий отримувач
          </NuxtLink>
          <NuxtLink to="/messaging/campaigns?status=failed" class="flex items-center gap-3 rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-800">
            <ExclamationTriangleIcon class="h-5 w-5" /> Переглянути помилки
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
