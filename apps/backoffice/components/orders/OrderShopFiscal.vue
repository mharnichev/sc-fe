<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'
import { shopFiscalPrefix, shopFiscalMoney, shopFiscalStatus, shopFiscalReason, shopFiscalRejected, shopFiscalAuthorityValid, useShopFiscalRead } from '~/utils/shopFiscal'
import type { ShopFiscalAuthority, ShopFiscalOrder, ShopFiscalReturn, ShopFiscalRegister, ShopFiscalPreview, ShopFiscalDocument } from '~/utils/shopFiscal'
const props = defineProps<{ order: OrderResponse, returnId?: number, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore(), api = useApi()
const resource = computed(() => props.returnId ? `${props.order.id}:return:${props.returnId}` : String(props.order.id))
const context = () => JSON.stringify([auth.user, props.order.id, props.returnId])
type Entity = ShopFiscalOrder | ShopFiscalReturn
interface Panel extends ShopFiscalAuthority { entity: Entity, register: ShopFiscalRegister }
const entityMatches = (entity: Entity) => entity.order_id === props.order.id && (props.returnId ? 'sale_document_id' in entity && entity.id === props.returnId : !('sale_document_id' in entity))
const read = useShopFiscalRead<Panel>(context, async () => {
  if (!auth.user?.id) throw new Error('No actor')
  const [entity, register] = await Promise.all([api<Entity>(`${shopFiscalPrefix}/${props.returnId ? `returns/${props.returnId}` : `orders/${props.order.id}`}`, { retry: 0 }), api<ShopFiscalRegister>(`${shopFiscalPrefix}/register`, { retry: 0 })])
  return { authority: entity.authority, simulation: entity.simulation, is_sent_dps: entity.is_sent_dps, notice: entity.notice, entity, register }
}, value => entityMatches(value.entity) && shopFiscalAuthorityValid(value.register) && Number.isSafeInteger(value.entity.revision) && !!value.entity.actions)
const { state, loading, error } = read
const entity = computed(() => state.value?.entity)
const canonicalDocument = computed(() => { const value = entity.value; return value ? ('sale_document' in value ? value.sale_document : value.fiscal_document) : null })
const recoveredDocument = shallowRef<ShopFiscalDocument | null>(null)
const preview = shallowRef<ShopFiscalPreview | null>(null), previewError = ref(''), printError = ref(''), cancelEvidence = ref(''), confirmed = ref(false)
const prepare = useOrderSalesCommand<{ expected_revision: number }>('shop-fiscal-preview', resource, shopFiscalRejected)
const approve = useOrderSalesCommand<{ expected_revision: number, preview_id: number, confirm: true }>('shop-fiscal-approve', resource, shopFiscalRejected)
type DocumentBody = { document_id: number, expected_revision: number, evidence?: string }
const process = useOrderSalesCommand<DocumentBody>('shop-fiscal-process', resource, shopFiscalRejected)
const reconcile = useOrderSalesCommand<DocumentBody>('shop-fiscal-reconcile', resource, shopFiscalRejected)
const cancel = useOrderSalesCommand<DocumentBody>('shop-fiscal-cancel', resource, shopFiscalRejected)
const documentCommands = { process, reconcile, cancel }, list = [prepare, approve, process, reconcile, cancel]
const pendingDocumentId = computed(() => [process, reconcile, cancel].find(command => command.intent.value)?.intent.value?.body.document_id)
const document = computed(() => pendingDocumentId.value ? (canonicalDocument.value?.id === pendingDocumentId.value ? canonicalDocument.value : recoveredDocument.value?.id === pendingDocumentId.value ? recoveredDocument.value : null) : canonicalDocument.value)
const busy = computed(() => list.some(command => command.busy.value))
const unresolved = computed(() => (!!prepare.intent.value && !prepare.intent.value.resultId) || [approve, process, reconcile, cancel].some(command => command.intent.value))
const prepareRecovery = computed(() => !!prepare.intent.value && (!prepare.intent.value.resultId || !preview.value))
const previewAction = computed(() => props.returnId ? 'receipt_preview' : 'sale_preview'), approveAction = computed(() => props.returnId ? 'receipt' : 'sale_receipt')
const can = (action: string, saved: boolean) => !!entity.value && !loading.value && !busy.value && entity.value.actions[saved ? `replay_${action}` : action] === true
const previewCurrent = computed(() => !!preview.value && !!entity.value && preview.value.expected_revision === entity.value.revision && preview.value.shift_revision === state.value?.register.shift_revision && state.value.register.shift_status === 'open' && Date.parse(preview.value.expires_at) > Date.now())
let previewSequence = 0, documentSequence = 0
const hydratePendingDocument = async () => {
  const id = pendingDocumentId.value, version = read.version(), sequence = ++documentSequence
  recoveredDocument.value = null
  if (!id || !entity.value || canonicalDocument.value?.id === id) return
  try {
    const value = await api<ShopFiscalDocument>(`${shopFiscalPrefix}/documents/${id}`, { retry: 0 })
    if (!read.current(version) || sequence !== documentSequence) return
    if (!shopFiscalAuthorityValid(value) || value.id !== id || value.order_id !== props.order.id || value.return_id !== (props.returnId || null) || value.kind !== (props.returnId ? 'return' : 'sale') || !value.actions) throw new Error('Invalid saved document')
    recoveredDocument.value = value
  } catch { if (read.current(version) && sequence === documentSequence) previewError.value = 'Не вдалося відновити документ збереженої команди. Оновіть стан; точний запит збережено.' }
}
watch([pendingDocumentId, () => state.value], () => { void hydratePendingDocument() })
const hydratePreview = async (id: number) => {
  const version = read.version(), sequence = ++previewSequence
  try {
    const value = await api<ShopFiscalPreview>(`${shopFiscalPrefix}/previews/${id}`, { retry: 0 })
    if (!read.current(version) || sequence !== previewSequence) return
    if (!shopFiscalAuthorityValid(value) || value.id !== id || value.order_id !== props.order.id || value.return_id !== (props.returnId || null) || value.kind !== (props.returnId ? 'return' : 'sale') || !Array.isArray(value.snapshot?.items)) throw new Error('Invalid preview')
    preview.value = value; previewError.value = ''; confirmed.value = false
  } catch { if (read.current(version) && sequence === previewSequence) { preview.value = null; previewError.value = 'Не вдалося відновити точний preview. Погодження заблоковано; повторіть читання.' } }
}
watch([context, () => state.value?.register.shift_revision, () => entity.value?.revision, () => preview.value?.snapshot_hash], () => { confirmed.value = false }, { flush: 'sync' })
watch(context, () => { documentSequence++; recoveredDocument.value = null; previewSequence++; preview.value = null; previewError.value = ''; printError.value = ''; cancelEvidence.value = ''; confirmed.value = false }, { immediate: true, flush: 'sync' })
watch(() => state.value, () => { if (state.value && prepare.intent.value?.resultId) void hydratePreview(prepare.intent.value.resultId) })
watch([() => props.refreshToken, () => props.order.revision], () => { if (auth.user?.id) void read.load() })
onScopeDispose(() => { previewSequence++; documentSequence++ })
const reload = async () => { if (await read.load()) { await hydratePendingDocument(); if (prepare.intent.value?.resultId) await hydratePreview(prepare.intent.value.resultId) } }
const createPreview = async () => {
  if (!entity.value || !can(previewAction.value, prepareRecovery.value) || (unresolved.value && !prepare.intent.value)) return
  if (prepare.intent.value?.resultId && preview.value) { prepare.clear(); preview.value = null }
  const version = read.version(), target = props.returnId ? `/returns/${props.returnId}/receipt-preview` : `/orders/${props.order.id}/sale-preview`
  await prepare.execute({ expected_revision: entity.value.revision }, (body, key) => api<ShopFiscalPreview>(shopFiscalPrefix + target, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }), async id => { if (read.current(version)) await hydratePreview(id) })
}
const submit = async () => {
  if (!entity.value || !can(approveAction.value, !!approve.intent.value) || (unresolved.value && !approve.intent.value) || (!approve.intent.value && (!previewCurrent.value || !confirmed.value || !preview.value || Date.parse(preview.value.expires_at) <= Date.now()))) return
  const version = read.version(), target = props.returnId ? `/returns/${props.returnId}/receipts` : `/orders/${props.order.id}/sale-receipts`
  confirmed.value = false
  await approve.execute(approve.intent.value?.body || { expected_revision: preview.value!.expected_revision, preview_id: preview.value!.id, confirm: true }, (body, key) => api<ShopFiscalDocument>(shopFiscalPrefix + target, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }), async () => {
    if (!read.current(version)) return
    if (!await read.load()) throw new Error('Canonical read unavailable')
    if (!read.current(version)) return
    previewSequence++; approve.clear(); prepare.clear(); preview.value = null; emit('changed')
  })
  if (read.current(version) && !approve.intent.value && approve.error.value) await read.load()
}
const canDocument = (operation: keyof typeof documentCommands) => {
  const command = documentCommands[operation], saved = command.intent.value
  return !!entity.value && !!document.value && !loading.value && !busy.value && !(unresolved.value && !saved) && (!saved || saved.body.document_id === document.value.id) && document.value.actions[saved ? `replay_${operation}` : operation] === true
}
const runDocument = async (operation: keyof typeof documentCommands) => {
  const command = documentCommands[operation]
  if (!canDocument(operation) || !document.value || (operation === 'cancel' && !command.intent.value && !cancelEvidence.value.trim())) return
  const version = read.version()
  await command.execute({ document_id: document.value.id, expected_revision: document.value.revision, ...(operation === 'cancel' ? { evidence: cancelEvidence.value.trim() } : {}) }, (payload, key) => {
    const { document_id, ...body } = payload
    return api<ShopFiscalDocument>(`${shopFiscalPrefix}/documents/${document_id}/${operation}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  }, async () => {
    if (!read.current(version)) return
    if (!await read.load()) throw new Error('Canonical read unavailable')
    if (!read.current(version)) return
    command.clear(); documentSequence++; recoveredDocument.value = null; cancelEvidence.value = ''; emit('changed')
  })
  if (read.current(version) && !command.intent.value && command.error.value) await read.load()
}
const print = async () => {
  if (!document.value?.actions.print || document.value.status !== 'issued') return
  const version = read.version(), popup = window.open('about:blank', '_blank')
  if (!popup) { printError.value = 'Дозвольте вікно локального тестового чека.'; return }
  popup.opener = null; printError.value = ''
  try {
    const html = await api<string>(`${shopFiscalPrefix}/documents/${document.value.id}/print`, { responseType: 'text', retry: 0 })
    if (!read.current(version)) { popup.close(); return }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); popup.location.replace(url); window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch { popup.close(); if (read.current(version)) printError.value = 'Локальний чек недоступний. Оновіть стан.' }
}
</script>
<template>
  <section :aria-label="returnId ? `Чек повернення магазину #${returnId}` : 'Чек продажу магазину'" class="space-y-4 rounded-[1.75rem] border border-violet-200 bg-white p-6">
    <h2 class="text-xl font-semibold">{{ returnId ? `Чек повернення магазину #${returnId}` : 'Чек продажу магазину' }}</h2>
    <p class="rounded-xl bg-amber-100 p-3 font-semibold text-amber-950" role="status">ТЕСТОВИЙ ДОКУМЕНТ · не є фіскальним чеком, до ДПС не надсилається.</p>
    <p>Чек не записує оплату та не змінює склад. Кожен факт підтверджується окремо.</p>
    <BaseButton variant="neutral" :disabled="loading || busy" @click="reload">Оновити стан чека</BaseButton>
    <template v-if="entity">
      <p v-for="reason in entity.blocking_reasons" :key="reason">{{ shopFiscalReason(reason) }}</p>
      <BaseButton v-if="entity.actions[previewAction] || prepare.intent.value" :disabled="!can(previewAction, prepareRecovery) || (unresolved && !prepare.intent.value)" @click="createPreview">{{ prepare.intent.value && !preview ? 'Відновити той самий preview' : 'Створити новий preview чека' }}</BaseButton>
    </template>
    <article v-if="preview" aria-label="Точний preview чека магазину" class="space-y-3 rounded-xl bg-violet-50 p-4">
      <h3 class="font-semibold">Тестовий preview #{{ preview.id }} · ще не видано</h3><p>Зміна revision {{ preview.shift_revision }} · дійсний до {{ preview.expires_at }}</p><p class="break-all">Hash {{ preview.snapshot_hash }}</p>
      <p class="font-semibold">Точна сума {{ shopFiscalMoney(preview.snapshot.amount_minor) }}</p>
      <ul><li v-for="line in preview.snapshot.items" :key="line.order_item_id">{{ line.name || line.product_id }} · {{ line.quantity }} · {{ shopFiscalMoney(line.total_minor) }}</li></ul>
      <p v-if="!previewCurrent">Preview застарів або зміна відрізняється. Нове погодження заблоковано; оновіть дані та створіть новий preview.</p>
      <BaseCheckbox v-if="!approve.intent.value" v-model="confirmed" :disabled="busy || unresolved || !previewCurrent" :label="`Погоджую саме тестовий preview #${preview.id} і суму ${shopFiscalMoney(preview.snapshot.amount_minor)}`" />
      <BaseButton v-if="!approve.intent.value" :disabled="!can(approveAction, false) || unresolved || !confirmed || !previewCurrent" @click="submit">Погодити та створити тестовий чек</BaseButton>
    </article>
    <BaseButton v-if="approve.intent.value" :disabled="!can(approveAction, true)" @click="submit">Повторити те саме погодження чека</BaseButton>
    <p v-if="pendingDocumentId && !document" role="status">Точну команду документа #{{ pendingDocumentId }} збережено. Для повтору спочатку відновіть доступний документ.</p>
    <article v-if="document" :aria-label="`Тестовий документ магазину #${document.id}`" class="space-y-3 border-t pt-4">
      <h3 class="font-semibold">Тестовий {{ document.kind === 'return' ? 'чек повернення' : 'чек продажу' }} #{{ document.id }}</h3><p role="status">{{ shopFiscalStatus(document.status) }} · {{ shopFiscalMoney(document.amount_minor) }}</p><p>Опорний UUID {{ document.provider_uuid }}</p>
      <p v-for="reason in document.blocking_reasons" :key="reason">{{ shopFiscalReason(reason) }}</p>
      <BaseButton v-if="document.actions.process || process.intent.value" :disabled="!canDocument('process')" @click="runDocument('process')">{{ process.intent.value ? 'Повторити ту саму обробку' : 'Обробити тестовий чек' }}</BaseButton>
      <BaseButton v-if="document.actions.reconcile || reconcile.intent.value" :disabled="!canDocument('reconcile')" @click="runDocument('reconcile')">{{ reconcile.intent.value ? 'Повторити ту саму звірку' : 'Звірити невідомий результат' }}</BaseButton>
      <template v-if="document.actions.cancel || cancel.intent.value"><BaseInput v-model="cancelEvidence" label="Підстава скасування непереданого чека" :disabled="busy || unresolved" /><BaseButton :disabled="!canDocument('cancel') || (!cancel.intent.value && !cancelEvidence.trim())" @click="runDocument('cancel')">{{ cancel.intent.value ? 'Повторити те саме скасування' : 'Скасувати непередане погодження' }}</BaseButton></template>
      <BaseButton v-if="document.actions.print" variant="neutral" @click="print">Локальний перегляд / друк тестового чека</BaseButton>
    </article>
    <p v-for="message in [error, previewError, printError, ...list.map(command => command.error.value)].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
