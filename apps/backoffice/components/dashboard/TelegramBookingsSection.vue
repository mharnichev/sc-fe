<script setup lang="ts">
import { PaperAirplaneIcon } from '@heroicons/vue/24/outline'
import { dashboardMetricComparison } from '~/utils/adminDashboard'
import type { DashboardTelegramBookings } from '~/utils/adminDashboardContract'

const props = defineProps<{
  summary?: DashboardTelegramBookings | null
  loading?: boolean
}>()

const countFormatter = new Intl.NumberFormat('uk-UA')
const statusItems = computed(() => [
  { key: 'confirmed', label: 'Підтверджені', value: props.summary?.status_counts.confirmed, tone: 'cyan' },
  { key: 'completed', label: 'Завершені', value: props.summary?.status_counts.completed, tone: 'emerald' },
  { key: 'cancelled', label: 'Скасовані', value: props.summary?.status_counts.cancelled, tone: 'rose' },
  { key: 'pending', label: 'Очікують', value: props.summary?.status_counts.pending, tone: 'amber' },
])
</script>

<template>
  <BaseCard as="section" variant="surface" padding="md" class="telegram-bookings" aria-labelledby="telegram-bookings-title">
    <div class="telegram-bookings__header">
      <div class="flex items-start gap-3">
        <PaperAirplaneIcon class="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden="true" />
        <div>
          <h2 id="telegram-bookings-title" class="text-lg font-semibold text-slate-900">Записи через Telegram</h2>
          <p class="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Окремо від вебворонки: записи, створені ботом у вибраному періоді, та їхній поточний статус.
          </p>
        </div>
      </div>
      <BaseBadge tone="info">За датою створення · Europe/Kyiv</BaseBadge>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <DashboardDecisionMetricCard
        label="Створено Telegram-записів"
        tone="cyan"
        :value="summary?.created_bookings.current"
        :comparison="dashboardMetricComparison(summary?.created_bookings)"
        :loading="loading"
        :help="{
          summary: 'Кількість записів, які клієнти підтвердили безпосередньо в Telegram-боті.',
          formula: 'COUNT записів із source = telegram, створених у вибраному періоді.',
          note: 'Дата майбутнього візиту не впливає на потрапляння запису до цього періоду.',
        }"
      />
      <DashboardDecisionMetricCard
        label="Унікальні Telegram-клієнти"
        tone="dark"
        :value="summary?.unique_clients.current"
        :comparison="dashboardMetricComparison(summary?.unique_clients)"
        :loading="loading"
        :help="{
          summary: 'Кількість різних клієнтів, які створили Telegram-запис у вибраному періоді.',
          formula: 'COUNT DISTINCT за customer_id; для незв’язаних записів — за номером телефону.',
          note: 'Один клієнт із кількома записами рахується один раз.',
        }"
      />
    </div>

    <div v-if="loading" class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Завантаження статусів Telegram-записів">
      <div v-for="index in 4" :key="index" class="h-24 animate-pulse rounded-2xl bg-slate-100" />
    </div>
    <BaseEmptyState
      v-else-if="!summary"
      class="mt-3"
      compact
      title="Статистика Telegram недоступна"
      description="Backend не повернув перевірену розбивку записів за каналом."
    />
    <dl v-else class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Поточні статуси Telegram-записів">
      <div
        v-for="item in statusItems"
        :key="item.key"
        class="telegram-bookings__status"
        :class="`telegram-bookings__status--${item.tone}`"
      >
        <dt class="text-sm text-slate-500">{{ item.label }}</dt>
        <dd class="mt-2 text-2xl font-semibold text-slate-900">{{ countFormatter.format(item.value ?? 0) }}</dd>
      </div>
    </dl>

    <p v-if="summary" class="mt-4 text-xs leading-5 text-slate-500">
      Історія до запуску обліку джерела відновлена лише частково; усі нові записи визначаються точно. Статуси показують поточний стан записів, створених у вибраному періоді.
    </p>
  </BaseCard>
</template>

<style scoped>
.telegram-bookings {
  border: 1px solid var(--bo-border);
  background: var(--bo-surface);
}

.telegram-bookings__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.telegram-bookings__status {
  min-height: 6rem;
  padding: 1rem;
  border: 1px solid var(--bo-border);
  border-radius: 1rem;
  background: var(--bo-surface-elevated);
}

.telegram-bookings__status--cyan { border-color: color-mix(in srgb, var(--bo-accent) 42%, var(--bo-border)); }
.telegram-bookings__status--emerald { border-color: var(--bo-success); background: var(--bo-success-surface); }
.telegram-bookings__status--rose { border-color: var(--bo-danger); background: var(--bo-danger-surface); }
.telegram-bookings__status--amber { border-color: var(--bo-warning); background: var(--bo-warning-surface); }

@media (max-width: 40rem) {
  .telegram-bookings__header { flex-direction: column; }
}
</style>
