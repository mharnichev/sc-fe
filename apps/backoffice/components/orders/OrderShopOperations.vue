<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'
import { orderAmountMinor } from '~/utils/orderSales'

type Operation = 'manual_payment' | 'provider_payment' | 'handover' | 'complete'
type Action = 'record_manual_payment' | 'record_provider_payment' | 'handover' | 'complete'
type Method = 'cash' | 'card' | 'bank_transfer' | 'cod'
interface RevisionCommand { expected_revision: number }
interface ManualPayment extends RevisionCommand { amount_minor: number, currency: 'UAH', method: Method, external_reference: string, evidence: string }
interface ProviderPayment extends RevisionCommand { reference: string }
interface PhysicalCommand extends RevisionCommand { evidence: string }
interface ShopState {
  payments_profile?: 'r2' | 'legacy'
  order_id: number
  revision: number
  order: OrderResponse
  stage: 'reserved' | 'paid' | 'dispatched' | 'completed'
  authority: 'none' | 'manual' | 'provider' | 'test'
  payment: null | { id: number, method: string, source: string, amount_minor: number, currency: string, external_reference: string, authority: string, created_at: string }
  fulfillment: null | { id: number, kind: 'pickup' | 'nova_poshta', shipment_id: number | null, tracking_number: string | null, authority: string, created_at: string }
  completion: null | { id: number, authority: string, created_at: string }
  actions: Record<string, boolean>
  blocking_reasons: string[]
  available_payment_methods: string[]
}

const props = defineProps<{ order: OrderResponse, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi(), auth = useAuthStore()
const { formatDateTime, formatMoney } = useBookingFormatting()
const resource = computed(() => String(props.order.id))
const rejected = ['shop_payments_workflow_required', 'shop_operations_disabled', 'shop_order_required', 'revision_conflict', 'terminal_order', 'payment_exists', 'payment_required', 'amount_mismatch', 'external_reference_used', 'provider_unavailable', 'provider_proof_invalid', 'provider_test_unsafe', 'fiscal_policy_unavailable', 'fiscal_policy_invalid', 'fiscal_test_unsafe', 'carrier_shipment_required', 'carrier_shipment_ambiguous', 'carrier_allocation_mismatch', 'tracking_delivery_required', 'tracking_stale', 'tracking_ambiguous', 'handover_exists', 'handover_required', 'completion_exists', 'reservation_ownership_mismatch', 'procurement_required', 'incompatible_sales_facts', 'shop_refund_required', 'shop_return_required', 'idempotency_conflict']
const manual = useOrderSalesCommand<ManualPayment>('shop-manual-payment', resource, rejected)
const provider = useOrderSalesCommand<ProviderPayment>('shop-provider-payment', resource, rejected)
const handover = useOrderSalesCommand<PhysicalCommand>('shop-handover', resource, rejected)
const complete = useOrderSalesCommand<PhysicalCommand>('shop-complete', resource, rejected)
const commands = { manual_payment: manual, provider_payment: provider, handover, complete }
const commandList = [manual, provider, handover, complete]
const busy = computed(() => commandList.some(command => command.busy.value))
const unresolved = computed(() => commandList.some(command => !!command.intent.value))
const state = shallowRef<ShopState | null>(null)
const loading = ref(false), readError = ref('')
const source = ref<'manual' | 'provider'>('manual')
const method = ref<Method>('bank_transfer')
const externalReference = ref(''), manualEvidence = ref(''), providerReference = ref('')
const handoverEvidence = ref(''), completionEvidence = ref('')
const manualConfirmed = ref(false), providerConfirmed = ref(false), handoverConfirmed = ref(false), completionConfirmed = ref(false)
const labels = { reserved: 'Зарезервовано', paid: 'Оплату підтверджено', dispatched: 'Видачу / відправлення підтверджено', completed: 'Замовлення завершено' }
const methodLabels: Record<Method, string> = { cash: 'Готівка', card: 'Картка', bank_transfer: 'Банківський переказ', cod: 'Післяплата' }
const reasonLabels: Record<string, string> = {
  shop_operations_disabled: 'Операції магазину вимкнено. Нові факти не записуються.',
  record_sales_required: 'Немає дозволу на облік продажів.', post_inventory_required: 'Немає дозволу на видачу товару.',
  manage_shipments_required: 'Немає дозволу на керування відправленнями.',
  payment_exists: 'Оплату вже підтверджено окремим фактом.', payment_required: 'Спочатку підтвердьте оплату.',
  handover_exists: 'Видачу або відправлення вже підтверджено.', handover_required: 'Спочатку підтвердьте фізичну видачу або відправлення.',
  completion_exists: 'Завершення вже зафіксовано.', terminal_order: 'Замовлення вже закрите.',
  provider_unavailable: 'Перевірка платіжним провайдером недоступна.',
  fiscal_policy_unavailable: 'Потрібна дозволена фіскальна політика для цієї дії.', fiscal_policy_invalid: 'Фіскальна перевірка не дозволяє цю дію.',
  carrier_shipment_required: 'Потрібне підтверджене відправлення перевізника.', carrier_shipment_ambiguous: 'Відправлення неоднозначне. Потрібна перевірка.',
  tracking_delivery_required: 'Потрібне окреме свіже підтвердження доставки перевізником.', tracking_stale: 'Статус перевізника застарів. Потрібне оновлення.',
  procurement_required: 'Замовлення ще очікує надходження товару.', reservation_ownership_mismatch: 'Резерв товару потребує перевірки.',
}
const amountMinor = computed(() => state.value ? orderAmountMinor(state.value.order.total_amount) : null)
const methods = computed(() => (state.value?.available_payment_methods || []).filter((value): value is Method => ['cash', 'card', 'bank_transfer', 'cod'].includes(value)))
const testAuthority = computed(() => !!state.value && [state.value.authority, state.value.payment?.authority, state.value.fulfillment?.authority, state.value.completion?.authority].includes('test'))
const action: Record<Operation, Action> = { manual_payment: 'record_manual_payment', provider_payment: 'record_provider_payment', handover: 'handover', complete: 'complete' }
const suffix: Record<Operation, string> = { manual_payment: '/payments/manual', provider_payment: '/payments/provider', handover: '/handover', complete: '/complete' }
const canRun = (operation: Operation) => {
  const command = commands[operation]
  if (!state.value || loading.value || busy.value || (unresolved.value && !command.intent.value)) return false
  if (state.value.payments_profile === 'r2' && ['manual_payment', 'provider_payment'].includes(operation) && !command.intent.value) return false
  return command.intent.value ? command.intent.value.resultId === props.order.id || state.value.actions[`replay_${operation}`] === true : state.value.actions[action[operation]] === true
}
const manualReady = computed(() => !!manual.intent.value || (!!amountMinor.value && methods.value.includes(method.value) && !!externalReference.value.trim() && !!manualEvidence.value.trim() && manualConfirmed.value))
const providerReady = computed(() => !!provider.intent.value || (!!providerReference.value.trim() && providerConfirmed.value))
const handoverReady = computed(() => !!handover.intent.value || (!!handoverEvidence.value.trim() && handoverConfirmed.value))
const completionReady = computed(() => !!complete.intent.value || (!!completionEvidence.value.trim() && completionConfirmed.value))
const resetConfirmations = () => { manualConfirmed.value = false; providerConfirmed.value = false; handoverConfirmed.value = false; completionConfirmed.value = false }
watch([source, method, externalReference, manualEvidence, providerReference, handoverEvidence, completionEvidence], resetConfirmations, { flush: 'sync' })
let generation = 0, reads = 0
const matches = (value: ShopState) => value?.order_id === props.order.id && value.order?.id === props.order.id && value.order.channel === 'shop'
  && Number.isSafeInteger(value.revision) && value.revision > 0 && value.order.revision === value.revision
  && ['reserved', 'paid', 'dispatched', 'completed'].includes(value.stage) && ['none', 'manual', 'provider', 'test'].includes(value.authority)
  && !!value.actions && typeof value.actions === 'object' && Array.isArray(value.blocking_reasons) && Array.isArray(value.available_payment_methods)
const load = async () => {
  const version = generation, request = ++reads, id = props.order.id
  loading.value = true; readError.value = ''; resetConfirmations()
  try {
    const value = await api<ShopState>(`/backoffice/orders/${id}/shop-operations`, { retry: 0 })
    if (version !== generation || request !== reads) return false
    if (!matches(value)) throw new Error('Mismatched Shop operations response')
    state.value = value
    if (!manual.intent.value && !methods.value.includes(method.value)) method.value = methods.value[0] || 'bank_transfer'
    return true
  }
  catch {
    if (version === generation && request === reads) { state.value = null; readError.value = 'Не вдалося перевірити операції магазину. Дії заблоковано; оновіть стан.' }
    return false
  }
  finally { if (version === generation && request === reads) loading.value = false }
}
watch([() => props.order.id, () => JSON.stringify(auth.user)], () => {
  generation++; reads++; state.value = null; readError.value = ''; loading.value = false
  source.value = 'manual'; method.value = 'bank_transfer'; externalReference.value = ''; manualEvidence.value = ''; providerReference.value = ''; handoverEvidence.value = ''; completionEvidence.value = ''; resetConfirmations()
  if (import.meta.client && auth.user?.id && props.order.channel === 'shop') void load()
}, { immediate: true, flush: 'sync' })
// Show the immutable request being retried, including after a tab reload.
watch([manual.intent, provider.intent, handover.intent, complete.intent], ([savedManual, savedProvider, savedHandover, savedCompletion]) => {
  if (savedManual) { source.value = 'manual'; method.value = savedManual.body.method; externalReference.value = savedManual.body.external_reference; manualEvidence.value = savedManual.body.evidence }
  if (savedProvider) { source.value = 'provider'; providerReference.value = savedProvider.body.reference }
  if (savedHandover) handoverEvidence.value = savedHandover.body.evidence
  if (savedCompletion) completionEvidence.value = savedCompletion.body.evidence
}, { immediate: true, flush: 'post' })
watch([() => props.order.revision, () => props.refreshToken], () => { if (import.meta.client && auth.user?.id && props.order.channel === 'shop') void load() })
onScopeDispose(() => { generation++; reads++ })
const send = async (operation: Operation) => {
  if (!canRun(operation) || !state.value) return
  const command = commands[operation], version = generation, id = props.order.id
  const common = { expected_revision: state.value.revision }
  const success = async () => {
    if (version !== generation) return
    if (!await load()) throw new Error('Canonical state could not be reloaded')
    if (version !== generation) return
    command.clear(); resetConfirmations(); emit('changed')
  }
  // Every accepted response is followed by a fresh canonical GET; replay ACKs may be old.
  const response = async <T extends object>(body: T, key: string) => {
    const result = await api<ShopState>(`/backoffice/orders/${id}/shop-operations${suffix[operation]}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
    if (result.order_id !== id) throw new Error('Mismatched command acknowledgement')
    return { id: result.order_id }
  }
  if (operation === 'manual_payment' && manualReady.value && (manual.intent.value || amountMinor.value)) await manual.execute({ ...common, amount_minor: amountMinor.value || 0, currency: 'UAH', method: method.value, external_reference: externalReference.value.trim(), evidence: manualEvidence.value.trim() }, response, success)
  else if (operation === 'provider_payment' && providerReady.value) await provider.execute({ ...common, reference: providerReference.value.trim() }, response, success)
  else if (operation === 'handover' && handoverReady.value) await handover.execute({ ...common, evidence: handoverEvidence.value.trim() }, response, success)
  else if (operation === 'complete' && completionReady.value) await complete.execute({ ...common, evidence: completionEvidence.value.trim() }, response, success)
  if (version === generation && !command.intent.value && command.error.value) await load()
}
</script>

<template>
  <section class="shop-operations" aria-label="Операції замовлення магазину">
    <header class="shop-operations__heading"><h2>Оплата та виконання замовлення магазину</h2><BaseButton variant="neutral" :disabled="loading || busy" @click="load">Оновити стан операцій</BaseButton></header>
    <p>Оплата, фізична видача або відправлення та завершення записуються окремо. Статус доставки не підтверджує надходження грошей.</p>
    <p v-if="testAuthority" class="shop-operations__test" role="status">ТЕСТОВІ ФАКТИ · не підтверджують реальні оплату, видачу, завершення або фіскальний чек.</p>
    <p v-if="readError" role="alert" class="shop-operations__error">{{ readError }}</p>
    <p v-if="loading" role="status">Перевіряємо поточні факти та дозволені дії…</p>
    <template v-if="state">
      <p class="shop-operations__stage" role="status">{{ labels[state.stage] }}</p>
      <ul v-if="state.blocking_reasons.length" class="shop-operations__reasons"><li v-for="reason in state.blocking_reasons" :key="reason">{{ reasonLabels[reason] || 'Дія недоступна: потрібна додаткова перевірка.' }}</li></ul>
      <p v-if="unresolved" role="status">Є збережений запит із непідтвердженим результатом. Повторіть його без зміни даних; нові операції тимчасово заблоковано.</p>
      <div v-if="(state.payments_profile !== 'r2' && (state.actions.record_manual_payment || state.actions.record_provider_payment)) || manual.intent.value || provider.intent.value" class="shop-operations__group">
        <h3>1. Підтвердити оплату</h3>
        <BaseSelect v-model="source" :id="`shop-payment-source-${order.id}`" :aria-labelledby="`shop-payment-source-${order.id}-label`" label="Джерело підтвердження оплати" native :disabled="busy || unresolved"><option value="manual">Перевірені докази співробітника</option><option value="provider">Перевірка платіжним провайдером</option></BaseSelect>
        <div v-if="source === 'manual' || manual.intent.value" class="shop-operations__fields">
          <p>Сума за замовленням: <strong>{{ formatMoney(state.order.total_amount) }} UAH</strong>. Записуйте лише фактично перевірену оплату на повну суму.</p>
          <BaseSelect v-model="method" :id="`shop-payment-method-${order.id}`" :aria-labelledby="`shop-payment-method-${order.id}-label`" label="Спосіб підтвердженої оплати" native :disabled="busy || !!manual.intent.value"><option v-for="item in methods" :key="item" :value="item">{{ methodLabels[item] }}</option></BaseSelect>
          <BaseInput v-model="externalReference" label="Референс перевіреної оплати" :maxlength="200" :disabled="busy || !!manual.intent.value" />
          <BaseInput v-model="manualEvidence" label="Доказ перевірки оплати співробітником" :maxlength="500" :disabled="busy || !!manual.intent.value" />
          <BaseCheckbox v-model="manualConfirmed" :disabled="busy || !!manual.intent.value">Підтверджую перевірку референсу, способу та повної суми оплати.</BaseCheckbox>
          <BaseButton variant="primary" :loading="manual.busy.value" :disabled="!canRun('manual_payment') || !manualReady" @click="send('manual_payment')">{{ manual.intent.value ? 'Повторити збережене підтвердження оплати' : 'Записати перевірену оплату' }}</BaseButton>
        </div>
        <div v-if="source === 'provider' || provider.intent.value" class="shop-operations__fields">
          <p>Сервер сам перевірить платіж у налаштованого провайдера. Введення референсу не підтверджує оплату.</p>
          <BaseInput v-model="providerReference" label="Референс для перевірки провайдером" :maxlength="200" :disabled="busy || !!provider.intent.value" />
          <BaseCheckbox v-model="providerConfirmed" :disabled="busy || !!provider.intent.value">Підтверджую запит окремої перевірки платежу сервером.</BaseCheckbox>
          <BaseButton variant="primary" :loading="provider.busy.value" :disabled="!canRun('provider_payment') || !providerReady" @click="send('provider_payment')">{{ provider.intent.value ? 'Повторити збережену перевірку провайдера' : 'Перевірити платіж у провайдера' }}</BaseButton>
        </div>
      </div>
      <div v-if="state.actions.handover || handover.intent.value" class="shop-operations__group">
        <h3>2. Підтвердити фізичну видачу / відправлення</h3>
        <BaseInput v-model="handoverEvidence" label="Доказ видачі або передачі перевізнику" :maxlength="500" :disabled="busy || !!handover.intent.value" />
        <BaseCheckbox v-model="handoverConfirmed" :disabled="busy || !!handover.intent.value">Підтверджую фактичну видачу товару або передачу перевізнику.</BaseCheckbox>
        <BaseButton variant="primary" :loading="handover.busy.value" :disabled="!canRun('handover') || !handoverReady" @click="send('handover')">{{ handover.intent.value ? 'Повторити збережене підтвердження видачі' : 'Підтвердити видачу / відправлення' }}</BaseButton>
      </div>
      <div v-if="state.actions.complete || complete.intent.value" class="shop-operations__group">
        <h3>3. Завершити замовлення</h3>
        <p>Завершення не створює нового платежу та не замінює фіскальне підтвердження.</p>
        <BaseInput v-model="completionEvidence" label="Доказ перевірки завершення замовлення" :maxlength="500" :disabled="busy || !!complete.intent.value" />
        <BaseCheckbox v-model="completionConfirmed" :disabled="busy || !!complete.intent.value">Підтверджую окрему перевірку всіх умов завершення.</BaseCheckbox>
        <BaseButton variant="success" :loading="complete.busy.value" :disabled="!canRun('complete') || !completionReady" @click="send('complete')">{{ complete.intent.value ? 'Повторити збережене завершення' : 'Завершити замовлення магазину' }}</BaseButton>
      </div>
      <div v-if="state.payment || state.fulfillment || state.completion" class="shop-operations__facts">
        <h3>Підтверджені окремі факти</h3>
        <p v-if="state.payment">Оплата #{{ state.payment.id }} · {{ formatMoney((state.payment.amount_minor / 100).toFixed(2)) }} {{ state.payment.currency }} · {{ methodLabels[state.payment.method as Method] || state.payment.method }} · {{ state.payment.authority === 'test' ? 'Тестове підтвердження' : state.payment.source === 'manual' ? 'Докази співробітника' : 'Перевірка провайдера' }} · {{ state.payment.external_reference }} · {{ formatDateTime(state.payment.created_at) }}</p>
        <p v-if="state.fulfillment">Видача / відправлення #{{ state.fulfillment.id }} · {{ state.fulfillment.kind === 'nova_poshta' ? 'Передача Новій Пошті' : 'Видача покупцю' }} · {{ state.fulfillment.tracking_number || 'Без ТТН' }} · {{ formatDateTime(state.fulfillment.created_at) }}</p>
        <p v-if="state.completion">Завершення #{{ state.completion.id }} · {{ formatDateTime(state.completion.created_at) }}</p>
      </div>
    </template>
    <p v-for="(command, index) in commandList.filter(item => item.error.value)" :key="index" role="alert" class="shop-operations__error">{{ command.error.value }}</p>
  </section>
</template>

<style scoped>
.shop-operations { display: grid; gap: 1rem; border: 1px solid var(--ui-border, #e2e8f0); border-radius: 1.75rem; padding: 1.5rem; background: var(--bo-surface); color: var(--bo-text-primary); }
.shop-operations__heading { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem; }
.shop-operations h2 { font-size: 1.15rem; font-weight: 700; }
.shop-operations h3 { font-size: 1rem; font-weight: 600; }
.shop-operations__stage { font-weight: 700; }
.shop-operations__group, .shop-operations__fields, .shop-operations__facts { display: grid; gap: .8rem; }
.shop-operations__group { border-top: 1px solid var(--ui-border, #e2e8f0); padding-top: 1rem; }
.shop-operations__test { border-radius: .75rem; background: #fffbeb; color: #92400e; padding: .8rem; font-weight: 700; }
.shop-operations__error { color: #be123c; }
.shop-operations__reasons { padding-left: 1.25rem; list-style: disc; font-size: .9rem; }
.shop-operations__facts { font-size: .9rem; overflow-wrap: anywhere; }
</style>
