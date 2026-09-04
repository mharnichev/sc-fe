<script setup lang="ts">
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  LanguageIcon,
  LinkIcon,
} from '@heroicons/vue/24/outline'
import type { BlogSubscriptionEventType } from '~/composables/useBackofficeApi'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/dashboard')
    }
  },
})

const api = useBackofficeApi()
const { addDaysInput, apiErrorMessage, formatDate, formatDateTime, todayInput } = useBookingFormatting()

const periodEndInput = ref(todayInput())
const periodStartInput = ref(addDaysInput(periodEndInput.value, -30))
const activeFilterCount = computed(() => [
  periodStartInput.value !== addDaysInput(todayInput(), -30) ? periodStartInput.value : '',
  periodEndInput.value !== todayInput() ? periodEndInput.value : '',
].filter(Boolean).length)

const toPeriodStartIso = (value: string) => new Date(`${value}T00:00:00`).toISOString()
const toPeriodEndIso = (value: string) => new Date(`${value}T23:59:59.999`).toISOString()

const periodStartIso = computed(() => toPeriodStartIso(periodStartInput.value))
const periodEndIso = computed(() => toPeriodEndIso(periodEndInput.value))

const { data, pending, error, refresh } = await useAsyncData(
  'blog-statistics-dashboard',
  async () => {
    const [statistics, subscriptions, events] = await Promise.all([
      api.getBlogStatistics({
        period_start: periodStartIso.value,
        period_end: periodEndIso.value,
      }),
      api.getBlogSubscriptions(1, 8),
      api.getBlogSubscriptionEvents(1, 10),
    ])
    return { statistics, subscriptions, events }
  },
  { watch: [periodStartIso, periodEndIso] },
)

const statistics = computed(() => data.value?.statistics || null)
const subscriptions = computed(() => data.value?.subscriptions.items || [])
const events = computed(() => data.value?.events.items || [])

const unsubscribeRate = computed(() => {
  const rate = Number(statistics.value?.unsubscribe_rate || 0)
  return `${(rate * 100).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%`
})

const dailyRows = computed(() =>
  [...(statistics.value?.by_date || [])].sort((first, second) => first.date.localeCompare(second.date)),
)

const maxDailyValue = computed(() =>
  Math.max(
    1,
    ...dailyRows.value.flatMap(row => [row.subscribed, row.unsubscribed, Math.abs(row.net_growth)]),
  ),
)

const topSources = computed(() => (statistics.value?.by_source || []).slice(0, 6))
const topLanguages = computed(() => (statistics.value?.by_language || []).slice(0, 6))
const unsubscribeReasons = computed(() => (statistics.value?.unsubscribe_reasons || []).slice(0, 5))

const sourceMax = computed(() =>
  Math.max(1, ...topSources.value.map(source => Math.max(source.active_subscribers, source.subscribe_events, source.unsubscribe_events))),
)

const percentWidth = (value: number, max: number) => `${Math.max(3, Math.round((Number(value || 0) / max) * 100))}%`

const dailyBarStyle = (value: number) => ({
  height: `${Math.max(value ? 10 : 2, Math.round((Math.abs(value) / maxDailyValue.value) * 100))}%`,
})

const sourceLabel = (source?: string | null) => {
  if (!source || source === 'unknown') return 'Невідомо'
  if (source === 'website') return 'Сайт'
  return source
}

const languageLabel = (language?: string | null) => {
  if (!language || language === 'unknown') return 'Невідомо'
  return language.toUpperCase()
}

const eventLabel = (type: BlogSubscriptionEventType) => ({
  subscribed: 'Підписка',
  resubscribed: 'Повторна підписка',
  unsubscribed: 'Відписка',
}[type])

const eventTone = (type: BlogSubscriptionEventType) => ({
  subscribed: 'success',
  resubscribed: 'info',
  unsubscribed: 'danger',
} as const)[type]

const statusLabel = (status: string) => status === 'subscribed' ? 'активна' : 'відписана'
const statusTone = (status: string) => status === 'subscribed' ? 'success' : 'neutral'

const eventCount = (type: BlogSubscriptionEventType) =>
  statistics.value?.events.find(item => item.event_type === type)?.count || 0

const refreshAll = () => refresh()
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Блог</p>
        <h1 class="mt-1 text-3xl font-semibold text-slate-900">Статистика підписок</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Аналітика підписок, джерела, мови, причини відписок і останні події з blog API.
        </p>
      </div>
      <BaseButton
        type="button"
        :disabled="pending"
        class="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        @click="refreshAll"
      >
        <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
        {{ pending ? 'Оновлення...' : 'Оновити' }}
      </BaseButton>
    </div>

    <BaseFilterPanel
      fields-class="!block"
      :active-count="activeFilterCount"
      mobile-title="Період статистики підписок"
      :loading="pending"
      :show-clear="false"
      aria-label="Період статистики підписок"
      @apply="refreshAll"
    >
      <BaseDateRange
        v-model:date-from="periodStartInput"
        v-model:date-to="periodEndInput"
        from-label="Початок періоду"
        to-label="Кінець періоду"
        field-class="grid gap-1.5 text-sm font-medium text-slate-700"
        input-class="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900"
      />
      <template #actions>
        <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span class="block text-xs uppercase tracking-[0.16em] text-slate-400">Поточний період</span>
          <span class="mt-1 block font-medium text-slate-900">{{ formatDate(statistics?.period_start) }} - {{ formatDate(statistics?.period_end) }}</span>
        </div>
      </template>
    </BaseFilterPanel>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ apiErrorMessage(error, 'Не вдалося завантажити статистику блогу. Перевірте доступність sc-be blog API.') }}
    </p>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatisticsStatCard
        label="Активні підписники"
        :value="statistics?.active_subscribers || 0"
        :hint="`Усього: ${statistics?.total_subscribers || 0}`"
        :loading="pending"
        tone="dark"
      />
      <StatisticsStatCard
        label="Нові підписки"
        :value="statistics?.subscribe_events || 0"
        :hint="`Повторні: ${eventCount('resubscribed')}`"
        :loading="pending"
        tone="emerald"
      />
      <StatisticsStatCard
        label="Відписки"
        :value="statistics?.unsubscribe_events || 0"
        :hint="`Rate: ${unsubscribeRate}`"
        :loading="pending"
        tone="rose"
      />
      <StatisticsStatCard
        label="Net growth"
        :value="statistics?.net_growth || 0"
        :hint="`${statistics?.unsubscribed_subscribers || 0} відписаних загалом`"
        :loading="pending"
        tone="cyan"
      />
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Динаміка за днями</h2>
            <p class="mt-1 text-sm text-slate-500">Підписки, відписки і чистий приріст за обраний період.</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs text-slate-500">
            <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-emerald-500" /> підписки</span>
            <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-rose-500" /> відписки</span>
            <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-cyan-500" /> net</span>
          </div>
        </div>

        <div v-if="pending" class="mt-5 h-64 animate-pulse rounded-2xl bg-slate-100" />
        <StatisticsEmptyState
          v-else-if="!dailyRows.length"
          class="mt-5"
          title="Немає подій за період"
          description="Графік зʼявиться після підписок або відписок."
        />
        <div v-else class="mt-5 overflow-x-auto">
          <div class="flex h-64 min-w-[680px] items-end gap-2 rounded-2xl bg-slate-50 p-4">
            <div
              v-for="row in dailyRows"
              :key="row.date"
              class="flex min-w-10 flex-1 flex-col items-center justify-end gap-2"
            >
              <div class="flex h-48 w-full items-end justify-center gap-1">
                <span class="w-2 rounded-t-full bg-emerald-500" :style="dailyBarStyle(row.subscribed)" :title="`${row.date}: +${row.subscribed}`" />
                <span class="w-2 rounded-t-full bg-rose-500" :style="dailyBarStyle(row.unsubscribed)" :title="`${row.date}: -${row.unsubscribed}`" />
                <span class="w-2 rounded-t-full bg-cyan-500" :style="dailyBarStyle(row.net_growth)" :title="`${row.date}: net ${row.net_growth}`" />
              </div>
              <span class="text-[0.65rem] text-slate-500">{{ row.date.slice(5) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Події періоду</h2>
        <div v-if="pending" class="mt-4 space-y-3">
          <div v-for="index in 3" :key="index" class="h-16 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <div v-else class="mt-4 space-y-3">
          <div class="rounded-2xl bg-emerald-50 p-4">
            <p class="text-sm text-emerald-700">Перші підписки</p>
            <p class="mt-1 text-2xl font-semibold text-emerald-950">{{ eventCount('subscribed') }}</p>
          </div>
          <div class="rounded-2xl bg-cyan-50 p-4">
            <p class="text-sm text-cyan-700">Повторні підписки</p>
            <p class="mt-1 text-2xl font-semibold text-cyan-950">{{ eventCount('resubscribed') }}</p>
          </div>
          <div class="rounded-2xl bg-rose-50 p-4">
            <p class="text-sm text-rose-700">Відписки</p>
            <p class="mt-1 text-2xl font-semibold text-rose-950">{{ eventCount('unsubscribed') }}</p>
          </div>
        </div>
      </section>
    </div>

    <div class="grid gap-4 xl:grid-cols-3">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
        <h2 class="text-lg font-semibold text-slate-900">Джерела підписок</h2>
        <div v-if="pending" class="mt-4 space-y-3">
          <div v-for="index in 5" :key="index" class="h-14 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <StatisticsEmptyState
          v-else-if="!topSources.length"
          class="mt-4"
          title="Джерел ще немає"
          description="Дані зʼявляться після першої підписки."
        />
        <div v-else class="mt-4 space-y-4">
          <article v-for="source in topSources" :key="source.source" class="rounded-2xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="font-medium text-slate-900">{{ sourceLabel(source.source) }}</p>
              <p class="text-sm text-slate-500">{{ source.active_subscribers }} активних</p>
            </div>
            <div class="mt-3 grid gap-2">
              <div class="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs text-slate-500">
                <span>Активні</span>
                <span class="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span class="block h-full rounded-full bg-slate-950" :style="{ width: percentWidth(source.active_subscribers, sourceMax) }" />
                </span>
                <span class="text-right">{{ source.active_subscribers }}</span>
              </div>
              <div class="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs text-slate-500">
                <span>Підписки</span>
                <span class="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span class="block h-full rounded-full bg-emerald-500" :style="{ width: percentWidth(source.subscribe_events, sourceMax) }" />
                </span>
                <span class="text-right">{{ source.subscribe_events }}</span>
              </div>
              <div class="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs text-slate-500">
                <span>Відписки</span>
                <span class="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span class="block h-full rounded-full bg-rose-500" :style="{ width: percentWidth(source.unsubscribe_events, sourceMax) }" />
                </span>
                <span class="text-right">{{ source.unsubscribe_events }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div class="grid gap-4">
        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center gap-2">
            <LanguageIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
            <h2 class="text-lg font-semibold text-slate-900">Мови</h2>
          </div>
          <div v-if="pending" class="mt-4 space-y-3">
            <div v-for="index in 3" :key="index" class="h-12 animate-pulse rounded-2xl bg-slate-100" />
          </div>
          <div v-else-if="topLanguages.length" class="mt-4 space-y-3">
            <div v-for="language in topLanguages" :key="language.language" class="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <span class="font-medium text-slate-900">{{ languageLabel(language.language) }}</span>
              <span class="text-sm text-slate-500">{{ language.active_subscribers }}</span>
            </div>
          </div>
          <p v-else class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Мови ще не передані у підписках.</p>
        </section>

        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
          <h2 class="text-lg font-semibold text-slate-900">Причини відписок</h2>
          <div v-if="pending" class="mt-4 space-y-3">
            <div v-for="index in 3" :key="index" class="h-12 animate-pulse rounded-2xl bg-slate-100" />
          </div>
          <div v-else-if="unsubscribeReasons.length" class="mt-4 space-y-3">
            <div v-for="reason in unsubscribeReasons" :key="reason.reason" class="rounded-2xl bg-rose-50 px-4 py-3">
              <p class="font-medium text-rose-950">{{ reason.reason === 'unknown' ? 'Не вказано' : reason.reason }}</p>
              <p class="mt-1 text-sm text-rose-700">{{ reason.count }} відписок</p>
            </div>
          </div>
          <p v-else class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Причин відписок ще немає.</p>
        </section>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
          <EnvelopeIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
          <h2 class="text-lg font-semibold text-slate-900">Останні підписники</h2>
        </div>
        <BaseTable
          caption="Останні підписники блогу"
          wrapper-class="rounded-none border-0"
          min-width="46rem"
          :loading="pending"
          loading-label="Завантаження підписників…"
          :empty="!subscriptions.length"
          empty-title="Підписників ще немає"
        >
          <template #head>
            <tr>
              <th>Email</th>
              <th>Статус</th>
              <th>Джерело</th>
              <th>Підписка</th>
            </tr>
          </template>
            <tr v-for="subscription in subscriptions" :key="subscription.id">
              <td>
                <p class="font-medium text-ui-primary">{{ subscription.email }}</p>
                <p class="mt-1 text-xs text-ui-muted">{{ subscription.name || `Subscription #${subscription.id}` }}</p>
              </td>
              <td>
                <BaseBadge :tone="statusTone(subscription.status)">
                  {{ statusLabel(subscription.status) }}
                </BaseBadge>
              </td>
              <td class="text-ui-secondary">{{ sourceLabel(subscription.source) }}</td>
              <td class="whitespace-nowrap text-ui-secondary">{{ formatDateTime(subscription.subscribed_at) }}</td>
            </tr>
        </BaseTable>
      </section>

      <section class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
          <CalendarDaysIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
          <h2 class="text-lg font-semibold text-slate-900">Останні події</h2>
        </div>
        <BaseTable
          caption="Останні події блогу"
          wrapper-class="rounded-none border-0"
          min-width="44rem"
          :loading="pending"
          loading-label="Завантаження подій…"
          :empty="!events.length"
          empty-title="Подій блогу ще немає"
        >
          <template #head>
            <tr>
              <th>Подія</th>
              <th>Підписка</th>
              <th>Джерело</th>
              <th>Дата</th>
            </tr>
          </template>
            <tr v-for="event in events" :key="event.id">
              <td>
                <BaseBadge :tone="eventTone(event.event_type)">
                  {{ eventLabel(event.event_type) }}
                </BaseBadge>
              </td>
              <td class="text-ui-secondary">#{{ event.subscription_id }}</td>
              <td class="text-ui-secondary">{{ sourceLabel(event.source) }}</td>
              <td class="whitespace-nowrap text-ui-secondary">{{ formatDateTime(event.occurred_at) }}</td>
            </tr>
        </BaseTable>
      </section>
    </div>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex items-center gap-2">
        <LinkIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
        <h2 class="text-lg font-semibold text-slate-900">Дані, які зараз віддає sc-be</h2>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-3">
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="font-medium text-slate-900">/backoffice/blog/statistics</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">KPI, події за період, щоденна динаміка, джерела, мови і причини відписок.</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="font-medium text-slate-900">/backoffice/blog/subscriptions</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">Пагінований список email-підписок зі статусом, джерелом, мовою, UTM і датами.</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="font-medium text-slate-900">/backoffice/blog/events</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">Пагінований журнал subscribed, resubscribed і unsubscribed подій.</p>
        </div>
      </div>
    </section>
  </div>
</template>
