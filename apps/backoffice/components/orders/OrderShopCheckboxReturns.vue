<script setup lang="ts">
import OrderShopCheckboxFiscal from '~/components/orders/OrderShopCheckboxFiscal.vue'
import type { OrderResponse } from '~/composables/useBackofficeApi'
import { shopCheckboxPrefix, checkboxMoney, checkboxReason, checkboxNotice, checkboxAuthorityValid, checkboxCancellationBasis, useCheckboxRead, useCheckboxCommand } from '~/utils/shopCheckboxFiscal'
import type { CheckboxOrder, CheckboxReturn, CheckboxLine, CheckboxReadiness } from '~/utils/shopCheckboxFiscal'
const props = defineProps<{ order: OrderResponse, refreshToken?: number, profileReady?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi(), auth = useAuthStore(), resource = computed(() => `order:${props.order.id}`)
const context = () => JSON.stringify([auth.user, props.order.id])
interface Panel extends CheckboxOrder { readiness: CheckboxReadiness }
const read = useCheckboxRead<Panel>(context, async () => {
  if (!auth.user?.id) throw new Error('No actor')
  const [entity, readiness] = await Promise.all([api<CheckboxOrder>(`${shopCheckboxPrefix}/orders/${props.order.id}`, { retry: 0 }), api<CheckboxReadiness>(`${shopCheckboxPrefix}/readiness`, { retry: 0 })])
  return { ...entity, readiness }
}, value => value.profile === 'checkbox' && value.order_id === props.order.id && Array.isArray(value.returns) && !!value.actions && checkboxAuthorityValid(value.readiness), value => JSON.stringify([value.readiness.register?.id || value.readiness.profile_id, value.authority, value.transport]))
const register = () => read.state.value?.readiness.register?.id || read.state.value?.readiness.profile_id || undefined
const { state, loading, error } = read
interface CreateBody { expected_revision: number, sale_document_id: number, lines: Array<{ order_item_id: number, quantity: number }>, reason: string }
interface RefundBody { return_id: number, expected_revision: number, external_reference: string, evidence: string }
interface PhysicalBody { return_id: number, expected_revision: number, lines: Array<{ order_item_id: number, quantity: number, disposition: 'restock' | 'not_restock' }>, evidence: string }
const create = useCheckboxCommand<CreateBody>('return-create', resource, register)
const refund = useCheckboxCommand<RefundBody>('return-refund', resource, register)
const receive = useCheckboxCommand<PhysicalBody>('return-receive', resource, register)
const list = [create, refund, receive], busy = computed(() => list.some(command => command.busy.value)), unresolved = computed(() => list.some(command => command.intent.value))
const quantities = ref<Record<number, number | string | null>>({}), reason = ref(''), confirmed = ref(false), selectedId = ref('')
const refundReference = ref(''), refundEvidence = ref(''), refundConfirmed = ref(false), receiptEvidence = ref(''), receiptConfirmed = ref(false), goodsFit = ref(false)
const dispositions = ref<Record<number, '' | 'restock' | 'not_restock'>>({})
const recovered = shallowRef<CheckboxReturn | null>(null), recoveryError = ref('')
const pendingReturnId = computed(() => refund.intent.value?.body.return_id || receive.intent.value?.body.return_id || create.intent.value?.resultId)
const record = computed(() => { const id = pendingReturnId.value || Number(selectedId.value); return state.value?.returns.find(item => item.id === id) || (recovered.value?.id === id ? recovered.value : null) })
let recoverySequence = 0
const hydrateReturn = async (id: number) => {
  const version = read.version(), sequence = ++recoverySequence
  try { const value = await api<CheckboxReturn>(`${shopCheckboxPrefix}/returns/${id}`, { retry: 0 }); if (!read.current(version) || sequence !== recoverySequence) return false; if (!checkboxAuthorityValid(value) || value.id !== id || value.order_id !== props.order.id || !value.actions) throw new Error('Invalid saved return'); recovered.value = value; recoveryError.value = ''; return true }
  catch { if (read.current(version) && sequence === recoverySequence) { recovered.value = null; recoveryError.value = 'Не вдалося відновити оригінальне повернення. Точний запит збережено.' } return false }
}
watch([pendingReturnId, () => state.value], () => { if (state.value && pendingReturnId.value && !state.value.returns.some(item => item.id === pendingReturnId.value)) void hydrateReturn(pendingReturnId.value) })
onScopeDispose(() => { recoverySequence++ })
const remaining = (line: CheckboxLine) => Math.max(0, line.quantity - (state.value?.returns || []).flatMap(item => item.lines).filter(item => item.order_item_id === line.order_item_id).reduce((sum, item) => sum + item.quantity, 0))
const selected = computed(() => (state.value?.sale_document?.snapshot.items || []).map(line => ({ order_item_id: line.order_item_id, quantity: Number(quantities.value[line.order_item_id] || 0) })).filter(line => line.quantity > 0))
const valid = computed(() => !!reason.value.trim() && selected.value.length > 0 && selected.value.every(line => Number.isSafeInteger(line.quantity) && line.quantity <= remaining(state.value!.sale_document!.snapshot.items.find(item => item.order_item_id === line.order_item_id)!)))
const canCreate = computed(() => props.profileReady !== false && (props.order.fulfillment_method === 'pickup' || !!create.intent.value) && !!state.value && !loading.value && !busy.value && !(unresolved.value && !create.intent.value) && state.value.actions[create.intent.value ? 'replay_create_return' : 'create_return'] === true)
const physicalLines = computed(() => (record.value?.lines || []).map(line => ({ order_item_id: line.order_item_id, quantity: line.quantity, disposition: dispositions.value[line.order_item_id] || '' })))
const physicalValid = computed(() => !!receiptEvidence.value.trim() && physicalLines.value.length > 0 && physicalLines.value.every(line => ['restock', 'not_restock'].includes(line.disposition)) && (!physicalLines.value.some(line => line.disposition === 'restock') || goodsFit.value))
const canRecord = (operation: 'refund' | 'physical_receipt') => {
  const command = operation === 'refund' ? refund : receive, saved = command.intent.value
  if (operation === 'physical_receipt' && (record.value?.carrier_receipt_id || record.value?.cancellation_case_id || record.value?.physical_not_required)) return false
  return props.profileReady !== false && !!record.value && !loading.value && !busy.value && !(unresolved.value && !saved) && (!saved || saved.body.return_id === record.value.id) && record.value.actions[saved ? `replay_${operation}` : operation] === true
}
watch(context, () => { recoverySequence++; recovered.value = null; recoveryError.value = ''; quantities.value = {}; reason.value = ''; confirmed.value = false; selectedId.value = ''; refundReference.value = ''; refundEvidence.value = ''; receiptEvidence.value = ''; dispositions.value = {}; goodsFit.value = false; refundConfirmed.value = false; receiptConfirmed.value = false }, { immediate: true, flush: 'sync' })
watch([selectedId, () => record.value?.revision], () => { refundConfirmed.value = false; receiptConfirmed.value = false; goodsFit.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([reason.value, quantities.value, state.value?.revision]), () => { confirmed.value = false }, { flush: 'sync' })
watch([refundReference, refundEvidence], () => { refundConfirmed.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([dispositions.value, receiptEvidence.value, goodsFit.value]), () => { receiptConfirmed.value = false }, { flush: 'sync' })
watch([create.intent, refund.intent, receive.intent], ([savedCreate, savedRefund, savedReceipt]) => {
  if (savedCreate) { reason.value = savedCreate.body.reason; quantities.value = Object.fromEntries(savedCreate.body.lines.map(line => [line.order_item_id, line.quantity])) }
  if (savedRefund) { selectedId.value = String(savedRefund.body.return_id); refundReference.value = savedRefund.body.external_reference; refundEvidence.value = savedRefund.body.evidence }
  if (savedReceipt) { selectedId.value = String(savedReceipt.body.return_id); receiptEvidence.value = savedReceipt.body.evidence; dispositions.value = Object.fromEntries(savedReceipt.body.lines.map(line => [line.order_item_id, line.disposition])) }
}, { immediate: true, flush: 'post' })
watch(() => state.value?.returns, items => { if (pendingReturnId.value) selectedId.value = String(pendingReturnId.value); else if (items?.length && !items.some(item => String(item.id) === selectedId.value)) selectedId.value = String(items[0]!.id) })
watch([() => props.refreshToken, () => props.order.revision], () => { if (auth.user?.id) void read.load() })
const accepted = async (version: number, id: number, clear: () => void) => {
  if (!read.current(version)) return
  if (!await read.load()) throw new Error('Canonical read unavailable')
  if (!read.current(version)) return
  if (!state.value?.returns.some(item => item.id === id) && !await hydrateReturn(id)) throw new Error('Original return unavailable')
  if (!read.current(version)) return
  clear(); selectedId.value = String(id); emit('changed')
}
const createReturn = async () => {
  if (!canCreate.value || !state.value || (!create.intent.value && (!valid.value || !confirmed.value || !state.value.sale_document))) return
  const version = read.version(); confirmed.value = false
  await create.execute(create.intent.value?.body || { expected_revision: state.value.revision, sale_document_id: state.value.sale_document!.id, lines: selected.value, reason: reason.value.trim() }, (body, key) => api<CheckboxReturn>(`${shopCheckboxPrefix}/orders/${props.order.id}/returns`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }), id => accepted(version, id, () => { create.clear(); quantities.value = {}; reason.value = '' }))
  if (read.current(version) && !create.intent.value && create.error.value) await read.load()
}
const refundReturn = async () => {
  if (!canRecord('refund') || !record.value || (!refund.intent.value && (!refundReference.value.trim() || !refundEvidence.value.trim() || !refundConfirmed.value))) return
  const version = read.version(); refundConfirmed.value = false
  await refund.execute({ return_id: record.value.id, expected_revision: record.value.revision, external_reference: refundReference.value.trim(), evidence: refundEvidence.value.trim() }, (payload, key) => { const { return_id, ...body } = payload; return api<CheckboxReturn>(`${shopCheckboxPrefix}/returns/${return_id}/refund`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }) }, id => accepted(version, id, () => { refund.clear(); refundReference.value = ''; refundEvidence.value = '' }))
  if (read.current(version) && !refund.intent.value && refund.error.value) await read.load()
}
const receiveReturn = async () => {
  if (!canRecord('physical_receipt') || !record.value || (!receive.intent.value && (!physicalValid.value || !receiptConfirmed.value))) return
  const version = read.version(); receiptConfirmed.value = false
  const body: PhysicalBody = receive.intent.value?.body || { return_id: record.value.id, expected_revision: record.value.revision, lines: physicalLines.value.map(line => ({ ...line, disposition: line.disposition as 'restock' | 'not_restock' })), evidence: receiptEvidence.value.trim() }
  await receive.execute(body, (payload, key) => { const { return_id, ...command } = payload; return api<CheckboxReturn>(`${shopCheckboxPrefix}/returns/${return_id}/physical-receipt`, { method: 'POST', body: command, headers: { 'Idempotency-Key': key }, retry: 0 }) }, id => accepted(version, id, () => { receive.clear(); receiptEvidence.value = ''; dispositions.value = {}; goodsFit.value = false }))
  if (read.current(version) && !receive.intent.value && receive.error.value) await read.load()
}
const reload = async () => { if (await read.load() && pendingReturnId.value && !state.value?.returns.some(item => item.id === pendingReturnId.value)) await hydrateReturn(pendingReturnId.value) }
const changed = async () => { await read.load(); emit('changed') }
</script>
<template>
  <section aria-label="Повернення Checkbox" class="space-y-4 rounded-[1.75rem] border border-amber-200 bg-white p-6 text-slate-900">
    <h2 class="text-xl font-semibold">Повернення Checkbox</h2><p v-if="state" class="rounded-xl bg-amber-100 p-3 font-semibold text-amber-950" role="status">{{ checkboxNotice(state) }}</p><p>Ручний запис доказів повернення грошей не виконує банківського переказу. Повернення чека й фізичне приймання — окремі факти.</p>
    <BaseButton variant="neutral" :disabled="loading || busy" @click="reload">Оновити повернення Checkbox</BaseButton>
    <template v-if="state">
      <p v-for="code in state.blocking_reasons" :key="code">{{ checkboxReason(code) }}</p>
      <div v-if="state.actions.create_return || create.intent.value" class="space-y-3">
        <p>Незмінний запит резервує кількості з виданого чека. Сума обчислюється сервером за початковим продажем.</p>
        <div v-for="line in state.sale_document?.snapshot.items || []" :key="line.order_item_id"><p>{{ line.name || line.product_id }} · доступно {{ remaining(line) }} з {{ line.quantity }}</p><BaseInput v-model="quantities[line.order_item_id]" type="number" :min="0" :max="remaining(line)" :step="1" :label="`Кількість повернення ${line.name || line.order_item_id}`" :disabled="busy || unresolved" /></div>
        <BaseInput v-model="reason" label="Причина повернення Checkbox" :maxlength="500" :disabled="busy || unresolved" />
        <BaseCheckbox v-if="!create.intent.value" v-model="confirmed" label="Підтверджую незмінний запит обраних кількостей; гроші та приймання оформлю окремо." :disabled="!valid || busy || loading" />
        <BaseButton :disabled="!canCreate || (!create.intent.value && (!valid || !confirmed))" @click="createReturn">{{ create.intent.value ? 'Повторити те саме створення повернення' : 'Створити повернення Checkbox' }}</BaseButton>
      </div>
      <article v-for="item in state.returns" :key="item.id" class="border-t pt-3"><h3 class="font-semibold">Повернення Checkbox #{{ item.id }} · {{ checkboxMoney(item.amount_minor) }}</h3><p>{{ item.reason }} · гроші {{ item.refund ? 'підтверджено окремо' : 'не підтверджено' }} · приймання {{ checkboxCancellationBasis(item) ? 'не потрібне — товар не передавався' : item.cancellation_case_id || item.physical_not_required ? 'підстава потребує звірки' : item.physical_receipt ? 'підтверджено окремо' : 'не підтверджено' }} · чек {{ item.fiscal_document ? `#${item.fiscal_document.id}` : 'не видано' }}</p></article>
      <BaseSelect v-if="state.returns.length" id="shop-fiscal-return-select" v-model="selectedId" label="Повернення для окремих дій" aria-labelledby="shop-fiscal-return-select-label" native :disabled="busy || unresolved"><option v-for="item in state.returns" :key="item.id" :value="String(item.id)">#{{ item.id }} · {{ checkboxMoney(item.amount_minor) }}</option></BaseSelect>
      <article v-if="record" :aria-label="`Окремі факти повернення Checkbox #${record.id}`" class="space-y-4 rounded-xl p-4" style="background: var(--bo-surface); color: var(--bo-text-primary)">
        <h3 class="font-semibold">Окремі факти #{{ record.id }} · {{ checkboxMoney(record.amount_minor) }}</h3>
        <ul><li v-for="line in record.lines" :key="line.order_item_id">{{ line.name || line.product_id }} · {{ line.quantity }} · {{ checkboxMoney(line.total_minor) }}</li></ul>
        <p v-for="code in record.blocking_reasons" :key="code">{{ checkboxReason(code) }}</p>
        <p v-if="record.refund">Гроші підтверджено: {{ checkboxMoney(record.refund.amount_minor) }} · {{ record.refund.method }} · {{ record.refund.external_reference }} · {{ record.refund.evidence }}</p>
        <div v-if="record.actions.refund || refund.intent.value" class="space-y-3"><p>Спосіб та сума визначаються сервером за вихідним платежем. Це лише запис перевірених доказів співробітника: банківський переказ не виконується, склад не змінюється.</p><BaseInput v-model="refundReference" label="Референс повернення грошей" :disabled="busy || unresolved" /><BaseInput v-model="refundEvidence" label="Доказ повернення грошей" :maxlength="500" :disabled="busy || unresolved" /><BaseCheckbox v-model="refundConfirmed" :label="`Підтверджую окремий запис перевірених співробітником доказів повернення ${checkboxMoney(record.amount_minor)}`" :disabled="busy || unresolved" /><BaseButton :disabled="!canRecord('refund') || (!refund.intent.value && (!refundConfirmed || !refundReference.trim() || !refundEvidence.trim()))" @click="refundReturn">{{ refund.intent.value ? 'Повторити те саме повернення грошей' : 'Підтвердити повернення грошей' }}</BaseButton></div>
        <p v-if="checkboxCancellationBasis(record)" role="status">Приймання не потрібне: товар не передавався. Підстава — заявка повного скасування #{{ record.cancellation_case_id }}. Звільнення резерву є окремою фінальною дією цієї заявки; цей запис не оприбутковує товар.</p>
        <p v-else-if="record.cancellation_case_id || record.physical_not_required" role="status">Підстава звільнення від фізичного приймання потребує звірки. Фізична дія заблокована.</p>
        <p v-if="record.carrier_receipt_id" role="status">Успадковано окреме приймання НП #{{ record.carrier_receipt_id }}. Рішення щодо складу незмінні; повторного приймання або складського руху немає.</p>
        <p v-if="record.physical_receipt">Приймання підтверджено: {{ record.physical_receipt.evidence }}<span v-for="line in record.physical_receipt.lines" :key="line.order_item_id"> · #{{ line.order_item_id }} {{ line.quantity }} {{ line.disposition === 'restock' ? 'оприбутковано за окремим фактом приймання' : 'без оприбуткування' }}</span></p>
        <div v-if="!record.carrier_receipt_id && !record.cancellation_case_id && !record.physical_not_required && (record.actions.physical_receipt || receive.intent.value)" class="space-y-3"><p>Приймання охоплює всі кількості цього запиту. Факт доставки не оприбутковує товар автоматично.</p><BaseSelect v-for="line in record.lines" :id="`shop-return-disposition-${record.id}-${line.order_item_id}`" :key="line.order_item_id" v-model="dispositions[line.order_item_id]" :label="`Рішення щодо ${line.name || line.order_item_id}`" :aria-labelledby="`shop-return-disposition-${record.id}-${line.order_item_id}-label`" native :disabled="busy || unresolved"><option value="">Оберіть рішення</option><option value="restock">Оприбуткувати товар</option><option value="not_restock">Прийняти без оприбуткування</option></BaseSelect><BaseInput v-model="receiptEvidence" label="Доказ фізичного приймання Checkbox" :maxlength="500" :disabled="busy || unresolved" /><BaseCheckbox v-model="goodsFit" label="Перевірено придатність товару для оприбуткування." :disabled="busy || unresolved" /><BaseCheckbox v-model="receiptConfirmed" label="Підтверджую фізичне приймання всіх кількостей і кожне рішення щодо складу." :disabled="busy || unresolved || !physicalValid" /><BaseButton :disabled="!canRecord('physical_receipt') || (!receive.intent.value && (!physicalValid || !receiptConfirmed))" @click="receiveReturn">{{ receive.intent.value ? 'Повторити те саме фізичне приймання' : 'Зафіксувати фізичне приймання Checkbox' }}</BaseButton></div>
        <OrderShopCheckboxFiscal :profile-ready="profileReady" :key="`${auth.user?.id}:${record.id}`" :order="order" :return-id="record.id" :refresh-token="refreshToken" @changed="changed" />
      </article>
    </template>
    <p v-for="message in [error, recoveryError, ...list.map(command => command.error.value)].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
