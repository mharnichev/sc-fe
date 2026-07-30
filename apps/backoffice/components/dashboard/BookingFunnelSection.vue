<script setup lang="ts">
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
} from '@heroicons/vue/24/outline'
import type { DashboardBookingFunnel } from '~/utils/adminDashboardContract'
import {
  bookingFunnelAlertContent,
  bookingFunnelAlertTriggerExplanation,
  bookingFunnelBottleneckLabel,
  bookingFunnelDisplayState,
  bookingFunnelStepDescriptions,
  formatBookingFunnelPercentage,
  mapBookingFunnelRows,
  triggeredBookingFunnelAlerts,
} from '~/utils/bookingFunnelDashboard'

const props = defineProps<{
  funnel?: DashboardBookingFunnel | null
  loading?: boolean
}>()

const rows = computed(() => mapBookingFunnelRows(props.funnel))
const alerts = computed(() => triggeredBookingFunnelAlerts(props.funnel))
const noSlotDates = computed(() => props.funnel?.no_slot_dates ?? [])
const bottleneckLabel = computed(() => bookingFunnelBottleneckLabel(props.funnel))
const displayState = computed(() => bookingFunnelDisplayState(props.funnel))
const isRenderable = computed(() =>
  displayState.value === 'available' || displayState.value === 'partial',
)
const overallConversion = computed(() => {
  const overall = props.funnel?.overall_conversion
  return formatBookingFunnelPercentage(overall?.conversion_percent, overall?.status)
})
const alertMetric = (code: keyof typeof bookingFunnelAlertContent, count: number, rate: string | number | null) => {
  const countLabel = `${count.toLocaleString('uk-UA')} ${count === 1 ? 'випадок' : 'випадків'}`
  if (code !== 'no_slot' || rate === null) return countLabel
  return `${countLabel} · ${formatBookingFunnelPercentage(rate)} від виборів майстра`
}
const alertTrigger = (code: keyof typeof bookingFunnelAlertContent) =>
  props.funnel
    ? bookingFunnelAlertTriggerExplanation(code, props.funnel.alert_thresholds)
    : 'Поріг сигналу недоступний.'
const targetDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const observedAtFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})
const formatTargetDate = (value: string) =>
  targetDateFormatter.format(new Date(`${value}T00:00:00.000Z`))
const formatObservedAt = (value: string) => observedAtFormatter.format(new Date(value))
</script>

<template>
  <section
    class="booking-funnel rounded-[1.75rem] border p-4 shadow-sm sm:p-5"
    aria-labelledby="booking-funnel-title"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <ChartBarSquareIcon class="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
        <div>
          <h2 id="booking-funnel-title" class="flex items-center gap-1 text-lg font-semibold text-slate-900">
            Воронка онлайн-запису
            <DashboardMetricHelp
              title="Воронка онлайн-запису"
              summary="Когорта складається зі спроб, у яких найраніший persisted booking_start зафіксовано у вибраному періоді. Пізніші contextual backfill не дублюють спробу між періодами, а кроки зіставляються за тим самим анонімним session hash."
              formula="Конверсія A → B = сесії, що мають обидві події A і B, ÷ сесії з A × 100%. Відсів = сесії A без B."
              note="«Почали запис» означає першу змістовну дію у формі, а не клік CTA чи відкриття сторінки. Версія розрахунку — 2."
            />
          </h2>
          <p class="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Де спроби запису продовжуються, а де зупиняються. Період визначає booking_start; завершення тієї самої спроби може надійти пізніше.
          </p>
        </div>
      </div>
      <div
        v-if="!loading && isRenderable"
        class="booking-funnel__overall rounded-2xl border px-4 py-3 text-right"
      >
        <p class="flex items-center justify-end gap-1 text-xs text-slate-500">
          Від початку до успішного запису
          <DashboardMetricHelp
            title="Загальна конверсія запису"
            summary="Показує, яка частка сесій із зафіксованим початком завершилася створенням запису."
            formula="Сесії з booking_start і server-side booking_success ÷ сесії з booking_start × 100%."
            note="Успіхи без anonymous session виключаються з відсотка й показуються окремо як прогалина атрибуції."
          />
        </p>
        <p class="mt-1 text-xl font-semibold text-slate-900">{{ overallConversion }}</p>
      </div>
    </div>

    <div v-if="loading" class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Завантаження воронки запису">
      <div v-for="index in 6" :key="index" class="h-44 animate-pulse rounded-2xl bg-slate-100" />
    </div>

    <StatisticsEmptyState
      v-else-if="funnel?.status === 'empty'"
      class="mt-5"
      title="Даних воронки ще немає"
      description="У вибраному періоді ще не зафіксовано жодного початку онлайн-запису. Це не означає нульову конверсію."
    />

    <div
      v-else-if="!funnel"
      class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900"
      role="status"
    >
      <p class="font-semibold">Воронка поки недоступна</p>
      <p class="mt-1 text-sm leading-6">
        Недостатньо надійних подій, щоб показати конверсію. Значення не замінюються нулями або локальними оцінками.
      </p>
    </div>

    <template v-else>
      <div
        v-if="funnel.status === 'unavailable'"
        class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900"
        role="status"
      >
        <p class="font-semibold">Конверсія воронки поки недоступна</p>
        <p class="mt-1 text-sm leading-6">
          Недостатньо надійних подій booking_start, тому кроки й відсотки не показуються. Операційні сигнали за період залишаються доступними нижче.
        </p>
        <p class="mt-2 text-sm leading-6">
          Діагностика телеметрії:
          {{ funnel.tracking_gap_count.toLocaleString('uk-UA') }} переходів без попередньої події,
          {{ funnel.unattributed_booking_successes.toLocaleString('uk-UA') }} успішних записів без anonymous session.
        </p>
        <p v-if="funnel.status_reason" class="mt-2 text-xs leading-5">{{ funnel.status_reason }}</p>
      </div>

      <div
        v-else-if="funnel.status === 'partial'"
        class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        role="status"
      >
        Частина телеметрії неповна: {{ funnel.tracking_gap_count.toLocaleString('uk-UA') }} переходів без попередньої події,
        {{ funnel.unattributed_booking_successes.toLocaleString('uk-UA') }} успішних записів без anonymous session.
        Відсотки нижче рахуються лише як перетини тих самих сесій.
        <span v-if="funnel.status_reason" class="block text-xs">{{ funnel.status_reason }}</span>
      </div>

      <ol
        v-if="isRenderable"
        class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
        aria-label="Кроки воронки онлайн-запису"
      >
        <li
          v-for="(row, index) in rows"
          :key="row.step"
          class="booking-funnel__step relative rounded-2xl border p-4"
        >
          <span class="booking-funnel__step-number inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold">
            {{ index + 1 }}
          </span>
          <p class="mt-3 flex min-h-10 items-start gap-1 text-sm font-medium leading-5 text-slate-700">
            {{ row.label }}
            <DashboardMetricHelp
              :title="row.label"
              :summary="bookingFunnelStepDescriptions[row.step]"
              formula="Одна анонімна сесія враховується на цьому кроці не більше одного разу."
            />
          </p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">
            {{ row.count === null ? 'Недоступно' : row.count.toLocaleString('uk-UA') }}
          </p>
          <p class="mt-1 text-xs text-slate-500">спроб запису</p>

          <div v-if="row.conversion" class="mt-4 border-t border-slate-200 pt-3">
            <p class="text-xs text-slate-500">З попереднього кроку</p>
            <p class="mt-1 font-semibold text-slate-900">
              {{ formatBookingFunnelPercentage(row.conversion.conversion_percent, row.conversion.status) }}
            </p>
            <p class="mt-2 text-xs leading-5 text-slate-500">
              Відсів:
              <template v-if="row.dropOff?.status === 'available'">
                <strong class="font-semibold text-slate-700">{{ row.dropOff.count?.toLocaleString('uk-UA') }}</strong>
                · {{ formatBookingFunnelPercentage(row.dropOff.drop_off_percent) }}
              </template>
              <span v-else>недоступно</span>
            </p>
            <p
              v-if="row.conversion.status === 'unavailable' && row.conversion.unavailable_reason"
              class="mt-2 text-xs leading-5 text-amber-700"
            >
              {{ row.conversion.unavailable_reason }}
            </p>
          </div>
          <p v-else class="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
            Початок воронки — попереднього кроку немає.
          </p>
        </li>
      </ol>

      <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <article class="booking-funnel__bottleneck rounded-2xl border p-4">
          <p class="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-rose-700">
            Головне вузьке місце
            <DashboardMetricHelp
              title="Як обирається вузьке місце"
              summary="Backend порівнює активні операційні сигнали та втрати між послідовними кроками, а потім повертає одну пріоритетну дію."
              :trigger="`Перехід бере участь у висновку лише від ${funnel.alert_thresholds.meaningful_step_sessions} сесій на попередньому кроці.`"
              note="Малий обсяг даних не перетворюється на впевнену рекомендацію."
            />
          </p>
          <template v-if="funnel.recommended_action">
            <h3 class="mt-2 font-semibold text-slate-950">{{ bottleneckLabel }}</h3>
            <p class="mt-1 text-sm leading-6 text-slate-600">{{ funnel.recommended_action.explanation_uk }}</p>
          </template>
          <template v-else>
            <h3 class="mt-2 font-semibold text-slate-950">Ще недостатньо даних для висновку</h3>
            <p class="mt-1 text-sm leading-6 text-slate-600">
              Для цього періоду ще немає достатньо подій, щоб надійно визначити головну перешкоду.
            </p>
          </template>
        </article>

        <article class="booking-funnel__insight rounded-2xl border p-4">
          <div class="flex items-start gap-3">
            <LightBulbIcon class="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
            <div>
              <p class="text-xs font-medium uppercase tracking-[0.14em] text-cyan-700">Тижневий висновок</p>
              <p class="mt-2 text-sm leading-6 text-slate-700">{{ funnel.weekly_insight_uk }}</p>
              <NuxtLink
                v-if="funnel.recommended_action"
                :to="funnel.recommended_action.recommended_backoffice_route"
                class="booking-funnel__action mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition"
              >
                {{ funnel.recommended_action.title_uk }}
                <ArrowRightIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>

      <section
        v-if="noSlotDates.length || funnel.no_slot_unknown_date_count"
        class="booking-funnel__no-slot-dates mt-4 overflow-hidden rounded-2xl border"
        aria-labelledby="booking-funnel-no-slot-dates-title"
      >
        <div class="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
          <div class="flex items-start gap-3">
            <CalendarDaysIcon class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h3
                id="booking-funnel-no-slot-dates-title"
                class="flex items-center gap-1 text-sm font-semibold text-slate-900"
              >
                Дати, на які не знайшли вільних слотів
                <DashboardMetricHelp
                  title="Дати без доступних слотів"
                  summary="Показує відкриті робочі дні, для яких успішний запит повернув порожній список слотів."
                  formula="Одне спостереження на анонімну сесію, майстра, послугу та вибрану дату."
                  note="Помилки мережі, закриті робочі дні та конфлікти застарілих слотів сюди не потрапляють."
                />
              </h3>
              <p class="mt-1 text-xs leading-5 text-slate-500">
                Допомагає відрізнити загальний сигнал «немає слотів» від конкретних проблемних днів.
              </p>
            </div>
          </div>
          <span
            v-if="funnel.no_slot_unknown_date_count"
            class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
          >
            Дата не визначена: {{ funnel.no_slot_unknown_date_count.toLocaleString('uk-UA') }}
          </span>
        </div>

        <BaseTable
          v-if="noSlotDates.length"
          caption="Дати, на які відвідувачі не знайшли вільних слотів"
          min-width="50rem"
          wrapper-class="!rounded-none !border-x-0 !border-b-0"
        >
          <template #head>
            <tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th class="px-4 py-3 font-medium">Дата без слотів</th>
              <th class="px-4 py-3 text-right font-medium">Спостереження</th>
              <th class="px-4 py-3 text-right font-medium">Сесії</th>
              <th class="px-4 py-3 text-right font-medium">Майстри</th>
              <th class="px-4 py-3 font-medium">Вперше помітили</th>
              <th class="px-4 py-3 font-medium">Востаннє помітили</th>
            </tr>
          </template>
          <tr v-for="item in noSlotDates" :key="item.target_date">
            <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
              <time :datetime="item.target_date">{{ formatTargetDate(item.target_date) }}</time>
            </td>
            <td class="px-4 py-3 text-right font-semibold text-slate-900">
              {{ item.observations.toLocaleString('uk-UA') }}
            </td>
            <td class="px-4 py-3 text-right text-slate-700">
              {{ item.unique_sessions.toLocaleString('uk-UA') }}
            </td>
            <td class="px-4 py-3 text-right text-slate-700">
              {{ item.affected_masters.toLocaleString('uk-UA') }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-600">
              <time :datetime="item.first_observed_at">{{ formatObservedAt(item.first_observed_at) }}</time>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-600">
              <time :datetime="item.last_observed_at">{{ formatObservedAt(item.last_observed_at) }}</time>
            </td>
          </tr>
        </BaseTable>
        <p
          v-else
          class="border-t border-slate-200 px-4 py-3 text-sm leading-6 text-slate-500"
        >
          Для старих подій вибрану дату відновити неможливо, тому вони показані лише загальним числом.
        </p>
      </section>

      <div v-if="alerts.length" class="mt-4" aria-labelledby="booking-funnel-alerts-title">
        <h3 id="booking-funnel-alerts-title" class="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ExclamationTriangleIcon class="h-5 w-5 text-amber-600" aria-hidden="true" />
          Потребує уваги
        </h3>
        <ul class="mt-3 grid gap-3 md:grid-cols-3">
          <li
            v-for="alert in alerts"
            :key="alert.code"
            class="booking-funnel__alert rounded-2xl border p-4"
          >
            <p class="flex items-start gap-1 font-semibold">
              {{ bookingFunnelAlertContent[alert.code].title }}
              <DashboardMetricHelp
                :title="bookingFunnelAlertContent[alert.code].title"
                :summary="bookingFunnelAlertContent[alert.code].description"
                :trigger="alertTrigger(alert.code)"
                :action="bookingFunnelAlertContent[alert.code].action"
              />
            </p>
            <p class="mt-1 text-sm leading-5">{{ bookingFunnelAlertContent[alert.code].description }}</p>
            <p class="mt-2 text-xs font-medium">
              Зараз: {{ alertMetric(alert.code, alert.count, alert.rate_percent) }}
            </p>
            <p class="mt-2 text-xs leading-5">
              <strong>Чому спрацювало:</strong> {{ alertTrigger(alert.code) }}
            </p>
            <p class="mt-2 text-xs leading-5">
              <strong>Що зробити:</strong> {{ bookingFunnelAlertContent[alert.code].action }}
            </p>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped>
.booking-funnel {
  border-color: color-mix(in srgb, var(--accent-text) 18%, var(--border));
  background: color-mix(in srgb, var(--accent-text) 3%, var(--glass));
}

.booking-funnel__overall,
.booking-funnel__insight {
  border-color: color-mix(in srgb, var(--accent-text) 24%, var(--border));
  background: color-mix(in srgb, var(--accent-text) 9%, var(--glass));
}

.booking-funnel__step {
  border-color: var(--border);
  background: var(--glass);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 7%, transparent);
}

.booking-funnel__step-number {
  background: color-mix(in srgb, var(--accent-text) 15%, var(--glass));
  color: color-mix(in srgb, var(--accent-text) 78%, var(--text-primary));
}

.booking-funnel__bottleneck {
  border-color: color-mix(in srgb, var(--danger) 24%, var(--border));
  background: color-mix(in srgb, var(--danger) 7%, var(--glass));
}

.booking-funnel__action {
  border-color: color-mix(in srgb, var(--accent-text) 38%, var(--border));
  background: color-mix(in srgb, var(--accent-text) 12%, transparent);
  color: color-mix(in srgb, var(--accent-text) 90%, var(--text-primary));
}

.booking-funnel__action:hover {
  border-color: color-mix(in srgb, var(--accent-text) 56%, var(--border));
  background: color-mix(in srgb, var(--accent-text) 22%, var(--glass-hover));
  color: var(--text-primary);
}

.booking-funnel__alert {
  border-color: color-mix(in srgb, var(--warning) 30%, var(--border));
  background: color-mix(in srgb, var(--warning) 10%, var(--glass));
  color: var(--bo-warning-text);
}

.booking-funnel__no-slot-dates {
  border-color: color-mix(in srgb, var(--warning) 24%, var(--border));
  background: color-mix(in srgb, var(--warning) 5%, var(--glass));
}
</style>
