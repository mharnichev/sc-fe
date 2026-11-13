<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'
import { salesErrorDetail } from '~/utils/orderSales'

const props = defineProps<{ order: OrderResponse }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore()
const readApi = useApi()
const writeApi = useApi({ refreshOnUnauthorized: false })

interface CancellationState {
  order_id: number
  revision: number
  order_status: string
  status: string
  reason: string
}

const endpoint = computed(() => `/backoffice/shop-payments/orders/${props.order.id}/online-payment`)
const action = computed(() => {
  const user = auth.user
  const order = props.order
  if (!user?.id || !(user.is_superuser || user.can_manage_fiscal_settings) ||
      order.channel !== 'shop' || order.simulation ||
      !(order.payment_method === 'onlineCard' || order.payment_channel === 'online_monobank') ||
      order.payments?.length || ['paid', 'simulated_paid', 'payment_reconciliation_required'].includes(order.payment_status || '') ||
      order.payment_status?.startsWith('paid_')) return null
  if (order.archived && order.status === 'cancelled') return 'deactivate-archived-invoice'
  if (!order.archived && ['pending', 'confirmed'].includes(order.status)) return 'deactivate-unpaid'
  return null
})
const bankOnly = computed(() => action.value === 'deactivate-archived-invoice')
const label = computed(() => bankOnly.value ? 'Закрити інвойс Mono в архіві' : 'Скасувати неоплачене замовлення через Mono')
const open = ref(false)
const busy = ref(false)
const outcome = ref<'confirmed' | 'review' | null>(null)
const error = ref('')
let generation = 0
watch([() => props.order.id, () => auth.user?.id, () => auth.sessionRevision], () => {
  generation++
  open.value = false
  busy.value = false
  outcome.value = null
  error.value = ''
}, { flush: 'sync' })
onScopeDispose(() => { generation++ })

const submit = async () => {
  const operation = action.value
  if (!open.value || busy.value || outcome.value || !operation) return

  const context = generation
  const id = props.order.id
  const orderStatus = props.order.status
  const path = endpoint.value
  const revision = props.order.revision
  busy.value = true
  error.value = ''
  let submitted = false
  try {
    const state = await readApi<CancellationState>(`${path}/cancellation`, { retry: 0 })
    if (context !== generation || operation !== action.value) return
    if (state.order_id !== id || state.order_status !== orderStatus ||
        !Number.isSafeInteger(state.revision) || state.revision < 1 ||
        state.revision !== revision || props.order.revision !== revision) {
      error.value = 'Замовлення змінилося. Оновіть дані та підтвердьте дію ще раз.'
      emit('changed')
      return
    }
    const eligible = operation === 'deactivate-archived-invoice'
      ? state.status === 'cancelled'
      : state.status === 'reconciliation_required' &&
        ['invoice_reconciliation_required', 'invoice_dispatch_unconfirmed'].includes(state.reason)
    if (!eligible) {
      error.value = 'Поточний стан не дозволяє закрити інвойс Mono. Перевірте дані оплати.'
      return
    }

    submitted = true
    const result = await writeApi<{ order_id: number, invoice_status: string, order_status: string }>(`${path}/${operation}`, {
      method: 'POST', body: { expected_revision: state.revision }, retry: 0,
    })
    if (context !== generation) return
    if (result.order_id !== id || result.invoice_status !== 'deactivated' || result.order_status !== 'cancelled') {
      outcome.value = 'review'
      return
    }
    outcome.value = 'confirmed'
    emit('changed')
  }
  catch (cause) {
    if (context !== generation) return
    const { code } = salesErrorDetail(cause)
    if (code === 'revision_conflict') {
      error.value = 'Замовлення змінилося. Оновіть дані та підтвердьте дію ще раз.'
      emit('changed')
    } else if (!submitted || code === 'invoice_removal_preflight_failed') {
      error.value = 'Попередня перевірка не пройшла. Запит на закриття інвойсу до Mono не надіслано.'
    } else {
      outcome.value = 'review'
    }
  }
  finally {
    if (context === generation) {
      busy.value = false
      open.value = false
    }
  }
}
</script>

<template>
  <section v-if="action || outcome || error" class="space-y-2" aria-label="Закриття інвойсу Mono">
    <BaseButton v-if="action && !outcome" variant="danger-outline" aria-haspopup="dialog" @click="open = true">
      {{ label }}
    </BaseButton>
    <p v-if="outcome === 'confirmed'" role="status">Закриття інвойсу Mono підтверджено.</p>
    <p v-if="outcome === 'review'" role="alert">Результат закриття не підтверджено. Потрібна звірка з Mono перед будь-яким повтором.</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <BaseModal v-model="open" compact max-width-class="max-w-md" :aria-label="label"
      :close-on-backdrop="!busy" :close-on-escape="!busy">
      <template #head><h2 class="text-lg font-semibold">{{ label }} · #{{ order.id }}</h2></template>
      <template #body>
        <form class="space-y-4" @submit.prevent="submit">
          <p v-if="bankOnly">Буде закрито лише інвойс Mono. Архівне замовлення та його резерв не зміняться.</p>
          <p v-else>Після підтвердження Mono замовлення буде скасовано, а активний резерв знято.</p>
          <div class="flex flex-wrap justify-end gap-2">
            <BaseButton type="button" variant="neutral" :disabled="busy" @click="open = false">Закрити</BaseButton>
            <BaseButton type="submit" variant="danger" :loading="busy" :disabled="busy || !action || !!outcome">Підтвердити</BaseButton>
          </div>
        </form>
      </template>
    </BaseModal>
  </section>
</template>
