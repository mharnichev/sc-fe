<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'
import { shopCarrierPrefix, shopCarrierAuthorityValid, shopCarrierStatus, shopCarrierReason, shopCarrierRejected, useShopCarrierRead } from '~/utils/shopCarrierReturns'
import type { ShopCarrierCase, ShopCarrierState, ShopCarrierReceiptLine } from '~/utils/shopCarrierReturns'
const props = defineProps<{ order: OrderResponse, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore(), api = useApi(), resource = computed(() => String(props.order.id))
const context = () => JSON.stringify([auth.user, props.order.id])
const read = useShopCarrierRead<ShopCarrierState>(context, () => api(shopCarrierPrefix(props.order.id), { retry: 0 }), value => value.order_id === props.order.id && Number.isSafeInteger(value.revision) && Array.isArray(value.cases) && Array.isArray(value.eligible_lines) && !!value.actions, () => !!auth.user?.id && props.order.fulfillment_method === 'nova_poshta')
const { state, loading, error } = read
interface CreateBody { expected_revision: number, original_shipment_id: number, lines: Array<{ order_item_id: number, quantity: number }>, evidence: string, confirm: true }
interface CaseBody { case_id: number, expected_revision: number, evidence?: string, confirm?: true, lines?: ShopCarrierReceiptLine[] }
const create = useOrderSalesCommand<CreateBody>('shop-carrier-return-create', resource, shopCarrierRejected)
const refresh = useOrderSalesCommand<CaseBody>('shop-carrier-return-refresh', resource, shopCarrierRejected)
const reconcile = useOrderSalesCommand<CaseBody>('shop-carrier-return-reconcile', resource, shopCarrierRejected)
const receive = useOrderSalesCommand<CaseBody>('shop-carrier-return-receive', resource, shopCarrierRejected)
const close = useOrderSalesCommand<CaseBody>('shop-carrier-return-close-unpaid', resource, shopCarrierRejected)
const commands = { refresh, reconcile, receive, close_unpaid: close }, caseCommands = [refresh, reconcile, receive, close], list = [create, ...caseCommands]
const busy = computed(() => list.some(command => command.busy.value)), unresolved = computed(() => list.some(command => command.intent.value))
const pendingId = computed(() => caseCommands.find(command => command.intent.value)?.intent.value?.body.case_id)
const selectedId = ref(''), recovered = shallowRef<ShopCarrierCase | null>(null), recoveryError = ref('')
const record = computed(() => { const id = pendingId.value || Number(selectedId.value); return state.value?.cases.find(item => item.id === id) || (recovered.value?.id === id ? recovered.value : null) })
const quantities = ref<Record<number, number | string | null>>({}), createEvidence = ref(''), createConfirmed = ref(false)
const receiptEvidence = ref(''), receiptConfirmed = ref(false), goodsFit = ref(false), closeEvidence = ref(''), closeConfirmed = ref(false)
const dispositions = ref<Record<number, '' | 'restock' | 'not_restock'>>({})
const selectedLines = computed(() => (state.value?.eligible_lines || []).map(line => ({ order_item_id: line.order_item_id, quantity: state.value?.financial_mode === 'unpaid_cod' ? line.quantity : Number(quantities.value[line.order_item_id] || 0) })).filter(line => line.quantity > 0))
const createValid = computed(() => !!state.value?.original_shipment_id && !!state.value.financial_mode && !!createEvidence.value.trim() && selectedLines.value.length > 0 && selectedLines.value.every(line => Number.isSafeInteger(line.quantity) && line.quantity <= (state.value!.eligible_lines.find(item => item.order_item_id === line.order_item_id)?.quantity || 0)))
const receiptLines = computed(() => (record.value?.lines || []).map(line => ({ order_item_id: line.order_item_id, quantity: line.quantity, disposition: dispositions.value[line.order_item_id] || '' })))
const receiptValid = computed(() => !!receiptEvidence.value.trim() && receiptLines.value.length > 0 && receiptLines.value.every(line => ['restock', 'not_restock'].includes(line.disposition)) && (!receiptLines.value.some(line => line.disposition === 'restock') || goodsFit.value))
const canCreate = computed(() => !!state.value && !loading.value && !busy.value && !(unresolved.value && !create.intent.value) && state.value.actions[create.intent.value ? 'replay_create' : 'create'] === true)
const canCase = (operation: keyof typeof commands) => {
  const saved = commands[operation].intent.value
  return !!state.value && !!record.value && !loading.value && !busy.value && !(unresolved.value && !saved) && (!saved || saved.body.case_id === record.value.id) && record.value.actions[saved ? `replay_${operation}` : operation] === true
}
let recoverySequence = 0
const hydrateCase = async (id: number) => {
  const version = read.version(), sequence = ++recoverySequence
  try { const value = await api<ShopCarrierCase>(`${shopCarrierPrefix(props.order.id)}/${id}`, { retry: 0 }); if (!read.current(version) || sequence !== recoverySequence) return false; if (!shopCarrierAuthorityValid(value) || value.id !== id || value.order_id !== props.order.id || !value.actions) throw new Error('Invalid saved return case'); recovered.value = value; recoveryError.value = ''; return true }
  catch { if (read.current(version) && sequence === recoverySequence) { recovered.value = null; recoveryError.value = 'Не вдалося відновити збережений випадок. Точну команду збережено; оновіть стан.' } return false }
}
watch([pendingId, () => state.value], () => { const id = pendingId.value || Number(selectedId.value); if (state.value && id && !state.value.cases.some(item => item.id === id)) void hydrateCase(id) })
watch(context, () => { recoverySequence++; recovered.value = null; recoveryError.value = ''; selectedId.value = ''; quantities.value = {}; createEvidence.value = ''; createConfirmed.value = false; receiptEvidence.value = ''; receiptConfirmed.value = false; goodsFit.value = false; dispositions.value = {}; closeEvidence.value = ''; closeConfirmed.value = false }, { immediate: true, flush: 'sync' })
watch(() => state.value?.cases, cases => { if (pendingId.value) selectedId.value = String(pendingId.value); else if (cases?.length && !cases.some(item => String(item.id) === selectedId.value) && !recovered.value) selectedId.value = String(cases[0]!.id) })
watch(() => JSON.stringify([quantities.value, createEvidence.value, state.value?.revision, state.value?.financial_mode]), () => { createConfirmed.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([receiptLines.value, receiptEvidence.value, goodsFit.value, record.value?.revision]), () => { receiptConfirmed.value = false }, { flush: 'sync' })
watch([closeEvidence, () => record.value?.revision], () => { closeConfirmed.value = false }, { flush: 'sync' })
watch(selectedId, () => { dispositions.value = {}; receiptEvidence.value = ''; receiptConfirmed.value = false; goodsFit.value = false; closeEvidence.value = ''; closeConfirmed.value = false }, { flush: 'sync' })
watch([create.intent, receive.intent, close.intent], ([savedCreate, savedReceipt, savedClose]) => {
  if (savedCreate) { quantities.value = Object.fromEntries(savedCreate.body.lines.map(line => [line.order_item_id, line.quantity])); createEvidence.value = savedCreate.body.evidence }
  if (savedReceipt) { selectedId.value = String(savedReceipt.body.case_id); dispositions.value = Object.fromEntries((savedReceipt.body.lines || []).map(line => [line.order_item_id, line.disposition])); receiptEvidence.value = savedReceipt.body.evidence || '' }
  if (savedClose) { selectedId.value = String(savedClose.body.case_id); closeEvidence.value = savedClose.body.evidence || '' }
}, { immediate: true, flush: 'post' })
watch([() => props.refreshToken, () => props.order.revision], () => { if (auth.user?.id) void read.load() })
onScopeDispose(() => { recoverySequence++ })
const reload = async () => { if (await read.load() && pendingId.value && !state.value?.cases.some(item => item.id === pendingId.value)) await hydrateCase(pendingId.value) }
const accepted = async (version: number, id: number, clear: () => void) => {
  if (!read.current(version)) return
  if (!await read.load()) throw new Error('Canonical case read unavailable')
  if (!read.current(version)) return
  if (!state.value?.cases.some(item => item.id === id) && !await hydrateCase(id)) throw new Error('Accepted case unavailable')
  if (!read.current(version)) return
  clear(); selectedId.value = String(id); emit('changed')
}
const createCase = async () => {
  if (!canCreate.value || !state.value || (!create.intent.value && (!createValid.value || !createConfirmed.value))) return
  const version = read.version(); createConfirmed.value = false
  await create.execute(create.intent.value?.body || { expected_revision: state.value.revision, original_shipment_id: state.value.original_shipment_id!, lines: selectedLines.value, evidence: createEvidence.value.trim(), confirm: true }, (body, key) => api<ShopCarrierCase>(shopCarrierPrefix(props.order.id), { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }), id => accepted(version, id, () => { create.clear(); quantities.value = {}; createEvidence.value = '' }))
  if (read.current(version) && !create.intent.value && create.error.value) await read.load()
}
const runCase = async (operation: keyof typeof commands) => {
  const command = commands[operation]
  if (!canCase(operation) || !record.value || (!command.intent.value && ((operation === 'receive' && (!receiptValid.value || !receiptConfirmed.value)) || (operation === 'close_unpaid' && (!closeEvidence.value.trim() || !closeConfirmed.value))))) return
  const version = read.version(), target = operation === 'close_unpaid' ? 'close-unpaid' : operation
  const body: CaseBody = command.intent.value?.body || { case_id: record.value.id, expected_revision: record.value.revision, ...(operation === 'receive' ? { lines: receiptLines.value.map(line => ({ ...line, disposition: line.disposition as 'restock' | 'not_restock' })), evidence: receiptEvidence.value.trim(), confirm: true as const } : operation === 'close_unpaid' ? { evidence: closeEvidence.value.trim(), confirm: true as const } : {}) }
  receiptConfirmed.value = false; closeConfirmed.value = false
  await command.execute(body, (payload, key) => { const { case_id, ...request } = payload; return api<ShopCarrierCase>(`${shopCarrierPrefix(props.order.id)}/${case_id}/${target}`, { method: 'POST', body: request, headers: { 'Idempotency-Key': key }, retry: 0 }) }, id => accepted(version, id, () => { command.clear(); receiptEvidence.value = ''; closeEvidence.value = ''; dispositions.value = {}; goodsFit.value = false }))
  if (read.current(version) && !command.intent.value && command.error.value) await read.load()
}
</script>
<template>
  <section aria-label="Повернення НП магазину" class="space-y-4 rounded-[1.75rem] border border-amber-200 bg-white p-6">
    <h2 class="text-xl font-semibold">Повернення НП магазину</h2><p class="rounded-xl bg-amber-100 p-3 font-semibold text-amber-950" role="status">ТЕСТОВЕ ПОВЕРНЕННЯ НП · реальних операцій перевізника, списань коштів та повідомлень немає.</p>
    <p>Статус перевізника не підтверджує оплату і не оприбутковує товар. Гроші, склад та чек оформлюються окремо.</p><BaseButton variant="neutral" :disabled="loading || busy" @click="reload">Оновити випадки повернення НП</BaseButton>
    <template v-if="state">
      <p v-for="reason in state.blocking_reasons" :key="reason">{{ shopCarrierReason(reason) }}</p>
      <div v-if="state.actions.create || create.intent.value" class="space-y-3">
        <p>{{ state.financial_mode === 'paid' ? 'Оплачений продаж: оберіть кількості окремої зворотної посилки.' : 'Неоплачена COD-відмова: повертається вся відправлена кількість. Оплата, refund і чек не створюються.' }}</p>
        <div v-for="line in state.eligible_lines" :key="line.order_item_id"><p>{{ line.name || line.product_id }} · доступно {{ line.quantity }}</p><BaseInput v-if="state.financial_mode === 'paid'" v-model="quantities[line.order_item_id]" type="number" :min="0" :max="line.quantity" :step="1" :label="`Кількість зворотної посилки ${line.name || line.order_item_id}`" :disabled="busy || unresolved" /><p v-else>Уся кількість: {{ line.quantity }}</p></div>
        <BaseInput v-model="createEvidence" label="Підстава зворотної посилки НП" :maxlength="500" :disabled="busy || unresolved" /><BaseCheckbox v-if="!create.intent.value" v-model="createConfirmed" label="Підтверджую окрему тестову зворотну ТТН та зазначені кількості." :disabled="!createValid || busy || loading" /><BaseButton :disabled="!canCreate || (!create.intent.value && (!createValid || !createConfirmed))" @click="createCase">{{ create.intent.value ? 'Повторити ту саму зворотну ТТН' : 'Створити тестову зворотну ТТН' }}</BaseButton>
      </div>
      <BaseSelect v-if="state.cases.length" id="shop-carrier-case" v-model="selectedId" label="Випадок повернення НП" aria-labelledby="shop-carrier-case-label" native :disabled="busy || unresolved"><option v-for="item in state.cases" :key="item.id" :value="String(item.id)">#{{ item.id }} · {{ item.financial_mode === 'paid' ? 'оплачений продаж' : 'неоплачена відмова' }}</option></BaseSelect>
      <p v-if="pendingId && !record" role="status">Точну команду випадку #{{ pendingId }} збережено; для повтору відновіть його стан.</p>
      <article v-if="record" :aria-label="`Випадок повернення НП #${record.id}`" class="space-y-3 border-t pt-4">
        <h3 class="font-semibold">Тестове повернення НП #{{ record.id }} · {{ record.financial_mode === 'paid' ? 'оплачений продаж' : 'неоплачена COD-відмова' }}</h3><p role="status">{{ shopCarrierStatus(record.status) }}</p><p>Вихідне відправлення #{{ record.original_shipment_id }} → зворотне #{{ record.return_shipment_id }} · {{ record.tracking_number || 'Номер ТТН ще не підтверджено' }}</p><p class="break-all">Опорний UUID {{ record.provider_uuid }}</p>
        <ul><li v-for="line in record.lines" :key="line.order_item_id">{{ line.name || line.product_id }} · {{ line.quantity }}</li></ul>
        <p v-if="record.observation">Окреме спостереження перевізника: {{ shopCarrierStatus(record.observation.status) }} · {{ record.observation.event_at || 'Час події невідомий' }} · перевірено {{ record.observation.observed_at }}</p><p v-for="reason in record.blocking_reasons" :key="reason">{{ shopCarrierReason(reason) }}</p>
        <BaseButton v-if="record.actions.refresh || refresh.intent.value" :disabled="!canCase('refresh')" @click="runCase('refresh')">{{ refresh.intent.value ? 'Повторити ту саму перевірку НП' : 'Перевірити повернення перевізником' }}</BaseButton><BaseButton v-if="record.actions.reconcile || reconcile.intent.value" :disabled="!canCase('reconcile')" @click="runCase('reconcile')">{{ reconcile.intent.value ? 'Повторити ту саму звірку ТТН' : 'Звірити невідому зворотну ТТН' }}</BaseButton>
        <p v-if="record.receipt">Приймання #{{ record.receipt.id }} зафіксовано окремо: {{ record.receipt.evidence }}<span v-for="line in record.receipt.lines" :key="line.order_item_id"> · #{{ line.order_item_id }} {{ line.quantity }} {{ line.disposition === 'restock' ? 'оприбутковано в тестову БД' : 'без оприбуткування' }}</span></p>
        <div v-if="record.actions.receive || receive.intent.value" class="space-y-3"><p>Прийміть усі кількості посилки, явно визначивши рішення щодо складу.</p><BaseSelect v-for="line in record.lines" :id="`carrier-disposition-${record.id}-${line.order_item_id}`" :key="line.order_item_id" v-model="dispositions[line.order_item_id]" :label="`Рішення щодо посилки ${line.name || line.order_item_id}`" :aria-labelledby="`carrier-disposition-${record.id}-${line.order_item_id}-label`" native :disabled="busy || unresolved"><option value="">Оберіть рішення</option><option value="restock">Оприбуткувати в тестову БД</option><option value="not_restock">Прийняти без оприбуткування</option></BaseSelect><BaseInput v-model="receiptEvidence" label="Доказ приймання посилки НП" :maxlength="500" :disabled="busy || unresolved" /><BaseCheckbox v-model="goodsFit" label="Товар для оприбуткування перевірено та придатний до продажу." :disabled="busy || unresolved" /><BaseCheckbox v-model="receiptConfirmed" label="Підтверджую окреме фізичне приймання всіх кількостей і кожне рішення щодо складу." :disabled="busy || unresolved || !receiptValid" /><BaseButton :disabled="!canCase('receive') || (!receive.intent.value && (!receiptValid || !receiptConfirmed))" @click="runCase('receive')">{{ receive.intent.value ? 'Повторити те саме приймання НП' : 'Зафіксувати приймання посилки НП' }}</BaseButton></div>
        <template v-if="record.financial_mode === 'paid'"><p v-if="record.actions.create_financial_return">Приймання #{{ record.receipt?.id }} доступне для окремого повернення грошей і чека в розділі «Повернення».</p><p v-if="record.receipt && !record.financial_remaining_lines.length">Прийняті кількості вже пов’язані з фінансовими поверненнями. Гроші, зв’язок приймання та чеки перевіряйте окремо.</p></template>
        <template v-else><p>Оплата, повернення грошей та фіскальний чек у цьому випадку не створюються.</p><p v-if="record.closure">Неоплачену відмову закрито: {{ record.closure.evidence }}. Закриття не змінює склад повторно.</p><div v-if="record.actions.close_unpaid || close.intent.value" class="space-y-3"><BaseInput v-model="closeEvidence" label="Доказ звірки неоплаченої відмови" :maxlength="500" :disabled="busy || unresolved" /><BaseCheckbox v-model="closeConfirmed" label="Підтверджую закриття неоплаченої COD-відмови без фінансових фактів і повторної зміни складу." :disabled="busy || unresolved" /><BaseButton :disabled="!canCase('close_unpaid') || (!close.intent.value && (!closeEvidence.trim() || !closeConfirmed))" @click="runCase('close_unpaid')">{{ close.intent.value ? 'Повторити те саме закриття відмови' : 'Закрити неоплачену COD-відмову' }}</BaseButton></div></template>
      </article>
    </template>
    <p v-for="message in [error, recoveryError, ...list.map(command => command.error.value)].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
