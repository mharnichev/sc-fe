<script setup lang="ts">
import { shopCarrierPrefix, useShopCarrierRead } from '~/utils/shopCarrierReturns'
import type { ShopCarrierState } from '~/utils/shopCarrierReturns'
import OrderShopFiscal from '~/components/orders/OrderShopFiscal.vue'
import type { OrderResponse } from '~/composables/useBackofficeApi'
import { shopFiscalPrefix, shopFiscalMoney, shopFiscalReason, shopFiscalRejected, useShopFiscalRead } from '~/utils/shopFiscal'
import type { ShopFiscalOrder, ShopFiscalReturn, ShopFiscalLine } from '~/utils/shopFiscal'
const props = defineProps<{ order: OrderResponse, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi(), auth = useAuthStore(), resource = computed(() => String(props.order.id))
const context = () => JSON.stringify([auth.user, props.order.id])
const read = useShopFiscalRead<ShopFiscalOrder>(context, () => auth.user?.id ? api(`${shopFiscalPrefix}/orders/${props.order.id}`, { retry: 0 }) : Promise.reject(new Error('No actor')), value => value.order_id === props.order.id && Array.isArray(value.returns) && !!value.actions)
const { state, loading, error } = read
const isCarrier = computed(() => props.order.fulfillment_method === 'nova_poshta')
const carrierRead = useShopCarrierRead<ShopCarrierState>(context, () => api(shopCarrierPrefix(props.order.id), { retry: 0 }), value => value.order_id === props.order.id && Array.isArray(value.cases), () => !!auth.user?.id && isCarrier.value)
const carrierReceiptId = ref('')
const carrierCases = computed(() => (carrierRead.state.value?.cases || []).filter(item => item.financial_mode === 'paid' && item.receipt && item.actions.create_financial_return && item.financial_remaining_lines.length))
const carrierCase = computed(() => carrierCases.value.find(item => String(item.receipt!.id) === carrierReceiptId.value))
const carrierReady = computed(() => !!carrierRead.state.value && !carrierRead.loading.value && !carrierRead.error.value)
const reload = async () => { await Promise.all([read.load(), carrierRead.load()]) }
interface CreateBody { expected_revision: number, sale_document_id: number, carrier_receipt_id?: number, lines: Array<{ order_item_id: number, quantity: number }>, reason: string }
interface RefundBody { return_id: number, expected_revision: number, external_reference: string, evidence: string }
interface PhysicalBody { return_id: number, expected_revision: number, lines: Array<{ order_item_id: number, quantity: number, disposition: 'restock' | 'not_restock' }>, evidence: string }
const create = useOrderSalesCommand<CreateBody>('shop-fiscal-return-create', resource, shopFiscalRejected)
const refund = useOrderSalesCommand<RefundBody>('shop-fiscal-return-refund', resource, shopFiscalRejected)
const receive = useOrderSalesCommand<PhysicalBody>('shop-fiscal-return-receive', resource, shopFiscalRejected)
const list = [create, refund, receive], busy = computed(() => list.some(command => command.busy.value)), unresolved = computed(() => list.some(command => command.intent.value))
const quantities = ref<Record<number, number | string | null>>({}), reason = ref(''), confirmed = ref(false), selectedId = ref('')
const refundReference = ref(''), refundEvidence = ref(''), refundConfirmed = ref(false), receiptEvidence = ref(''), receiptConfirmed = ref(false), goodsFit = ref(false)
const dispositions = ref<Record<number, '' | 'restock' | 'not_restock'>>({})
const record = computed(() => state.value?.returns.find(item => String(item.id) === selectedId.value))
const remaining = (line: ShopFiscalLine) => Math.max(0, line.quantity - (state.value?.returns || []).flatMap(item => item.lines).filter(item => item.order_item_id === line.order_item_id).reduce((sum, item) => sum + item.quantity, 0))
const availableLines = computed(() => isCarrier.value ? (carrierCase.value?.financial_remaining_lines || []) : (state.value?.sale_document?.snapshot.items || []))
const availableQuantity = (line: { order_item_id: number, quantity: number }) => isCarrier.value ? line.quantity : remaining(line as ShopFiscalLine)
const selected = computed(() => availableLines.value.map(line => ({ order_item_id: line.order_item_id, quantity: Number(quantities.value[line.order_item_id] || 0) })).filter(line => line.quantity > 0))
const valid = computed(() => !!reason.value.trim() && (!isCarrier.value || (carrierReady.value && !!carrierCase.value)) && selected.value.length > 0 && selected.value.every(line => Number.isSafeInteger(line.quantity) && line.quantity <= availableQuantity(availableLines.value.find(item => item.order_item_id === line.order_item_id)!)))
const canCreate = computed(() => !!state.value && !loading.value && !busy.value && !(unresolved.value && !create.intent.value) && state.value.actions[create.intent.value ? 'replay_create_return' : 'create_return'] === true)
const carrierReceipt = computed(() => carrierRead.state.value?.cases.find(item => item.receipt?.id === record.value?.carrier_receipt_id)?.receipt)
const physicalLines = computed(() => (record.value?.lines || []).map(line => ({ order_item_id: line.order_item_id, quantity: line.quantity, disposition: record.value?.carrier_receipt_id ? (carrierReceipt.value?.lines.find(item => item.order_item_id === line.order_item_id && item.quantity >= line.quantity)?.disposition || '') : (dispositions.value[line.order_item_id] || '') })))
const physicalValid = computed(() => !!receiptEvidence.value.trim() && physicalLines.value.length > 0 && physicalLines.value.every(line => ['restock', 'not_restock'].includes(line.disposition)) && (record.value?.carrier_receipt_id ? carrierReady.value : (!physicalLines.value.some(line => line.disposition === 'restock') || goodsFit.value)))
const canRecord = (operation: 'refund' | 'physical_receipt') => {
  const command = operation === 'refund' ? refund : receive, saved = command.intent.value
  return !!record.value && !loading.value && !busy.value && !(unresolved.value && !saved) && (!saved || saved.body.return_id === record.value.id) && record.value.actions[saved ? `replay_${operation}` : operation] === true
}
watch(context, () => { quantities.value = {}; reason.value = ''; confirmed.value = false; selectedId.value = ''; carrierReceiptId.value = ''; refundReference.value = ''; refundEvidence.value = ''; receiptEvidence.value = ''; dispositions.value = {}; goodsFit.value = false; refundConfirmed.value = false; receiptConfirmed.value = false }, { immediate: true, flush: 'sync' })
watch([selectedId, () => record.value?.revision], () => { refundConfirmed.value = false; receiptConfirmed.value = false; goodsFit.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([reason.value, quantities.value, carrierReceiptId.value, state.value?.revision]), () => { confirmed.value = false }, { flush: 'sync' })
watch([refundReference, refundEvidence], () => { refundConfirmed.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([dispositions.value, receiptEvidence.value, goodsFit.value]), () => { receiptConfirmed.value = false }, { flush: 'sync' })
watch([create.intent, refund.intent, receive.intent], ([savedCreate, savedRefund, savedReceipt]) => {
  if (savedCreate) { carrierReceiptId.value = savedCreate.body.carrier_receipt_id ? String(savedCreate.body.carrier_receipt_id) : ''; reason.value = savedCreate.body.reason; quantities.value = Object.fromEntries(savedCreate.body.lines.map(line => [line.order_item_id, line.quantity])) }
  if (savedRefund) { selectedId.value = String(savedRefund.body.return_id); refundReference.value = savedRefund.body.external_reference; refundEvidence.value = savedRefund.body.evidence }
  if (savedReceipt) { selectedId.value = String(savedReceipt.body.return_id); receiptEvidence.value = savedReceipt.body.evidence; dispositions.value = Object.fromEntries(savedReceipt.body.lines.map(line => [line.order_item_id, line.disposition])) }
}, { immediate: true, flush: 'post' })
watch(carrierCases, items => { if (!create.intent.value && items.length && !items.some(item => String(item.receipt!.id) === carrierReceiptId.value)) carrierReceiptId.value = String(items[0]!.receipt!.id) })
watch(() => state.value?.returns, items => { if (items?.length && !items.some(item => String(item.id) === selectedId.value)) selectedId.value = String(items[0]!.id) })
watch([() => props.refreshToken, () => props.order.revision], () => { if (auth.user?.id) void reload() })
const accepted = async (version: number, clear: () => void) => {
  if (!read.current(version)) return
  if (!await read.load()) throw new Error('Canonical read unavailable')
  if (!read.current(version)) return
  if (isCarrier.value && !await carrierRead.load()) throw new Error('Carrier receipt read unavailable')
  if (!read.current(version)) return
  clear(); emit('changed')
}
const createReturn = async () => {
  if (!canCreate.value || !state.value || (!create.intent.value && (!valid.value || !confirmed.value || !state.value.sale_document))) return
  const version = read.version(); confirmed.value = false
  await create.execute(create.intent.value?.body || { expected_revision: state.value.revision, sale_document_id: state.value.sale_document!.id, ...(isCarrier.value ? { carrier_receipt_id: Number(carrierReceiptId.value) } : {}), lines: selected.value, reason: reason.value.trim() }, (body, key) => api<ShopFiscalReturn>(`${shopFiscalPrefix}/orders/${props.order.id}/returns`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }), () => accepted(version, () => { create.clear(); quantities.value = {}; reason.value = '' }))
  if (read.current(version) && !create.intent.value && create.error.value) await read.load()
}
const refundReturn = async () => {
  if (!canRecord('refund') || !record.value || (!refund.intent.value && (!refundReference.value.trim() || !refundEvidence.value.trim() || !refundConfirmed.value))) return
  const version = read.version(); refundConfirmed.value = false
  await refund.execute({ return_id: record.value.id, expected_revision: record.value.revision, external_reference: refundReference.value.trim(), evidence: refundEvidence.value.trim() }, (payload, key) => { const { return_id, ...body } = payload; return api<ShopFiscalReturn>(`${shopFiscalPrefix}/returns/${return_id}/refund`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }) }, () => accepted(version, () => { refund.clear(); refundReference.value = ''; refundEvidence.value = '' }))
  if (read.current(version) && !refund.intent.value && refund.error.value) await read.load()
}
const receiveReturn = async () => {
  if (!canRecord('physical_receipt') || !record.value || (!receive.intent.value && (!physicalValid.value || !receiptConfirmed.value))) return
  const version = read.version(); receiptConfirmed.value = false
  const body: PhysicalBody = receive.intent.value?.body || { return_id: record.value.id, expected_revision: record.value.revision, lines: physicalLines.value.map(line => ({ ...line, disposition: line.disposition as 'restock' | 'not_restock' })), evidence: receiptEvidence.value.trim() }
  await receive.execute(body, (payload, key) => { const { return_id, ...command } = payload; return api<ShopFiscalReturn>(`${shopFiscalPrefix}/returns/${return_id}/physical-receipt`, { method: 'POST', body: command, headers: { 'Idempotency-Key': key }, retry: 0 }) }, () => accepted(version, () => { receive.clear(); receiptEvidence.value = ''; dispositions.value = {}; goodsFit.value = false }))
  if (read.current(version) && !receive.intent.value && receive.error.value) await read.load()
}
const changed = async () => { await reload(); emit('changed') }
</script>
<template>
  <section aria-label="Повернення магазину" class="space-y-4 rounded-[1.75rem] border border-amber-200 bg-white p-6">
    <h2 class="text-xl font-semibold">Повернення магазину</h2><p class="rounded-xl bg-amber-100 p-3 font-semibold text-amber-950" role="status">ТЕСТОВІ ФАКТИ · гроші, склад і повернення чека записуються окремо. Реальних списань та повідомлень немає.</p>
    <BaseButton variant="neutral" :disabled="loading || busy" @click="reload">Оновити повернення магазину</BaseButton>
    <template v-if="state">
      <p v-for="code in state.blocking_reasons" :key="code">{{ shopFiscalReason(code) }}</p>
      <div v-if="state.actions.create_return || create.intent.value" class="space-y-3">
        <p>Незмінний запит резервує кількості з виданого чека. Сума обчислюється сервером за початковим продажем.</p>
        <BaseSelect v-if="isCarrier" id="shop-financial-carrier-receipt" v-model="carrierReceiptId" label="Приймання НП для фінансового повернення" aria-labelledby="shop-financial-carrier-receipt-label" native :disabled="busy || unresolved || !carrierReady"><option value="">Оберіть приймання</option><option v-for="item in carrierCases" :key="item.id" :value="String(item.receipt!.id)">Приймання #{{ item.receipt!.id }} · випадок #{{ item.id }}</option></BaseSelect><p v-if="isCarrier">Доступні лише прийняті та ще не пов’язані з фінансовим поверненням кількості. Нового оприбуткування тут немає.</p>
        <div v-for="line in availableLines" :key="line.order_item_id"><p>{{ line.name || line.product_id }} · доступно {{ availableQuantity(line) }} з {{ line.quantity }}</p><BaseInput v-model="quantities[line.order_item_id]" type="number" :min="0" :max="availableQuantity(line)" :step="1" :label="`Кількість повернення ${line.name || line.order_item_id}`" :disabled="busy || unresolved" /></div>
        <BaseInput v-model="reason" label="Причина повернення магазину" :maxlength="500" :disabled="busy || unresolved" />
        <BaseCheckbox v-if="!create.intent.value" v-model="confirmed" label="Підтверджую незмінний запит обраних кількостей; гроші та приймання оформлю окремо." :disabled="!valid || busy || loading" />
        <BaseButton :disabled="!canCreate || (!create.intent.value && (!valid || !confirmed))" @click="createReturn">{{ create.intent.value ? 'Повторити те саме створення повернення' : 'Створити повернення магазину' }}</BaseButton>
      </div>
      <article v-for="item in state.returns" :key="item.id" class="border-t pt-3"><h3 class="font-semibold">Тестове повернення #{{ item.id }} · {{ shopFiscalMoney(item.amount_minor) }}</h3><p>{{ item.reason }} · гроші {{ item.refund ? 'підтверджено окремо' : 'не підтверджено' }} · приймання {{ item.physical_receipt ? 'підтверджено окремо' : 'не підтверджено' }} · чек {{ item.fiscal_document ? `#${item.fiscal_document.id}` : 'не видано' }}</p></article>
      <BaseSelect v-if="state.returns.length" id="shop-fiscal-return-select" v-model="selectedId" label="Повернення для окремих дій" aria-labelledby="shop-fiscal-return-select-label" native :disabled="busy || unresolved"><option v-for="item in state.returns" :key="item.id" :value="String(item.id)">#{{ item.id }} · {{ shopFiscalMoney(item.amount_minor) }}</option></BaseSelect>
      <article v-if="record" :aria-label="`Окремі факти повернення магазину #${record.id}`" class="space-y-4 rounded-xl bg-amber-50 p-4">
        <h3 class="font-semibold">Окремі факти #{{ record.id }} · {{ shopFiscalMoney(record.amount_minor) }}</h3>
        <p v-if="record.carrier_receipt_id">Фінансове повернення за прийманням НП #{{ record.carrier_receipt_id }}. Фізичний зв’язок фіксується окремо без повторної зміни складу.</p><ul><li v-for="line in record.lines" :key="line.order_item_id">{{ line.name || line.product_id }} · {{ line.quantity }} · {{ shopFiscalMoney(line.total_minor) }}</li></ul>
        <p v-for="code in record.blocking_reasons" :key="code">{{ shopFiscalReason(code) }}</p>
        <p v-if="record.refund">Гроші підтверджено: {{ shopFiscalMoney(record.refund.amount_minor) }} · {{ record.refund.method }} · {{ record.refund.external_reference }} · {{ record.refund.evidence }}</p>
        <div v-if="record.actions.refund || refund.intent.value" class="space-y-3"><p>Спосіб та сума повернення визначаються сервером за вихідним платежем. Склад не змінюється.</p><BaseInput v-model="refundReference" label="Референс повернення грошей" :disabled="busy || unresolved" /><BaseInput v-model="refundEvidence" label="Доказ повернення грошей" :maxlength="500" :disabled="busy || unresolved" /><BaseCheckbox v-model="refundConfirmed" :label="`Підтверджую окремий тестовий факт повернення ${shopFiscalMoney(record.amount_minor)}`" :disabled="busy || unresolved" /><BaseButton :disabled="!canRecord('refund') || (!refund.intent.value && (!refundConfirmed || !refundReference.trim() || !refundEvidence.trim()))" @click="refundReturn">{{ refund.intent.value ? 'Повторити те саме повернення грошей' : 'Підтвердити повернення грошей' }}</BaseButton></div>
        <p v-if="record.physical_receipt">Приймання підтверджено: {{ record.physical_receipt.evidence }}<span v-for="line in record.physical_receipt.lines" :key="line.order_item_id"> · #{{ line.order_item_id }} {{ line.quantity }} {{ line.disposition === 'restock' ? 'оприбутковано в тестову БД' : 'без оприбуткування' }}</span></p>
        <div v-if="record.actions.physical_receipt || receive.intent.value" class="space-y-3"><p>{{ record.carrier_receipt_id ? 'Зв’язок з незмінним прийманням НП: кількості та рішення щодо складу збережено. Ця дія не змінює склад повторно.' : 'Приймання охоплює всі кількості цього запиту. Факт доставки не оприбутковує товар автоматично.' }}</p><ul v-if="record.carrier_receipt_id"><li v-for="line in physicalLines" :key="line.order_item_id">#{{ line.order_item_id }} · {{ line.quantity }} · {{ line.disposition === 'restock' ? 'оприбутковано первинним прийманням' : line.disposition === 'not_restock' ? 'без оприбуткування' : 'потрібно перевірити первинне приймання' }}</li></ul><template v-else><BaseSelect v-for="line in record.lines" :id="`shop-return-disposition-${record.id}-${line.order_item_id}`" :key="line.order_item_id" v-model="dispositions[line.order_item_id]" :label="`Рішення щодо ${line.name || line.order_item_id}`" :aria-labelledby="`shop-return-disposition-${record.id}-${line.order_item_id}-label`" native :disabled="busy || unresolved"><option value="">Оберіть рішення</option><option value="restock">Оприбуткувати в тестову БД</option><option value="not_restock">Прийняти без оприбуткування</option></BaseSelect></template><BaseInput v-model="receiptEvidence" label="Доказ фізичного приймання магазину" :maxlength="500" :disabled="busy || unresolved" /><BaseCheckbox v-if="!record.carrier_receipt_id" v-model="goodsFit" label="Перевірено придатність товару для оприбуткування." :disabled="busy || unresolved" /><BaseCheckbox v-model="receiptConfirmed" label="Підтверджую фізичне приймання всіх кількостей і кожне рішення щодо складу." :disabled="busy || unresolved || !physicalValid" /><BaseButton :disabled="!canRecord('physical_receipt') || (!receive.intent.value && (!physicalValid || !receiptConfirmed))" @click="receiveReturn">{{ receive.intent.value ? 'Повторити те саме фізичне приймання' : record.carrier_receipt_id ? 'Пов’язати приймання НП без зміни складу' : 'Зафіксувати фізичне приймання магазину' }}</BaseButton></div>
        <OrderShopFiscal :key="`${auth.user?.id}:${record.id}`" :order="order" :return-id="record.id" :refresh-token="refreshToken" @changed="changed" />
      </article>
    </template>
    <p v-for="message in [error, carrierRead.error.value, ...list.map(command => command.error.value)].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
