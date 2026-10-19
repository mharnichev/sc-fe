<script setup lang="ts">
import OrderFiscalShareMock from '~/components/orders/OrderFiscalShareMock.vue'
import type { FiscalMockDocument, FiscalMockDocumentCommand, FiscalMockPreview, FiscalMockReadiness, FiscalMockSubmission, OrderResponse } from '~/composables/useBackofficeApi'
import { fiscalApprovalIdentity, fiscalDefinitiveRejections, fiscalDeliveryLabel, fiscalMoney, fiscalPaymentMethodLabel, fiscalStatusLabel } from '~/utils/fiscalMock'
const props = defineProps<{ order: OrderResponse, returnId?: number, parentSaleId?: number, refreshToken?: number, saleAutomationOwned?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const api = useBackofficeApi()
const auth = useAuthStore()
const resource = computed(() => props.returnId ? `${props.order.id}:return:${props.returnId}` : String(props.order.id))
type ShiftIntent = { cash_register_id: string, operation: 'open-shift' | 'close-shift', expected_shift_revision: number }
type DocumentIntent = FiscalMockDocumentCommand & { document_id: number, operation: 'process' | 'cancel' | 'delivery' }
const shift = useOrderSalesCommand<ShiftIntent>('fiscal-shift', resource, fiscalDefinitiveRejections)
const prepare = useOrderSalesCommand<{ cash_register_id: string }>('fiscal-preview', resource, fiscalDefinitiveRejections)
const submit = useOrderSalesCommand<FiscalMockSubmission>('fiscal-submit', resource, fiscalDefinitiveRejections)
const transition = useOrderSalesCommand<DocumentIntent>('fiscal-document', resource, fiscalDefinitiveRejections)
const commands = [shift, prepare, submit, transition]
const busy = computed(() => commands.some(command => command.busy.value))
const previewPending = computed(() => !!prepare.intent.value && !prepare.intent.value.resultId)
const unresolved = computed(() => previewPending.value || [shift, submit, transition].some(command => !!command.intent.value))
const readiness = shallowRef<FiscalMockReadiness | null>(null)
const documents = ref<FiscalMockDocument[]>([])
const preview = shallowRef<FiscalMockPreview | null>(null)
const registerId = ref('MOCK-KASA-1')
const register = computed(() => readiness.value?.cash_registers.find(item => item.id === registerId.value))
const enabled = computed(() => readiness.value?.mode === 'mock_only' && readiness.value.available === true && register.value?.credential_kind === 'mock')
const hasFiscalSalesPermission = computed(() => auth.user?.is_superuser || (props.returnId ? auth.user?.can_fiscalize_returns === true : auth.user?.can_fiscalize_sales === true))
const canManageShift = computed(() => !props.returnId && enabled.value && (auth.user?.is_superuser || auth.user?.can_manage_fiscal_settings === true))
const canFiscalize = computed(() => enabled.value && hasFiscalSalesPermission.value && (!!props.returnId || !props.saleAutomationOwned))
// Recovery repeats only the durable approval; it cannot confirm a new snapshot.
const canRetrySubmission = computed(() => !!submit.intent.value && hasFiscalSalesPermission.value && readiness.value?.mode === 'mock_only'
  && readiness.value.cash_registers.some(item => item.id === submit.intent.value?.body.cash_register_id && item.credential_kind === 'mock'))
const confirmed = ref(false)
const loading = ref(false)
const readError = ref('')
const printError = ref('')
const submissionOutcome = ref<'accepted' | 'timeout_after_acceptance'>('accepted')
const deliveryOutcome = ref<'delivered' | 'failed'>('delivered')
let contextVersion = 0, readVersion = 0, previewVersion = 0
onBeforeUnmount(() => { contextVersion++; readVersion++; previewVersion++ })
const current = (version: number) => contextVersion === version
const approvalIdentity = computed(() => fiscalApprovalIdentity(auth.user?.id, props.order.id, props.returnId ? preview.value?.revision : props.order.revision, registerId.value, preview.value))
watch([approvalIdentity, () => register.value?.shift_revision, () => props.saleAutomationOwned], () => { confirmed.value = false }, { flush: 'sync' })
const previewCurrent = computed(() => !!preview.value && preview.value.order_id === props.order.id && (props.returnId ? preview.value.kind === 'return' && preview.value.return_id === props.returnId && (!props.parentSaleId || preview.value.parent_sale_id === props.parentSaleId) : preview.value.kind !== 'return' && preview.value.revision === props.order.revision) && preview.value.cash_register_id === registerId.value && preview.value.shift_revision === register.value?.shift_revision && register.value?.shift_status === 'open')
const canSubmit = computed(() => canFiscalize.value && previewCurrent.value && preview.value?.allowed_actions.includes('submit') && !preview.value.blocking_reasons.length)
const hydratePreview = async (id: number, version: number, order: number) => {
  const request = ++previewVersion
  const result = await api.getFiscalMockPreview(order, id)
  if (request === previewVersion && current(version) && result.order_id === order && (props.returnId ? result.kind === 'return' && result.return_id === props.returnId && (!props.parentSaleId || result.parent_sale_id === props.parentSaleId) : result.kind !== 'return')) { preview.value = result; confirmed.value = false }
}
const load = async () => {
  const version = contextVersion, request = ++readVersion, order = props.order.id
  loading.value = true; readError.value = ''
  const [capabilities, list] = await Promise.allSettled([
    api.getFiscalMockReadiness(),
    hasFiscalSalesPermission.value ? api.getFiscalMockDocuments(order) : Promise.resolve([]),
  ])
  if (!current(version) || request !== readVersion) return
  const failures: string[] = []
  if (capabilities.status === 'fulfilled' && Array.isArray(capabilities.value.cash_registers)) readiness.value = capabilities.value
  else { readiness.value = null; failures.push('Не вдалося прочитати MOCK готовність. Нові операції заблоковано; повторіть читання.') }
  if (list.status === 'fulfilled' && Array.isArray(list.value)) documents.value = list.value.filter(item => props.returnId ? item.kind === 'return' && item.return_id === props.returnId : item.kind !== 'return')
  else { documents.value = []; failures.push('Не вдалося прочитати MOCK документи. Повторіть читання.') }
  const savedPreview = prepare.intent.value?.resultId
  if (hasFiscalSalesPermission.value && savedPreview) {
    try { await hydratePreview(savedPreview, version, order) }
    catch { if (current(version) && request === readVersion) { preview.value = null; confirmed.value = false; failures.push('Не вдалося відновити MOCK preview. Повторіть читання.') } }
  }
  if (current(version) && request === readVersion) { readError.value = failures.join(' '); loading.value = false }
}
watch([() => props.order.id, () => auth.user?.id, () => props.returnId, () => props.parentSaleId], () => {
  contextVersion++; readVersion++; previewVersion++; confirmed.value = false; preview.value = null; documents.value = []; readiness.value = null; printError.value = ''
  if (import.meta.client && auth.user?.id) void load()
}, { immediate: true, flush: 'sync' })
watch(() => props.refreshToken, () => { confirmed.value = false; if (import.meta.client && auth.user?.id) void load() })
const afterCommand = async (version: number) => { if (current(version)) { confirmed.value = false; await load(); if (current(version)) emit('changed') } }
const runShift = async (operation: 'open-shift' | 'close-shift') => {
  if (!canManageShift.value || busy.value || (unresolved.value && !shift.intent.value) || !register.value) return
  const version = contextVersion, order = props.order.id
  await shift.execute({ cash_register_id: registerId.value, operation, expected_shift_revision: register.value.shift_revision }, async (body, key) => {
    await api.runFiscalMockShift(body.cash_register_id, body.operation, { expected_shift_revision: body.expected_shift_revision }, key)
    return { id: order }
  }, async () => { if (!current(version)) return; shift.clear(); await afterCommand(version) })
  if (current(version) && !shift.intent.value && shift.error.value) await afterCommand(version)
}
const createPreview = async () => {
  if (!canFiscalize.value || busy.value || (unresolved.value && !previewPending.value)) return
  const version = contextVersion, order = props.order.id
  if (prepare.intent.value?.resultId) { prepare.clear(); preview.value = null }
  confirmed.value = false
  await prepare.execute({ cash_register_id: registerId.value }, (body, key) => props.returnId ? api.createReturnFiscalMockPreview(props.returnId, body, key) : api.createFiscalMockPreview(order, body, key), async id => { if (current(version)) await hydratePreview(id, version, order) })
  if (current(version) && !prepare.intent.value && prepare.error.value) await afterCommand(version)
}
const queue = async () => {
  if ((submit.intent.value ? !canRetrySubmission.value : !canFiscalize.value) || busy.value || (unresolved.value && !submit.intent.value)) return
  if (!submit.intent.value && (!confirmed.value || !canSubmit.value || !preview.value || Date.parse(preview.value.expires_at) <= Date.now())) { confirmed.value = false; return }
  const version = contextVersion, order = props.order.id
  const body = submit.intent.value?.body || { preview_id: preview.value!.id, expected_revision: preview.value!.revision, snapshot_hash: preview.value!.snapshot_hash, cash_register_id: preview.value!.cash_register_id, confirm: true as const, mock_outcome: submissionOutcome.value }
  confirmed.value = false
  await submit.execute(body, (payload, key) => api.submitFiscalMock(order, payload, key), async () => { if (!current(version)) return; submit.clear(); await afterCommand(version) })
  if (current(version) && !submit.intent.value && submit.error.value) await afterCommand(version)
}
const runDocument = async (operation: DocumentIntent['operation'], document?: FiscalMockDocument) => {
  if (busy.value || (unresolved.value && !transition.intent.value)) return
  if (!transition.intent.value && (!document || !document.allowed_actions.includes(operation))) return
  const version = contextVersion
  const body: DocumentIntent = transition.intent.value?.body || { document_id: document!.id, operation, expected_revision: document!.revision, ...(operation === 'process' ? { mock_delivery_outcome: deliveryOutcome.value } : operation === 'delivery' ? { mock_outcome: deliveryOutcome.value } : {}) }
  await transition.execute(body, (payload, key) => { const { document_id, operation: action, ...command } = payload; return api.runFiscalMockDocument(document_id, action, command, key) }, async () => { if (!current(version)) return; transition.clear(); await afterCommand(version) })
  if (current(version) && !transition.intent.value && transition.error.value) await afterCommand(version)
}
const print = async (document: FiscalMockDocument) => {
  if (document.status !== 'issued' || !document.allowed_actions.includes('print')) return
  const version = contextVersion
  const popup = window.open('about:blank', '_blank')
  if (!popup) { printError.value = 'Дозвольте вікно локального MOCK чека.'; return }
  popup.opener = null; printError.value = ''
  try {
    const html = await api.getFiscalMockPrint(document.id)
    if (!current(version)) { popup.close(); return }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    popup.location.replace(url); window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  catch { popup.close(); if (current(version)) printError.value = 'Локальний MOCK чек недоступний. Оновіть стан.' }
}
</script>
<template>
  <section :aria-label="returnId ? `Checkbox фіскальне повернення MOCK #${returnId}` : 'Checkbox фіскалізація MOCK'" class="space-y-4 rounded-[1.75rem] border border-violet-200 bg-white p-6">
    <h2 class="text-xl font-semibold">Checkbox — {{ returnId ? `фіскальне повернення MOCK #${returnId}` : 'фіскалізація MOCK' }}</h2>
    <p>Лише локальна симуляція. Це тестовий MOCK чек, не попередній документ замовлення. До ДПС нічого не надсилається. Оплата, залишки, доставка товару та повідомлення не змінюються.</p>
    <p v-if="!returnId && saleAutomationOwned" role="status">Власник фіскалізації — автоматизація Checkbox ЕТТН / monobank QR MOCK. Ручна продажа заблокована; зміна власника можлива лише після підтвердженої сервером відміни / завершення.</p>
    <BaseButton variant="neutral" :disabled="loading || busy" @click="load">Оновити MOCK готовність і документи</BaseButton>
    <p v-if="!enabled" role="status">Нові MOCK погодження та керування зміною заблоковано сервером або готовність недоступна. Дозволені дії для наявних документів показано окремо.</p>
    <p v-for="reason in readiness?.blocking_reasons || []" :key="reason">{{ reason }}</p>
    <template v-if="readiness">
      <label>MOCK каса<BaseSelect v-model="registerId" native :disabled="busy || unresolved"><option v-for="item in readiness.cash_registers" :key="item.id" :value="item.id">{{ item.label }} · {{ item.id }}</option></BaseSelect></label>
      <p v-if="register">Зміна MOCK: {{ register.shift_status === 'open' ? 'відкрита' : 'закрита' }} · revision {{ register.shift_revision }}</p>
      <div v-if="enabled" class="flex flex-wrap gap-3">
        <BaseButton v-if="canManageShift && shift.intent.value" :disabled="busy" @click="runShift(shift.intent.value.body.operation)">Повторити команду MOCK зміни</BaseButton>
        <BaseButton v-else-if="canManageShift" :disabled="busy || unresolved" @click="runShift(register?.shift_status === 'open' ? 'close-shift' : 'open-shift')">{{ register?.shift_status === 'open' ? 'Закрити MOCK зміну' : 'Відкрити MOCK зміну' }}</BaseButton>
        <BaseButton v-if="canFiscalize" :disabled="busy || (unresolved && !previewPending)" @click="createPreview">{{ prepare.intent.value && !prepare.intent.value.resultId ? 'Повторити MOCK preview' : 'Створити новий MOCK preview' }}</BaseButton>
      </div>
    </template>
    <article v-if="preview" class="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4" aria-label="MOCK preview">
      <h3 class="font-semibold">MOCK preview #{{ preview.id }} · НЕ відправлено</h3>
      <p>Каса {{ preview.cash_register_id }} · revision {{ returnId ? 'повернення' : 'замовлення' }} {{ preview.revision }} · зміни {{ preview.shift_revision }} · дійсний до {{ preview.expires_at }}</p>
      <p class="break-all">Hash snapshot: {{ preview.snapshot_hash }}</p>
      <p class="text-lg font-semibold">Точна сума MOCK: {{ fiscalMoney(preview.snapshot.amount_minor) }}</p>
      <p v-if="preview.snapshot.kind !== 'return'">Підсумок позицій: {{ fiscalMoney(preview.snapshot.subtotal_minor || 0) }} · знижка {{ fiscalMoney(preview.snapshot.discount_minor || 0) }} · додаткова знижка {{ fiscalMoney(preview.snapshot.additional_discount_minor || 0) }}</p>
      <p v-if="preview.snapshot.payment">{{ returnId ? 'Окреме MOCK повернення грошей' : 'Оплата зі snapshot' }} #{{ preview.snapshot.payment.id }}: {{ fiscalMoney(preview.snapshot.payment.amount_minor) }} · {{ fiscalPaymentMethodLabel(preview.snapshot.payment.method) }} · {{ returnId ? 'окремий незмінний факт повернення' : 'тестове підтвердження оператора' }}</p>
      <ul><li v-for="item in preview.snapshot.items" :key="item.order_item_id">{{ item.name || ('sku' in item && item.sku) || item.product_id }} · {{ item.quantity }}<template v-if="'price_minor' in item"> × {{ fiscalMoney(item.price_minor) }}</template> · разом {{ fiscalMoney(item.total_minor) }}</li></ul>
      <p v-if="!returnId">Податковий MOCK snapshot: MOCK_NO_TAX · 0% · 0.00 грн. Це тестове відображення, що не підтверджує юридичний податковий режим.</p>
      <p>{{ preview.snapshot.notice }}</p>
      <details><summary>Повний незмінний MOCK snapshot</summary><pre class="overflow-auto whitespace-pre-wrap">{{ JSON.stringify(preview.snapshot, null, 2) }}</pre></details>
      <p v-for="reason in preview.blocking_reasons" :key="reason">{{ reason }}</p>
      <p v-if="!previewCurrent">Погодження недійсне: замовлення, каса або зміна відрізняється. Створіть новий preview.</p>
      <template v-if="canFiscalize && !submit.intent.value">
        <label>Сценарій MOCK подання<BaseSelect v-model="submissionOutcome" native :disabled="busy || unresolved"><option value="accepted">Звичайне MOCK прийняття</option><option value="timeout_after_acceptance">MOCK невідомий результат після прийняття</option></BaseSelect></label>
        <BaseCheckbox v-model="confirmed" :disabled="busy || unresolved || !canSubmit" :label="`Погоджую саме MOCK preview #${preview.id}, касу ${preview.cash_register_id} і точну суму ${fiscalMoney(preview.snapshot.amount_minor)}`" />
        <BaseButton :disabled="busy || unresolved || !confirmed || !canSubmit" @click="queue">Погодити та поставити MOCK у чергу</BaseButton>
      </template>
    </article>
    <BaseButton v-if="hasFiscalSalesPermission && submit.intent.value" :disabled="busy || !canRetrySubmission" @click="queue">Повторити те саме MOCK подання</BaseButton>
    <BaseButton v-if="transition.intent.value" :disabled="busy" @click="runDocument(transition.intent.value.body.operation)">Повторити команду MOCK документа #{{ transition.intent.value.body.document_id }}</BaseButton>
    <p v-if="!documents.length && !loading">MOCK фіскальних документів ще немає.</p>
    <label v-if="documents.some(item => item.allowed_actions.includes('process') || item.allowed_actions.includes('delivery'))">Сценарій локального показу / друку<BaseSelect v-model="deliveryOutcome" native :disabled="busy || unresolved"><option value="delivered">Успішний локальний показ / друк</option><option value="failed">Помилка локального показу / друку</option></BaseSelect></label>
    <article v-for="document in documents" :id="`mock-fiscal-document-${document.id}`" :key="document.id" :aria-label="`MOCK фіскальний документ #${document.id}`" class="space-y-3 border-t pt-4">
      <h3 class="font-semibold">MOCK {{ document.kind === 'return' ? 'фіскальне повернення' : 'фіскальний документ' }} #{{ document.id }}</h3>
      <p :class="document.status === 'unknown' ? 'rounded-xl bg-amber-100 p-3 text-amber-900' : document.status === 'error' ? 'rounded-xl bg-rose-100 p-3 text-rose-900' : 'text-violet-800'">{{ fiscalStatusLabel(document.status) }}</p>
      <p>MOCK · До ДПС не надсилалось · каса {{ document.cash_register_id }} · revision {{ document.revision }}</p>
      <p v-if="document.source === 'qr'">Канонічний MOCK чек monobank QR #{{ document.qr_attempt_id }}. Повторне ручне подання цієї оплати заблоковане.</p>
      <p v-if="document.source === 'automation' && document.automation_id">Канонічний MOCK чек автоматизації ЕТТН #{{ document.automation_id }}. Повторне ручне подання для цього scope заблоковане.</p>
      <p class="break-all">Provider UUID: {{ document.provider_uuid }} · Hash: {{ document.snapshot_hash }}</p>
      <p>{{ fiscalDeliveryLabel(document.delivery.status) }} · спроб {{ document.delivery.attempts }}</p>
      <p v-if="document.delivery.last_error" role="alert" class="text-rose-700">{{ document.delivery.last_error }}</p>
      <p v-for="reason in document.blocking_reasons" :key="reason">{{ reason }}</p>
      <p v-if="['queued','unknown','processing'].includes(document.status)">Обробка MOCK запускається лише явною командою оператора. Невідомий результат не дозволяє створити другий чек.</p>
      <div class="flex flex-wrap gap-3">
        <BaseButton v-if="document.allowed_actions.includes('process')" :disabled="busy || unresolved" @click="runDocument('process', document)">Звірити / обробити поточний MOCK</BaseButton>
        <BaseButton v-if="document.allowed_actions.includes('cancel')" :disabled="busy || unresolved" @click="runDocument('cancel', document)">Скасувати погодження до відправки MOCK</BaseButton>
        <BaseButton v-if="document.allowed_actions.includes('delivery')" :disabled="busy || unresolved" @click="runDocument('delivery', document)">Повторити лише локальний показ / друк MOCK</BaseButton>
        <BaseButton v-if="document.status === 'issued' && document.allowed_actions.includes('print')" variant="neutral" @click="print(document)">Відкрити MOCK чек / друк</BaseButton>
      </div>
      <OrderFiscalShareMock :document="document" />
    </article>
    <p v-if="readError" role="status" class="text-rose-700">{{ readError }}</p>
    <p v-for="(message, index) in [printError, ...commands.map(command => command.error.value)].filter(Boolean)" :key="index" role="alert" class="text-rose-700">{{ message }}</p>
  </section>
</template>
