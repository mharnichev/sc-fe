<script setup lang="ts">
import { salesErrorDetail } from '~/utils/orderSales'

interface CancellationState {
  order_id: number
  revision: number
  order_status: string
  status: 'available' | 'reconciliation_required' | 'unavailable' | 'cancelled'
  reason: string
}

const props = defineProps<{ orderId: number, revision?: number }>()
const emit = defineEmits<{ cancelled: [state: CancellationState], reconcile: [], focusFallback: [] }>()
const api = useApi()
const resource = computed(() => String(props.orderId))
const endpoint = computed(() => `/backoffice/shop-payments/orders/${resource.value}/online-payment/cancellation`)
const command = useOrderSalesCommand<{ expected_revision: number }>('shop-online-cancellation', resource)
const state = shallowRef<CancellationState | null>(null)
const open = ref(false)
const readError = ref(false)
const notice = ref('')
let sequence = 0
onScopeDispose(() => { sequence++ })

const reasonLabels: Record<string, string> = {
  payment_not_started: 'Оплату ще не розпочато.',
  invoice_not_dispatched: 'Рахунок ще не надіслано до mono.',
  invoice_dispatch_unconfirmed: 'Невідомо, чи mono отримав запит на рахунок. Потрібна звірка з банком.',
  invoice_reconciliation_required: 'Потрібно звірити рахунок і стан оплати в mono.',
  paid_order_requires_resolution: 'Оплату підтверджено. Відкрийте звірку для оплаченого скасування.',
  reservation_ownership_unconfirmed: 'Не вдалося підтвердити резерв. Перевірте його перед скасуванням.',
  shop_order_operations_disabled: 'Скасування замовлень тимчасово недоступне.',
  order_closed: 'Замовлення закрите.',
  order_has_financial_or_fulfillment_facts: 'Перевірте оплату та виконання перед скасуванням.',
  order_cancelled: 'Замовлення вже скасовано.',
}
const reason = computed(() => state.value ? reasonLabels[state.value.reason] || 'Перевірте стан замовлення.' : '')
const available = computed(() => state.value?.status === 'available')
const matches = (value: CancellationState | undefined) =>
  value?.order_id === props.orderId && Number.isSafeInteger(value.revision) && value.revision > 0
const httpStatus = (cause: unknown) => (cause as { response?: { status?: number }, statusCode?: number } | null)?.response?.status
  ?? (cause as { statusCode?: number } | null)?.statusCode

const read = async () => {
  const request = ++sequence
  state.value = null
  readError.value = false
  try {
    const value = await api<CancellationState>(endpoint.value)
    if (request !== sequence) return
    if (!matches(value)) throw new Error('Invalid cancellation state')
    state.value = value
    if (value.status === 'cancelled') {
      if (command.intent.value) command.clear()
      emit('cancelled', value)
    }
  }
  catch (cause) {
    if (request === sequence) readError.value = ![401, 403, 404].includes(httpStatus(cause) ?? 0)
  }
}
const closeAfterUpdate = async () => {
  open.value = false
  await nextTick()
  emit('focusFallback')
}

watch(() => props.revision, () => {
  if (!import.meta.client || command.busy.value) return
  if (open.value) void closeAfterUpdate()
  void read()
}, { immediate: true })

const showConfirmation = () => {
  notice.value = ''
  command.error.value = ''
  open.value = true
}

const cancel = async () => {
  const current = state.value
  if (!open.value || !current || current.status !== 'available' || command.busy.value) return
  const request = ++sequence
  let result: CancellationState | undefined
  let rejection: unknown
  notice.value = ''
  await command.execute({ expected_revision: current.revision }, async (body, key) => {
    try {
      const value = await api<CancellationState>(endpoint.value, {
        method: 'POST', body, headers: { 'Idempotency-Key': key },
      })
      if (!matches(value) || value.status !== 'cancelled' || value.order_status !== 'cancelled') {
        throw new Error('Invalid cancellation result')
      }
      result = value
      return { id: value.order_id }
    }
    catch (cause) {
      rejection = cause
      throw cause
    }
  }, async () => {
    if (request !== sequence) return
    command.clear()
    if (!result) {
      await read()
    } else {
      state.value = result
      emit('cancelled', result)
    }
    await closeAfterUpdate()
  })
  if (request !== sequence) return
  const status = httpStatus(rejection)
  if (status === 401 || status === 403 || status === 404) {
    state.value = null
    await closeAfterUpdate()
  }
  else if (status === 409) {
    command.clear()
    const { code, cancellation } = salesErrorDetail(rejection) as { code?: string, cancellation?: CancellationState }
    if (code !== 'revision_conflict' && code !== 'idempotency_conflict' && cancellation && matches(cancellation)) {
      state.value = cancellation
      if (cancellation.status === 'cancelled') emit('cancelled', cancellation)
    } else {
      await read()
    }
    await closeAfterUpdate()
    if (state.value) notice.value = 'Стан замовлення оновлено. Перевірте його перед повторною дією.'
  }
}
</script>

<template>
  <div v-if="state || readError || notice" class="min-w-0 space-y-1">
    <BaseButton v-if="available" variant="danger-outline" size="lg" aria-haspopup="dialog" @click="showConfirmation">
      {{ command.intent.value ? 'Повторити скасування' : 'Скасувати замовлення' }}
    </BaseButton>
    <div v-else-if="state?.status !== 'cancelled'" class="max-w-sm text-sm text-ui-secondary">
      <p v-if="reason" role="status">{{ reason }}</p>
      <BaseButton v-if="state?.status === 'reconciliation_required'" variant="neutral" size="sm" class="mt-1" @click="emit('reconcile')">
        Перейти до звірки
      </BaseButton>
      <BaseButton v-if="readError" variant="neutral" size="sm" @click="read">Перевірити можливість скасування</BaseButton>
    </div>
    <p v-if="notice" role="status" class="max-w-xs text-xs text-ui-secondary">{{ notice }}</p>
  </div>
  <BaseModal v-model="open" compact max-width-class="max-w-md" aria-label="Скасувати замовлення"
    :close-on-backdrop="!command.busy.value" :close-on-escape="!command.busy.value">
    <template #head><h2 class="text-lg font-semibold">Скасувати замовлення #{{ orderId }}</h2></template>
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-ui-secondary">{{ reason }} <span v-if="available">Після скасування резерв цього замовлення буде знято.</span></p>
        <p v-if="command.error.value" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">
          {{ command.intent.value ? 'Результат не підтверджено. Можна повторити той самий запит.' : 'Не вдалося скасувати замовлення.' }}
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <BaseButton variant="neutral" :disabled="command.busy.value" @click="open = false">Закрити</BaseButton>
          <BaseButton variant="danger" :disabled="!available" :loading="command.busy.value" @click="cancel">
            {{ command.intent.value ? 'Повторити запит' : 'Підтвердити скасування' }}
          </BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
