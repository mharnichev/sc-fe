<script setup lang="ts">
import { SparklesIcon } from '@heroicons/vue/24/outline'
import type { BookingRecoverySummary } from '~/utils/bookingRecoveryContract'

const props = defineProps<{
  summary?: BookingRecoverySummary | null
  loading?: boolean
  unavailable?: boolean
}>()

const countFormatter = new Intl.NumberFormat('uk-UA')
const percentageFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 })

const formatCount = (value: number) => countFormatter.format(value)
const formatRate = (value: number | string | null | undefined) =>
  value === null || value === undefined ? 'Недостатньо даних' : `${percentageFormatter.format(Number(value))}%`
const formatDuration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) return 'Недостатньо даних'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} хв`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} год ${remainder} хв` : `${hours} год`
}

const isEmpty = computed(() => props.summary !== undefined && props.summary !== null && [
  props.summary.no_slot_sessions,
  props.summary.alternatives_returned,
  props.summary.waitlist_requests,
  props.summary.offers_sent,
  props.summary.cancelled_slots_refilled,
].every(value => value === 0))
</script>

<template>
  <BaseCard as="section" variant="surface" padding="md" class="booking-recovery" aria-labelledby="booking-recovery-title">
    <div class="booking-recovery__header">
      <div class="booking-recovery__heading">
        <SparklesIcon class="booking-recovery__icon" aria-hidden="true" />
        <div>
          <h2 id="booking-recovery-title" class="booking-recovery__title">Відновлення після відсутності слотів</h2>
          <p class="booking-recovery__description">
            Глобальні операційні метрики для унікальних сесій без вільного часу, альтернатив і листа очікування. Фільтр майстра вище на цей блок не впливає.
          </p>
        </div>
      </div>
      <BaseBadge tone="info">Усі майстри · Europe/Kyiv</BaseBadge>
    </div>

    <div v-if="loading" class="booking-recovery__skeleton" aria-label="Завантаження метрик відновлення">
      <div v-for="index in 8" :key="index" class="booking-recovery__skeleton-item" />
    </div>

    <div v-else-if="unavailable" class="booking-recovery__notice" role="status">
      <p class="booking-recovery__notice-title">Метрики відновлення тимчасово недоступні</p>
      <p class="booking-recovery__notice-text">Backend не повернув перевірений підсумок за цей період. Значення не замінюються локальними оцінками.</p>
    </div>

    <BaseEmptyState
      v-else-if="!summary || isEmpty"
      compact
      title="Ще недостатньо production-даних"
      description="Коли з’являться сесії без слотів або запити до листа очікування, тут буде видно, як вони відновлюються."
    />

    <template v-else>
      <dl class="booking-recovery__grid">
        <div class="booking-recovery__metric booking-recovery__metric--accent">
          <dt>Сесії без слотів</dt>
          <dd>{{ formatCount(summary.no_slot_sessions) }}</dd>
          <p>Унікальні сесії, не кількість втрачених клієнтів.</p>
        </div>
        <div class="booking-recovery__metric">
          <dt>Альтернативні слоти показано</dt>
          <dd>{{ formatCount(summary.alternative_slots_returned) }}</dd>
          <p>Запитів: {{ formatCount(summary.alternatives_requested) }} · відповідей: {{ formatCount(summary.alternatives_returned) }}.</p>
        </div>
        <div class="booking-recovery__metric booking-recovery__metric--success">
          <dt>Записів після альтернатив</dt>
          <dd>{{ formatCount(summary.bookings_after_alternative) }}</dd>
          <p>Рівень відновлення: {{ formatRate(summary.alternative_recovery_rate_percent) }}.</p>
        </div>
        <div class="booking-recovery__metric">
          <dt>Запитів до листа очікування</dt>
          <dd>{{ formatCount(summary.waitlist_requests) }}</dd>
          <p>Підсумок нових запитів за вибраний період.</p>
        </div>
        <div class="booking-recovery__metric">
          <dt>Пропозицій надіслано</dt>
          <dd>{{ formatCount(summary.offers_sent) }}</dd>
          <p>Доставлено: {{ formatCount(summary.offers_delivered) }} · прострочено: {{ formatCount(summary.offers_expired) }}.</p>
        </div>
        <div class="booking-recovery__metric booking-recovery__metric--success">
          <dt>Пропозицій підтверджено</dt>
          <dd>{{ formatCount(summary.offers_claimed) }}</dd>
          <p>Заявки, за якими клієнт скористався захищеним посиланням.</p>
        </div>
        <div class="booking-recovery__metric">
          <dt>Скасовані слоти заповнено</dt>
          <dd>{{ formatCount(summary.cancelled_slots_refilled) }}</dd>
          <p>Через лист очікування після вивільнення часу.</p>
        </div>
        <div class="booking-recovery__metric">
          <dt>До заповнення після скасування</dt>
          <dd>{{ formatDuration(summary.average_cancellation_to_refill_seconds) }}</dd>
          <p>Середній час від скасування до заповненого слота.</p>
        </div>
      </dl>
      <p class="booking-recovery__footnote">
        Поточний backend не повертає розбивки за майстром, послугою чи днем, а також кількість саме активних заявок — тому ці значення тут не припускаються.
      </p>
    </template>
  </BaseCard>
</template>

<style scoped>
.booking-recovery {
  border: 1px solid var(--bo-border);
  background: var(--bo-surface);
  color: var(--bo-text-primary);
}

.booking-recovery__header,
.booking-recovery__heading {
  display: flex;
  align-items: flex-start;
}

.booking-recovery__header {
  justify-content: space-between;
  gap: 1rem;
}

.booking-recovery__heading { gap: 0.75rem; }
.booking-recovery__icon { width: 1.25rem; height: 1.25rem; flex: none; margin-top: 0.125rem; color: var(--bo-accent); }
.booking-recovery__title { font-size: 1.125rem; font-weight: 650; line-height: 1.45; }
.booking-recovery__description { margin-top: 0.25rem; max-width: 48rem; font-size: 0.875rem; line-height: 1.5; color: var(--bo-text-secondary); }
.booking-recovery__grid { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 0.75rem; margin-top: 1rem; }
.booking-recovery__metric { min-height: 9rem; padding: 1rem; border: 1px solid var(--bo-border); border-radius: 1rem; background: var(--bo-surface-elevated); }
.booking-recovery__metric--accent { border-color: var(--bo-focus-border); }
.booking-recovery__metric--success { border-color: var(--bo-success); background: var(--bo-success-surface); }
.booking-recovery__metric dt { font-size: 0.875rem; color: var(--bo-text-secondary); }
.booking-recovery__metric dd { margin-top: 0.5rem; font-size: 1.5rem; line-height: 1.2; font-weight: 650; color: var(--bo-text-primary); }
.booking-recovery__metric p, .booking-recovery__footnote, .booking-recovery__notice-text { margin-top: 0.5rem; font-size: 0.75rem; line-height: 1.5; color: var(--bo-text-muted); }
.booking-recovery__notice { margin-top: 1rem; padding: 1rem; border: 1px solid var(--bo-warning); border-radius: 1rem; background: var(--bo-warning-surface); }
.booking-recovery__notice-title { font-weight: 650; color: var(--bo-warning-text); }
.booking-recovery__notice-text { color: var(--bo-warning-text); }
.booking-recovery__skeleton { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 0.75rem; margin-top: 1rem; }
.booking-recovery__skeleton-item { height: 9rem; border-radius: 1rem; background: var(--bo-surface-elevated); animation: booking-recovery-pulse 1.5s ease-in-out infinite; }
.booking-recovery__footnote { margin-top: 1rem; }

@media (min-width: 40rem) {
  .booking-recovery__grid, .booking-recovery__skeleton { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 80rem) {
  .booking-recovery__grid, .booking-recovery__skeleton { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 30rem) {
  .booking-recovery__header { flex-direction: column; }
}

@keyframes booking-recovery-pulse { 50% { opacity: 0.48; } }
</style>
