<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'
import type { ResolutionBankEvidence, ResolutionCase, ResolutionCaseCommand, ResolutionKind, ResolutionOpen, ResolutionOperation, ResolutionState } from '~/utils/shopPaymentResolution'
import { resolutionPrefix, resolutionPaths, resolutionProfile, resolutionProfileMatches, resolutionCaseMatches, resolutionDocumentValid, resolutionInvoiceValid, resolutionStatus, resolutionReason, resolutionMoney, resolutionBankStatus, resolutionRejected, resolutionFailure, useResolutionRead } from '~/utils/shopPaymentResolution'
const props = defineProps<{ order: OrderResponse, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi(), auth = useAuthStore(), resource = computed(() => String(props.order.id))
const { formatDateTime } = useBookingFormatting()
const context = () => JSON.stringify([auth.user, props.order.id])
const read = useResolutionRead(context, () => api<ResolutionState>(`${resolutionPrefix}/orders/${props.order.id}`, { retry: 0 }), () => props.order.id, () => !!auth.user?.id && props.order.channel === 'shop')
const { state, loading, error } = read
const paid = useOrderSalesCommand<ResolutionOpen>('shop-r4-open-paid', resource, resolutionRejected), review = useOrderSalesCommand<ResolutionOpen>('shop-r4-open-review', resource, resolutionRejected)
const inspect = useOrderSalesCommand<ResolutionCaseCommand>('shop-r4-inspect', resource, resolutionRejected), correction = useOrderSalesCommand<ResolutionCaseCommand>('shop-r4-correct', resource, resolutionRejected), claim = useOrderSalesCommand<ResolutionCaseCommand>('shop-r4-claim', resource, resolutionRejected), close = useOrderSalesCommand<ResolutionCaseCommand>('shop-r4-close', resource, resolutionRejected), finalize = useOrderSalesCommand<ResolutionCaseCommand>('shop-r4-finalize', resource, resolutionRejected)
const opens = { paid_cancellation: paid, invoice_review: review }, commands = { inspect, correct_invoice: correction, financial_claim: claim, close_unpaid: close, finalize_paid: finalize }
const caseCommands = [inspect, correction, claim, close, finalize], list = [paid, review, ...caseCommands]
const busy = computed(() => list.some(command => command.busy.value)), unresolved = computed(() => list.some(command => !!command.intent.value)), locked = computed(() => busy.value || unresolved.value)
const selectedId = ref(''), recovered = shallowRef<ResolutionCase | null>(null), recovering = ref(false), recoveryError = ref('')
const pendingId = computed(() => { void busy.value; return caseCommands.find(command => command.intent.value)?.intent.value?.body.case_id || paid.intent.value?.resultId || review.intent.value?.resultId })
const record = computed(() => { const id = pendingId.value || Number(selectedId.value); return state.value?.cases.find(item => item.id === id) || (recovered.value?.id === id ? recovered.value : null) })
const testContext = computed(() => state.value?.cases.some(item => item.test_context) || recovered.value?.test_context)
const reason = ref(''), custody = ref(false), invoiceId = ref(''), foreignId = ref(''), replacementId = ref(''), correctionConfirmed = ref(false), claimReason = ref(''), claimConfirmed = ref(false), finalizeConfirmed = ref(false)
const bankType = ref(''), bankSource = ref(''), bankDocument = ref(''), bankLine = ref(''), bankDate = ref(''), bankVerified = ref(false), noMoney = ref(false), noHold = ref(false), allInvoicesClosed = ref(false)
const bankEvidence = computed<ResolutionBankEvidence | null>(() => {
  const value = record.value, policy = value?.manual_policy
  if (!value || !policy || !value.manual_policy_hash || !policy.document_types.includes(bankType.value) || !bankSource.value.trim() || bankSource.value.trim().length > 100 || !resolutionDocumentValid(bankDocument.value.trim()) || !resolutionDocumentValid(bankLine.value.trim()) || !bankVerified.value || !noMoney.value || !noHold.value || !allInvoicesClosed.value || !bankDate.value) return null
  const date = new Date(bankDate.value)
  if (!Number.isFinite(date.getTime()) || typeof value.snapshot.intent_id !== 'string' || typeof value.snapshot.reference !== 'string') return null
  return { type: bankType.value, source: bankSource.value.trim(), issuer: policy.issuer, account: policy.account, document_id: bankDocument.value.trim(), line_id: bankLine.value.trim(), order_id: props.order.id, intent_id: value.snapshot.intent_id, reference: value.snapshot.reference, known_invoice_ids: [...value.known_invoice_ids], verified_at: date.toISOString(), verified: true, no_money: true, no_hold: true, all_reference_invoices_closed: true }
})
const canOpen = (kind: ResolutionKind) => {
  const current = state.value, saved = opens[kind].intent.value
  if (!current || loading.value || recovering.value || busy.value || unresolved.value && !saved) return false
  if (saved?.resultId) return Number.isSafeInteger(saved.resultId) && saved.resultId > 0
  if (saved) return saved.body.kind === kind && resolutionProfileMatches(saved.body, resolutionProfile(current, kind)) && current.actions[`replay_open_${kind}`] === true
  const profile = resolutionProfile(current, kind)
  return !!profile.profile_id && !!profile.profile_hash && current.actions[`open_${kind}`] === true
}
const canCase = (operation: ResolutionOperation) => {
  const current = record.value, saved = commands[operation].intent.value
  if (!state.value || !current || loading.value || recovering.value || busy.value || unresolved.value && !saved) return false
  if (['inspect', 'correct_invoice', 'close_unpaid'].includes(operation) && current.kind !== 'invoice_review' || ['financial_claim', 'finalize_paid'].includes(operation) && current.kind !== 'paid_cancellation') return false
  if (saved && (saved.body.case_id !== current.id || !resolutionProfileMatches(saved.body, current))) return false
  if (saved?.resultId) return saved.resultId === current.id
  return current.actions[saved ? `replay_${operation}` : operation] === true
}
let recoverySequence = 0
const hydrateCase = async (id: number) => {
  const version = read.version(), sequence = ++recoverySequence; recovering.value = true
  try { const value = await api<ResolutionCase>(`${resolutionPrefix}/cases/${id}`, { retry: 0 }); if (!read.current(version) || sequence !== recoverySequence) return false; if (!resolutionCaseMatches(value, props.order.id, id)) throw new Error('Invalid original resolution'); recovered.value = value; recoveryError.value = ''; return true }
  catch { if (read.current(version) && sequence === recoverySequence) { recovered.value = null; recoveryError.value = 'Не вдалося відновити оригінальну звірку. Точний запит збережено; новий випадок не створено.' } return false }
  finally { if (sequence === recoverySequence) recovering.value = false }
}
const accepted = async (version: number, id: number, matches: (value: ResolutionCase) => boolean, clear: () => void) => {
  if (!read.current(version)) return
  if (!await read.load()) throw new Error('Canonical resolution read unavailable')
  if (!read.current(version)) return
  let value = state.value?.cases.find(item => item.id === id)
  if (!value) { if (!await hydrateCase(id)) throw new Error('Original resolution unavailable'); value = recovered.value || undefined }
  if (!read.current(version)) return
  if (!value || !matches(value)) throw new Error('Resolution acknowledgement belongs to another case')
  clear(); selectedId.value = String(id); emit('changed')
}
const request = async (path: string, body: object, key: string, version: number) => {
  try { return await api<ResolutionCase>(path, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 }) }
  catch (cause) { const code = (cause as { data?: { detail?: { code?: string } } })?.data?.detail?.code; if (['revision_conflict', 'resolution_revision_conflict'].includes(code || '') && (!await read.load() || !read.current(version))) throw new Error('Спочатку відновіть канонічний стан; точний запит збережено.'); return resolutionFailure(cause) }
}
const openCase = async (kind: ResolutionKind) => {
  const command = opens[kind], current = state.value
  if (!canOpen(kind) || !current || !command.intent.value && (!custody.value || !reason.value.trim() || reason.value.trim().length > 500)) return
  const profile = resolutionProfile(current, kind), version = read.version()
  const body: ResolutionOpen = command.intent.value?.body || { kind, expected_revision: current.revision, expected_profile_id: profile.profile_id!, expected_profile_hash: profile.profile_hash!, reason: reason.value.trim(), goods_in_custody: true }
  custody.value = false
  const matches = (value: ResolutionCase) => value.kind === kind && resolutionProfileMatches(body, value)
  await command.execute(body, async (saved, key) => {
    if (!read.current(version) || !state.value || saved.kind !== kind || !resolutionProfileMatches(saved, resolutionProfile(state.value, kind))) throw new Error('Resolution profile changed')
    const { kind: savedKind, ...payload } = saved
    const value = await request(`${resolutionPrefix}/orders/${props.order.id}/${savedKind === 'paid_cancellation' ? 'paid-cancellation' : 'invoice-review'}`, payload, key, version)
    if (!resolutionCaseMatches(value, props.order.id) || !matches(value)) throw new Error('Mismatched resolution open ACK')
    return { id: value.id }
  }, id => accepted(version, id, matches, () => { command.clear(); reason.value = '' }))
  if (read.current(version) && !command.intent.value && command.error.value) await read.load()
}
const runCase = async (operation: ResolutionOperation) => {
  const command = commands[operation], current = record.value
  if (!current || !canCase(operation)) return
  if (!command.intent.value && (operation === 'inspect' && !resolutionInvoiceValid(invoiceId.value.trim()) || operation === 'correct_invoice' && (!correctionConfirmed.value || foreignId.value === replacementId.value || ![foreignId.value, replacementId.value].every(id => current.observations.some(item => String(item.id) === id))) || operation === 'financial_claim' && (!claimConfirmed.value || !claimReason.value.trim() || claimReason.value.trim().length > 500) || operation === 'close_unpaid' && !bankEvidence.value || operation === 'finalize_paid' && !finalizeConfirmed.value)) return
  const version = read.version(), body: ResolutionCaseCommand = command.intent.value?.body || { case_id: current.id, expected_revision: current.revision, expected_profile_id: current.profile_id, expected_profile_hash: current.profile_hash,
    ...(operation === 'inspect' ? { invoice_id: invoiceId.value.trim() } : operation === 'correct_invoice' ? { foreign_observation_id: Number(foreignId.value), replacement_observation_id: Number(replacementId.value) } : operation === 'financial_claim' ? { reason: claimReason.value.trim() } : operation === 'close_unpaid' ? { expected_manual_policy_id: current.manual_policy!.id, expected_manual_policy_hash: current.manual_policy_hash!, evidence: bankEvidence.value! } : { confirm: true as const }) }
  correctionConfirmed.value = false; claimConfirmed.value = false; finalizeConfirmed.value = false; bankVerified.value = false; noMoney.value = false; noHold.value = false; allInvoicesClosed.value = false
  const matches = (value: ResolutionCase) => value.kind === current.kind && value.id === body.case_id && resolutionProfileMatches(body, value)
  await command.execute(body, async (saved, key) => {
    if (!read.current(version) || !record.value || saved.case_id !== record.value.id || !resolutionProfileMatches(saved, record.value)) throw new Error('Resolution case changed')
    const { case_id, ...payload } = saved, value = await request(`${resolutionPrefix}/cases/${case_id}/${resolutionPaths[operation]}`, payload, key, version)
    if (!resolutionCaseMatches(value, props.order.id, case_id) || !matches(value)) throw new Error('Mismatched resolution command ACK')
    return { id: value.id }
  }, id => accepted(version, id, matches, () => { command.clear(); invoiceId.value = ''; foreignId.value = ''; replacementId.value = ''; claimReason.value = ''; bankSource.value = ''; bankDocument.value = ''; bankLine.value = ''; bankDate.value = '' }))
  if (read.current(version) && !command.intent.value && command.error.value) await read.load()
}
const restoreSaved = () => {
  const opened = paid.intent.value || review.intent.value
  if (opened) reason.value = opened.body.reason
  if (inspect.intent.value) invoiceId.value = inspect.intent.value.body.invoice_id || ''
  if (correction.intent.value) { foreignId.value = String(correction.intent.value.body.foreign_observation_id); replacementId.value = String(correction.intent.value.body.replacement_observation_id) }
  if (claim.intent.value) claimReason.value = claim.intent.value.body.reason || ''
  const evidence = close.intent.value?.body.evidence
  if (evidence) { bankType.value = evidence.type; bankSource.value = evidence.source; bankDocument.value = evidence.document_id; bankLine.value = evidence.line_id; bankDate.value = new Date(new Date(evidence.verified_at).getTime() - new Date(evidence.verified_at).getTimezoneOffset() * 60000).toISOString().slice(0, 19) }
}
const resetConfirmations = () => { custody.value = false; correctionConfirmed.value = false; claimConfirmed.value = false; finalizeConfirmed.value = false; bankVerified.value = false; noMoney.value = false; noHold.value = false; allInvoicesClosed.value = false }
watch(context, () => { recoverySequence++; recovered.value = null; recovering.value = false; recoveryError.value = ''; selectedId.value = ''; reason.value = ''; invoiceId.value = ''; foreignId.value = ''; replacementId.value = ''; claimReason.value = ''; bankType.value = ''; bankSource.value = ''; bankDocument.value = ''; bankLine.value = ''; bankDate.value = ''; resetConfirmations(); restoreSaved() }, { immediate: true, flush: 'sync' })
watch(list.map(command => command.intent), restoreSaved, { immediate: true, flush: 'post' })
watch([pendingId, () => state.value], () => { if (state.value && pendingId.value && !state.value.cases.some(item => item.id === pendingId.value)) void hydrateCase(pendingId.value) })
watch(() => state.value?.cases, values => { if (pendingId.value) selectedId.value = String(pendingId.value); else if (values?.length && !values.some(item => String(item.id) === selectedId.value)) selectedId.value = String(values[values.length - 1]!.id) })
watch(selectedId, () => { invoiceId.value = ''; foreignId.value = ''; replacementId.value = ''; claimReason.value = ''; bankSource.value = ''; bankDocument.value = ''; bankLine.value = ''; bankDate.value = ''; resetConfirmations(); if (unresolved.value) restoreSaved() }, { flush: 'sync' })
watch(() => JSON.stringify([reason.value, state.value?.revision]), () => { custody.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([foreignId.value, replacementId.value, record.value?.revision]), () => { correctionConfirmed.value = false }, { flush: 'sync' })
watch([claimReason, () => record.value?.revision], () => { claimConfirmed.value = false }, { flush: 'sync' })
watch(() => JSON.stringify([bankType.value, bankSource.value, bankDocument.value, bankLine.value, bankDate.value, record.value?.revision, record.value?.manual_policy_hash, record.value?.manual_policy]), () => { bankVerified.value = false; noMoney.value = false; noHold.value = false; allInvoicesClosed.value = false }, { flush: 'sync' })
watch(() => record.value?.revision, () => { finalizeConfirmed.value = false })
watch(() => record.value?.manual_policy, policy => { if (!close.intent.value && policy && !policy.document_types.includes(bankType.value)) bankType.value = policy.document_types[0] || '' })
watch([() => props.order.revision, () => props.refreshToken], () => { if (auth.user?.id) void read.load() })
onScopeDispose(() => { recoverySequence++ })
const reload = async () => { if (await read.load() && pendingId.value && !state.value?.cases.some(item => item.id === pendingId.value)) await hydrateCase(pendingId.value) }
</script>
<template>
  <section class="resolution-panel" aria-label="Скасування до видачі та звірка передплати">
    <header><h2>Скасування до видачі та звірка передплати</h2><BaseButton :disabled="loading || busy" @click="reload">Оновити звірку та скасування</BaseButton></header>
    <p>Лише повне замовлення, яке не передавалось клієнту чи перевізнику. Резерв утримується до окремого фінального скасування. Фізичного повернення, оприбуткування та автоматичного банківського переказу тут немає.</p>
    <p v-if="testContext" class="resolution-panel__notice" role="status">ЛОКАЛЬНИЙ MOCK · збережені факти тестові; реальні платежі, операції провайдерів, надсилання до ДПС і повідомлення клієнту не виконуються.</p>
    <p v-if="loading || recovering" role="status">Перевіряємо початковий випадок, профіль і актуальні дозволи…</p>
    <template v-if="state">
      <div v-if="!state.cases.length"><p v-for="code in state.blocking_reasons" :key="code">{{ resolutionReason(code) }}</p></div>
      <p v-if="unresolved" class="resolution-panel__notice" role="status">Є точний збережений запит. Повтор використовує початкові дані та ключ; інші дії заблоковано до перевірки результату.</p>
      <div v-if="state.actions.open_paid_cancellation || state.actions.open_invoice_review || paid.intent.value || review.intent.value" class="resolution-panel__group">
        <BaseInput v-model="reason" label="Підстава скасування або звірки" :maxlength="500" :disabled="locked" />
        <BaseCheckbox v-if="!paid.intent.value && !review.intent.value" v-model="custody" :disabled="loading || busy">Особисто перевірив/перевірила: усі товари залишаються у нас, видачі та передачі перевізнику не було.</BaseCheckbox>
        <BaseButton v-if="state.actions.open_paid_cancellation || paid.intent.value" :disabled="!canOpen('paid_cancellation') || (!paid.intent.value && (!custody || !reason.trim()))" @click="openCase('paid_cancellation')">{{ paid.intent.value ? 'Повторити те саме відкриття оплаченої заявки' : 'Відкрити повне оплачене скасування' }}</BaseButton>
        <BaseButton v-if="state.actions.open_invoice_review || review.intent.value" :disabled="!canOpen('invoice_review') || (!review.intent.value && (!custody || !reason.trim()))" @click="openCase('invoice_review')">{{ review.intent.value ? 'Повторити те саме відкриття звірки invoice' : 'Відкрити звірку проблемного invoice' }}</BaseButton>
      </div>
      <BaseSelect v-if="state.cases.length" v-model="selectedId" :id="`resolution-case-${order.id}`" :aria-labelledby="`resolution-case-${order.id}-label`" label="Випадок скасування або звірки" native :disabled="locked"><option v-for="item in state.cases" :key="item.id" :value="String(item.id)">#{{ item.id }} · {{ item.kind === 'paid_cancellation' ? 'повне оплачене скасування' : 'звірка invoice' }}</option></BaseSelect>
      <article v-if="record" :aria-label="`Звірка платежу #${record.id}`" class="resolution-panel__group">
        <h3>Випадок #{{ record.id }} · {{ record.kind === 'paid_cancellation' ? 'повне оплачене скасування' : 'звірка invoice' }}</h3><p role="status">{{ resolutionStatus(record.status) }}</p><p>{{ record.reason }}</p>
        <p v-if="record.test_context" class="resolution-panel__notice">ТЕСТОВИЙ КОНТЕКСТ · не підтверджує реальні гроші або операції.</p>
        <p v-for="code in record.blocking_reasons" :key="code">{{ resolutionReason(code) }}</p>
        <p v-if="record.snapshot.reference">Reference: {{ record.snapshot.reference }} · початковий invoice {{ record.snapshot.original_invoice_id || 'не підтверджено' }}</p>
        <template v-if="record.kind === 'paid_cancellation'">
          <p>Потрібні вихідний чек продажу, повне повернення грошей і підтверджений чек повернення. Резерв звільняється лише фінальною дією; фактичний залишок товару не збільшується.</p>
          <p v-if="record.status === 'awaiting_sale'">Оформіть або відновіть початковий чек у розділі «Документи та чеки», потім оновіть цю заявку. Невідомий UUID не замінюється новим автоматично.</p>
          <p v-if="record.financial_return_id">Повний фінансовий запит #{{ record.financial_return_id }}: гроші та чек оформлюються окремо в розділі «Повернення». Приймання не потрібне — товар не передавався.</p>
          <div v-if="record.actions.financial_claim || claim.intent.value" class="resolution-panel__group"><BaseInput v-model="claimReason" label="Причина повного фінансового повернення" :maxlength="500" :disabled="locked" /><BaseCheckbox v-model="claimConfirmed" :disabled="locked">Підтверджую фінансовий запит на все замовлення без фізичного приймання або оприбуткування.</BaseCheckbox><BaseButton :disabled="!canCase('financial_claim') || (!claim.intent.value && (!claimConfirmed || !claimReason.trim()))" @click="runCase('financial_claim')">{{ claim.intent.value ? 'Повторити той самий повний фінансовий запит' : 'Створити повний фінансовий запит скасування' }}</BaseButton></div>
          <div v-if="record.actions.finalize_paid || finalize.intent.value" class="resolution-panel__group"><BaseCheckbox v-model="finalizeConfirmed" :disabled="locked">Підтверджую окреме фінальне скасування після повного повернення грошей і чека; резерв буде звільнено один раз.</BaseCheckbox><BaseButton :disabled="!canCase('finalize_paid') || (!finalize.intent.value && !finalizeConfirmed)" @click="runCase('finalize_paid')">{{ finalize.intent.value ? 'Повторити те саме фінальне оплачене скасування' : 'Фінально скасувати оплачене замовлення' }}</BaseButton></div>
        </template>
        <template v-else>
          <p>Спостереження банку не створює оплату. Невдача, прострочення чи 404 не доводять відсутності грошей і не закривають invoice.</p>
          <div v-if="record.actions.inspect || inspect.intent.value" class="resolution-panel__group"><BaseInput v-model="invoiceId" label="invoiceId для окремої звірки" :maxlength="100" :disabled="locked" /><BaseButton :disabled="!canCase('inspect') || (!inspect.intent.value && !resolutionInvoiceValid(invoiceId.trim()))" @click="runCase('inspect')">{{ inspect.intent.value ? 'Повторити ту саму звірку invoice' : 'Перевірити invoice без запису оплати' }}</BaseButton></div>
          <article v-for="observation in record.observations" :key="observation.id" class="resolution-panel__facts"><h3>Спостереження #{{ observation.id }} · {{ observation.invoice_id }}</h3><p>{{ formatDateTime(observation.created_at) }} · співробітник #{{ observation.operator_id }}</p><p v-if="observation.error_code">{{ resolutionReason(observation.error_code) }} Відсутність грошей не підтверджена.</p><template v-if="observation.proof"><p>Перевірена банківська відповідь: {{ resolutionBankStatus(observation.proof.status) }} · reference {{ observation.proof.reference }}</p><p>Заявлена сума {{ resolutionMoney(observation.proof.amount_minor, observation.proof.currency, observation.proof.currency_code) }}. Саме спостереження не є фактом оплати замовлення.</p></template><p class="resolution-panel__hash">SHA-256 {{ observation.proof_hash }}</p></article>
          <div v-if="record.actions.correct_invoice || correction.intent.value" class="resolution-panel__group"><p>Лише одноразова заміна позитивно підтвердженого чужого reference на точний власний invoice. Історія зберігається; виправлення не записує гроші.</p><BaseSelect v-model="foreignId" :id="`resolution-foreign-${record.id}`" :aria-labelledby="`resolution-foreign-${record.id}-label`" label="Спостереження початкового чужого invoice" native :disabled="locked"><option value="">Оберіть спостереження</option><option v-for="item in record.observations" :key="item.id" :value="String(item.id)">#{{ item.id }} · {{ item.invoice_id }}</option></BaseSelect><BaseSelect v-model="replacementId" :id="`resolution-replacement-${record.id}`" :aria-labelledby="`resolution-replacement-${record.id}-label`" label="Спостереження власного invoice для заміни" native :disabled="locked"><option value="">Оберіть спостереження</option><option v-for="item in record.observations" :key="item.id" :value="String(item.id)">#{{ item.id }} · {{ item.invoice_id }}</option></BaseSelect><BaseCheckbox v-model="correctionConfirmed" :disabled="locked">Підтверджую лише виправлення прив’язки за двома перевіреними спостереженнями, без запису оплати.</BaseCheckbox><BaseButton :disabled="!canCase('correct_invoice') || (!correction.intent.value && (!correctionConfirmed || !foreignId || !replacementId || foreignId === replacementId))" @click="runCase('correct_invoice')">{{ correction.intent.value ? 'Повторити те саме виправлення invoice' : 'Виправити invoice зі збереженням історії' }}</BaseButton></div>
          <p v-if="record.correction">Виправлення #{{ record.correction.id }}: початковий invoice {{ record.correction.original_invoice_id }} → поточний {{ record.correction.replacement_invoice_id }}. Оплату підтверджуйте окремо кнопкою «Перевірити invoice у Monobank» в оплаті магазину.</p>
          <div v-if="record.actions.close_unpaid || close.intent.value" class="resolution-panel__group"><h3>Ручна звірка банківського документа для неоплаченого закриття</h3><p v-if="record.manual_policy?.environment === 'test'" class="resolution-panel__notice">ТЕСТОВА ПОЛІТИКА ДОКУМЕНТА · запис ручної звірки не підтверджує реальне банківське закриття.</p><p>Банк має окремо підтвердити відсутність грошей і утримання та деактивацію всіх invoice цього reference. Це запис перевірених доказів співробітника, без операції банку.</p><p>Reference {{ record.snapshot.reference }} · intent {{ record.snapshot.intent_id }}</p><p>Усі поточні invoice за серверними фактами: {{ record.known_invoice_ids.length ? record.known_invoice_ids.join(', ') : 'Сервер підтвердив порожній перелік відомих invoice; документ однаково має охоплювати всі invoice цього reference.' }}</p><p v-if="close.intent.value">Точний збережений запит: політика {{ close.intent.value.body.expected_manual_policy_id }} · установа {{ close.intent.value.body.evidence?.issuer }} · рахунок {{ close.intent.value.body.evidence?.account }}. Повтор не підміняє їх поточними налаштуваннями.</p><p v-if="record.manual_policy">Поточна політика: установа {{ record.manual_policy.issuer }} · рахунок {{ record.manual_policy.account }} · політика {{ record.manual_policy.id }}</p><BaseSelect v-model="bankType" :id="`resolution-bank-type-${record.id}`" :aria-labelledby="`resolution-bank-type-${record.id}-label`" label="Тип банківського документа закриття" native :disabled="locked"><option v-for="type in record.manual_policy?.document_types || []" :key="type" :value="type">{{ type === 'bank_closure_statement' ? 'Банківська довідка про закриття та відсутність грошей' : 'Дозволений банківський документ' }}</option></BaseSelect><BaseInput v-model="bankSource" label="Джерело банківського документа закриття" :maxlength="100" :disabled="locked" /><BaseInput v-model="bankDocument" label="Номер банківського документа закриття" :maxlength="100" :disabled="locked" /><BaseInput v-model="bankLine" label="Рядок банківського документа закриття" :maxlength="100" :disabled="locked" /><BaseInput v-model="bankDate" label="Дата перевірки банком (місцевий час)" type="datetime-local" step="1" :disabled="locked" /><BaseCheckbox v-model="noMoney" :disabled="locked">У перевіреному мною банківському документі підтверджено відсутність отриманих грошей за цим reference.</BaseCheckbox><BaseCheckbox v-model="noHold" :disabled="locked">У перевіреному мною документі підтверджено відсутність утриманих або заблокованих коштів.</BaseCheckbox><BaseCheckbox v-model="allInvoicesClosed" :disabled="locked">У перевіреному мною документі підтверджено деактивацію всіх invoice цього reference, включно з усіма відомими кандидатами.</BaseCheckbox><BaseCheckbox v-model="bankVerified" :disabled="locked">Особисто звірив/звіряла документ, установу, рахунок, рядок, reference і повний перелік invoice.</BaseCheckbox><BaseButton :disabled="!canCase('close_unpaid') || (!close.intent.value && !bankEvidence)" @click="runCase('close_unpaid')">{{ close.intent.value ? 'Повторити те саме неоплачене закриття' : 'Закрити неоплачене замовлення за документом банку' }}</BaseButton></div>
          <p v-if="record.closure">Ручну звірку банківського документа збережено: {{ record.closure.document_id }} · рядок {{ record.closure.line_id }} · установа {{ record.closure.issuer }} · рахунок {{ record.closure.account }} · співробітник #{{ record.closure.operator_id }}. Історія invoice та intent залишається.</p>
        </template>
        <p v-if="record.finalization">Фінальне скасування #{{ record.finalization.id }} зафіксовано окремо. Резерв звільнено один раз; фізичний залишок товару не збільшувався.</p>
        <article v-for="exception in record.exceptions" :key="exception.id" class="resolution-panel__notice" role="alert"><h3>Потрібна фінансова перевірка #{{ exception.id }}</h3><p>Спостереження #{{ exception.observation_id }} · {{ exception.reason === 'late_success' ? 'Успішна оплата після закриття' : 'Суперечливі банківські факти' }} · {{ resolutionMoney(exception.amount_minor, exception.currency) }}. Видача, повторний резерв і новий платіж автоматично не створюються.</p></article>
      </article>
    </template>
    <p v-for="message in [error, recoveryError, ...list.map(command => command.error.value)].filter(Boolean)" :key="message" role="alert">{{ message }}</p>
  </section>
</template>
<style scoped>
.resolution-panel { padding:1.25rem; border:1px solid var(--bo-border); border-radius:1.5rem; background:var(--bo-surface); color:var(--bo-text-primary); }
.resolution-panel header { display:flex; flex-wrap:wrap; gap:1rem; align-items:center; justify-content:space-between; } .resolution-panel h2 { font-size:1.2rem; font-weight:700; } .resolution-panel h3 { font-weight:600; }
.resolution-panel p, .resolution-panel article { margin-top:.8rem; } .resolution-panel__group { display:grid; gap:.8rem; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--bo-border); } .resolution-panel__notice, .resolution-panel__facts { padding:1rem; border:1px solid var(--bo-border); border-radius:.75rem; background:var(--bo-surface-hover); } .resolution-panel__hash { overflow-wrap:anywhere; color:var(--bo-text-secondary); }
</style>
