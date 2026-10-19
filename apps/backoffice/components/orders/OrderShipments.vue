<script setup lang="ts">
import type { OrderResponse, Shipment, ShipmentCreateCommand, ShipmentCommand, ShipmentAddress, ShipmentSettlement, ShipmentCodCommand, ShipmentReturnReceiptCommand, ShipmentReturnCommand } from '~/composables/useBackofficeApi'
import { fiscalMoney } from '~/utils/fiscalMock'
import { orderAmountMinor } from '~/utils/orderSales'
import { shipmentStatusLabel, orderUsesNovaPoshta, storedShipmentAddressReady, shipmentAddressSummary } from '~/utils/shipmentStatus'
const props = defineProps<{ order: OrderResponse }>()
const emit = defineEmits<{ changed: [] }>()
const api = useBackofficeApi()
const auth = useAuthStore()
const resource = computed(() => String(props.order.id))
const fixture = useOrderSalesCommand<{ expected_revision: number, address_snapshot?: ShipmentAddress }>('shipment-fixture', resource)
const prepare = useOrderSalesCommand<ShipmentCreateCommand>('shipment-prepare', resource)
type TargetCommand = ShipmentCommand & { shipment_id: number }
const refresh = useOrderSalesCommand<TargetCommand>('shipment-refresh', resource)
const cancel = useOrderSalesCommand<TargetCommand>('shipment-cancel', resource)
const handover = useOrderSalesCommand<TargetCommand>('shipment-handover', resource)
// These business rejections occur before acceptance. Unknown outcomes and
// idempotency conflicts must retain their original request and key.
const settlementRejections = ['mock_shipments_disabled', 'mock_shipment_required', 'mock_order_required', 'handover_required', 'delivered_shipment_required', 'cod_amount_mismatch', 'cod_payment_exists', 'return_shipment_exists', 'fiscal_return_receipt_exists', 'parcel_receipt_exists', 'return_capacity_exceeded', 'returned_shipment_required', 'receipt_quantity_mismatch', 'shipped_quantity_exceeded', 'product_missing', 'qr_payment_owns_order'] as const
const codPayment = useOrderSalesCommand<ShipmentCodCommand & { shipment_id: number }>('shipment-cod-payment', resource, settlementRejections)
const returnReceipt = useOrderSalesCommand<ShipmentReturnReceiptCommand & { shipment_id: number }>('shipment-return-receipt', resource, settlementRejections)
const returnShipment = useOrderSalesCommand<ShipmentReturnCommand & { shipment_id: number }>('shipment-return-shipment', resource, settlementRejections)
const commands = [prepare, refresh, cancel, handover, fixture, codPayment, returnReceipt, returnShipment]
const enabled = computed(() => props.order.shipment_actions?.mode === 'mock_only' && props.order.shipment_actions.simulation_available && props.order.shipment_actions.can_manage)
const active = computed(() => props.order.shipments?.find(s => s.active))
const isMockShipment = (shipment: Shipment) => shipment.simulation === true && shipment.carrier === 'mock_nova_poshta'
const isMockSettlementEligible = (shipment: Shipment) => isMockShipment(shipment) && (shipment.tracking_number || '').startsWith('MOCK-')
const mockShipments = computed(() => (props.order.shipments || []).filter(isMockShipment))
const hasNonMockShipments = computed(() => (props.order.shipments || []).some(shipment => !isMockShipment(shipment)))
const busy = computed(() => commands.some(c => c.busy.value))
const unresolved = computed(() => commands.some(c => c.intent.value))
const corrected = ref(false)
const cityRef = ref(''), cityLabel = ref(''), destinationRef = ref(''), destinationLabel = ref(''), building = ref('')
const destination = ref<'warehouse' | 'street'>('warehouse')
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const correctionReady = computed(() => uuid(cityRef.value) && uuid(destinationRef.value) && !!cityLabel.value.trim() && !!destinationLabel.value.trim() && (destination.value === 'warehouse' || !!building.value.trim()))
const addressSnapshot = computed<ShipmentAddress | undefined>(() => corrected.value ? { shippingCityRef: cityRef.value, cityLabel: cityLabel.value.trim(), ...(destination.value === 'warehouse' ? { shippingWarehouseRef: destinationRef.value, warehouseLabel: destinationLabel.value.trim() } : { shippingStreetRef: destinationRef.value, streetLabel: destinationLabel.value.trim(), buildingNumber: building.value.trim() }) } : undefined)
const source = ref<'create' | 'attach'>('create')
const tracking = ref('')
const confirmed = ref(false)
const weight = ref('1'), length = ref('20'), width = ref('15'), height = ref('10'), places = ref('1')
const payer = ref<'sender' | 'recipient'>('recipient')
const declared = ref(''), cod = ref('0')
const evidence = ref('')
const mockStatus = ref('created')
const labelError = ref('')
watch([() => props.order.id, () => auth.user?.id], () => { confirmed.value = false; corrected.value = false; evidence.value = ''; tracking.value = ''; declared.value = props.order.total_amount }, { immediate: true })
const storedAddressSummary = computed(() => shipmentAddressSummary(props.order.shipping_payload_json, props.order))
const storedAddressReady = computed(() => storedShipmentAddressReady(props.order.shipping_payload_json))
const addressReady = computed(() => corrected.value ? correctionReady.value : storedAddressReady.value)
const validPackaging = computed(() => [weight.value, length.value, width.value, height.value, places.value].every(v => Number.isFinite(Number(v)) && Number(v) > 0) && [length.value, width.value, height.value, places.value].every(v => Number.isInteger(Number(v))) && !!orderAmountMinor(declared.value) && (cod.value === '0' || cod.value === '0.00' || !!orderAmountMinor(cod.value)))
const createFixture = async () => {
  if (!enabled.value || busy.value || (!fixture.intent.value && !props.order.shipment_actions?.can_create) || (unresolved.value && !fixture.intent.value)) return
  const startedActor = auth.user?.id, startedOrder = props.order.id
  await fixture.execute({ expected_revision: props.order.revision!, ...(addressSnapshot.value ? { address_snapshot: addressSnapshot.value } : {}) }, async (body, key) => {
    const result = await api.createMockShipmentFixture(startedOrder, body, key)
    if (auth.user?.id === startedActor && props.order.id === startedOrder) { tracking.value = result.tracking_number; source.value = 'attach' }
    return { id: startedOrder }
  }, () => { fixture.clear(); emit('changed') })
}
const create = async () => {
  if (!enabled.value || busy.value || (!prepare.intent.value && (!props.order.shipment_actions?.can_create || unresolved.value || active.value || !confirmed.value || !addressReady.value || !validPackaging.value))) return
  await prepare.execute({ expected_revision: props.order.revision!, source: source.value, ...(addressSnapshot.value ? { address_snapshot: addressSnapshot.value } : {}), ...(source.value === 'attach' ? { tracking_number: tracking.value.trim() } : {}), packaging: { weight_kg: Number(weight.value), length_cm: Number(length.value), width_cm: Number(width.value), height_cm: Number(height.value), places: Number(places.value), payer: payer.value, declared_value_minor: orderAmountMinor(declared.value)!, cod_amount_minor: orderAmountMinor(cod.value) || 0 } }, (body, key) => api.createOrderShipment(props.order.id, body, key), () => { prepare.clear(); confirmed.value = false; emit('changed') })
  if (!prepare.intent.value) emit('changed')
}
const run = async (operation: 'refresh' | 'cancel' | 'handover', shipment: Shipment) => {
  const command = { refresh, cancel, handover }[operation]
  if (!enabled.value || busy.value || (unresolved.value && !command.intent.value)) return
  if (operation === 'handover' && !command.intent.value && (!props.order.shipment_actions?.can_handover || !evidence.value.trim())) return
  await command.execute({ expected_revision: props.order.revision!, shipment_id: shipment.id, ...(operation === 'refresh' ? { mock_status: mockStatus.value } : {}), ...(operation === 'handover' ? { evidence: evidence.value.trim() } : {}) }, (body, key) => { const { shipment_id, ...payload } = body; return api.runShipmentCommand(props.order.id, shipment_id, operation, payload, key) }, () => { command.clear(); evidence.value = ''; emit('changed') })
  if (!command.intent.value) emit('changed')
}
type SettlementForm = { providerEvent: string, paymentEvidence: string, paymentConfirmed: boolean, receiptEvidence: string, receiptConfirmed: boolean, goodsFit: boolean, returnEvidence: string, returnConfirmed: boolean, returnQuantities: Record<number, number | string | null>, dispositions: Record<number, '' | 'restock' | 'not_restock'> }
const settlements = ref<Record<number, ShipmentSettlement>>({})
const settlementErrors = ref<Record<number, string>>({})
const settlementLoading = ref(false)
const forms = ref<Record<number, SettlementForm>>({})
let settlementGeneration = 0
const newForm = (): SettlementForm => ({ providerEvent: '', paymentEvidence: '', paymentConfirmed: false, receiptEvidence: '', receiptConfirmed: false, goodsFit: false, returnEvidence: '', returnConfirmed: false, returnQuantities: {}, dispositions: {} })
const loadSettlements = async () => {
  const version = ++settlementGeneration, orderId = props.order.id
  settlementLoading.value = true
  // Never retain old eligibility after a failed or unknown read.
  settlements.value = {}; settlementErrors.value = {}
  for (const form of Object.values(forms.value)) { form.paymentConfirmed = false; form.receiptConfirmed = false; form.returnConfirmed = false }
  const targets = mockShipments.value.filter(isMockSettlementEligible)
  const result = await Promise.allSettled(targets.map(async shipment => ({ id: shipment.id, data: await api.getShipmentSettlement(orderId, shipment.id) })))
  if (version !== settlementGeneration) return
  result.forEach((item, index) => {
    const shipment = targets[index]
    if (!shipment) return
    if (item.status === 'fulfilled' && item.value.data?.mode === 'mock_only' && item.value.data.order_id === orderId && item.value.data.shipment_id === shipment.id && Array.isArray(item.value.data.allowed_actions) && Array.isArray(item.value.data.items)) settlements.value[shipment.id] = item.value.data
    else settlementErrors.value[shipment.id] = 'Не вдалося прочитати окремі MOCK факти. Нові операції заблоковано; оновіть стан.'
  })
  settlementLoading.value = false
}
watch([() => props.order.id, () => auth.user?.id], () => { settlementGeneration++; forms.value = {}; settlements.value = {}; settlementErrors.value = {} }, { immediate: true, flush: 'sync' })
watch(() => JSON.stringify([props.order.id, auth.user?.id, props.order.revision, props.order.shipments?.map(item => [item.id, item.status, item.simulation, item.carrier, item.tracking_number])]), () => {
  for (const shipment of mockShipments.value) forms.value[shipment.id] ||= newForm()
  if (import.meta.client && auth.user?.id) void loadSettlements()
}, { immediate: true, flush: 'sync' })
onScopeDispose(() => { settlementGeneration++ })
watch(() => JSON.stringify(Object.entries(forms.value).map(([id, form]) => [id, form.providerEvent, form.paymentEvidence, form.receiptEvidence, form.dispositions, form.goodsFit, form.returnEvidence, form.returnQuantities])), () => {
  for (const form of Object.values(forms.value)) { form.paymentConfirmed = false; form.receiptConfirmed = false; form.returnConfirmed = false }
}, { flush: 'sync' })
const settlementPermission = (operation: 'confirm_cod' | 'receive_return' | 'create_return_shipment') => enabled.value && (auth.user?.is_superuser || (operation === 'receive_return' ? auth.user?.can_post_inventory === true : auth.user?.can_record_sales === true))
const settlementAllowed = (shipmentId: number, operation: 'confirm_cod' | 'receive_return' | 'create_return_shipment') => settlementPermission(operation) && settlements.value[shipmentId]?.available === true && settlements.value[shipmentId]?.allowed_actions.includes(operation)
const paymentReady = (id: number) => /^MOCK-COD-[A-Za-z0-9_-]+$/.test(forms.value[id]?.providerEvent.trim() || '') && !!forms.value[id]?.paymentEvidence.trim()
const receiptReady = (id: number) => {
  const form = forms.value[id], items = settlements.value[id]?.items || []
  return !!form?.receiptEvidence.trim() && items.length > 0 && items.every(item => Number.isSafeInteger(item.quantity) && item.quantity > 0 && ['restock', 'not_restock'].includes(form.dispositions[item.order_item_id] || '')) && (!items.some(item => form.dispositions[item.order_item_id] === 'restock') || form.goodsFit)
}
const returnItems = (id: number) => (settlements.value[id]?.items || []).map(item => ({ order_item_id: item.order_item_id, quantity: Number(forms.value[id]?.returnQuantities[item.order_item_id] ?? item.quantity) }))
const returnReady = (id: number) => {
  const items = returnItems(id)
  return !!forms.value[id]?.returnEvidence.trim() && items.some(item => item.quantity > 0) && items.every(item => Number.isSafeInteger(item.quantity) && item.quantity >= 0 && item.quantity <= (settlements.value[id]?.items.find(line => line.order_item_id === item.order_item_id)?.quantity || 0))
}
const settle = async (operation: 'confirm_cod' | 'receive_return' | 'create_return_shipment', shipment: Shipment) => {
  const command = { confirm_cod: codPayment, receive_return: returnReceipt, create_return_shipment: returnShipment }[operation]
  const saved = command.intent.value, form = forms.value[shipment.id], snapshot = settlements.value[shipment.id]
  if (!settlementPermission(operation) || busy.value || (unresolved.value && !saved) || (saved && saved.body.shipment_id !== shipment.id)) return
  if (!saved && (settlementLoading.value || !settlementAllowed(shipment.id, operation) || !snapshot || !form)) return
  if (!saved && ((operation === 'confirm_cod' && (!paymentReady(shipment.id) || !form.paymentConfirmed)) || (operation === 'receive_return' && (!receiptReady(shipment.id) || !form.receiptConfirmed)) || (operation === 'create_return_shipment' && (!returnReady(shipment.id) || !form.returnConfirmed)))) return
  const orderId = props.order.id, actorId = auth.user?.id
  const current = () => props.order.id === orderId && auth.user?.id === actorId
  const success = async () => { if (!current()) return; command.clear(); forms.value[shipment.id] = newForm(); emit('changed'); await loadSettlements() }
  if (operation === 'confirm_cod') await codPayment.execute(codPayment.intent.value?.body || { shipment_id: shipment.id, expected_revision: snapshot!.revision, provider_event_id: form.providerEvent.trim(), evidence: form.paymentEvidence.trim(), confirm: true }, (body, key) => { const { shipment_id, ...payload } = body; return api.confirmShipmentCod(orderId, shipment_id, payload, key) }, success)
  else if (operation === 'receive_return') await returnReceipt.execute(returnReceipt.intent.value?.body || { shipment_id: shipment.id, expected_revision: snapshot!.revision, evidence: form.receiptEvidence.trim(), confirm: true, items: snapshot!.items.map(item => ({ order_item_id: item.order_item_id, quantity: item.quantity, disposition: form.dispositions[item.order_item_id] as 'restock' | 'not_restock' })) }, (body, key) => { const { shipment_id, ...payload } = body; return api.receiveShipmentReturn(orderId, shipment_id, payload, key) }, success)
  else await returnShipment.execute(returnShipment.intent.value?.body || { shipment_id: shipment.id, expected_revision: snapshot!.revision, evidence: form.returnEvidence.trim(), confirm: true, items: returnItems(shipment.id).filter(item => item.quantity > 0) }, (body, key) => { const { shipment_id, ...payload } = body; return api.createShipmentReturn(orderId, shipment_id, payload, key) }, success)
  if (current() && !command.intent.value && command.error.value) { emit('changed'); await loadSettlements() }
}
const label = async (shipment: Shipment) => {
  const preview = window.open('about:blank', '_blank')
  if (!preview) { labelError.value = 'Дозвольте вікно етикетки.'; return }
  preview.opener = null; labelError.value = ''
  try {
    const html = await api.getShipmentLabel(props.order.id, shipment.id)
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    preview.location.replace(url); window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  catch { preview.close(); labelError.value = 'Етикетка недоступна. Оновіть стан відправлення.' }
}
</script>
<template>
  <section v-if="orderUsesNovaPoshta(order) || order.shipments?.length" class="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-6" aria-label="Відправлення Nova Poshta">
    <h2 class="text-xl font-semibold">{{ hasNonMockShipments ? 'Відправлення Nova Poshta' : 'Доставка Nova Poshta — MOCK' }}</h2>
    <p v-if="!hasNonMockShipments">Локальна симуляція. Реальні відправлення, розрахунки та повідомлення не виконуються. ТТН не списує товар; передача перевізнику — окрема команда.</p>
    <p v-else>Для нетестових відправлень тут доступний лише перегляд. Оплату та виконання підтверджуйте окремо в операціях замовлення.</p>
    <p v-if="!enabled && !hasNonMockShipments">Операції заблоковано сервером. Доступний лише перегляд.</p>
    <template v-if="!hasNonMockShipments"><p v-for="reason in order.shipment_actions?.blocking_reasons || []" :key="reason">{{ reason }}</p></template>
    <form v-if="enabled && ((order.shipment_actions?.can_create && !active) || prepare.intent.value || fixture.intent.value)" class="grid gap-3 sm:grid-cols-2" @submit.prevent="create">
      <p class="sm:col-span-2">Збережена адреса: {{ storedAddressSummary.city }} · {{ storedAddressSummary.destination }}<br>City ref зі snapshot: {{ storedAddressSummary.cityRef }}<br>Destination ref зі snapshot: {{ storedAddressSummary.destinationRef }}</p>
      <p v-if="!addressReady" role="status">Стабільні refs відсутні. Стару адресу не можна відновити за підписом; створення заблоковано.</p>
      <BaseCheckbox v-model="corrected" label="Явно вказати виправлену адресу для цього відправлення" :disabled="busy || unresolved" />
      <template v-if="corrected">
        <p>Вкажіть перевірені refs явно. Історична адреса замовлення залишається без змін. MOCK не підтверджує існування адреси в НП.</p>
        <BaseInput v-model="cityRef" label="City ref (UUID)" :disabled="busy || unresolved" />
        <BaseInput v-model="cityLabel" label="Назва міста" :disabled="busy || unresolved" />
        <label>Тип адреси<BaseSelect v-model="destination" native :disabled="busy || unresolved"><option value="warehouse">Відділення</option><option value="street">Вулиця</option></BaseSelect></label>
        <BaseInput v-model="destinationRef" label="Destination ref (UUID)" :disabled="busy || unresolved" />
        <BaseInput v-model="destinationLabel" label="Назва відділення / вулиці" :disabled="busy || unresolved" />
        <BaseInput v-if="destination === 'street'" v-model="building" label="Номер будинку" :disabled="busy || unresolved" />
      </template>
      <label>Джерело<BaseSelect v-model="source" native :disabled="busy || unresolved"><option value="create">Створити MOCK</option><option value="attach">Прив’язати перевірений MOCK</option></BaseSelect></label>
      <BaseInput v-if="source === 'attach'" v-model="tracking" label="MOCK номер" :disabled="busy || unresolved" />
      <BaseButton v-if="source === 'attach' || fixture.intent.value" type="button" :disabled="busy || (unresolved && !fixture.intent.value)" @click="createFixture">{{ fixture.intent.value ? 'Повторити MOCK fixture' : 'Створити тестовий MOCK номер' }}</BaseButton>
      <BaseInput v-model="weight" label="Вага, кг" :disabled="busy || unresolved" />
      <BaseInput v-model="length" label="Довжина, см" :disabled="busy || unresolved" />
      <BaseInput v-model="width" label="Ширина, см" :disabled="busy || unresolved" />
      <BaseInput v-model="height" label="Висота, см" :disabled="busy || unresolved" />
      <BaseInput v-model="places" label="Кількість місць" :disabled="busy || unresolved" />
      <label>Платник доставки<BaseSelect v-model="payer" native :disabled="busy || unresolved"><option value="recipient">Отримувач</option><option value="sender">Відправник</option></BaseSelect></label>
      <BaseInput v-model="declared" label="Оголошена вартість, грн" :disabled="busy || unresolved" />
      <BaseInput v-model="cod" label="Післяплата, грн (не підтверджує оплату)" :disabled="busy || unresolved" />
      <BaseCheckbox v-model="confirmed" label="Адресу та збережені refs перевірено" :disabled="busy || unresolved" />
      <BaseButton type="submit" :loading="prepare.busy.value" :disabled="busy || (!prepare.intent.value && (unresolved || !confirmed || !addressReady || !validPackaging))">{{ prepare.intent.value ? 'Повторити підготовку MOCK' : 'Підготувати MOCK відправлення' }}</BaseButton>
    </form>
    <article v-for="shipment in order.shipments || []" :key="shipment.id" class="space-y-3 border-t pt-4">
      <p>{{ isMockShipment(shipment) ? 'MOCK — тестове відправлення' : 'Відправлення' }} · {{ shipment.tracking_number || 'Номер не підтверджено' }}</p>
      <p>{{ shipmentStatusLabel(shipment.status) }} · остання перевірка: {{ shipment.last_checked_at || 'Ще не виконувалась' }}</p>
      <p v-if="shipment.address_snapshot">Адреса відправлення: {{ shipment.address_snapshot.cityLabel }} · {{ shipment.address_snapshot.warehouseLabel || shipment.address_snapshot.streetLabel }} {{ shipment.address_snapshot.buildingNumber }}</p>
      <p v-if="shipment.packaging">Упаковка: {{ shipment.packaging.weight_kg }} кг · {{ shipment.packaging.length_cm }} × {{ shipment.packaging.width_cm }} × {{ shipment.packaging.height_cm }} см · місць {{ shipment.packaging.places }}</p>
      <p>Оплата товару ведеться окремо. Відмова чи повернення перевізником не оприбутковує товар на склад.</p>
      <div class="flex flex-wrap gap-3">
        <BaseButton v-if="isMockShipment(shipment) && shipment.label_url" variant="neutral" @click="label(shipment)">MOCK етикетка / друк</BaseButton>
        <template v-if="isMockShipment(shipment) && enabled && (shipment.active || [refresh, cancel, handover].some(command => command.intent.value?.body.shipment_id === shipment.id))">
          <label>MOCK стан для перевірки<BaseSelect v-model="mockStatus" native :disabled="busy || unresolved"><option v-for="state in ['created','in_transit','delivered','refused','returning','returned','unrecognized']" :key="state" :value="state">{{ state }}</option></BaseSelect></label>
          <BaseButton :disabled="busy || (unresolved && !refresh.intent.value)" @click="run('refresh', shipment)">{{ refresh.intent.value ? 'Повторити звірку MOCK' : 'Звірити MOCK стан' }}</BaseButton>
          <BaseButton v-if="shipment.status === 'created' || cancel.intent.value?.body.shipment_id === shipment.id" :disabled="busy || (unresolved && !cancel.intent.value)" @click="run('cancel', shipment)">{{ cancel.intent.value ? 'Повторити скасування MOCK' : 'Скасувати MOCK' }}</BaseButton>
          <div v-if="order.shipment_actions?.can_handover || handover.intent.value" class="space-y-2">
            <BaseInput v-model="evidence" label="Підстава тестової передачі перевізнику" :disabled="busy || unresolved" />
            <BaseButton :disabled="busy || (unresolved && !handover.intent.value) || (!handover.intent.value && !evidence.trim())" @click="run('handover', shipment)">{{ handover.intent.value ? 'Повторити передачу MOCK' : 'Підтвердити передачу MOCK' }}</BaseButton>
          </div>
        </template>
      </div>
      <section v-if="isMockSettlementEligible(shipment)" class="space-y-3 rounded-xl border border-amber-200 p-4" :aria-label="`Окремі MOCK факти ТТН ${shipment.id}`">
        <h3 class="font-semibold">Оплата та фізичне повернення — MOCK</h3>
        <p>Статус перевізника не підтверджує гроші та не оприбутковує товар. Кожен факт нижче потребує окремого підтвердження.</p>
        <BaseButton variant="neutral" :disabled="busy || settlementLoading" @click="loadSettlements">Оновити окремі MOCK факти</BaseButton>
        <p v-if="settlementErrors[shipment.id]" role="alert">{{ settlementErrors[shipment.id] }}</p>
        <template v-if="settlements[shipment.id]">
          <p class="[overflow-wrap:anywhere]">Післяплата за даними сервера: {{ fiscalMoney(settlements[shipment.id].amount_minor) }} · ТТН {{ settlements[shipment.id].tracking_number }}</p>
          <p>{{ settlements[shipment.id].cod_payment ? 'Оплату MOCK підтверджено окремим фактом' : 'Оплату післяплати не підтверджено' }}</p>
          <p v-if="settlements[shipment.id].cod_payment" class="[overflow-wrap:anywhere]">MOCK платіж #{{ settlements[shipment.id].cod_payment!.payment_id }} · {{ settlements[shipment.id].cod_payment!.provider_event_id }} · {{ settlements[shipment.id].cod_payment!.evidence }}</p>
          <p>{{ settlements[shipment.id].return_receipt ? 'Фізичне приймання MOCK зафіксовано' : 'Фізичне приймання не зафіксовано; склад не змінено' }}</p>
          <ul v-if="settlements[shipment.id].return_receipt"><li v-for="item in settlements[shipment.id].return_receipt!.items" :key="item.order_item_id">Позиція #{{ item.order_item_id }} · {{ item.quantity }} · {{ item.disposition === 'restock' ? 'оприбутковано в тестову БД' : 'прийнято без оприбуткування' }}</li></ul>
          <p v-for="reason in settlements[shipment.id].blocking_reasons" :key="reason">{{ reason }}</p>
          <div v-if="settlementAllowed(shipment.id, 'confirm_cod') && !codPayment.intent.value" class="space-y-3">
            <BaseInput v-model="forms[shipment.id].providerEvent" label="Унікальний MOCK-COD-референс оплати" :maxlength="128" :disabled="busy || unresolved" />
            <BaseInput v-model="forms[shipment.id].paymentEvidence" label="Доказ окремого MOCK підтвердження післяплати" :maxlength="500" :disabled="busy || unresolved" />
            <BaseCheckbox v-model="forms[shipment.id].paymentConfirmed" :disabled="busy || unresolved || !paymentReady(shipment.id)" :label="`Підтверджую окремий MOCK факт отримання ${fiscalMoney(settlements[shipment.id].amount_minor)} за цією ТТН`" />
            <BaseButton :disabled="busy || unresolved || !paymentReady(shipment.id) || !forms[shipment.id].paymentConfirmed" @click="settle('confirm_cod', shipment)">Підтвердити післяплату MOCK</BaseButton>
          </div>
          <div v-if="settlementAllowed(shipment.id, 'create_return_shipment') && !returnShipment.intent.value" class="space-y-3">
            <p>Окрема зворотна MOCK ТТН після доставки. Оберіть кількості для цієї посилки; 0 виключає позицію. Гроші та склад підтверджуються окремо.</p>
            <BaseInput v-for="item in settlements[shipment.id].items" :key="item.order_item_id" :model-value="forms[shipment.id].returnQuantities[item.order_item_id] ?? item.quantity" @update:model-value="forms[shipment.id].returnQuantities[item.order_item_id] = $event" type="number" :min="0" :max="item.quantity" :step="1" :label="`Кількість зворотної MOCK посилки ${item.name || item.order_item_id}`" :disabled="busy || unresolved" />
            <BaseInput v-model="forms[shipment.id].returnEvidence" label="Підстава зворотної MOCK ТТН" :maxlength="500" :disabled="busy || unresolved" />
            <BaseCheckbox v-model="forms[shipment.id].returnConfirmed" :disabled="busy || unresolved || !returnReady(shipment.id)" label="Підтверджую створення окремої зворотної MOCK ТТН" />
            <BaseButton :disabled="busy || unresolved || !returnReady(shipment.id) || !forms[shipment.id].returnConfirmed" @click="settle('create_return_shipment', shipment)">Створити зворотну MOCK ТТН</BaseButton>
          </div>
          <div v-if="settlementAllowed(shipment.id, 'receive_return') && !returnReceipt.intent.value" class="space-y-3">
            <p>Приймання всієї поверненої посилки. Перевірте кількості та стан кожної позиції.</p>
            <label v-for="item in settlements[shipment.id].items" :key="item.order_item_id">{{ item.name || `Позиція #${item.order_item_id}` }} · {{ item.quantity }}<BaseSelect v-model="forms[shipment.id].dispositions[item.order_item_id]" native :disabled="busy || unresolved"><option value="">Оберіть рішення</option><option value="restock">Оприбуткувати в тестову БД</option><option value="not_restock">Прийняти без оприбуткування</option></BaseSelect></label>
            <BaseInput v-model="forms[shipment.id].receiptEvidence" label="Доказ приймання поверненої MOCK посилки" :maxlength="500" :disabled="busy || unresolved" />
            <BaseCheckbox v-model="forms[shipment.id].goodsFit" :disabled="busy || unresolved" label="Товар для оприбуткування перевірено та придатний до продажу MOCK" />
            <BaseCheckbox v-model="forms[shipment.id].receiptConfirmed" :disabled="busy || unresolved || !receiptReady(shipment.id)" label="Підтверджую фізичне приймання всієї посилки та рішення для кожної позиції MOCK" />
            <BaseButton :disabled="busy || unresolved || !receiptReady(shipment.id) || !forms[shipment.id].receiptConfirmed" @click="settle('receive_return', shipment)">Прийняти повернену посилку MOCK</BaseButton>
          </div>
        </template>
        <BaseButton v-if="settlementPermission('confirm_cod') && codPayment.intent.value?.body.shipment_id === shipment.id" :disabled="busy" @click="settle('confirm_cod', shipment)">Повторити те саме підтвердження післяплати MOCK</BaseButton>
        <BaseButton v-if="settlementPermission('receive_return') && returnReceipt.intent.value?.body.shipment_id === shipment.id" :disabled="busy" @click="settle('receive_return', shipment)">Повторити те саме приймання посилки MOCK</BaseButton>
        <BaseButton v-if="settlementPermission('create_return_shipment') && returnShipment.intent.value?.body.shipment_id === shipment.id" :disabled="busy" @click="settle('create_return_shipment', shipment)">Повторити ту саму зворотну MOCK ТТН</BaseButton>
      </section>
      <details v-if="shipment.events?.length"><summary>{{ isMockShipment(shipment) ? 'Журнал MOCK' : 'Історія відправлення' }}</summary><ul><li v-for="(event,index) in shipment.events" :key="index">{{ event.created_at }} · {{ event.operation }} · {{ shipmentStatusLabel(event.normalized_status) }} · {{ event.outcome }}</li></ul></details>
    </article>
    <p v-for="(message,index) in [fixture.error.value,prepare.error.value,refresh.error.value,cancel.error.value,handover.error.value,codPayment.error.value,returnReceipt.error.value,returnShipment.error.value,labelError].filter(Boolean)" :key="index" role="alert" class="text-rose-600">{{ message }}</p>
  </section>
</template>
