<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'
import { shopCheckboxPrefix, checkboxAuthorityValid, checkboxDocumentIssued, checkboxDocumentStatus, checkboxNotice, checkboxMoney, checkboxReason, checkboxOperationStatus, useCheckboxRead, useCheckboxCommand } from '~/utils/shopCheckboxFiscal'
import type { CheckboxAuthority, CheckboxReadiness, CheckboxOrder, CheckboxReturn, CheckboxPreview, CheckboxDocument, CheckboxOperation } from '~/utils/shopCheckboxFiscal'
const props = defineProps<{ order: OrderResponse, returnId?: number, refreshToken?: number, profileReady?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi(), auth = useAuthStore(), resource = computed(() => props.returnId ? `order:${props.order.id}:return:${props.returnId}` : `order:${props.order.id}`)
const context = () => JSON.stringify([auth.user, props.order.id, props.returnId])
type Entity = CheckboxOrder | CheckboxReturn
interface Panel extends CheckboxAuthority { entity: Entity, readiness: CheckboxReadiness }
const entityMatches = (entity: Entity) => entity.order_id === props.order.id && (props.returnId ? 'sale_document_id' in entity && entity.id === props.returnId : 'profile' in entity && entity.profile === 'checkbox')
const read = useCheckboxRead<Panel>(context, async () => {
  if (!auth.user?.id) throw new Error('No actor')
  const [entity, readiness] = await Promise.all([api<Entity>(`${shopCheckboxPrefix}/${props.returnId ? `returns/${props.returnId}` : `orders/${props.order.id}`}`, { retry: 0 }), api<CheckboxReadiness>(`${shopCheckboxPrefix}/readiness`, { retry: 0 })])
  return { authority: entity.authority, transport: entity.transport, entity, readiness }
}, value => entityMatches(value.entity) && checkboxAuthorityValid(value.readiness) && value.readiness.profile === 'checkbox' && Number.isSafeInteger(value.entity.revision) && !!value.entity.actions, value => JSON.stringify([value.readiness.register?.id || value.readiness.profile_id, value.authority, value.transport]))
const { state, loading, error } = read
const entity = computed(() => state.value?.entity), register = () => (state.value?.readiness.register?.id || state.value?.readiness.profile_id || undefined)
const canonicalDocument = computed(() => entity.value ? ('sale_document' in entity.value ? entity.value.sale_document : entity.value.fiscal_document) : null)
const recoveredDocument = shallowRef<CheckboxDocument | null>(null), operation = shallowRef<CheckboxOperation | null>(null), preview = shallowRef<CheckboxPreview | null>(null)
const proofError = ref(''), printError = ref(''), cancelEvidence = ref(''), confirmed = ref(false)
const prepare = useCheckboxCommand<{ expected_revision: number }>('preview', resource, register)
const approve = useCheckboxCommand<{ expected_revision: number, preview_id: number, confirm: true }>('approve', resource, register)
interface DocumentBody { document_id: number, expected_revision: number, evidence?: string }
const process = useCheckboxCommand<DocumentBody>('document-process', resource, register), reconcile = useCheckboxCommand<DocumentBody>('document-reconcile', resource, register), cancel = useCheckboxCommand<DocumentBody>('document-cancel', resource, register)
const commands = { process, reconcile, cancel }, list = [prepare, approve, process, reconcile, cancel]
const pendingDocumentId = computed(() => [process, reconcile, cancel].find(command => command.intent.value)?.intent.value?.body.document_id || approve.intent.value?.resultId)
const document = computed(() => pendingDocumentId.value ? (canonicalDocument.value?.id === pendingDocumentId.value ? canonicalDocument.value : recoveredDocument.value?.id === pendingDocumentId.value ? recoveredDocument.value : null) : canonicalDocument.value)
const busy = computed(() => list.some(command => command.busy.value)), unresolved = computed(() => (!!prepare.intent.value && !prepare.intent.value.resultId) || [approve, process, reconcile, cancel].some(command => command.intent.value))
const previewAction = computed(() => props.returnId ? 'receipt_preview' : 'sale_preview'), approveAction = computed(() => props.returnId ? 'approve_receipt' : 'approve_sale')
const recoveringPreview = computed(() => !!prepare.intent.value && (!prepare.intent.value.resultId || !preview.value))
const can = (action: string, saved: boolean) => props.profileReady !== false && !!entity.value && !loading.value && !busy.value && entity.value.actions[saved ? `replay_${action}` : action] === true
const previewCurrent = computed(() => !!preview.value && !!entity.value && prepare.register.value === register() && preview.value.expected_revision === entity.value.revision && preview.value.register_revision === state.value?.readiness.register?.revision && state.value.readiness.register.shift_status === 'open' && Date.parse(preview.value.expires_at) > Date.now())
let documentSequence = 0, previewSequence = 0
const documentMatches = (value: CheckboxDocument, id: number) => checkboxAuthorityValid(value) && value.id === id && value.order_id === props.order.id && value.return_id === (props.returnId || null) && value.kind === (props.returnId ? 'return' : 'sale') && !!value.actions && !(value.transport === 'mock_http' && value.is_sent_dps === true)
const hydrateDocument = async (id: number) => {
  const version = read.version(), sequence = ++documentSequence
  try { const value = await api<CheckboxDocument>(`${shopCheckboxPrefix}/documents/${id}`, { retry: 0 }); if (!read.current(version) || sequence !== documentSequence) return false; if (!documentMatches(value, id)) throw new Error('Mismatched document'); recoveredDocument.value = value; proofError.value = ''; return true }
  catch { if (read.current(version) && sequence === documentSequence) { recoveredDocument.value = null; proofError.value = 'Не вдалося відновити оригінальний документ. Точний запит збережено.' } return false }
}
const hydratePreview = async (id: number) => {
  const version = read.version(), sequence = ++previewSequence
  try { const value = await api<CheckboxPreview>(`${shopCheckboxPrefix}/previews/${id}`, { retry: 0 }); if (!read.current(version) || sequence !== previewSequence) return; if (!checkboxAuthorityValid(value) || value.id !== id || value.order_id !== props.order.id || value.return_id !== (props.returnId || null) || value.kind !== (props.returnId ? 'return' : 'sale') || !Array.isArray(value.snapshot.items)) throw new Error('Mismatched preview'); preview.value = value; proofError.value = '' }
  catch { if (read.current(version) && sequence === previewSequence) { preview.value = null; proofError.value = 'Не вдалося відновити точний preview. Нове погодження заблоковано.' } }
}
watch([pendingDocumentId, () => state.value], () => { if (state.value && pendingDocumentId.value && canonicalDocument.value?.id !== pendingDocumentId.value) void hydrateDocument(pendingDocumentId.value) })
watch([context, () => entity.value?.revision, () => state.value?.readiness.register?.revision, () => preview.value?.snapshot_hash], () => { confirmed.value = false }, { flush: 'sync' })
watch(context, () => { documentSequence++; previewSequence++; recoveredDocument.value = null; operation.value = null; preview.value = null; proofError.value = ''; printError.value = ''; cancelEvidence.value = '' }, { immediate: true, flush: 'sync' })
watch(() => state.value, () => { if (state.value && prepare.intent.value?.resultId) void hydratePreview(prepare.intent.value.resultId) })
watch([() => props.refreshToken, () => props.order.revision], () => { if (auth.user?.id) void read.load() })
onScopeDispose(() => { documentSequence++; previewSequence++ })
const reload = async () => { if (await read.load()) { if (pendingDocumentId.value) await hydrateDocument(pendingDocumentId.value); if (prepare.intent.value?.resultId) await hydratePreview(prepare.intent.value.resultId) } }
const createPreview = async () => {
  if (!entity.value || !can(previewAction.value, recoveringPreview.value) || (unresolved.value && !prepare.intent.value)) return
  if (prepare.intent.value?.resultId && preview.value) { prepare.clear(); preview.value = null }
  const version = read.version(), target = props.returnId ? `/returns/${props.returnId}/receipt-preview` : `/orders/${props.order.id}/sale-preview`
  await prepare.execute({ expected_revision: entity.value.revision }, (body, key) => api<CheckboxPreview>(shopCheckboxPrefix + target, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }), async id => { if (read.current(version)) await hydratePreview(id) })
}
const acceptedDocument = async (version: number, id: number, clear: () => void) => {
  if (!read.current(version)) return
  if (!await read.load() || !read.current(version)) throw new Error('Canonical state unavailable')
  if (!await hydrateDocument(id) || !read.current(version)) throw new Error('Original document unavailable')
  clear(); emit('changed')
}
const submit = async () => {
  if (!entity.value || !can(approveAction.value, !!approve.intent.value) || (unresolved.value && !approve.intent.value) || (!approve.intent.value && (!previewCurrent.value || !confirmed.value || !preview.value))) return
  const version = read.version(), target = props.returnId ? `/returns/${props.returnId}/receipts` : `/orders/${props.order.id}/sale-receipts`; confirmed.value = false
  await approve.execute(approve.intent.value?.body || { expected_revision: preview.value!.expected_revision, preview_id: preview.value!.id, confirm: true }, (body, key) => api<CheckboxDocument>(shopCheckboxPrefix + target, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }), id => acceptedDocument(version, id, () => { approve.clear(); prepare.clear(); previewSequence++; preview.value = null }))
  if (read.current(version) && !approve.intent.value && approve.error.value) await read.load()
}
const canDocument = (kind: keyof typeof commands) => { const saved = commands[kind].intent.value; return props.profileReady !== false && !!entity.value && !!document.value && documentMatches(document.value, document.value.id) && !loading.value && !busy.value && !(unresolved.value && !saved) && (!saved || saved.body.document_id === document.value.id) && document.value.actions[saved ? `replay_${kind}` : kind] === true }
const runDocument = async (kind: keyof typeof commands) => {
  const command = commands[kind]
  if (!canDocument(kind) || !document.value || (kind === 'cancel' && !command.intent.value && !cancelEvidence.value.trim())) return
  const version = read.version(), targetId = document.value.id
  await command.execute({ document_id: targetId, expected_revision: document.value.revision, ...(kind === 'cancel' ? { evidence: cancelEvidence.value.trim() } : {}) }, (saved, key) => { const { document_id, ...body } = saved; return api<CheckboxOperation | CheckboxDocument>(`${shopCheckboxPrefix}/documents/${document_id}/${kind}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }) }, async id => {
    if (!read.current(version)) return
    if (kind !== 'cancel') { const value = await api<CheckboxOperation>(`${shopCheckboxPrefix}/operations/${id}`, { retry: 0 }); if (!read.current(version)) return; if (!checkboxAuthorityValid(value) || value.id !== id || value.document_id !== targetId || value.order_id !== props.order.id || value.kind !== (props.returnId ? 'return' : 'sale')) throw new Error('Mismatched operation'); operation.value = value }
    await acceptedDocument(version, targetId, () => { command.clear(); cancelEvidence.value = '' })
  })
  if (read.current(version) && !command.intent.value && command.error.value) await read.load()
}
const print = async () => {
  if (props.profileReady === false || !document.value?.actions.print || !checkboxDocumentIssued(document.value)) return
  const version = read.version(), popup = window.open('about:blank', '_blank'); if (!popup) { printError.value = 'Дозвольте локальне вікно перегляду чека.'; return }; popup.opener = null
  try { const html = await api<string>(`${shopCheckboxPrefix}/documents/${document.value.id}/print`, { responseType: 'text', retry: 0 }); if (!read.current(version)) { popup.close(); return }; const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); popup.location.replace(url); window.setTimeout(() => URL.revokeObjectURL(url), 60000) }
  catch { popup.close(); if (read.current(version)) printError.value = 'Локальний перегляд недоступний. Оновіть стан.' }
}
</script>
<template>
  <section :aria-label="returnId ? `Чек повернення Checkbox #${returnId}` : 'Чек продажу Checkbox'" class="space-y-4 rounded-[1.75rem] border border-violet-200 bg-white p-6 text-slate-900">
    <h2 class="text-xl font-semibold">{{ returnId ? `Чек повернення Checkbox #${returnId}` : 'Чек продажу Checkbox' }}</h2>
    <p v-if="state" class="rounded-xl bg-amber-100 p-3 font-semibold text-amber-950" role="status">{{ checkboxNotice(state) }}</p><p>Чек не підтверджує рух банківських коштів, фізичне приймання чи доставку чека покупцю.</p>
    <BaseButton variant="neutral" :disabled="loading || busy" @click="reload">Оновити чек Checkbox</BaseButton>
    <template v-if="entity">
      <p v-for="code in entity.blocking_reasons" :key="code">{{ checkboxReason(code) }}</p>
      <BaseButton v-if="entity.actions[previewAction] || prepare.intent.value" :disabled="!can(previewAction, recoveringPreview) || (unresolved && !prepare.intent.value)" @click="createPreview">{{ recoveringPreview ? 'Відновити той самий preview Checkbox' : 'Створити preview Checkbox' }}</BaseButton>
    </template>
    <article v-if="preview" aria-label="Точний preview Checkbox" class="space-y-3 rounded-xl p-4" style="background: var(--bo-surface); color: var(--bo-text-primary)"><h3 class="font-semibold">Preview #{{ preview.id }} · ще не видано</h3><p>{{ checkboxNotice(preview) }}</p><p>Профіль {{ prepare.register.value }} · register revision {{ preview.register_revision }} · {{ preview.expires_at }}</p><p class="break-all">Hash {{ preview.snapshot_hash }}</p><p>{{ checkboxMoney(preview.snapshot.amount_minor) }} · {{ preview.snapshot.payment.label }}</p><ul><li v-for="line in preview.snapshot.items" :key="line.order_item_id">{{ line.name }} · {{ line.quantity }} · {{ checkboxMoney(line.total_minor) }} · податкові коди {{ (line.tax_codes || []).join(', ') }}</li></ul><p v-if="!previewCurrent">Підстава або профіль застаріли. Нове погодження заблоковано.</p><BaseCheckbox v-if="!approve.intent.value" v-model="confirmed" :label="`Погоджую preview Checkbox #${preview.id} та його незмінні суми й податки`" :disabled="busy || unresolved || !previewCurrent" /><BaseButton v-if="!approve.intent.value" :disabled="!can(approveAction, false) || unresolved || !previewCurrent || !confirmed" @click="submit">Погодити чек Checkbox</BaseButton></article>
    <BaseButton v-if="approve.intent.value" :disabled="!can(approveAction, true)" @click="submit">Повторити те саме погодження Checkbox</BaseButton>
    <p v-if="pendingDocumentId && !document" role="status">Збережено документ #{{ pendingDocumentId }}. Для безпечного повтору відновіть оригінал.</p>
    <article v-if="document" :aria-label="`Документ Checkbox #${document.id}`" class="space-y-3 border-t pt-4"><h3 class="font-semibold">{{ document.kind === 'sale' ? 'Продаж' : 'Повернення' }} #{{ document.id }} · {{ checkboxMoney(document.amount_minor) }}</h3><p>{{ checkboxNotice(document) }}</p><p role="status">{{ checkboxDocumentStatus(document) }}</p><p class="break-all">UUID {{ document.provider_uuid }} · зміна {{ document.shift_id }}</p><p v-if="document.operation">{{ checkboxOperationStatus(document.operation) }}</p><p v-if="document.operation?.result?.status">Статус провайдера (окремо від перевіреного доказу): {{ document.operation.result.status }}</p><p v-for="code in document.blocking_reasons" :key="code">{{ checkboxReason(code) }}</p><BaseButton v-if="document.actions.process || process.intent.value" :disabled="!canDocument('process')" @click="runDocument('process')">{{ process.intent.value ? 'Повторити ту саму обробку Checkbox' : 'Обробити чек Checkbox' }}</BaseButton><BaseButton v-if="document.actions.reconcile || reconcile.intent.value" :disabled="!canDocument('reconcile')" @click="runDocument('reconcile')">{{ reconcile.intent.value ? 'Повторити ту саму звірку Checkbox' : 'Звірити результат Checkbox' }}</BaseButton><template v-if="document.actions.cancel || cancel.intent.value"><BaseInput v-model="cancelEvidence" label="Підстава скасування Checkbox" :disabled="busy || unresolved" /><BaseButton :disabled="!canDocument('cancel') || (!cancel.intent.value && !cancelEvidence.trim())" @click="runDocument('cancel')">{{ cancel.intent.value ? 'Повторити те саме скасування Checkbox' : 'Скасувати непереданий чек Checkbox' }}</BaseButton></template><BaseButton v-if="document.actions.print" variant="neutral" :disabled="!checkboxDocumentIssued(document)" @click="print">Локальний перегляд чека Checkbox</BaseButton></article>
    <p v-for="message in [error, proofError, printError, ...list.map(command => command.error.value)].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
