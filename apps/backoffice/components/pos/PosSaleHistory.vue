<script setup lang="ts">
import { ClockIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import type { PosCheckout, PosPage, PosSaleSummary } from '~/types/posSale'
import { posExpiredClosure, posMoney } from '~/composables/usePosSale'

const props = defineProps<{ actorId: number; currentCheckoutId?: string; canResume: boolean; resumeError: string }>()
const emit = defineEmits<{ resume: [entry: PosSaleSummary] }>()
const api = useApi(), auth = useAuthStore()
const rows = shallowRef<PosSaleSummary[]>([])
const page = ref(0), total = ref(0), loading = ref(false), error = ref('')
const selected = ref<number | null>(null), detail = shallowRef<PosCheckout | null>(null)
const detailLoading = ref(false), detailError = ref('')
let generation = 0, detailGeneration = 0

const terminal = (entry: PosSaleSummary) => ['completed', 'cancelled'].includes(entry.order_status)
const sections = computed(() => [
  { title: 'Незавершені', rows: rows.value.filter(entry => !terminal(entry)) },
  { title: 'Завершені та скасовані', rows: rows.value.filter(terminal) },
])
const stateText = (entry: PosSaleSummary) => {
  if (entry.order_status === 'cancelled') return entry.payment_status === 'unknown' ? 'Скасовано · потребує звірки' : 'Скасовано'
  if (entry.order_status === 'completed') return 'Завершено'
  if (entry.handover_status === 'ready') return 'Можна видати'
  if (entry.payment_status === 'paid') return 'Оплачено'
  if (entry.status === 'requires_review') return 'Потребує перевірки'
  if (entry.status === 'prepared' || entry.status === 'creating_invoice') return 'Готується рахунок'
  return 'Очікує оплати'
}
const date = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })

const load = async (next = 1) => {
  if (loading.value) return
  const v = generation
  loading.value = true; error.value = ''
  try {
    const result = await api<PosPage<PosSaleSummary>>('/backoffice/pos/my-sales', {
      query: { page: next, page_size: 20 }, retry: 0, cache: 'no-store',
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
    rows.value = rows.value.map(row => row.order_id === entry.order_id ? {
      ...row, status: value.status, order_status: value.order_status, payment_status: value.payment.status,
      receipt_status: value.receipt.status, handover_status: value.handover.status,
    } : row)
  } catch {
    if (v === detailGeneration) detailError.value = 'Не вдалося перечитати стан продажу.'
  } finally {
    if (v === detailGeneration) detailLoading.value = false
  }
}
watch(() => [props.actorId, auth.sessionRevision], () => {
  generation++; detailGeneration++
  rows.value = []; page.value = 0; total.value = 0; loading.value = false; selected.value = null; detail.value = null
  void load()
}, { immediate: true, flush: 'sync' })
onScopeDispose(() => { generation++; detailGeneration++ })
</script>

<template>
  <BaseCard as="section" aria-label="Мої продажі" padding="sm" class="space-y-3">
    <BaseLoader v-if="loading && !rows.length" label="Завантажуємо мої продажі" />
    <p v-if="error" role="alert" class="text-sm text-ui-warning">{{ error }}</p>
    <BaseButton v-if="error" type="button" variant="neutral" size="lg" @click="load(page ? page + 1 : 1)">Спробувати ще раз</BaseButton>
    <BaseEmptyState v-if="!error && !loading && !rows.length" title="Продажів поки немає" compact />
    <section v-for="section in sections.filter(group => group.rows.length)" :key="section.title" class="space-y-1.5">
      <h2 class="flex items-center gap-2 text-base font-semibold"><ClockIcon class="h-4 w-4 text-ui-secondary" aria-hidden="true" />{{ section.title }}</h2>
      <BaseCard v-for="entry in section.rows" :key="entry.order_id" as="article" variant="subtle" padding="sm" class="space-y-1.5 !rounded-xl">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="break-words text-sm font-semibold">Продаж #{{ entry.order_id }}</h3>
            <p class="text-xs text-ui-secondary">{{ date.format(new Date(entry.created_at)) }}<span v-if="entry.checkout_id === currentCheckoutId"> · Поточний</span></p>
          </div>
          <p class="shrink-0 text-sm font-semibold tabular-nums">{{ posMoney(entry.amount_minor) }}</p>
        </div>
        <p class="break-words text-sm text-ui-secondary">{{ entry.items.map(item => item.name + ' × ' + item.quantity).join(', ') }}</p>
        <div class="flex flex-wrap items-center justify-between gap-1">
          <BaseBadge :tone="entry.order_status === 'completed' ? 'success' : entry.status === 'requires_review' && (!terminal(entry) || entry.payment_status === 'unknown') ? 'warning' : 'neutral'">{{ stateText(entry) }}</BaseBadge>
          <BaseButton v-if="entry.checkout_id" type="button" variant="ghost" size="lg" :aria-label="'Деталі продажу #' + entry.order_id" :aria-expanded="selected === entry.order_id" @click="open(entry)">Деталі<ChevronDownIcon class="h-4 w-4" aria-hidden="true" /></BaseButton>
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
    </section>
    <BaseButton v-if="!error && rows.length < total" type="button" variant="ghost" size="lg" :loading="loading" @click="load(page + 1)">Показати ще</BaseButton>
  </BaseCard>
</template>
