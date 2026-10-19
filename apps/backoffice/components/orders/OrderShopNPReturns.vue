<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'
import type { ShopNPAttach, ShopNPCase, ShopNPCaseCommand, ShopNPLine, ShopNPOperation, ShopNPReceiptLine, ShopNPState } from '~/utils/shopNPReturns'
import { shopNPPrefix, shopNPPaths, shopNPTTNValid, shopNPDocumentIdValid, shopNPProfileMatches, shopNPCaseMatches, shopNPReason, shopNPRejected, shopNPFailure, shopNPStatus, shopNPObservationStatus, useShopNPRead } from '~/utils/shopNPReturns'

const props = defineProps<{ order: OrderResponse, refreshToken?: number, profileReady?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi(), auth = useAuthStore(), resource = computed(() => String(props.order.id))
const { formatDateTime } = useBookingFormatting()
const context = () => JSON.stringify([auth.user, props.order.id, props.order.fulfillment_method])
const read = useShopNPRead(context, () => api<ShopNPState>(`${shopNPPrefix}/orders/${props.order.id}`, { retry: 0 }), () => props.order.id, () => !!auth.user?.id && props.order.fulfillment_method === 'nova_poshta')
const { state, loading, error } = read
const attach = useOrderSalesCommand<ShopNPAttach>('shop-np-return-attach', resource, shopNPRejected)
const refresh = useOrderSalesCommand<ShopNPCaseCommand>('shop-np-return-refresh', resource, shopNPRejected)
const receive = useOrderSalesCommand<ShopNPCaseCommand>('shop-np-return-receive', resource, shopNPRejected)
const close = useOrderSalesCommand<ShopNPCaseCommand>('shop-np-return-close', resource, shopNPRejected)
const claim = useOrderSalesCommand<ShopNPCaseCommand>('shop-np-return-claim', resource, shopNPRejected)
const commands = { refresh, receive, close_unpaid: close, financial_claim: claim }, caseCommands = [refresh, receive, close, claim], list = [attach, ...caseCommands]
const busy = computed(() => list.some(command => command.busy.value)), unresolved = computed(() => list.some(command => !!command.intent.value))
const pendingId = computed(() => { void busy.value; return caseCommands.find(command => command.intent.value)?.intent.value?.body.case_id || attach.intent.value?.resultId })
const selectedId = ref(''), recovered = shallowRef<ShopNPCase | null>(null), recoveryError = ref(''), recovering = ref(false)
const record = computed(() => { const id = pendingId.value || Number(selectedId.value); return state.value?.cases.find(item => item.id === id) || (recovered.value?.id === id ? recovered.value : null) })
const returnTTN = ref(''), linkage = ref<'easy_return' | 'manual_document'>('easy_return'), reason = ref(''), attachConfirmed = ref(false)
const manualSource = ref(''), manualDocument = ref(''), manualLine = ref(''), quantities = ref<Record<number, number | string | null>>({})
const receiptEvidence = ref(''), contentsConfirmed = ref(false), goodsFit = ref(false), dispositions = ref<Record<number, '' | 'restock' | 'not_restock'>>({})
const closeEvidence = ref(''), closeConfirmed = ref(false), claimReason = ref(''), claimConfirmed = ref(false)
const locked = computed(() => busy.value || unresolved.value)
const testContext = computed(() => state.value?.readiness.authority === 'test' || state.value?.cases.some(item => item.test_context) || recovered.value?.test_context)
const attachLines = computed(() => (state.value?.eligible_lines || []).map(line => ({ order_item_id: line.order_item_id, quantity: state.value?.financial_mode === 'unpaid_cod' ? line.quantity : Number(quantities.value[line.order_item_id] || 0) })).filter(line => line.quantity > 0))
const shownAttachLines = computed<ShopNPLine[]>(() => attach.intent.value ? attach.intent.value.body.lines.map(line => { const original = state.value?.eligible_lines.find(item => item.order_item_id === line.order_item_id) || state.value?.cases.flatMap(item => item.lines).find(item => item.order_item_id === line.order_item_id); return { ...line, product_id: original?.product_id || 0, name: original?.name || null } }) : state.value?.eligible_lines || [])
const attachValid = computed(() => !!state.value?.original_shipment_id && !!state.value.financial_mode && shopNPTTNValid(returnTTN.value) && returnTTN.value !== state.value.original_ttn && !!reason.value.trim() && reason.value.trim().length <= 500
  && attachLines.value.length > 0 && attachLines.value.every(line => Number.isSafeInteger(line.quantity) && line.quantity <= (state.value!.eligible_lines.find(item => item.order_item_id === line.order_item_id)?.quantity || 0))
  && (linkage.value === 'easy_return' || state.value.readiness.manual_link_allowed && !!manualSource.value.trim() && manualSource.value.trim().length <= 100 && shopNPDocumentIdValid(manualDocument.value.trim()) && shopNPDocumentIdValid(manualLine.value.trim())))
const receiptLines = computed(() => (record.value?.lines || []).map(line => ({ order_item_id: line.order_item_id, quantity: line.quantity, disposition: dispositions.value[line.order_item_id] || '' })))
const receiptValid = computed(() => !!receiptEvidence.value.trim() && receiptEvidence.value.trim().length <= 500 && receiptLines.value.length > 0 && receiptLines.value.every(line => ['restock', 'not_restock'].includes(line.disposition)) && contentsConfirmed.value && (!receiptLines.value.some(line => line.disposition === 'restock') || goodsFit.value))
const canAttach = computed(() => {
  const current = state.value, saved = attach.intent.value
  if (props.profileReady === false || !current || loading.value || recovering.value || busy.value || unresolved.value && !saved) return false
  if (saved?.resultId) return Number.isSafeInteger(saved.resultId) && saved.resultId > 0
  if (saved) return shopNPProfileMatches(saved.body, current.readiness) && current.actions.replay_attach === true
  return !!current.readiness.profile_id && !!current.readiness.profile_hash && current.actions.attach === true
})
const canCase = (operation: ShopNPOperation) => {
  const current = record.value, saved = commands[operation].intent.value
  if (props.profileReady === false || !state.value || !current || loading.value || recovering.value || busy.value || unresolved.value && !saved) return false
  if (operation === 'financial_claim' && current.financial_mode !== 'paid' || operation === 'close_unpaid' && current.financial_mode !== 'unpaid_cod') return false
  if (saved && (saved.body.case_id !== current.id || !shopNPProfileMatches(saved.body, current))) return false
  if (saved?.resultId) return saved.resultId === current.id
  return current.actions[saved ? `replay_${operation}` : operation] === true
}
let recoverySequence = 0
const hydrateCase = async (id: number) => {
  const version = read.version(), sequence = ++recoverySequence
  recovering.value = true
  try {
    const value = await api<ShopNPCase>(`${shopNPPrefix}/cases/${id}`, { retry: 0 })
    if (!read.current(version) || sequence !== recoverySequence) return false
    if (!shopNPCaseMatches(value, props.order.id, id)) throw new Error('Invalid original NP case')
    recovered.value = value; recoveryError.value = ''; return true
  } catch { if (read.current(version) && sequence === recoverySequence) { recovered.value = null; recoveryError.value = 'Не вдалося відновити оригінальний випадок НП. Точний запит збережено; нову операцію не створено.' } return false }
  finally { if (sequence === recoverySequence) recovering.value = false }
}
const accepted = async (version: number, id: number, matches: (value: ShopNPCase) => boolean, clear: () => void) => {
  if (!read.current(version)) return
  if (!await read.load()) throw new Error('Canonical NP read unavailable')
  if (!read.current(version)) return
  let value = state.value?.cases.find(item => item.id === id)
  if (!value) { if (!await hydrateCase(id)) throw new Error('Original NP case unavailable'); value = recovered.value || undefined }
  if (!read.current(version)) return
  if (!value || !matches(value)) throw new Error('NP acknowledgement belongs to another case')
  clear(); selectedId.value = String(id); emit('changed')
}
const attachCase = async () => {
  if (!canAttach.value || !state.value || !attach.intent.value && (!attachValid.value || !attachConfirmed.value)) return
  const current = state.value, version = read.version()
  const body: ShopNPAttach = attach.intent.value?.body || {
    expected_revision: current.revision, expected_profile_id: current.readiness.profile_id!, expected_profile_hash: current.readiness.profile_hash!, original_shipment_id: current.original_shipment_id!, return_ttn: returnTTN.value,
    linkage_kind: linkage.value, manual_link: linkage.value === 'manual_document' ? { source: manualSource.value.trim(), document_id: manualDocument.value.trim(), line_id: manualLine.value.trim(), order_id: props.order.id, original_shipment_id: current.original_shipment_id!, original_ttn: current.original_ttn!, return_ttn: returnTTN.value, verified: true } : null,
    lines: attachLines.value, reason: reason.value.trim(),
  }
  attachConfirmed.value = false
  const matches = (value: ShopNPCase) => value.original_shipment_id === body.original_shipment_id && value.return_ttn === body.return_ttn && shopNPProfileMatches(body, value)
  await attach.execute(body, async (saved, key) => {
    if (!read.current(version) || !state.value || !shopNPProfileMatches(saved, state.value.readiness)) throw new Error('NP profile changed')
    const result = await api<ShopNPCase>(`${shopNPPrefix}/orders/${props.order.id}/attach`, { method: 'POST', body: saved, headers: { 'Idempotency-Key': key }, retry: 0 }).catch(shopNPFailure)
    if (!shopNPCaseMatches(result, props.order.id) || !matches(result)) throw new Error('Mismatched NP attachment acknowledgement')
    return { id: result.id }
  }, id => accepted(version, id, matches, () => { attach.clear(); returnTTN.value = ''; reason.value = ''; quantities.value = {}; manualSource.value = ''; manualDocument.value = ''; manualLine.value = '' }))
  if (read.current(version) && !attach.intent.value && attach.error.value) await read.load()
}
const runCase = async (operation: ShopNPOperation) => {
  const command = commands[operation], current = record.value
  if (!canCase(operation) || !current) return
  if (!command.intent.value && (operation === 'receive' && !receiptValid.value || operation === 'close_unpaid' && (!closeConfirmed.value || !closeEvidence.value.trim() || closeEvidence.value.trim().length > 500) || operation === 'financial_claim' && (!claimConfirmed.value || !claimReason.value.trim() || claimReason.value.trim().length > 500))) return
  const version = read.version(), body: ShopNPCaseCommand = command.intent.value?.body || {
    case_id: current.id, expected_revision: current.revision, expected_profile_id: current.profile_id, expected_profile_hash: current.profile_hash,
    ...(operation === 'receive' ? { lines: receiptLines.value.map(line => ({ ...line, disposition: line.disposition as ShopNPReceiptLine['disposition'] })), contents_verified: true as const, evidence: receiptEvidence.value.trim() } : operation === 'close_unpaid' ? { evidence: closeEvidence.value.trim(), confirm: true as const } : operation === 'financial_claim' ? { reason: claimReason.value.trim() } : {}),
  }
  contentsConfirmed.value = false; closeConfirmed.value = false; claimConfirmed.value = false
  const matches = (value: ShopNPCase) => value.id === body.case_id && shopNPProfileMatches(body, value)
  await command.execute(body, async (saved, key) => {
    if (!read.current(version) || !record.value || saved.case_id !== record.value.id || !shopNPProfileMatches(saved, record.value)) throw new Error('NP case context changed')
    const { case_id, ...request } = saved
    const result = await api<ShopNPCase>(`${shopNPPrefix}/cases/${case_id}/${shopNPPaths[operation]}`, { method: 'POST', body: request, headers: { 'Idempotency-Key': key }, retry: 0 }).catch(shopNPFailure)
    if (!shopNPCaseMatches(result, props.order.id, case_id) || !matches(result)) throw new Error('Mismatched NP command acknowledgement')
    return { id: result.id }
  }, id => accepted(version, id, matches, () => { command.clear(); receiptEvidence.value = ''; dispositions.value = {}; goodsFit.value = false; closeEvidence.value = ''; claimReason.value = '' }))
  if (read.current(version) && !command.intent.value && command.error.value) await read.load()
}
const restoreSaved = () => {
  const saved = attach.intent.value?.body
  if (saved) { returnTTN.value = saved.return_ttn; linkage.value = saved.linkage_kind; reason.value = saved.reason; quantities.value = Object.fromEntries(saved.lines.map(line => [line.order_item_id, line.quantity])); manualSource.value = saved.manual_link?.source || ''; manualDocument.value = saved.manual_link?.document_id || ''; manualLine.value = saved.manual_link?.line_id || '' }
  const received = receive.intent.value?.body
  if (received) { selectedId.value = String(received.case_id); receiptEvidence.value = received.evidence || ''; dispositions.value = Object.fromEntries((received.lines || []).map(line => [line.order_item_id, line.disposition])) }
  if (close.intent.value) { selectedId.value = String(close.intent.value.body.case_id); closeEvidence.value = close.intent.value.body.evidence || '' }
  if (claim.intent.value) { selectedId.value = String(claim.intent.value.body.case_id); claimReason.value = claim.intent.value.body.reason || '' }
}
watch(context, () => { recoverySequence++; recovering.value = false; recovered.value = null; recoveryError.value = ''; selectedId.value = ''; returnTTN.value = ''; linkage.value = 'easy_return'; reason.value = ''; quantities.value = {}; manualSource.value = ''; manualDocument.value = ''; manualLine.value = ''; receiptEvidence.value = ''; dispositions.value = {}; closeEvidence.value = ''; claimReason.value = ''; attachConfirmed.value = false; contentsConfirmed.value = false; goodsFit.value = false; closeConfirmed.value = false; claimConfirmed.value = false; restoreSaved() }, { immediate: true, flush: 'sync' })
watch(list.map(command => command.intent), restoreSaved, { immediate: true, flush: 'post' })
watch([pendingId, () => state.value], () => { if (state.value && pendingId.value && !state.value.cases.some(item => item.id === pendingId.value)) void hydrateCase(pendingId.value) })
watch(() => state.value?.cases, values => { if (pendingId.value) selectedId.value = String(pendingId.value); else if (values?.length && !values.some(item => String(item.id) === selectedId.value)) selectedId.value = String(values[0]!.id) })
watch(selectedId, () => { receiptEvidence.value = ''; dispositions.value = {}; contentsConfirmed.value = false; goodsFit.value = false; closeEvidence.value = ''; closeConfirmed.value = false; claimReason.value = ''; claimConfirmed.value = false; if (unresolved.value) restoreSaved() }, { flush: 'sync' })
watch(() => JSON.stringify([returnTTN.value, linkage.value, reason.value, quantities.value, manualSource.value, manualDocument.value, manualLine.value, state.value?.revision]), () => { attachConfirmed.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([receiptEvidence.value, dispositions.value, goodsFit.value, record.value?.revision]), () => { contentsConfirmed.value = false }, { flush: 'sync' })
watch([closeEvidence, () => record.value?.revision], () => { closeConfirmed.value = false }, { flush: 'sync' })
watch([claimReason, () => record.value?.revision], () => { claimConfirmed.value = false }, { flush: 'sync' })
watch([() => props.order.revision, () => props.refreshToken], () => { if (auth.user?.id) void read.load() })
onScopeDispose(() => { recoverySequence++ })
const reload = async () => { if (await read.load() && pendingId.value && !state.value?.cases.some(item => item.id === pendingId.value)) await hydrateCase(pendingId.value) }
</script>

<template>
  <section class="np-panel" aria-label="Зовнішні повернення НП магазину">
    <header><h2>Повернення НП · існуюча зворотна ТТН</h2><BaseButton variant="neutral" :disabled="loading || busy" @click="reload">Оновити повернення НП</BaseButton></header>
    <p>Тут прив’язується вже оформлена зовні ТТН. Створення відправлення НП, банківських переказів і повідомлень немає. Зв’язок ТТН, прибуття, вміст, склад, гроші та чек — окремі факти.</p>
    <p v-if="testContext" class="np-panel__notice" role="status">ЛОКАЛЬНИЙ MOCK · повернення НП та пов’язані факти тестові; реальні операції перевізника, платежі й надсилання до ДПС не виконуються.</p>
    <p v-if="recovering" role="status">Відновлюємо оригінальний випадок НП та перевіряємо його актуальні дозволи…</p>
    <p v-if="loading" role="status">Перевіряємо випадки, профіль і актуальні дозволи…</p>
    <p v-if="props.profileReady === false" role="status">Фіскальний профіль ще не підтверджено. Дії тимчасово заблоковано; збережений запит не змінено.</p>
    <template v-if="state">
      <div v-if="!state.cases.length && state.blocking_reasons.length"><p>Передумови для нової прив’язки ТТН:</p><p v-for="code in state.blocking_reasons" :key="code">{{ shopNPReason(code) }}</p></div>
      <p v-if="unresolved" class="np-panel__notice" role="status">Є точний збережений запит. Повтор використовує його початкові дані та ключ; інші дії заблоковано до перевірки результату.</p>
      <div v-if="state.actions.attach || attach.intent.value" class="np-panel__group">
        <h3>Прив’язати існуючу зворотну ТТН</h3>
        <p>Вихідна ТТН: <strong>{{ state.original_ttn || 'Не підтверджено' }}</strong>. {{ state.financial_mode === 'unpaid_cod' ? 'Неоплачена COD-відмова: лише повна відправлена кількість, без фінансових фактів.' : 'Оплачений продаж: оберіть кількості однієї зворотної посилки.' }}</p>
        <BaseInput v-model="returnTTN" label="Існуюча зворотна ТТН НП" :maxlength="14" :disabled="locked" />
        <BaseSelect v-model="linkage" :id="`np-linkage-${order.id}`" :aria-labelledby="`np-linkage-${order.id}-label`" label="Підстава зв’язку зворотної ТТН" native :disabled="locked"><option value="easy_return">Easy Return · сервер перевіряє зв’язок НП</option><option v-if="state.readiness.manual_link_allowed || attach.intent.value?.body.linkage_kind === 'manual_document'" value="manual_document">Зовнішній документ · ручна звірка співробітника</option></BaseSelect>
        <p v-if="linkage === 'easy_return'">Зв’язок підтверджує лише серверна перевірка LightReturnNumber НП, а не введений номер.</p>
        <div v-else class="np-panel__group">
          <p class="np-panel__notice">РУЧНИЙ ЗВ’ЯЗОК ЗА ДОКУМЕНТОМ · це не автоматичне підтвердження зв’язку НП. Документ не може перекрити явну невідповідність у даних НП.</p>
          <BaseInput v-model="manualSource" label="Джерело документа зв’язку ТТН" :maxlength="100" :disabled="locked" />
          <BaseInput v-model="manualDocument" label="Номер документа зв’язку ТТН" :maxlength="100" :disabled="locked" />
          <BaseInput v-model="manualLine" label="Рядок документа зв’язку ТТН" :maxlength="100" :disabled="locked" />
        </div>
        <div v-for="line in shownAttachLines" :key="line.order_item_id"><p>{{ line.name || `Позиція #${line.order_item_id}` }} · {{ attach.intent.value ? 'Збережена кількість' : 'Доступно' }} {{ line.quantity }}</p><BaseInput v-if="state.financial_mode === 'paid' || attach.intent.value" v-model="quantities[line.order_item_id]" type="number" :min="0" :max="line.quantity" :step="1" :label="`Кількість у зворотній ТТН ${line.name || line.order_item_id}`" :disabled="locked" /></div>
        <BaseInput v-model="reason" label="Причина прив’язки зворотної ТТН" :maxlength="500" :disabled="locked" />
        <BaseCheckbox v-if="!attach.intent.value" v-model="attachConfirmed" :disabled="!attachValid || busy || loading">{{ linkage === 'manual_document' ? 'Особисто звірив/звіряла документ, рядок, замовлення, обидві ТТН та кількості посилки.' : 'Підтверджую прив’язку існуючої зворотної ТТН та обраних кількостей для серверної перевірки.' }}</BaseCheckbox>
        <BaseButton variant="primary" :disabled="!canAttach || (!attach.intent.value && (!attachValid || !attachConfirmed))" @click="attachCase">{{ attach.intent.value ? 'Повторити ту саму прив’язку ТТН' : 'Прив’язати існуючу зворотну ТТН' }}</BaseButton>
      </div>
      <BaseSelect v-if="state.cases.length" v-model="selectedId" :id="`np-case-${order.id}`" :aria-labelledby="`np-case-${order.id}-label`" label="Зовнішній випадок повернення НП" native :disabled="locked"><option v-for="item in state.cases" :key="item.id" :value="String(item.id)">#{{ item.id }} · {{ item.return_ttn }} · {{ item.financial_mode === 'paid' ? 'оплачений продаж' : 'неоплачена COD-відмова' }}</option></BaseSelect>
      <p v-if="pendingId && !record" role="status">Відновлюємо оригінальний випадок #{{ pendingId }}. Його точний запит збережено.</p>
      <article v-if="record" :aria-label="`Зовнішнє повернення НП #${record.id}`" class="np-panel__group">
        <h3>Випадок НП #{{ record.id }} · {{ record.financial_mode === 'paid' ? 'оплачений продаж' : 'неоплачена COD-відмова' }}</h3>
        <p v-if="record.test_context" class="np-panel__notice">ТЕСТОВИЙ КОНТЕКСТ · не підтверджує реальну операцію НП або гроші.</p>
        <p role="status">{{ shopNPStatus(record.status) }}</p>
        <p>Вихідна ТТН {{ record.original_ttn }} → зворотна ТТН {{ record.return_ttn }}</p>
        <p>{{ record.linkage_authority === 'manual' ? 'Зв’язок ТТН: ручна перевірка зовнішнього документа співробітником; не автоматична перевірка НП.' : record.linkage_authority === 'test' ? 'Зв’язок ТТН: тестовий перевірений доказ НП.' : 'Зв’язок ТТН: перевірений сервером доказ НП.' }}</p>
        <p v-if="record.manual_link">Документ зв’язку: {{ record.manual_link.source }} · {{ record.manual_link.document_id }} · рядок {{ record.manual_link.line_id }}</p>
        <ul><li v-for="line in record.lines" :key="line.order_item_id">{{ line.name || `Позиція #${line.order_item_id}` }} · {{ line.quantity }}</li></ul>
        <p v-for="code in record.blocking_reasons" :key="code">{{ shopNPReason(code) }}</p>
        <details v-if="record.observation"><summary>Окремий доказ спостереження НП</summary><p>Вихідна ТТН: {{ shopNPObservationStatus(record.observation.proof.original.status) }} · {{ record.observation.proof.original.raw_status }}</p><p>Зворотна ТТН: {{ shopNPObservationStatus(record.observation.proof.reverse.status) }} · {{ record.observation.proof.reverse.raw_status }}</p><p>Спостереження: {{ formatDateTime(record.observation.proof.observed_at) }}</p><p class="np-panel__hash">Hash доказу: {{ record.observation.proof_hash }}</p></details>
        <BaseButton v-if="record.actions.refresh || refresh.intent.value" :disabled="!canCase('refresh')" @click="runCase('refresh')">{{ refresh.intent.value ? 'Повторити ту саму перевірку повернення НП' : 'Перевірити повернення НП' }}</BaseButton>
        <div v-if="record.receipt" class="np-panel__facts"><h3>Фізичне приймання НП #{{ record.receipt.id }}</h3><p>Вміст перевірено окремо · {{ record.receipt.evidence }} · співробітник #{{ record.receipt.operator_id }} · {{ formatDateTime(record.receipt.created_at) }}</p><ul><li v-for="line in record.receipt.lines" :key="line.order_item_id">Позиція #{{ line.order_item_id }} · {{ line.quantity }} · {{ line.disposition === 'restock' ? 'Оприбутковано за цим прийманням' : 'Прийнято без оприбуткування' }}</li></ul><p class="np-panel__hash">Hash приймання: {{ record.receipt.snapshot_hash }}</p></div>
        <div v-if="record.actions.receive || receive.intent.value" class="np-panel__group">
          <h3>Окрема перевірка вмісту та приймання</h3><p>Прийміть усі зазначені кількості посилки. Прибуття НП не доводить її вміст і не змінює склад автоматично.</p>
          <BaseSelect v-for="line in record.lines" :key="line.order_item_id" v-model="dispositions[line.order_item_id]" :id="`np-disposition-${record.id}-${line.order_item_id}`" :aria-labelledby="`np-disposition-${record.id}-${line.order_item_id}-label`" :label="`Рішення щодо повернення ${line.name || line.order_item_id}`" native :disabled="locked"><option value="">Оберіть рішення</option><option value="restock">Оприбуткувати придатний товар</option><option value="not_restock">Прийняти без оприбуткування</option></BaseSelect>
          <BaseInput v-model="receiptEvidence" label="Доказ перевірки вмісту та приймання НП" :maxlength="500" :disabled="locked" />
          <BaseCheckbox v-model="goodsFit" :disabled="locked">Товар, обраний для оприбуткування, оглянуто та визнано придатним до продажу.</BaseCheckbox>
          <BaseCheckbox v-model="contentsConfirmed" :disabled="locked">Особисто перевірив/перевірила вміст, усі кількості посилки та кожне рішення щодо складу.</BaseCheckbox>
          <BaseButton variant="primary" :disabled="!canCase('receive') || (!receive.intent.value && !receiptValid)" @click="runCase('receive')">{{ receive.intent.value ? 'Повторити те саме приймання НП' : 'Зафіксувати окреме приймання НП' }}</BaseButton>
        </div>
        <template v-if="record.financial_mode === 'paid'">
          <p v-if="record.financial_return_id">Фінансове повернення #{{ record.financial_return_id }} успадковує приймання НП #{{ record.receipt?.id }}. Повернення грошей і чек оформлюються окремо в розділі «Повернення»; повторного складського руху немає.</p>
          <div v-if="record.actions.financial_claim || claim.intent.value" class="np-panel__group"><h3>Фінансовий запит за прийнятою посилкою</h3><p>Запит охопить усі прийняті кількості цієї посилки. Він не виконує банківського переказу, не видає чек та не оприбутковує товар повторно.</p><BaseInput v-model="claimReason" label="Причина фінансового повернення за прийманням НП" :maxlength="500" :disabled="locked" /><BaseCheckbox v-model="claimConfirmed" :disabled="locked">Підтверджую окремий фінансовий запит за всім прийманням цієї посилки.</BaseCheckbox><BaseButton :disabled="!canCase('financial_claim') || (!claim.intent.value && (!claimConfirmed || !claimReason.trim()))" @click="runCase('financial_claim')">{{ claim.intent.value ? 'Повторити той самий фінансовий запит НП' : 'Створити фінансове повернення за прийманням НП' }}</BaseButton></div>
        </template>
        <template v-else>
          <p>НЕОПЛАЧЕНА COD-ВІДМОВА · платіж, повернення грошей та фіскальний документ не створюються.</p>
          <p v-if="record.closure">Неоплачену відмову закрито за прийманням #{{ record.closure.receipt_id }}: {{ record.closure.evidence }}. Повторного складського руху немає.</p>
          <div v-if="record.actions.close_unpaid || close.intent.value" class="np-panel__group"><BaseInput v-model="closeEvidence" label="Доказ закриття неоплаченої відмови НП" :maxlength="500" :disabled="locked" /><BaseCheckbox v-model="closeConfirmed" :disabled="locked">Підтверджую закриття повної неоплаченої COD-відмови без фінансових фактів і повторного оприбуткування.</BaseCheckbox><BaseButton :disabled="!canCase('close_unpaid') || (!close.intent.value && (!closeConfirmed || !closeEvidence.trim()))" @click="runCase('close_unpaid')">{{ close.intent.value ? 'Повторити те саме закриття COD-відмови' : 'Закрити неоплачену відмову НП' }}</BaseButton></div>
        </template>
      </article>
    </template>
    <p v-for="message in [error, recoveryError, ...list.map(command => command.error.value)].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
<style scoped>
.np-panel { padding:1.25rem; border:1px solid var(--bo-border); border-radius:1.5rem; background:var(--bo-surface); color:var(--bo-text-primary); }
.np-panel header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem; } .np-panel h2 { font-size:1.2rem; font-weight:700; } .np-panel h3 { font-weight:600; }
.np-panel p, .np-panel ul, .np-panel details { margin-top:.8rem; } .np-panel ul { padding-left:1.2rem; list-style:disc; } .np-panel summary { cursor:pointer; padding:.5rem 0; }
.np-panel__group { display:grid; gap:.8rem; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--bo-border); }
.np-panel__notice, .np-panel__facts { padding:1rem; border:1px solid var(--bo-border); border-radius:.75rem; background:var(--bo-surface-hover); } .np-panel__hash { overflow-wrap:anywhere; color:var(--bo-text-secondary); }
</style>
