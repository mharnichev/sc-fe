<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'

type Operation = 'attach' | 'refresh' | 'receive'
interface ReturnLine { order_item_id: number, quantity: number }
interface ReceivedLine { order_item_id: number, received_quantity: number, restock_quantity: number, damaged_quantity: number }
interface ReturnState {
  order_id: number
  revision: number
  profile_id: string | null
  profile_hash: string | null
  original_shipment_id: number | null
  original_ttn: string | null
  case_id: string | null
  return_ttn: string | null
  status: 'not_attached' | 'awaiting_return' | 'arrived' | 'received'
  eligible_lines: ReturnLine[]
  claimed_lines: ReturnLine[]
  observation: { observed_at?: string | null, original?: { status: string }, linkage_kind?: 'easy_return' | 'manual_document' } | null
  receipt: { id: string, lines: ReceivedLine[], evidence: string, operator_id: number, created_at: string } | null
  financial_refund_path: string | null
  can_attach: boolean
  can_refresh: boolean
  can_receive: boolean
  blocking_reasons: string[]
}
interface Identity { expected_revision: number, expected_profile_id: string, expected_profile_hash: string }
type Intent = { operation: 'attach', body: Identity & { original_shipment_id: number, return_ttn: string, lines: ReturnLine[] } }
  | { operation: 'refresh', body: Identity, previous_observed_at?: string | null }
  | { operation: 'receive', operator_id: number, body: Identity & { lines: ReceivedLine[], contents_verified: true, evidence: string } }

const props = defineProps<{ order: OrderResponse, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi(), auth = useAuthStore()
const { formatDateTime } = useBookingFormatting()
const endpoint = computed(() => `/backoffice/shop-np-direct-returns/orders/${props.order.id}`)
const scope = computed(() => JSON.stringify([props.order.id, auth.user?.id, auth.sessionRevision]))
const command = useOrderSalesCommand<Intent>('shop-np-direct-return', () => String(props.order.id), [
  'np_return_linkage_mismatch', 'np_return_tracking_stale', 'np_return_profile_conflict', 'np_return_quantity_mismatch',
  'np_return_proof_invalid', 'np_direct_return_original_proof', 'np_direct_return_binding_conflict', 'np_return_manual_link_invalid',
  'np_return_receipt_exists', 'np_direct_return_conflict', 'np_direct_return_financial_active',
])
const state = shallowRef<ReturnState | null>(null)
const loading = ref(false), error = ref('')
const reverseNumber = ref(''), evidence = ref(''), confirmed = ref(false)
const expected = reactive<Record<number, string | number | null>>({})
const received = reactive<Record<number, string | number | null>>({})
const restock = reactive<Record<number, string | number | null>>({})
const openRefund = () => {
  const target = document.getElementById('shop-direct-refund')
  if (target instanceof HTMLDetailsElement) target.open = true
}
const itemName = (id: number) => props.order.items?.find(line => line.id === id)?.product_name || `Позиція №${id}`
const paths = { attach: 'attach', refresh: 'refresh', receive: 'physical-receipt' }
const flag = { attach: 'can_attach', refresh: 'can_refresh', receive: 'can_receive' } as const
const statuses = { not_attached: 'Зворотну ТТН ще не прив’язано', awaiting_return: 'Очікуємо зворотну посилку', arrived: 'Посилка прибула · очікує огляду', received: 'Товар прийнято після огляду' }
let sequence = 0
let active = true
const matches = (value: ReturnState, id: number) => value?.order_id === id && Number.isSafeInteger(value.revision)
  && Object.hasOwn(statuses, value.status) && Array.isArray(value.eligible_lines) && Array.isArray(value.claimed_lines) && Array.isArray(value.blocking_reasons)
const sameLines = <T extends { order_item_id: number }>(actual: T[], expected: T[]) =>
  actual.length === expected.length && expected.every(line => {
    const found = actual.find(candidate => candidate.order_item_id === line.order_item_id)
    return !!found && Object.entries(line).every(([field, value]) => found[field as keyof T] === value)
  })
const applied = (value: ReturnState, intent: Intent) => {
  if (intent.operation === 'attach') return value.original_shipment_id === intent.body.original_shipment_id
    && value.return_ttn === intent.body.return_ttn && sameLines(value.claimed_lines, intent.body.lines)
  if (intent.operation === 'receive') return !!value.receipt && value.receipt.operator_id === intent.operator_id
    && value.receipt.evidence === intent.body.evidence && sameLines(value.receipt.lines, intent.body.lines)
  return value.revision > intent.body.expected_revision && !!value.observation?.observed_at
    && value.observation.observed_at !== intent.previous_observed_at
}
const load = async () => {
  const request = ++sequence, id = props.order.id
  state.value = null; error.value = ''; confirmed.value = false
  if (!active || !auth.user?.id) return false
  loading.value = true
  try {
    const value = await api<ReturnState>(endpoint.value)
    if (request !== sequence) return false
    if (!matches(value, id)) throw new Error('Invalid Nova Poshta state')
    state.value = value
    const saved = command.intent.value
    if (saved && !command.busy.value && applied(value, saved.body)) {
      command.clear()
      command.error.value = ''
      emit('changed')
    }
    return true
  } catch (cause) {
    if (request === sequence) {
      const status = (cause as { response?: { status?: number } })?.response?.status
      error.value = status === 403 ? 'У вас немає дозволу на цей сценарій повернення.' : 'Не вдалося оновити стан повернення.'
    }
    return false
  } finally {
    if (request === sequence) loading.value = false
  }
}

const attachLines = computed(() => (state.value?.eligible_lines || []).map(line => ({
  order_item_id: line.order_item_id, quantity: Number(expected[line.order_item_id] ?? 0), limit: line.quantity,
})))
const receiveLines = computed(() => (state.value?.claimed_lines || []).map(line => {
  const id = line.order_item_id
  const quantity = Number(received[id] ?? 0), fit = Number(restock[id] ?? 0)
  return { order_item_id: id, received_quantity: quantity, restock_quantity: fit, damaged_quantity: quantity - fit, limit: line.quantity }
}))
const validQuantity = (value: number, limit: number) => Number.isSafeInteger(value) && value >= 0 && value <= limit
const canAttach = computed(() => !!state.value?.original_shipment_id && /^\d{14}$/.test(reverseNumber.value) && reverseNumber.value !== state.value?.original_ttn
  && attachLines.value.some(line => line.quantity > 0) && attachLines.value.every(line => validQuantity(line.quantity, line.limit)))
const canReceive = computed(() => confirmed.value && !!evidence.value.trim() && evidence.value.trim().length <= 500
  && receiveLines.value.length > 0 && receiveLines.value.every(line =>
    received[line.order_item_id] != null && received[line.order_item_id] !== ''
    && validQuantity(line.received_quantity, line.limit) && validQuantity(line.restock_quantity, line.received_quantity)))
const action = computed<Operation | undefined>(() => {
  const value = state.value, saved = command.intent.value?.body
  if (!value?.profile_id || !value.profile_hash) return
  if (saved) {
    if (saved.body.expected_profile_id === value.profile_id && saved.body.expected_profile_hash === value.profile_hash
      && (value[flag[saved.operation]] === true || command.intent.value?.resultId)) return saved.operation
    return
  }
  if (value.status === 'arrived') return value.can_receive ? 'receive' : undefined
  return value.can_refresh ? 'refresh' : value.can_attach ? 'attach' : undefined
})
const busy = computed(() => loading.value || command.busy.value)
const locked = computed(() => busy.value || !!command.intent.value)
const ready = computed(() => !!command.intent.value || (action.value === 'attach' ? canAttach.value : action.value === 'receive' ? canReceive.value : action.value === 'refresh'))
const reason = computed(() => {
  const code = state.value?.blocking_reasons[0]
  if (!code) {
    if (state.value?.status === 'arrived' && !state.value.can_receive) return 'Немає дозволу на фізичне приймання.'
    return ''
  }
  return ({
    np_return_tracking_stale: 'Дані НП застаріли. Оновіть звірку перед прийманням.',
    np_return_linkage_mismatch: 'Зворотна ТТН не пов’язана з вихідною.',
    np_return_delivery_required: 'Очікуємо підтвердження прибуття від НП.',
    np_direct_return_test_unsafe: 'Дія доступна в ізольованому тестовому режимі.',
    np_direct_return_dispatch_required: 'Потрібна підтверджена передача вихідної посилки.',
    np_direct_return_financial_active: 'Повернення коштів уже на звірці.',
    np_direct_return_binding_conflict: 'Дані вихідної посилки змінилися. Оновіть стан.',
    np_return_test_unsafe: 'Дія доступна в ізольованому тестовому режимі.',
    np_return_profile_conflict: 'Профіль змінився. Потрібна окрема звірка.',
  } as Record<string, string>)[code] || 'Наступна дія поки недоступна. Перевірте стан і дозволи.'
})
const execute = async () => {
  const value = state.value, operation = action.value
  if (!operation || !value?.profile_id || !value.profile_hash || busy.value || !ready.value) return
  const identity = { expected_revision: value.revision, expected_profile_id: value.profile_id, expected_profile_hash: value.profile_hash }
  const intent: Intent = command.intent.value?.body ?? (operation === 'attach'
    ? { operation, body: { ...identity, original_shipment_id: value.original_shipment_id!, return_ttn: reverseNumber.value,
      lines: attachLines.value.filter(line => line.quantity > 0).map(({ order_item_id, quantity }) => ({ order_item_id, quantity })) } }
    : operation === 'receive'
      ? { operation, operator_id: auth.user!.id, body: { ...identity, contents_verified: true, evidence: evidence.value.trim(),
        lines: receiveLines.value.map(({ limit: _limit, ...line }) => line) } }
      : { operation, body: identity, previous_observed_at: value.observation?.observed_at })
  const captured = scope.value, id = props.order.id, url = endpoint.value
  confirmed.value = false
  await command.execute(intent, async (saved, key) => {
    const result = await api<ReturnState>(`${url}/${paths[saved.operation]}`, {
      method: 'POST', body: saved.body, headers: { 'Idempotency-Key': key },
    })
    if (!matches(result, id) || !applied(result, saved)) throw new Error('Invalid Nova Poshta acknowledgement')
    return { id }
  }, async () => {
    if (!active || captured !== scope.value) return
    if (!await load()) throw new Error('Canonical return state unavailable')
    if (!active || captured !== scope.value) return
    command.clear()
    emit('changed')
  })
  if (active && captured === scope.value && command.error.value && !command.intent.value?.resultId) await load()
}
watch([scope, () => props.order.revision, () => props.refreshToken], () => {
  if (import.meta.client) void load()
}, { immediate: true, flush: 'sync' })
watch([received, restock, evidence], () => { confirmed.value = false }, { deep: true, flush: 'sync' })
watch(scope, () => {
  reverseNumber.value = ''; evidence.value = ''
  for (const form of [expected, received, restock]) for (const id in form) delete form[id]
}, { flush: 'sync' })
onBeforeUnmount(() => { active = false; sequence++ })
</script>

<template>
  <section class="base-card rounded-2xl space-y-3 p-4" aria-label="Повернення передоплати Новою поштою" :aria-busy="busy">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-semibold">Повернення передоплати Новою поштою</h3>
      <BaseButton variant="neutral" size="sm" :disabled="busy" @click="load">Оновити стан</BaseButton>
    </header>
    <p v-if="loading" role="status">Перевіряємо стан повернення…</p>
    <template v-if="state">
      <p class="text-ui-secondary text-sm">Тестові дані</p>
      <p role="status" class="font-semibold">{{ statuses[state.status] }}</p>
      <p v-if="state.observation?.original?.status === 'refused'">Відмова під час доставки</p>
      <p v-else-if="state.observation?.original?.status === 'delivered'">Повернення після отримання</p>
      <p v-if="state.observation?.linkage_kind === 'manual_document'" class="text-ui-secondary text-sm">Зв’язок ТТН підтверджено документом.</p>
      <dl class="grid gap-2 sm:grid-cols-2">
        <div v-if="state.original_ttn"><dt>Вихідна ТТН</dt><dd class="font-medium">{{ state.original_ttn }}</dd></div>
        <div v-if="state.return_ttn"><dt>Зворотна ТТН</dt><dd class="font-medium">{{ state.return_ttn }}</dd></div>
      </dl>
      <p v-if="state.case_id" class="text-ui-secondary text-sm">Остання звірка · {{ state.observation?.observed_at ? formatDateTime(state.observation.observed_at) : 'Ще не виконана' }}</p>
      <p v-if="reason">{{ reason }}</p>
      <div v-if="state.receipt">
        <p>Приймання · {{ formatDateTime(state.receipt.created_at) }}</p>
        <ul class="mt-2 space-y-1">
          <li v-for="line in state.receipt.lines" :key="line.order_item_id">
            {{ itemName(line.order_item_id) }} · прийнято {{ line.received_quantity }}, придатні {{ line.restock_quantity }}, пошкоджені {{ line.damaged_quantity }}
          </li>
        </ul>
        <a v-if="state.financial_refund_path" href="#shop-direct-refund" class="underline" @click="openRefund">Повернення коштів і чек</a>
      </div>
      <div v-if="action === 'attach' && !command.intent.value" class="grid gap-2">
        <BaseInput v-model="reverseNumber" label="Зворотна ТТН" maxlength="14" inputmode="numeric" :disabled="locked" />
        <BaseInput v-for="line in state.eligible_lines" :key="line.order_item_id" v-model="expected[line.order_item_id]" type="number"
          :label="`${itemName(line.order_item_id)} · заявлено до ${line.quantity} шт.`" :min="0" :max="line.quantity" :disabled="locked" />
      </div>
      <div v-if="action === 'receive' && !command.intent.value" class="grid gap-2">
        <fieldset v-for="line in state.claimed_lines" :key="line.order_item_id" class="grid gap-2 rounded-xl border border-ui p-3 sm:grid-cols-2">
          <legend>{{ itemName(line.order_item_id) }} · очікуємо {{ line.quantity }} шт.</legend>
          <BaseInput v-model="received[line.order_item_id]" type="number" :label="`Прийнято · ${itemName(line.order_item_id)}`" :min="0" :max="line.quantity" :disabled="locked" />
          <BaseInput v-model="restock[line.order_item_id]" type="number" :label="`Придатні · ${itemName(line.order_item_id)}`" :min="0" :max="Number(received[line.order_item_id] ?? 0)" :disabled="locked" />
          <p class="text-ui-secondary text-sm">Пошкоджені · {{ Math.max(0, Number(received[line.order_item_id] ?? 0) - Number(restock[line.order_item_id] ?? 0)) }} шт.</p>
        </fieldset>
        <BaseInput v-model="evidence" label="Доказ огляду посилки" :maxlength="500" :disabled="locked" />
        <BaseCheckbox v-model="confirmed" :disabled="locked">Підтверджую кількість і стан після огляду.</BaseCheckbox>
      </div>
      <BaseButton v-if="action" variant="primary" :disabled="busy || !ready" :data-testid="`np-direct-${action}`" @click="execute">
        {{ command.intent.value ? 'Повторити той самий запит' : action === 'attach' ? 'Прив’язати зворотну ТТН' : action === 'receive' ? 'Зафіксувати приймання' : 'Звірити статус НП' }}
      </BaseButton>
    </template>
    <p v-if="error || command.error.value" role="alert">{{ error || command.error.value }}</p>
  </section>
</template>
