<script setup lang="ts">
import type { ExternalFiscalReport } from '~/utils/shopFiscal'

const statuses = {
  unavailable: 'Дані зміни недоступні',
  missing: 'Звіт зміни відсутній',
  invalid: 'Звіт не пройшов перевірку',
  conflict: 'Дані суперечать чекам замовлення',
  partial: 'Збіг неповний',
  matched: 'Чеки замовлення збігаються',
  not_applicable: 'Звірка не застосовується',
}
interface ShiftEvidence {
  kind: 'x' | 'z'
  report_id: string
  authority: 'test'
  scope: 'provider_cash_register_shift'
  currency: 'UAH'
  reported_at: string
  shift_sale_minor: number
  shift_return_minor: number
}
interface Comparison {
  status: keyof typeof statuses
  reports: ShiftEvidence[]
  missing_receipt_ids: string[]
}
interface Reconciliation {
  order_id: number
  revision: number
  local_status: 'not_applicable' | 'sale_unresolved' | 'projected'
  local_projection: ExternalFiscalReport | null
  refund_status: 'none' | 'unresolved' | 'finalized'
  provider_x: Comparison
  provider_z: Comparison
}

const props = defineProps<{ orderId: number, revision?: number, refreshToken?: number }>()
const api = useApi({ refreshOnUnauthorized: false })
const auth = useAuthStore()
const { formatMoney, formatDateTime } = useBookingFormatting()
const state = shallowRef<Reconciliation | null>(null)
const loading = ref(false), error = ref('')
const scope = () => JSON.stringify([props.orderId, props.revision, props.refreshToken, auth.user?.id, auth.sessionRevision])
let generation = 0
const comparisons = computed(() => state.value ? [
  { label: 'X', value: state.value.provider_x }, { label: 'Z', value: state.value.provider_z },
] : [])
const validAmount = (amount: unknown): amount is number => Number.isSafeInteger(amount) && Number(amount) >= 0
const validComparison = (comparison: Comparison, kind: ShiftEvidence['kind']) => {
  if (!comparison || !Object.hasOwn(statuses, comparison.status)
    || !Array.isArray(comparison.reports) || !Array.isArray(comparison.missing_receipt_ids)) return false

  if (comparison.status !== 'partial' && comparison.status !== 'matched') {
    return comparison.reports.length === 0 && comparison.missing_receipt_ids.length === 0
  }

  return comparison.reports.length >= 1 && comparison.reports.length <= 2
    && new Set(comparison.reports.map(report => report?.report_id)).size === comparison.reports.length
    && (comparison.status === 'partial') === (comparison.missing_receipt_ids.length > 0)
    && comparison.reports.every(report => report?.kind === kind && typeof report.report_id === 'string' && report.report_id.length > 0
      && report.authority === 'test' && report.scope === 'provider_cash_register_shift'
      && report.currency === 'UAH' && Number.isFinite(Date.parse(report.reported_at))
      && validAmount(report.shift_sale_minor) && validAmount(report.shift_return_minor))
}
const load = async () => {
  if (!auth.user?.id || loading.value) return
  const started = ++generation, id = props.orderId, context = scope()
  const current = () => started === generation && context === scope()
  state.value = null; loading.value = true; error.value = ''
  try {
    const value = await api<Reconciliation>(`/backoffice/shop-external-fiscal-reports/orders/${id}`, { method: 'GET', retry: 0 })
    if (!current()) return
    if (value?.order_id !== id || !Number.isSafeInteger(value.revision) || !validComparison(value.provider_x, 'x') || !validComparison(value.provider_z, 'z')
      || !['not_applicable', 'sale_unresolved', 'projected'].includes(value.local_status)
      || !['none', 'unresolved', 'finalized'].includes(value.refund_status)
      || (value.local_status === 'projected') !== !!value.local_projection
      || (value.local_projection && (value.local_projection.issuer !== 'mono_checkbox_external' || value.local_projection.currency !== 'UAH'
        || !validAmount(value.local_projection.net_minor)))) throw new Error('Invalid reconciliation')
    state.value = value
  } catch (cause) {
    if (!current()) return
    const failure = cause as { statusCode?: number, response?: { status?: number } }
    error.value = (failure.response?.status ?? failure.statusCode) === 403
      ? 'Немає дозволу на перегляд звірки.' : 'Не вдалося отримати дані звірки.'
  } finally {
    if (current()) loading.value = false
  }
}
watch(scope, () => { generation++; state.value = null; loading.value = false; error.value = '' }, { flush: 'sync' })
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <section class="base-card mt-3 space-y-3 rounded-2xl p-4" aria-label="Звірка зовнішньої зміни" :aria-busy="loading">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-semibold">Звірка зовнішньої зміни</h3>
      <BaseButton variant="neutral" size="sm" :disabled="loading" @click="load">Перевірити звіти X і Z</BaseButton>
    </header>
    <p class="text-sm text-ui-secondary">Зовнішні X/Z доступні як тестові докази. Підсумок зміни охоплює всю касу.</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="state">
      <p v-if="state.local_projection">Залишок за замовленням · <strong>{{ formatMoney(state.local_projection.net_minor / 100) }}</strong></p>
      <p v-else-if="state.local_status === 'sale_unresolved'">Очікуємо підтверджений чек продажу.</p>
      <p v-if="state.refund_status === 'unresolved'" role="status">Повернення за замовленням ще на звірці.</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <BaseCard v-for="{ label, value } in comparisons" :key="label" variant="subtle" padding="sm">
          <h4 class="font-semibold">Звіт {{ label }}</h4>
          <p>{{ statuses[value.status] }}</p>
          <div v-for="report in value.reports" :key="report.report_id" class="mt-2 border-t border-ui pt-2">
            <p class="text-sm text-ui-secondary">Тестова зміна · {{ formatDateTime(report.reported_at) }}</p>
            <dl class="mt-2 text-sm">
              <div><dt>Продажі за зміну</dt><dd>{{ formatMoney(report.shift_sale_minor / 100) }}</dd></div>
              <div><dt>Повернення за зміну</dt><dd>{{ formatMoney(report.shift_return_minor / 100) }}</dd></div>
            </dl>
          </div>
          <p v-if="value.missing_receipt_ids.length">Відсутні чеки замовлення · {{ value.missing_receipt_ids.length }}</p>
        </BaseCard>
      </div>
    </template>
  </section>
</template>
