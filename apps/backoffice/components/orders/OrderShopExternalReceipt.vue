<script setup lang="ts">
import type { ShopPaymentState } from '~/utils/shopPayments'

interface ExternalReceiptState {
  order_id: number
  revision: number
  fiscal_profile: 'mono_checkbox_external'
  enabled: boolean
  paid: boolean
  accepted: boolean
  authority: 'none' | 'test' | 'provider'
  status: string
  receipt: { pdf_available: boolean, imported_at: string } | null
}
interface ReceiptRefresh {
  expected_revision: number
  expected_profile_id: string
  expected_profile_hash: string
}

const props = defineProps<{ orderId: number, revision?: number, refundActive?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi()
const auth = useAuthStore()
const { formatDateTime } = useBookingFormatting()
const endpoint = computed(() => `/backoffice/shop-payments/orders/${props.orderId}/external-receipt`)
const context = computed(() => JSON.stringify([props.orderId, auth.user?.id, auth.sessionRevision]))
const command = useOrderSalesCommand<ReceiptRefresh>('shop-external-receipt-refresh', () => String(props.orderId),
  ['revision_conflict', 'mono_checkbox_binding_conflict', 'mono_checkbox_canonical_payment_required', 'direct_refund_active'])
const state = shallowRef<ExternalReceiptState | null>(null)
const refreshBody = shallowRef<ReceiptRefresh | null>(null)
const loading = ref(false)
const downloading = ref(false)
const error = ref('')
let sequence = 0
let disposed = false
const matches = (value: ExternalReceiptState, id: number) =>
  value?.order_id === id && value.fiscal_profile === 'mono_checkbox_external' && Number.isSafeInteger(value.revision)
const load = async () => {
  const current = ++sequence
  const id = props.orderId
  const path = endpoint.value
  state.value = null
  refreshBody.value = null
  error.value = ''
  if (disposed || !auth.user?.id) { loading.value = false; return false }
  loading.value = true
  try {
    const value = await api<ExternalReceiptState>(path)
    if (current !== sequence) return false
    if (!matches(value, id)) throw new Error('Invalid receipt state')
    state.value = value
    if (!value.enabled || !value.paid || value.receipt?.pdf_available) return true
    const payment = await api<ShopPaymentState>(`/backoffice/shop-payments/orders/${id}`)
    if (current !== sequence) return false
    if (payment.order_id === id && payment.revision === value.revision && payment.mode === 'prepayment'
      && payment.intent?.status === 'accepted' && payment.payment && payment.profile_id
      && /^[0-9a-f]{64}$/.test(payment.profile_hash || '')) {
      refreshBody.value = { expected_revision: value.revision, expected_profile_id: payment.profile_id, expected_profile_hash: payment.profile_hash! }
    }
    return true
  } catch {
    if (current === sequence) error.value = 'Не вдалося перевірити зовнішній чек.'
    return false
  } finally {
    if (current === sequence) loading.value = false
  }
}
const saved = computed(() => command.intent.value)
const canRefresh = computed(() => !props.refundActive && !!refreshBody.value && (!saved.value ||
  (saved.value.body.expected_profile_id === refreshBody.value.expected_profile_id
    && saved.value.body.expected_profile_hash === refreshBody.value.expected_profile_hash)))
const busy = computed(() => loading.value || downloading.value || command.busy.value)
const refresh = async () => {
  if (!canRefresh.value || busy.value || !refreshBody.value) return
  const key = context.value
  const id = props.orderId
  const path = endpoint.value
  await command.execute(refreshBody.value, async (body, intentKey) => {
    const value = await api<ExternalReceiptState>(`${path}/refresh`, { method: 'POST', body, headers: { 'Idempotency-Key': intentKey } })
    if (!matches(value, id)) throw new Error('Invalid receipt refresh response')
    return { id }
  }, async () => {
    if (disposed || key !== context.value) return
    if (!await load() || key !== context.value) throw new Error('Receipt state unavailable')
    command.clear()
    emit('changed')
  })
  if (key === context.value && command.error.value && !saved.value) await load()
}
const download = async () => {
  if (busy.value || !state.value?.accepted || !state.value.receipt?.pdf_available) return
  const key = context.value
  const id = props.orderId
  downloading.value = true
  error.value = ''
  try {
    const blob = await api<Blob>(`${endpoint.value}/pdf`, { responseType: 'blob' })
    if (disposed || key !== context.value) return
    if (blob.type !== 'application/pdf') throw new Error('Invalid receipt PDF')
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `receipt-${id}.pdf`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    if (key === context.value) error.value = 'Не вдалося завантажити PDF чека.'
  } finally {
    if (key === context.value) downloading.value = false
  }
}
watch([context, () => props.revision], () => {
  if (import.meta.client) void load()
}, { immediate: true, flush: 'sync' })
watch(context, () => { downloading.value = false }, { flush: 'sync' })
onBeforeUnmount(() => { disposed = true; sequence++ })
</script>

<template>
  <section class="base-card rounded-2xl space-y-3 p-4" aria-label="Чек mono → Checkbox" :aria-busy="busy">
    <h3 class="font-semibold">Чек mono → Checkbox</h3>
    <p v-if="loading" role="status">Перевіряємо чек…</p>
    <template v-if="state">
      <p role="status">{{ state.accepted ? 'Чек підтверджено' : !state.paid ? 'Очікуємо підтвердження оплати' : state.status === 'mono_checkbox_receipt_pending' ? 'Чек формується' : 'Чек потребує звірки' }}</p>
      <p v-if="state.authority === 'test'">Тестовий чек</p>
      <p v-if="state.receipt?.imported_at">Отримано {{ formatDateTime(state.receipt.imported_at) }}</p>
    </template>
    <BaseButton variant="primary" v-if="state?.accepted && state.receipt?.pdf_available" :disabled="busy" @click="download">Завантажити PDF</BaseButton>
    <BaseButton v-else-if="canRefresh" variant="primary" :disabled="busy" @click="refresh">{{ saved ? 'Повторити звірку чека' : 'Звірити чек' }}</BaseButton>
    <BaseButton v-else :disabled="busy" variant="neutral" @click="load">Оновити стан чека</BaseButton>
    <p v-if="error || command.error.value" role="alert">{{ error || command.error.value }}</p>
  </section>
</template>
