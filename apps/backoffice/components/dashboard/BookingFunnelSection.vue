<script setup lang="ts">
import {
  ArrowRightIcon,
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
              summary="Кожен крок — кількість унікальних анонімних сесій із відповідною подією у вибраному періоді. Ідентифікатори зберігаються на backend у вигляді хешів."
              formula="Конверсія кроку = сесії наступного кроку ÷ сесії попереднього кроку × 100%. Відсів = 100% − конверсія."
              note="«Почали запис» означає першу змістовну дію у формі, а не просте відкриття сторінки."
            />
          </h2>
          <p class="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Де відвідувачі продовжують запис, а де зупиняються. Усі показники вже розраховані на сервері.
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
            formula="Успішно створені backend записи ÷ анонімні сесії з booking_start × 100%."
            note="Якщо успіх неможливо надійно зіставити із сесією або успіхів більше за стартів, backend повертає недоступний чи частковий стан замість оманливого відсотка."
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
      v-else-if="!funnel || funnel.status === 'unavailable'"
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
        v-if="funnel.status === 'partial'"
        class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        role="status"
      >
        Частина подій неповна. Доступні значення показані нижче, а ненадійні переходи позначені як недоступні.
      </div>

      <ol class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Кроки воронки онлайн-запису">
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
          <p class="mt-1 text-xs text-slate-500">відвідувачів</p>

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
            <p class="flex items-start gap-1 font-semibold text-amber-950">
              {{ bookingFunnelAlertContent[alert.code].title }}
              <DashboardMetricHelp
                :title="bookingFunnelAlertContent[alert.code].title"
                :summary="bookingFunnelAlertContent[alert.code].description"
                :trigger="alertTrigger(alert.code)"
                :action="bookingFunnelAlertContent[alert.code].action"
              />
            </p>
            <p class="mt-1 text-sm leading-5 text-amber-900">{{ bookingFunnelAlertContent[alert.code].description }}</p>
            <p class="mt-2 text-xs font-medium text-amber-800">
              Зараз: {{ alertMetric(alert.code, alert.count, alert.rate_percent) }}
            </p>
            <p class="mt-2 text-xs leading-5 text-amber-900">
              <strong>Чому спрацювало:</strong> {{ alertTrigger(alert.code) }}
            </p>
            <p class="mt-2 text-xs leading-5 text-amber-900">
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
}
</style>
