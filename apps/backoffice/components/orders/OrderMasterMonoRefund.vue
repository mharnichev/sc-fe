<script setup lang="ts">
interface RefundState {
  revision: number
  amount_minor: number
  items: Array<{ name: string, quantity: number }>
  money_status: 'not_started' | 'requires_review' | 'refunded'
  receipt_status: 'not_started' | 'pending' | 'issued'
  stock_status: 'not_required' | 'reserve_pending' | 'awaiting_goods' | 'received'
  receipt_url: string | null
  can_start: boolean
  can_reconcile: boolean
  can_receive: boolean
  reason: string | null
}

const props = defineProps<{ orderId: number, revision?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi()
const auth = useAuthStore()
const endpoint = computed(() => `/backoffice/master-mono/orders/${props.orderId}/refund`)
const scope = computed(() => JSON.stringify([props.orderId, auth.user?.id, auth.sessionRevision]))
const state = shallowRef<RefundState>()
const busy = ref(false)
const error = ref('')
const reason = ref('')
const confirmed = ref(false)
const uncertain = ref(false)
let sequence = 0

const moneyLabels = { not_started: 'Не розпочато', requires_review: 'Потрібна звірка з Mono', refunded: 'Кошти повернено' }
const receiptLabels = { not_started: 'Не розпочато', pending: 'Очікується підтвердження', issued: 'Чек підтверджено через Mono' }
const stockLabels = { not_required: 'Товар не видавали', reserve_pending: 'Потрібна звірка резерву', awaiting_goods: 'Очікується приймання', received: 'Товар прийнято' }
const money = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })

const load = async () => {
  const request = ++sequence
  busy.value = true
  error.value = ''
  try {
    const value = await api<RefundState>(endpoint.value, { retry: 0 })
    if (request === sequence) {
      state.value = value
      uncertain.value = false
    }
  } catch {
    if (request === sequence) error.value = 'Не вдалося прочитати стан повернення.'
  } finally {
    if (request === sequence) busy.value = false
  }
}

const submit = async (action: 'start' | 'reconcile' | 'receive') => {
  const current = state.value
  if (busy.value || uncertain.value || !current) return
  if (action === 'start' && (!current.can_start || !confirmed.value || reason.value.trim().length < 3)) return
  if (action === 'receive' && !current.can_receive || action === 'reconcile' && !current.can_reconcile) return
  const request = ++sequence
  const suffix = action === 'start' ? '' : `/${action}`
  busy.value = true
  error.value = ''
  try {
    const value = await api<RefundState>(endpoint.value + suffix, {
      method: 'POST',
      retry: 0,
      headers: action === 'start' ? { 'Idempotency-Key': crypto.randomUUID() } : undefined,
      body: action === 'reconcile' ? undefined : {
        expected_revision: current.revision,
        ...(action === 'start' ? { reason: reason.value.trim() } : {}),
      },
    })
    if (request !== sequence) return
    state.value = value
    confirmed.value = false
    emit('changed')
  } catch {
    if (request !== sequence) return
    uncertain.value = true
    error.value = 'Не вдалося підтвердити результат. Оновіть стан повернення.'
  } finally {
    if (request === sequence) busy.value = false
  }
}

watch(scope, () => {
  sequence++
  busy.value = false
  error.value = ''
  state.value = undefined
  reason.value = ''
  confirmed.value = false
  uncertain.value = false
  if (import.meta.client && auth.user?.id) void load()
}, { immediate: true })
watch(() => props.revision, (revision) => {
  if (!busy.value && state.value && revision && revision > state.value.revision) void load()
})
onBeforeUnmount(() => { sequence++ })
</script>

<template>
  <BaseCard as="section" class="space-y-3">
    <h2 class="text-lg font-semibold">Повернення через Mono</h2>
    <p v-if="error" role="alert" class="text-ui-danger">{{ error }}</p>
    <BaseButton v-if="error || uncertain" variant="secondary" :loading="busy" @click="load">Оновити стан</BaseButton>
    <p v-else-if="busy && !state" role="status">Завантаження…</p>
    <template v-if="state">
      <dl class="grid gap-2 sm:grid-cols-3" aria-live="polite">
        <div><dt>Кошти</dt><dd>{{ moneyLabels[state.money_status] }}</dd></div>
        <div><dt>Чек повернення</dt><dd>{{ receiptLabels[state.receipt_status] }}</dd></div>
        <div><dt>Склад</dt><dd>{{ stockLabels[state.stock_status] }}</dd></div>
      </dl>
      <a v-if="state.receipt_url" :href="state.receipt_url" target="_blank" rel="noopener noreferrer" class="text-ui-accent underline">Відкрити чек повернення</a>
      <p v-if="state.reason" class="break-words">Причина: {{ state.reason }}</p>
      <form v-if="state.can_start" class="space-y-3" @submit.prevent="submit('start')">
        <ul>
          <li v-for="(item, index) in state.items" :key="index">{{ item.name }} × {{ item.quantity }}</li>
        </ul>
        <p class="font-semibold">До повернення {{ money.format(state.amount_minor / 100) }}</p>
        <BaseInput v-model="reason" label="Причина повернення" :maxlength="500" :disabled="busy || uncertain" />
        <label class="flex items-center gap-2">
          <input v-model="confirmed" type="checkbox" :disabled="busy || uncertain">
          Підтверджую повне повернення коштів
        </label>
        <BaseButton type="submit" variant="primary" :loading="busy" :disabled="uncertain || !confirmed || reason.trim().length < 3">Повернути кошти</BaseButton>
      </form>
      <p v-else-if="state.money_status === 'not_started'">Повернення доступне після підтвердження оплати й чека продажу та ввімкнення функції.</p>
      <div v-if="state.can_reconcile || state.can_receive" class="flex flex-wrap gap-2">
        <BaseButton v-if="state.can_reconcile" variant="secondary" :disabled="busy || uncertain" @click="submit('reconcile')">Звірити повернення</BaseButton>
        <BaseButton v-if="state.can_receive" variant="secondary" :disabled="busy || uncertain" @click="submit('receive')">Підтвердити приймання товару на склад</BaseButton>
      </div>
    </template>
  </BaseCard>
</template>
