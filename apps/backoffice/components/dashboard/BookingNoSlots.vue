<script setup lang="ts">
import type { DashboardNoSlotMaster } from '~/utils/adminDashboardContract'
import { noSlotActivity, noSlotDateRange, parseNoSlotPage, type NoSlotAttempt, type NoSlotPage } from '~/utils/bookingNoSlots'

const props = defineProps<{
  masters?: DashboardNoSlotMaster[]
  dateFrom: string
  dateTo: string
  unknownDateCount?: number
  loading?: boolean
  snapshotId?: number | null
}>()
const api = useApi()
type MasterState = { open: boolean; loading: boolean; error: boolean; page: NoSlotPage<NoSlotAttempt> | null; offset: number }
const states = reactive<Record<string, MasterState>>({})
const key = (master: DashboardNoSlotMaster) => String(master.master_id ?? 'unknown')
const name = (master: DashboardNoSlotMaster) => master.master_name || (master.master_id ? `Майстер #${master.master_id}` : 'Майстра не визначено')
let generation = 0
watch(() => [props.masters, props.dateFrom, props.dateTo, props.snapshotId], () => {
  generation++
  for (const id of Object.keys(states)) delete states[id]
})
const load = async (master: DashboardNoSlotMaster, offset = 0) => {
  const state = states[key(master)]
  if (!state || state.loading) return
  const current = generation
  state.loading = true
  state.error = false
  state.offset = offset
  try {
    const response = await api<unknown>('/backoffice/statistics/admin/booking-no-slots', { query: {
      date_from: props.dateFrom, date_to: props.dateTo,
      master_id: master.master_id ?? undefined, unknown_master: master.master_id === null ? true : undefined,
      offset, limit: 10,
      snapshot_id: state.page?.snapshot_id ?? props.snapshotId ?? undefined,
    } })
    const page = parseNoSlotPage<NoSlotAttempt>(response, 'attempts')
    if (page.offset !== offset) throw new Error('Unexpected page')
    const expectedSnapshot = state.page?.snapshot_id ?? props.snapshotId
    if (expectedSnapshot !== undefined && expectedSnapshot !== null && page.snapshot_id !== expectedSnapshot) throw new Error('Unexpected snapshot')
    if (current === generation) state.page = page
  } catch {
    if (current === generation) state.error = true
  } finally {
    if (current === generation) state.loading = false
  }
}
const toggle = (master: DashboardNoSlotMaster) => {
  const id = key(master)
  const state = states[id] ?? (states[id] = { open: false, loading: false, error: false, page: null, offset: 0 })
  state.open = !state.open
  if (state.open && !state.page && !state.loading) void load(master)
}
</script>

<template>
  <section class="no-slots mt-5 rounded-2xl border" aria-labelledby="no-slots-title">
    <div class="p-4">
      <h3 id="no-slots-title" class="text-sm font-semibold text-ui-primary">Історичні пошуки без доступних слотів</h3>
      <p class="mt-2 text-xs leading-5 text-ui-secondary">
        Сесії — анонімні спроби запису, а не унікальні люди чи втрачені клієнти. Перевірки — спостереження доступності, а не клієнти.
        Контекст — поєднання бажаної дати, майстра, послуг і тривалості. Історичний результат «0 слотів» не описує доступність зараз.
      </p>
      <p class="mt-1 text-xs leading-5 text-ui-muted">
        Період фільтрує час перевірки (Europe/Kyiv), а не бажану дату запису. Сесії дедупліковано за весь період для кожного майстра;
        їх не можна підсумовувати між майстрами. Пізніші дії тієї самої сесії можуть бути за межами періоду.
      </p>
    </div>
    <p v-if="loading" role="status" class="px-4 pb-4 text-sm text-ui-muted">Завантаження історії перевірок…</p>
    <p v-else-if="masters === undefined" role="status" class="ui-status-warning mx-4 mb-4 rounded-xl p-3 text-sm">
      Повна зведена історія недоступна. Обмежений список контекстів не дозволяє точно порахувати сесії. Оновіть дані або повторіть спробу пізніше.
    </p>
    <p v-else-if="!masters.length" class="px-4 pb-4 text-sm text-ui-muted">За вибраними фільтрами перевірок без слотів немає.</p>
    <template v-else>
      <div class="hidden grid-cols-[1.2fr_1fr_1.3fr_1fr_auto] gap-4 border-t px-4 py-2 text-xs text-ui-muted lg:grid" aria-hidden="true">
        <span>Майстер</span><span>Сесії та перевірки</span><span>Бажані дати</span><span>Остання активність</span><span>Деталі</span>
      </div>
      <article v-for="master in masters" :key="key(master)" class="border-t" data-testid="no-slot-master">
        <div class="grid min-w-0 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.3fr_1fr_auto] lg:items-center">
          <h4 class="font-semibold text-ui-primary">{{ name(master) }}</h4>
          <div>
            <p class="text-lg font-semibold tabular-nums text-ui-primary">{{ master.unique_sessions }} <span class="text-sm font-normal">сесії</span></p>
            <p class="text-xs text-ui-secondary">{{ master.observations }} перевірок · {{ master.contexts }} контексти</p>
          </div>
          <div class="text-sm text-ui-secondary"><p>{{ master.checked_dates }} бажаних дат</p><p class="text-xs">{{ noSlotDateRange(master.date_from, master.date_to) }}</p></div>
          <p class="text-xs text-ui-secondary"><span class="block text-ui-muted lg:hidden">Остання активність</span><time :datetime="master.last_observed_at">{{ noSlotActivity(master.last_observed_at) }}</time></p>
          <button type="button" class="no-slots__button justify-self-start rounded-lg border px-3 py-2 text-sm"
            :aria-expanded="states[key(master)]?.open ?? false" :aria-controls="`no-slot-master-${key(master)}`"
            :aria-label="`${states[key(master)]?.open ? 'Згорнути' : 'Розгорнути'} спроби: ${name(master)}`" @click="toggle(master)">
            {{ states[key(master)]?.open ? 'Згорнути' : 'Спроби' }}
          </button>
        </div>
        <div v-if="states[key(master)]?.open" :id="`no-slot-master-${key(master)}`" class="border-t px-4 py-3" :aria-busy="states[key(master)]?.loading">
          <p v-if="master.unattributed_observations" class="mb-3 text-xs text-ui-secondary">{{ master.unattributed_observations }} перевірок без ідентифікатора сесії; вони не включені до кількості сесій.</p>
          <p v-if="states[key(master)]?.loading" role="status" class="py-3 text-sm text-ui-muted">Завантаження спроб…</p>
          <div v-else-if="states[key(master)]?.error" role="alert" class="py-3 text-sm text-ui-secondary">
            Не вдалося завантажити спроби.
            <button type="button" class="no-slots__button ml-2 underline" @click="load(master, states[key(master)]?.offset)">Повторити</button>
          </div>
          <template v-else-if="states[key(master)]?.page">
            <DashboardBookingNoSlotAttempt v-if="master.unattributed_observations" :unattributed-observations="master.unattributed_observations"
              :master-id="master.master_id" :date-from="dateFrom" :date-to="dateTo" :snapshot-id="states[key(master)]!.page!.snapshot_id" />
            <p v-if="states[key(master)]!.page!.total !== master.unique_sessions" role="status" class="ui-status-warning mb-3 rounded-lg p-2 text-xs">
              Історія змінилася після завантаження зведення. Оновіть дашборд для узгоджених підсумків.
            </p>
            <p v-if="!states[key(master)]!.page!.items.length" class="text-sm text-ui-muted">Анонімних спроб для цієї сторінки немає.</p>
            <DashboardBookingNoSlotAttempt v-for="(attempt, index) in states[key(master)]!.page!.items" :key="attempt.attempt_id"
              :attempt="attempt" :number="states[key(master)]!.page!.offset + index + 1" :master-id="master.master_id" :date-from="dateFrom" :date-to="dateTo" :snapshot-id="states[key(master)]!.page!.snapshot_id" />
            <nav v-if="states[key(master)]!.page!.total" class="mt-3 flex flex-wrap items-center gap-3 text-xs text-ui-secondary" aria-label="Сторінки анонімних спроб">
              <span>Показано {{ states[key(master)]!.page!.offset + 1 }}–{{ states[key(master)]!.page!.offset + states[key(master)]!.page!.items.length }} із {{ states[key(master)]!.page!.total }} сесій. Зведення враховує весь період.</span>
              <button v-if="states[key(master)]!.page!.offset > 0" type="button" class="no-slots__button rounded-lg border px-3 py-2" @click="load(master, Math.max(0, states[key(master)]!.page!.offset - 10))">Попередні спроби</button>
              <button v-if="states[key(master)]!.page!.has_more" type="button" class="no-slots__button rounded-lg border px-3 py-2" @click="load(master, states[key(master)]!.page!.offset + 10)">Наступні спроби</button>
            </nav>
          </template>
        </div>
      </article>
    </template>
    <p v-if="unknownDateCount" class="border-t p-4 text-xs text-ui-muted">У {{ unknownDateCount }} історичних перевірках бажану дату не визначено.</p>
  </section>
</template>

<style scoped>
.no-slots { background: var(--glass); border-color: var(--border); }
.no-slots :deep(.border-t), .no-slots :deep(button.border) { border-color: var(--border); }
.no-slots__button { color: var(--text-primary); min-height: 2.75rem; }
.no-slots__button:hover { background: var(--glass-hover); }
.no-slots__button:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 3px; }
</style>
