<script setup lang="ts">
import {
  ArrowUturnLeftIcon, BanknotesIcon, CheckCircleIcon, ChevronDownIcon, FunnelIcon,
  ClockIcon, ExclamationTriangleIcon, ListBulletIcon, MagnifyingGlassIcon, MinusCircleIcon, ReceiptPercentIcon,
  ShoppingBagIcon, XCircleIcon,
} from '@heroicons/vue/24/outline'
import type { Component } from 'vue'
import type { PosCheckout, PosPage, PosSaleSummary } from '~/types/posSale'
import { posExpiredClosure, posMoney } from '~/composables/usePosSale'

const props = defineProps<{ actorId: number; currentCheckoutId?: string; canResume: boolean; resumeError: string }>()
const emit = defineEmits<{ resume: [entry: PosSaleSummary] }>()
const api = useApi(), auth = useAuthStore()
const scopes = [
  { value: 'all', label: 'Усі', icon: ListBulletIcon },
  { value: 'active', label: 'В роботі', icon: ClockIcon },
  { value: 'completed', label: 'Завершені', icon: CheckCircleIcon },
  { value: 'cancelled', label: 'Скасовані', icon: XCircleIcon },
] as const
const sorts = [
  { value: 'newest', label: 'Спочатку нові' },
  { value: 'oldest', label: 'Спочатку давні' },
  { value: 'amount_desc', label: 'Від більшої суми' },
  { value: 'amount_asc', label: 'Від меншої суми' },
]
type HistoryFilters = { scope: (typeof scopes)[number]['value']; sort: string; q: string }
const defaultFilters: HistoryFilters = { scope: 'all', sort: 'newest', q: '' }
const filters = shallowRef(defaultFilters)
const draft = ref({ ...defaultFilters })
const filtersOpen = ref(false)
const activeFilters = computed(() => Number(filters.value.scope !== defaultFilters.scope)
  + Number(filters.value.sort !== defaultFilters.sort) + Number(Boolean(filters.value.q)))

const openFilters = (event: MouseEvent) => {
  if (event.currentTarget instanceof HTMLButtonElement) event.currentTarget.focus()
  draft.value = { ...filters.value }
  filtersOpen.value = true
}

const resetFilters = () => { draft.value = { ...defaultFilters } }

const applyFilters = () => {
  const next = { ...draft.value, q: draft.value.q.trim() }
  const current = filters.value
  filtersOpen.value = false
  if (next.scope !== current.scope || next.sort !== current.sort || next.q !== current.q) filters.value = next
}

const pageSize = 20
const rows = shallowRef<PosSaleSummary[]>([])
const page = ref(0), total = ref(0), loading = ref(false), error = ref('')
const notice = ref(''), noticeField = ref<HTMLElement | null>(null)
const selected = ref<number | null>(null), detail = shallowRef<PosCheckout | null>(null)
const detailLoading = ref(false), detailError = ref('')
let generation = 0, detailGeneration = 0

type StateMark = { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; icon: Component }
const payment = {
  not_started: { label: 'Не розпочато', tone: 'neutral', icon: MinusCircleIcon },
  pending: { label: 'Очікується', tone: 'info', icon: ClockIcon },
  processing: { label: 'В обробці', tone: 'info', icon: ClockIcon },
  paid: { label: 'Оплачено', tone: 'success', icon: CheckCircleIcon },
  failed: { label: 'Відхилено', tone: 'danger', icon: XCircleIcon },
  expired: { label: 'Прострочено', tone: 'neutral', icon: ClockIcon },
  reversed: { label: 'Сторновано', tone: 'danger', icon: ArrowUturnLeftIcon },
  unknown: { label: 'Потрібна звірка', tone: 'warning', icon: ExclamationTriangleIcon },
} satisfies Record<PosSaleSummary['payment_status'], StateMark>
const receipt = {
  not_requested: { label: 'Не запитано', tone: 'neutral', icon: MinusCircleIcon },
  pending: { label: 'Очікується', tone: 'warning', icon: ClockIcon },
  accepted: { label: 'Підтверджено', tone: 'success', icon: CheckCircleIcon },
  failed: { label: 'Помилка', tone: 'danger', icon: XCircleIcon },
  requires_review: { label: 'Потрібна звірка', tone: 'warning', icon: ExclamationTriangleIcon },
} satisfies Record<PosSaleSummary['receipt_status'], StateMark>
const handover = {
  not_ready: { label: 'Не готово', tone: 'neutral', icon: MinusCircleIcon },
  ready: { label: 'Можна видати', tone: 'info', icon: ShoppingBagIcon },
  handed_over: { label: 'Видано', tone: 'success', icon: CheckCircleIcon },
} satisfies Record<PosSaleSummary['handover_status'], StateMark>
const unknown: StateMark = { label: 'Немає даних', tone: 'neutral', icon: MinusCircleIcon }

const terminal = (entry: PosSaleSummary) => entry.order_status === 'completed' || entry.order_status === 'cancelled'
const scopeMatches = (entry: PosSaleSummary) => {
  const { scope } = filters.value
  return scope === 'all' || (scope === 'active' ? !terminal(entry) : entry.order_status === scope)
}
const outcome = (entry: PosSaleSummary): StateMark => {
  if (entry.order_status === 'cancelled') {
    return entry.payment_status === 'unknown' || entry.receipt_status === 'requires_review'
      ? { label: 'Скасовано · потрібна звірка', tone: 'warning', icon: ExclamationTriangleIcon }
      : { label: 'Скасовано', tone: 'neutral', icon: XCircleIcon }
  }
  if (entry.payment_status === 'failed' || entry.payment_status === 'reversed') return payment[entry.payment_status]
  if (entry.receipt_status === 'failed') return { label: 'Помилка чека', tone: 'danger', icon: XCircleIcon }
  if (entry.status === 'requires_review' || entry.receipt_status === 'requires_review' || entry.payment_status === 'unknown') {
    return { label: 'Потрібна звірка', tone: 'warning', icon: ExclamationTriangleIcon }
  }
  if (entry.order_status === 'completed' && entry.handover_status === 'handed_over') return { label: 'Завершено', tone: 'success', icon: CheckCircleIcon }
  if (entry.payment_status === 'paid') {
    if (entry.receipt_status === 'pending') return { label: 'Оплачено · очікуємо чек', tone: 'warning', icon: ClockIcon }
    if (entry.receipt_status === 'not_requested') return { label: 'Оплачено · чек не запитано', tone: 'warning', icon: ExclamationTriangleIcon }
    if (entry.handover_status === 'ready') return handover.ready
    if (entry.handover_status === 'handed_over') return handover.handed_over
    return { label: 'Оплачено · очікуємо видачу', tone: 'info', icon: ClockIcon }
  }
  if (entry.status === 'prepared' || entry.status === 'creating_invoice') return { label: 'Готується рахунок', tone: 'info', icon: ClockIcon }
  return { label: 'Очікуємо оплату', tone: 'info', icon: ClockIcon }
}

const cards = computed(() => rows.value.map(entry => ({
  entry,
  mark: outcome(entry),
  stages: [
    { ...(payment[entry.payment_status] ?? unknown), categoryIcon: BanknotesIcon, title: 'Оплата' },
    { ...(receipt[entry.receipt_status] ?? unknown), categoryIcon: ReceiptPercentIcon, title: 'Чек Checkbox' },
    { ...(handover[entry.handover_status] ?? unknown), categoryIcon: ShoppingBagIcon, title: 'Видача' },
  ],
})))
const date = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })

const load = async (next = 1) => {
  if (loading.value) return
  const v = generation
  loading.value = true
  error.value = ''
  try {
    const result = await api<PosPage<PosSaleSummary>>('/backoffice/pos/my-sales', {
      query: { scope: filters.value.scope, sort: filters.value.sort, q: filters.value.q || undefined, page: next, page_size: pageSize },
      retry: 0,
      cache: 'no-store',
    })
    if (v !== generation) return
    if (result.page !== next || !Array.isArray(result.items) || result.items.some(entry => entry.employee?.user_id !== props.actorId)) {
      throw new Error('Invalid personal sales history')
    }
    const entries = new Map((next === 1 ? [] : rows.value).map(entry => [entry.order_id, entry]))
    for (const entry of result.items) entries.set(entry.order_id, entry)
    rows.value = [...entries.values()]
    total.value = result.total
    page.value = next
  } catch {
    if (v === generation) error.value = 'Не вдалося завантажити мої продажі. Спробуйте ще раз.'
  } finally {
    if (v === generation) loading.value = false
  }
}

const reload = () => {
  generation++
  detailGeneration++
  rows.value = []
  page.value = 0
  total.value = 0
  loading.value = false
  selected.value = null
  detail.value = null
  detailError.value = ''
  detailLoading.value = false
  notice.value = ''
  void load()
}

const open = async (entry: PosSaleSummary) => {
  const v = ++detailGeneration
  detail.value = null; detailError.value = ''; detailLoading.value = false
  if (selected.value === entry.order_id) { selected.value = null; return }
  selected.value = entry.order_id
  if (!entry.checkout_id) return
  detailLoading.value = true
  try {
    const value = await api<PosCheckout>(`/backoffice/pos/checkouts/${entry.checkout_id}`, { retry: 0, cache: 'no-store' })
    if (v !== detailGeneration) return
    if (value.order_id !== entry.order_id || value.checkout_id !== entry.checkout_id
        || value.intent_id !== entry.intent_id || value.employee?.user_id !== props.actorId) throw new Error('Foreign sale')
    detail.value = value
    const latest = { ...entry, status: value.status, order_status: value.order_status, payment_status: value.payment.status,
      receipt_status: value.receipt.status, handover_status: value.handover.status }
    if (!scopeMatches(latest)) {
      const focused = document.activeElement
      const focusedCard = focused?.closest('[data-pos-history-card]')
      reload()
      notice.value = `Продаж #${entry.order_id}: ${outcome(latest).label}. Список оновлено.`
      await nextTick()
      const active = document.activeElement
      if (!filtersOpen.value && focusedCard && !focused?.isConnected
        && (!active || active === document.body || active === document.documentElement)) {
        noticeField.value?.focus()
      }
    } else {
      rows.value = rows.value.map(row => row.order_id === entry.order_id ? latest : row)
    }
  } catch {
    if (v === detailGeneration) detailError.value = 'Не вдалося перечитати стан продажу.'
  } finally {
    if (v === detailGeneration) detailLoading.value = false
  }
}

watch([() => props.actorId, () => auth.sessionRevision, filters], reload, { immediate: true, flush: 'sync' })
onScopeDispose(() => { generation++; detailGeneration++ })
</script>

<template>
  <BaseCard as="section" aria-label="Мої продажі" padding="sm" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <BaseButton type="button" variant="neutral" size="lg" class="!px-3" aria-haspopup="dialog"
        :aria-expanded="filtersOpen" :aria-label="activeFilters ? `Фільтри, застосовано ${activeFilters}` : undefined" @click="openFilters">
        <FunnelIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
        Фільтри
        <BaseBadge v-if="activeFilters" tone="accent" aria-hidden="true">{{ activeFilters }}</BaseBadge>
      </BaseButton>
      <p v-if="rows.length" aria-live="polite" class="text-xs text-ui-secondary">Показано {{ rows.length }} з {{ total }}</p>
    </div>
    <BaseModal v-model="filtersOpen" compact max-width-class="max-w-md" aria-label="Фільтри продажів">
      <template #head="{ close }">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">Фільтри продажів</h2>
          <ModalCloseButton class="!min-h-11 !min-w-11" @click="close" />
        </div>
      </template>
      <template #body>
        <form class="space-y-4" @submit.prevent="applyFilters">
          <BaseInput v-model="draft.q" type="search" label="Пошук продажів" placeholder="Товар, артикул, №"
            maxlength="120" autocomplete="off" input-class="base-control px-3 py-2 text-base">
            <template #icon><MagnifyingGlassIcon class="h-4 w-4" aria-hidden="true" /></template>
          </BaseInput>
          <fieldset class="space-y-1.5">
            <legend class="text-sm font-medium">Статус продажу</legend>
            <div class="grid grid-cols-2 gap-1.5">
              <BaseButton v-for="option in scopes" :key="option.value" type="button" size="lg"
                :variant="draft.scope === option.value ? 'outline' : 'ghost'"
                :aria-pressed="draft.scope === option.value" class="!gap-1.5 !px-2" @click="draft.scope = option.value">
                <component :is="option.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />{{ option.label }}
              </BaseButton>
            </div>
          </fieldset>
          <BaseSelect v-model="draft.sort" label="Сортування" :options="sorts" inline-menu />
          <div class="grid grid-cols-2 gap-2 border-t border-ui pt-3">
            <BaseButton type="button" variant="neutral" size="lg" class="!px-2" @click="resetFilters">Скинути</BaseButton>
            <BaseButton type="submit" variant="primary" size="lg" class="pos-history-apply !px-2">Застосувати</BaseButton>
          </div>
        </form>
      </template>
    </BaseModal>

    <p v-if="notice" ref="noticeField" role="status" tabindex="-1" class="rounded-lg border border-ui p-2 text-sm text-ui-secondary">{{ notice }}</p>
    <BaseLoader v-if="loading && !rows.length" label="Завантажуємо мої продажі" />
    <p v-if="error" role="alert" class="text-sm text-ui-warning">{{ error }}</p>
    <BaseButton v-if="error" type="button" variant="neutral" size="lg" @click="load(page + 1)">Спробувати ще раз</BaseButton>
    <BaseEmptyState v-if="!error && !loading && !rows.length" :title="filters.scope !== defaultFilters.scope || filters.q ? 'За цими умовами продажів немає' : 'Продажів поки немає'" compact />

    <BaseCard v-for="{ entry, mark, stages } in cards" :key="entry.order_id" as="article" padding="sm" class="history-card space-y-2.5 !rounded-xl" :data-tone="mark.tone" data-pos-history-card>
      <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="history-card-icon grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui text-ui-primary">
            <component :is="mark.icon" class="h-5 w-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <h2 class="break-words text-sm font-semibold">Продаж #{{ entry.order_id }}</h2>
            <p class="text-xs text-ui-secondary">{{ date.format(new Date(entry.created_at)) }}<span v-if="entry.checkout_id && entry.checkout_id === currentCheckoutId"> · Поточний</span></p>
          </div>
        </div>
        <p class="shrink-0 text-sm font-semibold tabular-nums sm:text-base">{{ posMoney(entry.amount_minor) }}</p>
      </div>
      <p class="flex items-start gap-2 text-sm text-ui-secondary">
        <ShoppingBagIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span class="min-w-0 break-words">{{ entry.items.map(item => item.name + ' × ' + item.quantity).join(', ') }}</span>
      </p>
      <BaseBadge :tone="mark.tone" class="max-w-full !whitespace-normal">{{ mark.label }}</BaseBadge>
      <dl class="grid gap-1 min-[520px]:grid-cols-3 min-[520px]:gap-1.5">
        <div v-for="stage in stages" :key="stage.title" class="history-stage flex min-w-0 items-center justify-between gap-1.5 rounded-lg border border-ui px-2 py-1.5 min-[520px]:block">
          <dt class="flex min-w-0 items-center gap-1 text-xs text-ui-secondary">
            <component :is="stage.categoryIcon" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{{ stage.title }}
          </dt>
          <dd class="history-stage-value flex min-w-0 items-center gap-1 text-xs font-semibold min-[520px]:mt-1" :data-tone="stage.tone">
            <component :is="stage.icon" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span class="min-w-0 [overflow-wrap:anywhere]">{{ stage.label }}</span>
          </dd>
        </div>
      </dl>
      <div v-if="entry.checkout_id" class="flex justify-end border-t border-ui pt-0.5">
        <BaseButton type="button" variant="ghost" size="lg" :aria-label="'Деталі продажу #' + entry.order_id" :aria-expanded="selected === entry.order_id" @click="open(entry)">
          Деталі<ChevronDownIcon class="h-4 w-4" :class="{ 'rotate-180': selected === entry.order_id }" aria-hidden="true" />
        </BaseButton>
      </div>
      <div v-if="selected === entry.order_id" class="space-y-2 border-t border-ui pt-2">
        <BaseLoader v-if="detailLoading" label="Перечитуємо продаж" />
        <p v-if="detailError" role="alert" class="text-sm text-ui-warning">{{ detailError }}</p>
        <p v-if="detail && posExpiredClosure(detail)" class="text-sm text-ui-secondary">Рахунок прострочено, оплату не отримано.</p>
        <p v-else-if="detail?.blocking_reasons.includes('master_mono_closed_conflict')" class="text-sm text-ui-warning">Нові дані про оплату потребують звірки.</p>
        <p v-if="resumeError" role="alert" class="text-sm text-ui-warning">{{ resumeError }}</p>
        <BaseButton v-if="detail && !terminal(entry)" type="button" variant="neutral" size="lg" block :disabled="!canResume && entry.checkout_id !== currentCheckoutId" @click="emit('resume', entry)">Продовжити цей продаж</BaseButton>
        <p v-if="detail && !terminal(entry) && !canResume && entry.checkout_id !== currentCheckoutId" class="text-xs text-ui-secondary">Спочатку завершіть дію з поточним продажем або звільніть кошик.</p>
      </div>
    </BaseCard>
    <BaseButton v-if="!error && page > 0 && page * pageSize < total" type="button" variant="neutral" size="lg" block :loading="loading" @click="load(page + 1)">Показати ще</BaseButton>
  </BaseCard>
</template>

<style scoped>
html:not([data-backoffice-theme='light']) .pos-history-apply {
  --bo-on-action: var(--bo-page);
}
.history-card {
  --sale-accent: var(--bo-info);
  background: linear-gradient(135deg, color-mix(in srgb, var(--sale-accent) 8%, var(--bo-surface)), var(--bo-surface) 72%);
  box-shadow: none;
}
.history-card[data-tone='neutral'] { --sale-accent: var(--bo-text-secondary); }
.history-card[data-tone='success'] { --sale-accent: var(--bo-success); }
.history-card[data-tone='warning'] { --sale-accent: var(--bo-warning); }
.history-card[data-tone='danger'] { --sale-accent: var(--bo-danger); }
.history-card-icon { background: color-mix(in srgb, var(--sale-accent) 12%, var(--bo-surface)); }
.history-stage { background: color-mix(in srgb, var(--bo-text-primary) 3%, var(--bo-surface)); }
.history-stage-value[data-tone='success'] { color: var(--bo-success-text); }
.history-stage-value[data-tone='warning'] { color: var(--bo-warning-text); }
.history-stage-value[data-tone='danger'] { color: var(--bo-danger-text); }
.history-stage-value[data-tone='info'] { color: var(--bo-info-text); }

@media (prefers-contrast: more), (prefers-reduced-transparency: reduce), (forced-colors: active) {
  .history-card, .history-card-icon, .history-stage { background: var(--bo-surface); }
}
</style>
