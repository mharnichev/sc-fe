<script setup lang="ts">
interface DirectRefundState {
  order_id: number
  revision: number
  available: boolean
  can_start: boolean
  can_reconcile: boolean
  carrier_receipt_id?: string | null
  refundable_items: Array<{ basket_index: number, name: string, quantity: number, unit_amount_minor: number }>
  kind: 'full' | 'partial' | null
  amount_minor: number | null
  ext_ref: string | null
  bank_confirmed: boolean
  return_receipt_id: string | null
  finalized_at: string | null
  last_checked_at: string | null
  reason: string
}
interface StartRefund {
  expected_revision: number
  kind: 'full' | 'partial'
  goods_in_custody: true
  quantities: Record<string, number>
  carrier_receipt_id?: string
}

const props = defineProps<{ orderId: number, revision?: number }>()
const emit = defineEmits<{ changed: [], active: [active: boolean] }>()
const api = useApi()
const auth = useAuthStore()
const { formatDateTime, formatMoney } = useBookingFormatting()
const endpoint = computed(() => `/backoffice/shop-direct-refunds/orders/${props.orderId}`)
const scope = computed(() => JSON.stringify([props.orderId, auth.user?.id, auth.sessionRevision]))
const start = useOrderSalesCommand<StartRefund>('shop-direct-refund', () => String(props.orderId), [
  'direct_refund_already_claimed', 'direct_refund_ineligible', 'direct_refund_active_shipment',
  'direct_refund_bank_conflict', 'direct_refund_original_required',
])
const state = shallowRef<DirectRefundState | null>(null)
const loading = ref(false)
const reconciling = ref(false)
const confirmed = ref(false)
const kind = ref<'full' | 'partial'>('full')
const quantities = ref<Record<string, string>>({})
const refundableItems = computed(() => state.value?.refundable_items || [])
const carrierReceipt = computed(() => state.value?.carrier_receipt_id || null)
const canSelectPartial = computed(() => !carrierReceipt.value && refundableItems.value.reduce((total, item) => total + item.quantity, 0) > 1)
const partialQuantities = computed(() => {
  if (kind.value !== 'partial' || !canSelectPartial.value) return null
  const selected: Record<string, number> = {}
  let remaining = 0
  for (const item of refundableItems.value) {
    const quantity = Number(quantities.value[item.basket_index] || 0)
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > item.quantity) return null
    if (quantity) selected[item.basket_index] = quantity
    remaining += item.quantity - quantity
  }
  return remaining && Object.keys(selected).length ? selected : null
})
const refundKindOptions = [{ value: 'full', label: 'Повне повернення' }, { value: 'partial', label: 'Часткове повернення' }]
const error = ref('')
let sequence = 0
let disposed = false
const matches = (value: DirectRefundState, id: number) => value?.order_id === id
  && Number.isSafeInteger(value.revision) && value.revision > 0 && typeof value.available === 'boolean'
  && typeof value.bank_confirmed === 'boolean' && typeof value.can_start === 'boolean'
  && typeof value.can_reconcile === 'boolean' && Array.isArray(value.refundable_items)
const load = async () => {
  const request = ++sequence
  const id = props.orderId
  state.value = null
  confirmed.value = false
  error.value = ''
  if (disposed || !auth.user?.id) { loading.value = false; return false }
  loading.value = true
  try {
    const value = await api<DirectRefundState>(endpoint.value)
    if (request !== sequence) return false
    if (!matches(value, id)) throw new Error('Invalid refund state')
    state.value = value
    emit('active', !!value.ext_ref)
    if (!canSelectPartial.value && !start.intent.value) kind.value = 'full'
    if (value.ext_ref && start.intent.value) start.clear()
    return true
  } catch {
    if (request === sequence) error.value = 'Не вдалося перевірити стан повернення.'
    return false
  } finally {
    if (request === sequence) loading.value = false
  }
}
const busy = computed(() => loading.value || reconciling.value || start.busy.value)
const canStart = computed(() => state.value?.can_start === true && !state.value.ext_ref && !state.value.finalized_at && (!carrierReceipt.value || state.value.kind === 'full' || state.value.kind === 'partial'))
const canReconcile = computed(() => state.value?.can_reconcile === true && !!state.value.ext_ref && !state.value.finalized_at)
const readyToStart = computed(() => !!start.intent.value || confirmed.value && (kind.value === 'full' || !!partialQuantities.value))
const reasonText: Record<string, string> = {
  direct_refunds_unavailable: 'Пряме повернення доступне лише в тестовому профілі.',
  direct_refund_test_unsafe: 'Ізольоване тестове середовище не підтверджено.',
  direct_refund_ineligible: 'Цей стан замовлення не дозволяє пряме повернення.',
  direct_refund_active_shipment: 'Спочатку звірте активне відправлення.',
  direct_refund_original_required: 'Потрібен підтверджений чек початкового продажу.',
  dispatch_outcome_unknown: 'Очікуємо результату запиту до банку.',
  bank_reconciliation_required: 'Банк ще не підтвердив повернення.',
  bank_unavailable: 'Відповідь банку зараз недоступна.',
  linked_return_receipt_required: 'Очікуємо підтвердження пов’язаного чека.',
  linked_return_receipt_conflict: 'Дані повернення в чеку суперечать раніше підтвердженим.',
  linked_return_receipt_unavailable: 'Дані пов’язаного чека зараз недоступні.',
}
const startRefund = async () => {
  if (busy.value || !canStart.value || !state.value || !readyToStart.value) return
  const current = scope.value
  const id = props.orderId
  const path = endpoint.value
  const body: StartRefund = carrierReceipt.value
    ? { expected_revision: state.value.revision, kind: state.value.kind!, goods_in_custody: true, quantities: {}, carrier_receipt_id: carrierReceipt.value }
    : { expected_revision: state.value.revision, kind: kind.value, goods_in_custody: true, quantities: partialQuantities.value || {} }
  confirmed.value = false
  await start.execute(body, async (payload, key) => {
    const value = await api<DirectRefundState>(`${path}/start`, { method: 'POST', body: payload, headers: { 'Idempotency-Key': key } })
    if (!matches(value, id) || !value.ext_ref || value.kind !== payload.kind || (payload.carrier_receipt_id && value.carrier_receipt_id !== payload.carrier_receipt_id)) throw new Error('Invalid refund acknowledgement')
    return { id }
  }, async () => {
    if (disposed || current !== scope.value) return
    if (!await load() || !state.value?.ext_ref) throw new Error('Refund state unavailable')
    if (current === scope.value && !disposed) emit('changed')
  })
  if (current === scope.value && !disposed && start.error.value) {
    await load()
    if (state.value?.ext_ref) emit('changed')
  }
}
const reconcile = async () => {
  if (busy.value || !canReconcile.value) return
  const current = scope.value
  const id = props.orderId
  const ref = state.value?.ext_ref
  reconciling.value = true
  error.value = ''
  try {
    const value = await api<DirectRefundState>(`${endpoint.value}/reconcile`, { method: 'POST' })
    if (disposed || current !== scope.value) return
    if (!matches(value, id) || value.ext_ref !== ref) throw new Error('Invalid refund reconciliation')
    if (await load() && current === scope.value && !disposed) emit('changed')
  } catch {
    if (!disposed && current === scope.value) {
      const refreshed = await load()
      if (!disposed && current === scope.value) {
        if (refreshed) emit('changed')
        if (!state.value?.finalized_at) error.value = 'Не вдалося звірити повернення. Оновіть стан і спробуйте ще раз.'
      }
    }
  } finally {
    if (!disposed && current === scope.value) reconciling.value = false
  }
}
watch(scope, () => { reconciling.value = false; kind.value = 'full'; quantities.value = {}; emit('active', false) }, { flush: 'sync' })
watch([kind, quantities], () => { confirmed.value = false }, { deep: true, flush: 'sync' })
watch([scope, () => props.revision], () => {
  if (import.meta.client) void load()
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { disposed = true; sequence++ })
</script>

<template>
  <section class="base-card rounded-2xl space-y-3 p-4" aria-label="Повернення mono → Checkbox" :aria-busy="busy">
    <h3 class="font-semibold">Повернення mono → Checkbox</h3>
    <p v-if="loading" role="status">Перевіряємо повернення…</p>
    <template v-if="state">
      <p v-if="state.available || state.ext_ref" class="text-sm font-medium">Тестове повернення</p>
      <template v-if="state.ext_ref">
        <p role="status">{{ state.finalized_at ? 'Повернення завершено' : 'Повернення на звірці' }}</p>
        <p v-if="state.amount_minor !== null">Сума · {{ formatMoney(state.amount_minor / 100) }}</p>
        <dl class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div><dt>Кошти</dt><dd class="font-semibold">{{ state.bank_confirmed ? 'Повернення підтверджено' : 'Очікуємо підтвердження банку' }}</dd></div>
          <div><dt>Чек повернення</dt><dd class="font-semibold">{{ state.return_receipt_id ? 'Чек підтверджено' : 'Очікуємо чек' }}</dd></div>
        </dl>
        <p v-if="state.kind === 'partial' && state.finalized_at">Звірте залишок замовлення перед видачею або відправленням.</p>
        <p v-if="state.last_checked_at">Остання звірка · {{ formatDateTime(state.last_checked_at) }}</p>
      </template>
      <p v-if="state.reason !== 'ready' && !state.finalized_at">{{ reasonText[state.reason] || 'Потрібна перевірка стану повернення.' }}</p>
      <template v-if="canStart">
        <p v-if="carrierReceipt && state.amount_minor !== null">За підтвердженим прийманням · {{ formatMoney(state.amount_minor / 100) }}</p>
        <template v-if="!start.intent.value">
          <BaseSelect v-if="canSelectPartial" v-model="kind" inline-menu label="Обсяг повернення" :options="refundKindOptions" :disabled="busy" />
          <template v-if="kind === 'partial'">
            <BaseInput v-for="item in refundableItems" :key="item.basket_index" v-model="quantities[item.basket_index]" type="number"
              :label="`${item.name} · до ${item.quantity} шт.`" min="0" :max="item.quantity" step="1" :disabled="busy" />
          </template>
          <BaseCheckbox v-model="confirmed" :disabled="busy">{{ carrierReceipt ? 'Підтверджую повернення за оглянутою посилкою.' : 'Підтверджую, що весь товар залишається у нас.' }}</BaseCheckbox>
        </template>
        <BaseButton variant="danger-outline" data-testid="direct-refund-start" :disabled="busy || !readyToStart" @click="startRefund">{{ start.intent.value ? 'Повторити запит на повернення' : (carrierReceipt ? state.kind : kind) === 'full' ? 'Почати повне повернення' : 'Почати часткове повернення' }}</BaseButton>
      </template>
      <BaseButton v-else-if="canReconcile" variant="primary" data-testid="direct-refund-reconcile" :disabled="busy" @click="reconcile">Звірити повернення</BaseButton>
    </template>
    <BaseButton v-if="!state || (!canStart && !canReconcile && !state.finalized_at)" variant="neutral" :disabled="busy" @click="load">Оновити стан повернення</BaseButton>
    <p v-if="error || start.error.value" role="alert">{{ error || start.error.value }}</p>
  </section>
</template>
