<script setup lang="ts">
import { noSlotActivity, noSlotDateRange, noSlotServices, parseNoSlotPage, type NoSlotAttempt, type NoSlotCheck, type NoSlotPage } from '~/utils/bookingNoSlots'
const props = defineProps<{
  attempt?: NoSlotAttempt
  number?: number
  unattributedObservations?: number
  masterId: number | null
  dateFrom: string
  dateTo: string
  snapshotId: number
}>()
const api = useApi()
const open = ref(false)
const loading = ref(false)
const error = ref(false)
const page = ref<NoSlotPage<NoSlotCheck> | null>(null)
const checks = ref<NoSlotCheck[]>([])
const detailsId = useId()
const load = async () => {
  if (loading.value) return
  loading.value = true
  error.value = false
  try {
    const response = await api<unknown>('/backoffice/statistics/admin/booking-no-slots', { query: {
      date_from: props.dateFrom, date_to: props.dateTo, master_id: props.masterId ?? undefined,
      unknown_master: props.masterId === null ? true : undefined,
      attempt_id: props.attempt?.attempt_id, unattributed: props.attempt ? undefined : true,
      snapshot_id: props.snapshotId, offset: checks.value.length, limit: 10,
    } })
    const next = parseNoSlotPage<NoSlotCheck>(response, 'checks')
    if (next.offset !== checks.value.length || next.snapshot_id !== props.snapshotId) throw new Error('Unexpected page')
    checks.value.push(...next.items)
    page.value = next
  } catch { error.value = true }
  finally { loading.value = false }
}
const toggle = () => {
  open.value = !open.value
  if (open.value && !page.value) void load()
}
</script>

<template>
  <article class="attempt border-b py-4" data-testid="no-slot-attempt">
    <template v-if="attempt">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h5 class="font-semibold text-ui-primary">Анонімна спроба {{ number }}</h5>
      <p class="text-sm tabular-nums text-ui-secondary">{{ attempt.observations }} перевірок · {{ attempt.contexts }} контексти</p>
    </div>
    <dl class="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
      <div><dt class="text-ui-muted">Послуги та тривалість</dt><dd class="mt-1 text-ui-secondary">{{ noSlotServices(attempt.services) }} · {{ attempt.durations_minutes.length ? `${attempt.durations_minutes.join(' / ')} хв` : 'Тривалість невідома' }}</dd></div>
      <div><dt class="text-ui-muted">Бажані дати: {{ attempt.checked_dates }}</dt><dd class="mt-1 text-ui-secondary">{{ noSlotDateRange(attempt.date_from, attempt.date_to) }}</dd></div>
      <div><dt class="text-ui-muted">Перша перевірка без слотів</dt><dd class="mt-1 text-ui-secondary"><time :datetime="attempt.first_observed_at">{{ noSlotActivity(attempt.first_observed_at) }}</time></dd></div>
      <div><dt class="text-ui-muted">Остання перевірка без слотів</dt><dd class="mt-1 text-ui-secondary"><time :datetime="attempt.last_observed_at">{{ noSlotActivity(attempt.last_observed_at) }}</time></dd></div>
    </dl>
    <ul class="mt-3 flex flex-wrap gap-2 text-xs text-ui-secondary" aria-label="Пізніші дії сесії">
      <li class="rounded-lg border px-2 py-1">{{ attempt.later_time_selection ? 'Пізніше вибрано час' : 'Пізнішого вибору часу не зафіксовано' }}</li>
      <li v-if="attempt.later_booking_same_master" class="rounded-lg border px-2 py-1">Пізніше записано до цього майстра</li>
      <li v-if="attempt.later_booking_other_master" class="rounded-lg border px-2 py-1">Пізніше записано до іншого майстра</li>
      <li v-if="attempt.later_booking_unknown_master" class="rounded-lg border px-2 py-1">Пізніше записано — майстра не визначено</li>
      <li v-if="!attempt.later_booking_same_master && !attempt.later_booking_other_master && !attempt.later_booking_unknown_master" class="rounded-lg border px-2 py-1">Пізнішого запису в цій сесії не зафіксовано</li>
    </ul>
    <p v-if="attempt.rapid_checks" class="mt-2 text-xs leading-5 text-ui-muted">{{ attempt.rapid_checks }} послідовних перевірок з інтервалом до 10 секунд. Це сигнал темпу перевірок, не висновок про їхню причину.</p>
    </template>
    <h5 v-else class="text-sm font-semibold text-ui-primary">Перевірки без ідентифікатора сесії · {{ unattributedObservations }}</h5>
    <button type="button" class="attempt__button mt-3 rounded-lg border px-3 py-2 text-xs" :aria-expanded="open" :aria-controls="detailsId" @click="toggle">
      {{ open ? 'Сховати перевірки' : 'Переглянути перевірки' }}
    </button>
    <div v-if="open" :id="detailsId" class="mt-3" :aria-busy="loading">
      <ol class="grid gap-2" aria-label="Історичні перевірки">
        <li v-for="(check, index) in checks" :key="index" class="rounded-lg border p-3 text-xs text-ui-secondary" data-testid="no-slot-check">
          <p class="font-medium text-ui-primary">Бажана дата: {{ noSlotDateRange(check.target_date, check.target_date) }}</p>
          <p class="mt-1">{{ noSlotServices(check.services) }} · {{ check.duration_minutes ? `${check.duration_minutes} хв` : 'Тривалість невідома' }}</p>
          <p class="mt-1">Перевірено <time :datetime="check.observed_at">{{ noSlotActivity(check.observed_at) }}</time> · 0 слотів</p>
        </li>
      </ol>
      <p v-if="loading" role="status" class="mt-3 text-xs text-ui-muted">Завантаження перевірок…</p>
      <div v-else-if="error" role="alert" class="mt-3 text-xs text-ui-secondary">Не вдалося завантажити перевірки. <button type="button" class="attempt__button underline" @click="load">Повторити</button></div>
      <template v-else-if="page">
        <p class="mt-3 text-xs text-ui-muted">Показано {{ checks.length }} із {{ page.total }} перевірок. Підсумки враховують усі перевірки.</p>
        <p v-if="page.total !== (attempt?.observations ?? unattributedObservations)" role="status" class="mt-2 text-xs text-ui-secondary">Деталі не узгоджені зі зведенням. Оновіть дашборд.</p>
        <button v-if="page.has_more" type="button" class="attempt__button mt-2 rounded-lg border px-3 py-2 text-xs" @click="load">Показати ще перевірки</button>
      </template>
    </div>
  </article>
</template>

<style scoped>
.attempt, .attempt .border { border-color: var(--border); }
.attempt__button { min-height: 2.75rem; color: var(--text-primary); }
.attempt__button:hover { background: var(--glass-hover); }
.attempt__button:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 3px; }
</style>
