<script setup lang="ts">
import type { OrderCancellationState } from '~/composables/useBackofficeApi'
import { salesErrorDetail } from '~/utils/orderSales'

const props = defineProps<{ orderId: number, revision?: number, archived: boolean, canOpenPaymentReview: boolean }>()
const emit = defineEmits<{ cancelled: [state: OrderCancellationState], archivedFacts: [state: OrderCancellationState], reconcile: [], focusFallback: [] }>()
const api = useApi()
const { $reportOrderCancellationError } = useNuxtApp()
const { formatDateTime } = useBookingFormatting()
const resource = computed(() => String(props.orderId))
const endpoint = computed(() => `/backoffice/orders/${resource.value}/cancellation`)
const command = useOrderSalesCommand<{ expected_revision: number, comment?: string }>('order-cancellation', resource, ['idempotency_conflict'], 'session')
const state = shallowRef<OrderCancellationState | null>(null)
const open = ref(false)
const readError = ref(false)
const notice = ref('')
const comment = ref('')
let sequence = 0
onScopeDispose(() => { sequence++ })

const canCancel = computed(() => state.value?.can_cancel === true && !state.value.archived && !props.archived)
const needsReview = computed(() => {
  const flags = state.value?.reconciliation
  return [flags?.payment && 'Оплата', flags?.receipt && 'Чек', flags?.inventory && 'Товар'].filter(Boolean).join(', ')
})
const paymentNotice = computed(() => {
  const payment = state.value?.payment_status
  if (payment === 'paid' || payment === 'paid_production') return 'Замовлення оплачене. Кошти автоматично не повернуться.'
  if (payment === 'simulated_paid') return 'Тестову оплату підтверджено. Скасування не змінить її запис.'
  if (state.value?.reconciliation.payment || !payment || ['failed', 'legacy_unknown', 'unknown'].includes(payment)) {
    return 'Статус платежу потребує перевірки. Після скасування може знадобитися звірка.'
  }
  return 'Скасування не змінює стан оплати.'
})
const goodsNotice = computed(() => {
  const facts = state.value
  if (['handed_over', 'pickup_handed_over', 'carrier_dispatched', 'fulfilled', 'simulated_handed_over', 'simulated_pickup_handed_over', 'simulated_carrier_dispatched', 'simulated_fulfilled'].includes(facts?.fulfillment_status || '')) {
    return 'Переданий товар потрібно повернути окремо.'
  }
  return facts?.reconciliation.inventory ? 'Товар потребує окремої звірки.' : ''
})
const matches = (value?: OrderCancellationState) =>
  value?.order_id === props.orderId && Number.isSafeInteger(value.revision) && value.revision > 0 &&
  typeof value.archived === 'boolean' && typeof value.can_cancel === 'boolean' && !!value.reconciliation
const httpStatus = (cause: unknown) => {
  const error = cause as { response?: { status?: number }, statusCode?: number } | null
  return error?.response?.status ?? error?.statusCode
}

const read = async () => {
  const request = ++sequence
  state.value = null
  readError.value = false
  try {
    const value = await api<OrderCancellationState>(endpoint.value)
    if (request !== sequence) return
    if (!matches(value)) throw new Error('Invalid cancellation state')
    state.value = value
    if (value.archived) {
      if (command.intent.value) command.clear()
      if (props.archived) emit('archivedFacts', value)
      else emit('cancelled', value)
    }
  }
  catch (cause) {
    if (request !== sequence || [401, 403, 404].includes(httpStatus(cause) ?? 0)) return
    readError.value = true
    $reportOrderCancellationError?.('read', cause)
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
  if (!canCancel.value || command.busy.value) return
  notice.value = ''
  command.error.value = ''
  comment.value = command.intent.value?.body.comment || ''
  open.value = true
}

defineExpose({ canCancel, showConfirmation })

const cancel = async () => {
  const current = state.value
  if (!open.value || !current || !canCancel.value || command.busy.value) return
  const request = ++sequence
  let result: OrderCancellationState | undefined
  let rejection: unknown
  const note = comment.value.trim()
  await command.execute({ expected_revision: current.revision, ...(note ? { comment: note } : {}) }, async (body, key) => {
    try {
      const value = await api<OrderCancellationState>(endpoint.value, {
        method: 'POST', body, headers: { 'Idempotency-Key': key },
      })
      if (!matches(value) || !value.archived || value.order_status !== 'cancelled') throw new Error('Invalid cancellation result')
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
    if (result) {
      state.value = result
      emit('cancelled', result)
    }
    await closeAfterUpdate()
    // A replay can return the saved result before a late payment changed reconciliation.
    await read()
  })
  if (request !== sequence) return
  const status = httpStatus(rejection)
  if (status === 401 || status === 403 || status === 404) {
    state.value = null
    await closeAfterUpdate()
  } else if (status === 409) {
    command.clear()
    const { cancellation } = salesErrorDetail(rejection) as { cancellation?: OrderCancellationState }
    if (cancellation && matches(cancellation)) {
      state.value = cancellation
      if (cancellation.archived) emit('cancelled', cancellation)
    } else {
      await read()
    }
    await closeAfterUpdate()
    if (state.value && !state.value.archived) notice.value = 'Замовлення змінилося. Перевірте оновлені дані та підтвердьте дію ще раз.'
  } else if (rejection) {
    $reportOrderCancellationError?.('submit', rejection)
  }
}
</script>

<template>
  <div v-if="canCancel || state?.archived || readError || notice" class="min-w-0 space-y-1">
    <BaseButton v-if="canCancel" variant="danger-outline" size="lg" aria-haspopup="dialog" @click="showConfirmation">
      {{ command.intent.value ? 'Повторити скасування' : 'Скасувати й архівувати' }}
    </BaseButton>
    <div v-if="state?.archived" class="max-w-sm space-y-1 text-sm text-ui-secondary">
      <BaseBadge tone="neutral">В архіві</BaseBadge>
      <p v-if="state.cancelled_at">Скасовано {{ formatDateTime(state.cancelled_at) }}</p>
      <p v-if="state.released_reservation_quantity">Знято резерв: {{ state.released_reservation_quantity }} шт.</p>
      <p v-if="state.comment" class="break-words">{{ state.comment }}</p>
      <p v-if="state.late_payment_verified">Оплату підтверджено після скасування.</p>
      <p v-if="needsReview" role="status">Потрібна звірка: {{ needsReview }}</p>
      <BaseButton v-if="canOpenPaymentReview && state.reconciliation.payment" variant="neutral" size="sm" @click="emit('reconcile')">Перейти до звірки</BaseButton>
    </div>
    <BaseButton v-if="readError" variant="neutral" size="sm" @click="read">Оновити дані скасування</BaseButton>
    <p v-if="notice" role="status" class="max-w-xs text-xs text-ui-secondary">{{ notice }}</p>
  </div>
  <BaseModal v-model="open" compact max-width-class="max-w-md" aria-label="Скасувати й архівувати замовлення"
    :close-on-backdrop="!command.busy.value" :close-on-escape="!command.busy.value">
    <template #head><h2 class="text-lg font-semibold">Скасувати й архівувати #{{ orderId }}</h2></template>
    <template #body>
      <form class="space-y-4" @submit.prevent="cancel">
        <p class="text-sm">Замовлення зникне з активного списку та залишиться в архіві.</p>
        <div class="space-y-1 text-sm text-ui-secondary">
          <p>{{ paymentNotice }}</p>
          <p v-if="state?.active_reservation_quantity">Буде знято активний резерв: {{ state.active_reservation_quantity }} шт.</p>
          <p v-if="goodsNotice">{{ goodsNotice }}</p>
          <p v-if="state?.reconciliation.receipt">Чек повернення оформлюється окремо.</p>
        </div>
        <BaseInput v-model="comment" label="Коментар адміністратора (необов’язково)" :maxlength="500"
          :disabled="command.busy.value || !!command.intent.value" />
        <p v-if="command.error.value" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">
          {{ command.intent.value ? 'Результат не підтверджено. Повторіть той самий запит.' : 'Не вдалося скасувати замовлення. Спробуйте ще раз.' }}
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <BaseButton type="button" variant="neutral" :disabled="command.busy.value" @click="open = false">Закрити</BaseButton>
          <BaseButton type="submit" variant="danger" :disabled="!canCancel" :loading="command.busy.value">
            {{ command.intent.value ? 'Повторити запит' : 'Підтвердити скасування' }}
          </BaseButton>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
