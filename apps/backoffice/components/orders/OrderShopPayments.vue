<script setup lang="ts">
import type { OrderResponse } from '~/composables/useBackofficeApi'
import type { ShopCODFields, ShopPaymentOperation, ShopPaymentSaved, ShopPaymentState } from '~/utils/shopPayments'
import { shopPaymentEvidenceRows, shopCODEvidence, shopInvoiceIdValid, shopPaymentIntentMatches, shopPaymentMoney, shopPaymentPaths, shopPaymentReason, shopPaymentRejected, shopPaymentStateMatches, shopPaymentVerification } from '~/utils/shopPayments'

const props = defineProps<{ order: OrderResponse, refreshToken?: number }>()
const emit = defineEmits<{ changed: [] }>()
const api = useApi(), auth = useAuthStore()
const { formatDateTime } = useBookingFormatting()
const resource = computed(() => String(props.order.id))
const stage = useOrderSalesCommand<ShopPaymentSaved>('shop-r2-invoice-intent', resource, shopPaymentRejected)
const verify = useOrderSalesCommand<ShopPaymentSaved>('shop-r2-verify', resource, shopPaymentRejected)
const manual = useOrderSalesCommand<ShopPaymentSaved>('shop-r2-manual-cod', resource, shopPaymentRejected)
const commands = { invoice_intent: stage, verify, manual_cod: manual }
const commandList = [stage, verify, manual]
const busy = computed(() => commandList.some(command => command.busy.value))
const unresolved = computed(() => commandList.some(command => !!command.intent.value))
const state = shallowRef<ShopPaymentState | null>(null)
const loading = ref(false), readError = ref(''), invoiceId = ref(''), lastVerificationStatus = ref('')
const cod = reactive<ShopCODFields>({ type: 'bank_statement', source: '', issuer: '', account: '', document_id: '', line_id: '', gross: '', fee: '', net: '', settled: '', tracking_number: '', verified: false })
const codEvidence = computed(() => shopCODEvidence(cod))
const pinnedInvoiceId = computed(() => state.value?.intent?.effective_invoice_id || state.value?.intent?.invoice_id || verify.intent.value?.body.command.invoice_id || '')
const lockFields = computed(() => busy.value || unresolved.value)
const testAuthority = computed(() => state.value?.test_context === true || state.value?.evidence?.test_context === true || state.value?.readiness.transport === 'mock_http' || state.value?.authority === 'test' || state.value?.payment?.authority === 'test')
let generation = 0, reads = 0
const load = async () => {
  const version = generation, sequence = ++reads, id = props.order.id
  loading.value = true; readError.value = ''; cod.verified = false
  try {
    const value = await api<ShopPaymentState>(`/backoffice/shop-payments/orders/${id}`, { retry: 0 })
    if (version !== generation || sequence !== reads) return false
    if (!shopPaymentStateMatches(value, id)) throw new Error('Invalid payment state')
    state.value = value
    if (value.intent?.effective_invoice_id || value.intent?.invoice_id) invoiceId.value = value.intent.effective_invoice_id || value.intent.invoice_id || ''
    if (!manual.intent.value && value.mode === 'cod' && value.readiness.manual_policy) { cod.issuer = value.readiness.manual_policy.issuer; cod.account = value.readiness.manual_policy.account; if (!value.readiness.manual_policy.types.includes(cod.type)) cod.type = value.readiness.manual_policy.types[0] || 'bank_statement' }
    return true
  } catch {
    if (version === generation && sequence === reads) { state.value = null; readError.value = 'Не вдалося перевірити платіжні факти та дозволи. Дії заблоковано; збережений запит не змінено.' }
    return false
  } finally { if (version === generation && sequence === reads) loading.value = false }
}
const action: Record<ShopPaymentOperation, string> = { invoice_intent: 'create_intent', verify: 'verify_invoice', manual_cod: 'record_manual_cod' }
const canRun = (operation: ShopPaymentOperation) => {
  const current = state.value, command = commands[operation], saved = command.intent.value
  if (!current || loading.value || busy.value || (unresolved.value && !saved)) return false
  if (saved) {
    if (!shopPaymentIntentMatches(saved, current)) return false
    // Known ACK recovery performs only an authorized canonical GET, never another POST.
    if (saved.resultId) return saved.resultId === props.order.id
    const configuredId = current.mode === 'cod' ? current.readiness.manual_policy?.id : current.readiness.profile_id
    const configuredHash = current.mode === 'cod' ? current.readiness.manual_policy_hash : current.readiness.profile_hash
    return current.profile_id === configuredId && current.profile_hash === configuredHash && current.readiness.replay_actions[operation] === true
  }
  return !!current.profile_id && !!current.profile_hash && current.actions[action[operation]] === true
}
const send = async (operation: ShopPaymentOperation) => {
  if (!canRun(operation) || !state.value) return
  const command = commands[operation], version = generation, id = props.order.id, current = state.value
  const body: ShopPaymentSaved = { profile_id: current.profile_id, mode: current.mode, command: { expected_revision: current.revision, expected_profile_id: current.profile_id || '', expected_profile_hash: current.profile_hash || '' } }
  if (operation === 'verify') {
    body.command.invoice_id = pinnedInvoiceId.value || invoiceId.value.trim()
    if (!command.intent.value && !shopInvoiceIdValid(body.command.invoice_id)) return
  }
  if (operation === 'manual_cod') {
    if (!command.intent.value && !codEvidence.value) return
    if (codEvidence.value) body.command.evidence = codEvidence.value
  }
  await command.execute(body, async (saved, key) => {
    // Recheck immediately before dispatch; a profile/mode switch must not reuse an old body.
    if (version !== generation || !state.value || !shopPaymentIntentMatches({ key, body: saved }, state.value)) throw new Error('Payment context changed')
    const result = await api<ShopPaymentState>(`/backoffice/shop-payments/orders/${id}/${shopPaymentPaths[operation]}`, { method: 'POST', body: saved.command, headers: { 'Idempotency-Key': key }, retry: 0 })
    if (!shopPaymentStateMatches(result, id) || result.mode !== saved.mode || result.profile_id !== saved.profile_id) throw new Error('Mismatched payment acknowledgement')
    if (version === generation && operation === 'verify') lastVerificationStatus.value = result.verification_status || ''
    return { id: result.order_id }
  }, async resultId => {
    if (version !== generation) return
    if (resultId !== id || !await load()) throw new Error('Canonical payment state unavailable')
    if (version !== generation) return
    command.clear(); cod.verified = false; emit('changed')
  })
  if (version === generation && !command.intent.value && command.error.value) await load()
}
const restoreSaved = () => {
  const savedVerify = verify.intent.value, savedManual = manual.intent.value
  if (savedVerify?.body.command.invoice_id) invoiceId.value = savedVerify.body.command.invoice_id
  const evidence = savedManual?.body.command.evidence
  if (evidence) Object.assign(cod, { type: evidence.type, source: evidence.source, issuer: evidence.issuer, account: evidence.account, document_id: evidence.document_id, line_id: evidence.line_id, gross: (evidence.gross_amount_minor / 100).toFixed(2), fee: (evidence.fee_minor / 100).toFixed(2), net: (evidence.net_amount_minor / 100).toFixed(2), settled: evidence.settled_at, tracking_number: evidence.tracking_number })
}
watch([stage.intent, verify.intent, manual.intent], restoreSaved, { immediate: true, flush: 'post' })
watch([() => props.order.id, () => JSON.stringify(auth.user)], () => {
  generation++; reads++; state.value = null; readError.value = ''; loading.value = false; invoiceId.value = ''; lastVerificationStatus.value = ''
  Object.assign(cod, { type: 'bank_statement', source: '', issuer: '', account: '', document_id: '', line_id: '', gross: '', fee: '', net: '', settled: '', tracking_number: '', verified: false })
  restoreSaved()
  if (import.meta.client && auth.user?.id && props.order.channel === 'shop') void load()
}, { immediate: true, flush: 'sync' })
watch(() => [cod.type, cod.source, cod.issuer, cod.account, cod.document_id, cod.line_id, cod.gross, cod.fee, cod.net, cod.settled, cod.tracking_number], () => { cod.verified = false }, { flush: 'sync' })
// Read refreshes keep this instance and its accepted callback mounted.
watch([() => props.order.revision, () => props.refreshToken], () => { if (import.meta.client && auth.user?.id && props.order.channel === 'shop') void load() })
onScopeDispose(() => { generation++; reads++ })
</script>

<template>
  <section class="shop-payments" aria-label="Оплата магазину · Monobank і післяплата">
    <header><h2>Оплата магазину</h2><BaseButton variant="neutral" :disabled="loading || busy" @click="load">Оновити стан оплати</BaseButton></header>
    <p>Передплату підтверджує серверна перевірка invoice Monobank. Післяплата має окрему звірку документа співробітником; доставка сама по собі не підтверджує гроші.</p>
    <p v-if="testAuthority" class="shop-payments__notice" role="status">ЛОКАЛЬНИЙ MOCK · платіжний контекст тестовий, зокрема ручна післяплата. Реальні платежі не виконуються; цей блок не створює фіскальний чек і нічого не надсилає до ДПС або клієнта.</p>
    <p v-if="readError" role="alert">{{ readError }}</p>
    <p v-if="loading" role="status">Перевіряємо платіжні факти та актуальні дозволи…</p>
    <template v-if="state">
      <ul v-if="state.blocking_reasons.length"><li v-for="reason in state.blocking_reasons" :key="reason">{{ shopPaymentReason(reason) }}</li></ul>
      <p v-if="unresolved" class="shop-payments__notice" role="status">Є збережений запит. Повтор використовує його точні дані та ключ; інші платіжні дії заблоковано. Зміна профілю або дозволів може заблокувати повтор, але не скасовує запит.</p>
      <div v-if="state.mode === 'prepayment'" class="shop-payments__group">
        <h3>Передплата · серверна перевірка Monobank</h3>
        <p>Збережіть reference та використайте його під час зовнішньої підготовки invoice. Тут немає створення invoice у банку, платіжного посилання або надсилання клієнту.</p>
        <p>Після збереження reference змінення товарів і звичайне скасування блокуються до фінансової звірки. Виправлення чужого invoice або документальне закриття виконується лише окремим дозволеним сценарієм нижче; історія зберігається.</p>
        <BaseButton v-if="state.actions.create_intent || stage.intent.value" :disabled="!canRun('invoice_intent')" :loading="stage.busy.value" @click="send('invoice_intent')">{{ stage.intent.value ? 'Повторити збереження reference' : 'Зберегти серверний reference' }}</BaseButton>
        <dl v-if="state.intent"><div><dt>Reference замовлення</dt><dd><code>{{ state.intent.reference }}</code></dd></div><div><dt>Сума та валюта invoice</dt><dd>{{ shopPaymentMoney(state.intent.amount_minor) }} · {{ state.intent.currency }}</dd></div></dl>
        <template v-if="state.intent || verify.intent.value">
          <BaseInput v-model="invoiceId" label="invoiceId для серверної перевірки" :maxlength="100" :disabled="lockFields || !!pinnedInvoiceId || !!state.payment" />
          <p v-if="pinnedInvoiceId">Поточний invoiceId для серверної перевірки: <code>{{ pinnedInvoiceId }}</code>. Довільна заміна кандидата заборонена.</p>
          <p v-if="state.intent?.correction_id">Виправлення #{{ state.intent.correction_id }}: початковий invoice <code>{{ state.intent.invoice_id }}</code> збережено в історії; поточний <code>{{ state.intent.effective_invoice_id }}</code>. Саме виправлення не підтверджує оплату.</p>
          <p>Введений invoiceId не є доказом оплати. Сервер сам перевіряє банк, reference, суму, валюту та налаштований профіль.</p>
          <BaseButton v-if="state.actions.verify_invoice || verify.intent.value" variant="primary" :disabled="!canRun('verify') || (!verify.intent.value && !shopInvoiceIdValid(pinnedInvoiceId || invoiceId.trim()))" :loading="verify.busy.value" @click="send('verify')">{{ verify.intent.value ? 'Повторити збережену перевірку invoice' : 'Перевірити invoice у Monobank' }}</BaseButton>
          <p v-if="!state.payment && state.intent?.invoice_id" role="status">Invoice прив’язано; завершену оплату ще не підтверджено.</p>
          <p v-if="lastVerificationStatus" role="status">{{ shopPaymentVerification(lastVerificationStatus) }}</p>
        </template>
      </div>
      <div v-if="state.mode === 'cod' && (state.actions.record_manual_cod || manual.intent.value)" class="shop-payments__group">
        <h3>Післяплата · перевірений документ співробітника</h3>
        <p>Це ручна звірка виписки або реєстру, а не автоматичне підтвердження банком. Вкажіть конкретний рядок і точну ТТН. Валова сума має дорівнювати сумі замовлення; комісія + зараховано = валова сума.</p>
        <BaseSelect v-model="cod.type" :id="`shop-cod-type-${order.id}`" :aria-labelledby="`shop-cod-type-${order.id}-label`" label="Тип доказу післяплати" native :disabled="lockFields"><option v-for="type in state.readiness.manual_policy?.types || []" :key="type" :value="type">{{ type === 'bank_statement' ? 'Банківська виписка' : 'Реєстр розрахунків перевізника' }}</option></BaseSelect>
        <BaseInput v-model="cod.source" label="Джерело документа післяплати" :maxlength="100" :disabled="lockFields" />
        <BaseInput v-model="cod.issuer" label="Дозволена установа, що видала документ" :maxlength="100" readonly />
        <BaseInput v-model="cod.account" label="Дозволений рахунок зарахування післяплати" :maxlength="100" readonly />
        <BaseInput v-model="cod.document_id" label="Номер документа післяплати" :maxlength="100" :disabled="lockFields" />
        <BaseInput v-model="cod.line_id" label="Ідентифікатор рядка документа" :maxlength="100" :disabled="lockFields" />
        <BaseInput v-model="cod.tracking_number" label="ТТН у документі післяплати" :maxlength="14" :disabled="lockFields" />
        <div class="shop-payments__amounts"><BaseInput v-model="cod.gross" label="Валова сума, грн" inputmode="decimal" :disabled="lockFields" /><BaseInput v-model="cod.fee" label="Комісія, грн" inputmode="decimal" :disabled="lockFields" /><BaseInput v-model="cod.net" label="Зараховано, грн" inputmode="decimal" :disabled="lockFields" /></div>
        <BaseInput v-model="cod.settled" label="Дата зарахування (місцевий час)" type="datetime-local" step="1" :disabled="lockFields" />
        <p v-if="codEvidence || manual.intent.value?.body.command.evidence">Дата для серверної перевірки: {{ manual.intent.value?.body.command.evidence?.settled_at || codEvidence?.settled_at }}</p>
        <BaseCheckbox v-model="cod.verified" :disabled="lockFields">Особисто звірив/звіряла документ, рахунок, рядок, ТТН, повну суму, комісію та дату фактичного зарахування.</BaseCheckbox>
        <BaseButton variant="primary" :disabled="!canRun('manual_cod') || (!manual.intent.value && !codEvidence)" :loading="manual.busy.value" @click="send('manual_cod')">{{ manual.intent.value ? 'Повторити збережену звірку післяплати' : 'Записати перевірену післяплату' }}</BaseButton>
      </div>
      <p v-for="(command, index) in commandList.filter(item => item.error.value)" :key="index" role="alert">{{ command.error.value }}</p>
      <dl v-if="state.payment" class="shop-payments__facts"><div><dt>Окремий факт оплати #{{ state.payment.id }}</dt><dd>{{ shopPaymentMoney(state.payment.amount_minor) }} · {{ state.payment.currency }}</dd></div><div><dt>Підстава</dt><dd>{{ state.payment.authority === 'manual' ? 'Ручна звірка документа співробітником' : state.payment.authority === 'test' ? 'Тестовий доказ банку · не реальна оплата' : 'Перевірений банківський доказ' }}</dd></div><div><dt>Референс доказу</dt><dd>{{ state.payment.external_reference }}</dd></div><div><dt>Зафіксовано</dt><dd>{{ formatDateTime(state.payment.created_at) }}</dd></div></dl>
      <div v-if="state.evidence" class="shop-payments__facts" aria-label="Збережений доказ оплати">
        <h3>Збережений доказ · {{ state.evidence.kind === 'cod' ? 'ручна звірка післяплати' : 'перевірка Monobank' }}</h3>
        <p v-if="state.evidence.test_context">ТЕСТОВИЙ КОНТЕКСТ · не підтверджує реальне надходження грошей.</p>
        <dl><div v-for="row in shopPaymentEvidenceRows(state.evidence)" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div><div><dt>Співробітник</dt><dd>#{{ state.evidence.operator_id }}</dd></div><div><dt>Доказ збережено</dt><dd>{{ formatDateTime(state.evidence.created_at) }}</dd></div><div><dt>SHA-256 доказу</dt><dd><code>{{ state.evidence.proof_hash }}</code></dd></div></dl>
      </div>
    </template>
  </section>
</template>

<style scoped>
.shop-payments { padding:1.25rem; border:1px solid var(--bo-border); border-radius:1.5rem; background:var(--bo-surface); color:var(--bo-text-primary); }
.shop-payments header { display:flex; flex-wrap:wrap; gap:1rem; align-items:center; justify-content:space-between; }
.shop-payments h2 { font-size:1.25rem; font-weight:600; } .shop-payments h3 { font-weight:600; }
.shop-payments p, .shop-payments ul, .shop-payments dl { margin-top:.8rem; } .shop-payments ul { padding-left:1.25rem; list-style:disc; }
.shop-payments__group { display:grid; gap:1rem; margin-top:1.25rem; padding-top:1rem; border-top:1px solid var(--bo-border); }
.shop-payments__notice { padding:.8rem; border:1px solid var(--bo-border); border-radius:.75rem; background:var(--bo-surface-hover); }
.shop-payments__amounts { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(10rem,1fr)); }
.shop-payments dl { display:grid; gap:.75rem; } .shop-payments dt { color:var(--bo-text-secondary); } .shop-payments dd, .shop-payments code { overflow-wrap:anywhere; }
.shop-payments__facts { padding:1rem; border:1px solid var(--bo-border); border-radius:.75rem; }
</style>
