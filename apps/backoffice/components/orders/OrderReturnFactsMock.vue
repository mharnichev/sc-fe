<script setup lang="ts">
import OrderFiscalMock from '~/components/orders/OrderFiscalMock.vue'
import type { MockReturn, MockReturnReceipt, MockReturnRefund, OrderResponse } from '~/composables/useBackofficeApi'
import { fiscalMoney, fiscalDefinitiveRejections } from '~/utils/fiscalMock'
const props = defineProps<{ record: MockReturn, order: OrderResponse, enabled: boolean, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useBackofficeApi(), auth = useAuthStore()
const resource = computed(() => `${props.order.id}:return:${props.record.id}`)
const refund = useOrderSalesCommand<MockReturnRefund>('mock-return-refund', resource, fiscalDefinitiveRejections)
const receipt = useOrderSalesCommand<MockReturnReceipt>('mock-return-receive', resource, fiscalDefinitiveRejections)
const busy = computed(() => refund.busy.value || receipt.busy.value), unresolved = computed(() => !!refund.intent.value || !!receipt.intent.value)
const refundEvidence = ref(''), receiptEvidence = ref(''), method = ref<'cash' | 'card'>('cash'), refundConfirmed = ref(false), goodsFit = ref(false), receiptConfirmed = ref(false)
const dispositions = ref<Record<number, '' | 'restock' | 'not_restock'>>({})
const qrSale = computed(() => props.order.payments?.some(payment => payment.method === 'monobank_qr') === true)
const refundPermission = computed(() => props.enabled && (auth.user?.is_superuser || auth.user?.can_record_sales === true))
const receivePermission = computed(() => props.enabled && (auth.user?.is_superuser || auth.user?.can_post_inventory === true))
const canRefund = computed(() => refundPermission.value && props.record.allowed_actions.includes('refund'))
const canReceive = computed(() => receivePermission.value && props.record.allowed_actions.includes('receive'))
const receiptItems = computed(() => props.record.items.map(item => ({ order_item_id: item.order_item_id, quantity: item.quantity, disposition: dispositions.value[item.order_item_id] || '' })))
const receiptValid = computed(() => !!receiptEvidence.value.trim() && receiptItems.value.every(item => item.disposition === 'restock' || item.disposition === 'not_restock') && (!receiptItems.value.some(item => item.disposition === 'restock') || goodsFit.value))
let generation = 0
watch([() => auth.user?.id, () => props.order.id, () => props.record.id], () => { generation++; refundEvidence.value = ''; receiptEvidence.value = ''; dispositions.value = {}; goodsFit.value = false; refundConfirmed.value = false; receiptConfirmed.value = false }, { immediate: true, flush: 'sync' })
watch(() => JSON.stringify([props.record.amount_minor, method.value, refundEvidence.value]), () => { refundConfirmed.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([receiptItems.value, receiptEvidence.value, goodsFit.value]), () => { receiptConfirmed.value = false }, { flush: 'sync' })
const runRefund = async () => {
  if (!refundPermission.value || busy.value || (!refund.intent.value && (!canRefund.value || unresolved.value || !refundEvidence.value.trim() || !refundConfirmed.value))) return
  const version = generation, id = props.record.id
  const body = refund.intent.value?.body || { method: qrSale.value ? 'monobank_qr' as const : method.value, evidence: refundEvidence.value.trim() }
  refundConfirmed.value = false
  await refund.execute(body, (payload, key) => api.refundMockReturn(id, payload, key), async () => { if (version !== generation) return; refund.clear(); emit('changed') })
}
const runReceipt = async () => {
  if (!receivePermission.value || busy.value || (!receipt.intent.value && (!canReceive.value || unresolved.value || !receiptValid.value || !receiptConfirmed.value))) return
  const version = generation, id = props.record.id
  const body: MockReturnReceipt = receipt.intent.value?.body || { evidence: receiptEvidence.value.trim(), items: receiptItems.value.map(item => ({ ...item, disposition: item.disposition as 'restock' | 'not_restock' })) }
  receiptConfirmed.value = false; goodsFit.value = false
  await receipt.execute(body, (payload, key) => api.receiveMockReturn(id, payload, key), async () => { if (version !== generation) return; receipt.clear(); emit('changed') })
}
</script>
<template>
  <article :aria-label="`MOCK повернення #${record.id}`" class="space-y-4 rounded-xl border border-amber-200 p-4">
    <h3 class="font-semibold">MOCK повернення #{{ record.id }} · продаж #{{ record.parent_sale_id }} · {{ fiscalMoney(record.amount_minor) }}</h3>
    <p>{{ record.reason }} · {{ record.created_at }}</p><ul><li v-for="item in record.items" :key="item.order_item_id">{{ item.name }} · {{ item.quantity }} · {{ fiscalMoney(item.total_minor) }}</li></ul>
    <p>Гроші: {{ record.refund ? `MOCK підтверджено ${fiscalMoney(record.refund.amount_minor)} · ${record.refund.evidence}` : 'повернення коштів не підтверджено' }}</p>
    <p>Фіскальні MOCK документи: {{ record.fiscal_document_ids.join(', ') || 'ще немає' }}. Стан документа показано нижче.</p>
    <p>Фізичне приймання: {{ record.receipt ? `зафіксовано · ${record.receipt.evidence}` : 'ще не зафіксовано; склад не змінено' }}</p>
    <ul v-if="record.receipt"><li v-for="item in record.receipt.items" :key="item.order_item_id">Позиція #{{ item.order_item_id }} · {{ item.quantity }} · {{ item.disposition === 'restock' ? 'оприбутковано в тестову БД' : 'без оприбуткування' }}</li></ul>
    <div v-if="(canRefund || (refundPermission && refund.intent.value)) && !record.refund" class="space-y-3">
      <p v-if="qrSale">Повернення monobank QR MOCK за оригінальним способом оплати — без реального списання.</p>
      <label v-else>Спосіб MOCK повернення грошей<BaseSelect v-model="method" native :disabled="busy || unresolved"><option value="cash">Готівка MOCK</option><option value="card">Картка MOCK — без списання</option></BaseSelect></label>
      <BaseInput v-model="refundEvidence" label="Доказ MOCK повернення грошей" :maxlength="500" :disabled="busy || unresolved" />
      <BaseCheckbox v-model="refundConfirmed" :disabled="busy || unresolved || !refundEvidence.trim()" :label="`Підтверджую окремий MOCK факт повернення саме ${fiscalMoney(record.amount_minor)}`" />
      <BaseButton :disabled="busy || (!refund.intent.value && (unresolved || !refundConfirmed || !refundEvidence.trim()))" @click="runRefund">{{ refund.intent.value ? 'Повторити те саме підтвердження грошей MOCK' : 'Підтвердити повернення грошей MOCK' }}</BaseButton>
    </div>
    <BaseButton v-else-if="refundPermission && refund.intent.value" :disabled="busy" @click="runRefund">Повторити те саме підтвердження грошей MOCK</BaseButton>
    <div v-if="(canReceive || (receivePermission && receipt.intent.value)) && !record.receipt" class="space-y-3">
      <p>Одне незмінне приймання охоплює всі кількості цього повернення. Рішення щодо складу оберіть для кожної позиції.</p>
      <label v-for="item in record.items" :key="item.order_item_id">{{ item.name }} · {{ item.quantity }}<BaseSelect v-model="dispositions[item.order_item_id]" native :disabled="busy || unresolved"><option value="">Оберіть рішення</option><option value="restock">Оприбуткувати в тестову БД</option><option value="not_restock">Прийняти без оприбуткування</option></BaseSelect></label>
      <BaseInput v-model="receiptEvidence" label="Доказ фізичного приймання MOCK" :maxlength="500" :disabled="busy || unresolved" />
      <BaseCheckbox v-model="goodsFit" :disabled="busy || unresolved" label="Перевірено стан товару: придатний до оприбуткування в тестову БД" />
      <BaseCheckbox v-model="receiptConfirmed" :disabled="busy || unresolved || !receiptValid" label="Підтверджую фізичне приймання всіх зазначених кількостей та кожне рішення щодо складу MOCK" />
      <BaseButton :disabled="busy || (!receipt.intent.value && (unresolved || !receiptValid || !receiptConfirmed))" @click="runReceipt">{{ receipt.intent.value ? 'Повторити те саме фізичне приймання MOCK' : 'Зафіксувати фізичне приймання MOCK' }}</BaseButton>
    </div>
    <BaseButton v-else-if="receivePermission && receipt.intent.value" :disabled="busy" @click="runReceipt">Повторити те саме фізичне приймання MOCK</BaseButton>
    <p v-for="message in [refund.error.value, receipt.error.value, ...record.blocking_reasons].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
    <OrderFiscalMock :order="order" :return-id="record.id" :parent-sale-id="record.parent_sale_id" :refresh-token="refreshToken" @changed="emit('changed')" />
  </article>
</template>
