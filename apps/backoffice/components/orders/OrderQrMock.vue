<script setup lang="ts">
import type { OrderResponse, QrMockAttempt, QrMockCommand, QrMockCreate, QrMockOutcome, QrMockReadiness, ProviderSandboxReadiness } from '~/composables/useBackofficeApi'
import { qrMockCode, qrMockLocalUrl, qrMockMoney, qrMockOwnsSale, qrMockPaymentLabel, qrMockReceiptLabel, qrMockTerminal } from '~/utils/qrMock'
import { qrProviderSandboxUrl, qrProviderSandboxReceiptLabel, qrProviderSandboxBlockingReason } from '~/utils/qrProviderSandbox'
const props = defineProps<{ order?: OrderResponse, attemptId?: number, simulator?: boolean, refreshToken?: number }>()
const emit = defineEmits<{ changed: [], owner: [owned: boolean] }>()
const api = useBackofficeApi(), auth = useAuthStore()
const { isAdmin, isBarber } = useBackofficeAccess()
const resource = computed(() => props.order ? String(props.order.id) : `attempt:${props.attemptId}`)
const permission = computed(() => !!auth.user?.is_active && (auth.user.is_superuser || (auth.user.can_record_sales === true && auth.user.can_accept_qr_payments === true)))
const session = computed(() => JSON.stringify([resource.value, auth.user?.id, auth.accessToken, permission.value]))
const local = computed(() => import.meta.client && !!qrMockLocalUrl('/orders/qr-simulator/1', window.location.origin, 1))
const rejections = ['mock_qr_disabled', 'provider_sandbox_disabled', 'sandbox_not_verified', 'qr_attempt_active', 'qr_sale_unavailable', 'fiscal_owner_exists', 'qr_payment_owns_order', 'payment_required', 'shift_closed']
type CreateIntent = QrMockCreate & { mode?: 'provider_sandbox', prior_attempt_id?: number }
const create = useOrderSalesCommand<CreateIntent>('qr-create', resource, rejections)
type Transition = QrMockCommand & { attempt_id: number, operation: 'refresh' | 'cancel' | 'simulate', mode?: 'provider_sandbox' }
const transition = useOrderSalesCommand<Transition>('qr-command', resource, rejections)
const attempt = shallowRef<QrMockAttempt | null>(null), readiness = shallowRef<QrMockReadiness | null>(null)
const sandboxReadiness = shallowRef<ProviderSandboxReadiness | null>(null), selectedSource = ref<'mock_only' | 'provider_sandbox'>('mock_only')
const providerSandbox = computed(() => create.intent.value?.body.mode === 'provider_sandbox' || (qrMockOwnsSale(attempt.value) ? attempt.value?.mode === 'provider_sandbox' : selectedSource.value === 'provider_sandbox'))
const loading = ref(false), stateReadFailed = ref(false), readError = ref(''), printError = ref('')
const confirmed = ref(false), outcome = ref<QrMockOutcome>('success')
const busy = computed(() => create.busy.value || transition.busy.value)
const unresolved = computed(() => !!create.intent.value || !!transition.intent.value)
const register = computed(() => readiness.value?.cash_registers.find(item => item.id === 'MOCK-KASA-1'))
const canCreate = computed(() => local.value && permission.value && !!props.order?.simulation && props.order.payment_status === 'unpaid' && props.order.status !== 'cancelled' && (providerSandbox.value ? sandboxReadiness.value?.available === true : readiness.value?.available === true) && register.value?.credential_kind === 'mock' && register.value.shift_status === 'open' && !qrMockOwnsSale(attempt.value))
const paymentUrl = computed(() => !attempt.value || !local.value ? null : attempt.value.mode === 'provider_sandbox' ? qrProviderSandboxUrl(attempt.value) : qrMockLocalUrl(attempt.value.local_payment_path, window.location.origin, attempt.value.id))
const code = computed(() => paymentUrl.value ? qrMockCode(paymentUrl.value) : null)
const canHandover = computed(() => attempt.value?.payment_status === 'paid' && attempt.value.receipt_status === 'issued')
let generation = 0, readSequence = 0
const popups = new Set<Window>()
const closePopups = () => { popups.forEach(popup => popup.close()); popups.clear() }
onBeforeUnmount(() => { generation++; readSequence++; closePopups() })
const valid = (version: number) => generation === version && permission.value
const accept = (value: QrMockAttempt) => {
  if (!['mock_only', 'provider_sandbox'].includes(value.mode) || (props.simulator && value.mode !== 'mock_only') || value.simulation !== true || !Number.isSafeInteger(value.id) || !Number.isSafeInteger(value.amount_minor) || value.amount_minor <= 0 || value.currency !== 'UAH' || (props.order && value.order_id !== props.order.id) || (props.attemptId && value.id !== props.attemptId)) throw new Error('Invalid QR mock response')
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error('Invalid QR revision')
  if (attempt.value?.id === value.id && attempt.value.revision > value.revision) return
  attempt.value = value
}
const load = async () => {
  if (!permission.value || !local.value) return
  const version = generation, request = ++readSequence, orderId = props.order?.id, id = props.attemptId
  loading.value = true; readError.value = ''
  const [ready, result, sandbox] = await Promise.allSettled([api.getQrMockReadiness(), id ? api.getQrMockAttempt(id) : api.getOrderQrMockAttempts(orderId!), Promise.resolve().then(() => api.getProviderSandboxReadiness())])
  if (!valid(version) || request !== readSequence) return
  const failures: string[] = []
  readiness.value = ready.status === 'fulfilled' && ready.value.mode === 'mock_only' && Array.isArray(ready.value.cash_registers) ? ready.value : null
  sandboxReadiness.value = sandbox.status === 'fulfilled' && sandbox.value.mode === 'provider_sandbox' && Array.isArray(sandbox.value.blocking_reasons) ? sandbox.value : null
  if (!readiness.value) failures.push('Готовність QR MOCK недоступна. Нові QR заблоковано.')
  try {
    if (result.status !== 'fulfilled') throw result.reason
    if (Array.isArray(result.value)) {
      const values = result.value.filter(item => item.order_id === orderId).sort((a, b) => b.id - a.id)
      if (values[0]) accept(values[0]); else attempt.value = null
    } else accept(result.value)
    stateReadFailed.value = false
  } catch { stateReadFailed.value = true; failures.push('Стан QR не підтверджено. Повторіть читання; нову оплату не створюйте.') }
  readError.value = failures.join(' '); loading.value = false
}
watch(session, () => {
  generation++; readSequence++; closePopups(); attempt.value = null; readiness.value = null; sandboxReadiness.value = null; selectedSource.value = 'mock_only'
  confirmed.value = false; stateReadFailed.value = false; readError.value = ''; printError.value = ''; loading.value = false
  if (import.meta.client) void load()
}, { immediate: true, flush: 'sync' })
watch(() => props.refreshToken, () => { if (import.meta.client) void load() })
watch(selectedSource, () => { confirmed.value = false }, { flush: 'sync' })
watch([() => props.order?.revision, () => register.value?.shift_revision], () => { confirmed.value = false }, { flush: 'sync' })
watch([attempt, () => create.intent.value, loading, stateReadFailed], () => emit('owner', qrMockOwnsSale(attempt.value) || !!create.intent.value || loading.value || stateReadFailed.value), { immediate: true, flush: 'sync' })
const prepare = async () => {
  if (!permission.value || !local.value || busy.value || !props.order || transition.intent.value || readError.value) return
  if (!create.intent.value && (!canCreate.value || !confirmed.value)) return
  const version = generation, orderId = props.order.id
  // An unknown provider create is reconciled by reading; never send another invoice POST.
  if (create.intent.value?.body.mode === 'provider_sandbox' && !create.intent.value.resultId) {
    const priorId = create.intent.value.body.prior_attempt_id ?? 0
    await load()
    if (!valid(version)) return
    if (attempt.value?.mode === 'provider_sandbox' && attempt.value.id > priorId) { create.clear(); confirmed.value = false; emit('changed') }
    else readError.value = 'Створення sandbox QR не підтверджено. Потрібна ручна звірка; повторне створення заблоковано.'
    return
  }
  await create.execute({ expected_revision: props.order.revision!, confirm: true, cash_register_id: 'MOCK-KASA-1', ...(providerSandbox.value ? { mode: 'provider_sandbox' as const, prior_attempt_id: attempt.value?.id ?? 0 } : {}) }, (body, key) => { const { mode, prior_attempt_id, ...command } = body; return mode === 'provider_sandbox' ? api.createOrderSandboxQrAttempt(orderId, command, key) : api.createOrderQrMockAttempt(orderId, command, key) }, async id => {
    if (!valid(version)) return
    const result = await api.getQrMockAttempt(id)
    if (!valid(version)) return
    accept(result); create.clear(); confirmed.value = false; emit('changed')
  })
  if (valid(version) && !create.intent.value && create.error.value) { await load(); if (valid(version)) emit('changed') }
}
const run = async (operation: Transition['operation']) => {
  if (!permission.value || !local.value || busy.value || create.intent.value) return
  const saved = transition.intent.value?.body
  if ((saved?.mode === 'provider_sandbox' || attempt.value?.mode === 'provider_sandbox') && operation !== 'refresh') return
  if (!saved && (!attempt.value?.allowed_actions.includes(operation) || (operation === 'simulate' && (!props.simulator || readiness.value?.available !== true)))) return
  const version = generation
  const body: Transition = saved || { attempt_id: attempt.value!.id, operation, expected_revision: attempt.value!.revision, ...(attempt.value!.mode === 'provider_sandbox' ? { mode: 'provider_sandbox' as const } : {}), ...(operation === 'simulate' ? { event_id: crypto.randomUUID(), outcome: outcome.value } : {}) }
  if (body.operation === 'simulate' && (isBarber.value || !props.simulator || readiness.value?.available !== true)) return
  await transition.execute(body, (payload, key) => { const { attempt_id, operation: action, mode, ...command } = payload; return mode === 'provider_sandbox' ? api.refreshSandboxQrAttempt(attempt_id, command, key) : api.runQrMockAttempt(attempt_id, action, command, key) }, async id => {
    if (!valid(version)) return
    const result = await api.getQrMockAttempt(id)
    if (!valid(version)) return
    accept(result); transition.clear(); emit('changed')
  })
  if (valid(version) && !transition.intent.value && transition.error.value) { await load(); if (valid(version)) emit('changed') }
}
const print = async () => {
  if (!permission.value || attempt.value?.receipt_status !== 'issued') return
  const version = generation, id = attempt.value.id
  const popup = window.open('about:blank', '_blank')
  if (!popup) { printError.value = 'Дозвольте вікно тестового чека.'; return }
  popup.opener = null; popups.add(popup); printError.value = ''
  try {
    const html = await api.getQrMockReceipt(id)
    if (!valid(version)) { popup.close(); return }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    popup.location.replace(url); window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch { popup.close(); if (valid(version)) printError.value = 'Тестовий чек недоступний. Повторіть читання.' }
  finally { popups.delete(popup) }
}
</script>
<template>
  <section :aria-label="providerSandbox ? 'monobank QR SANDBOX' : 'monobank QR MOCK'" class="space-y-4 rounded-[1.75rem] border border-cyan-200 bg-ui-surface p-4 sm:p-6">
    <header class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-xl font-semibold">QR-оплата</h2><span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{{ providerSandbox ? 'Тестове середовище mono + тестова каса Checkbox' : 'Локальний MOCK' }}</span></header>
    <p v-if="providerSandbox" class="text-sm text-ui-secondary">Тестове середовище mono + тестова каса Checkbox. Тестовий токен mono засвідчує оператор; домен платіжного посилання не підтверджує тестовий режим. Реальна оплата не пропонується.</p>
    <p v-else class="text-sm text-ui-secondary">Локальна симуляція: гроші не списуються, до ДПС і провайдерів запити не надсилаються.</p>
    <p v-if="!permission" role="status">Потрібні права на продажі та приймання QR-оплати.</p>
    <p v-else-if="!local" role="status">QR MOCK доступний лише на localhost.</p>
    <template v-else>
      <label v-if="!simulator && !qrMockOwnsSale(attempt) && !unresolved" class="block space-y-2 text-sm font-medium">Середовище QR
        <BaseSelect v-model="selectedSource" native :disabled="busy || loading || !!readError"><option value="mock_only">Локальний MOCK</option><option v-if="sandboxReadiness?.available" value="provider_sandbox">Тестове середовище mono + тестова каса Checkbox</option></BaseSelect>
      </label>
      <p v-if="providerSandbox && !sandboxReadiness?.available" role="status" class="rounded-2xl bg-amber-50 p-4 text-amber-900">Тестове підключення провайдерів недоступне. Нові sandbox QR заблоковано; звірте наявну спробу з адміністратором.</p>
      <p v-if="loading" role="status" class="text-sm text-ui-secondary">Перевіряємо стан оплати…</p>
      <p v-if="!providerSandbox && readiness && !readiness.available" role="status" class="rounded-2xl bg-amber-50 p-4 text-amber-900">QR-оплата зараз недоступна. Попросіть адміністратора перевірити тестовий режим і касу.</p>
      <p v-else-if="register && register.shift_status !== 'open'" role="status" class="rounded-2xl bg-amber-50 p-4 text-amber-900">Для нового QR адміністратор має відкрити MOCK зміну в керуванні касою. Після цього оновіть стан.</p>
      <div v-if="order && !create.intent.value && canCreate" class="space-y-4 rounded-2xl bg-ui-subtle p-4">
        <p class="font-medium">Перевірте товари та суму вище, потім створіть QR.</p>
        <BaseCheckbox v-model="confirmed" :disabled="busy || unresolved || loading" :label="`Погоджую QR для серверної суми замовлення ${order.total_amount} грн`" />
        <BaseButton variant="primary" size="lg" block :disabled="busy || unresolved || loading || !confirmed || !!readError" @click="prepare">{{ providerSandbox ? 'Створити QR (SANDBOX)' : 'Створити QR (MOCK)' }}</BaseButton>
      </div>
      <div v-if="create.intent.value" class="space-y-3 rounded-2xl bg-amber-50 p-4 text-amber-900"><p>Запит уже збережено. {{ create.intent.value.body.mode === 'provider_sandbox' ? 'Потрібна звірка створення. Повторний запит до провайдера не надсилається.' : 'Відновіть його, щоб отримати той самий QR без повторної оплати.' }}</p><BaseButton variant="primary" :disabled="busy || loading || !!readError" @click="prepare">{{ create.intent.value.body.mode === 'provider_sandbox' ? 'Перевірити створення sandbox QR' : 'Відновити той самий QR-запит' }}</BaseButton></div>
      <article v-if="attempt" class="space-y-4" :aria-label="`QR спроба #${attempt.id}`">
        <p class="text-lg font-semibold">Точна серверна сума QR: {{ qrMockMoney(attempt.amount_minor) }} · UAH</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl bg-ui-subtle p-4"><p class="mb-1 text-xs font-semibold uppercase tracking-wide text-ui-secondary">Оплата</p><p role="status" class="font-medium">{{ qrMockPaymentLabel(attempt.payment_status) }}</p></div>
          <div class="rounded-2xl bg-ui-subtle p-4"><p class="mb-1 text-xs font-semibold uppercase tracking-wide text-ui-secondary">Чек</p><p :role="attempt.receipt_status === 'error' ? 'alert' : 'status'" class="font-medium">{{ attempt.mode === 'provider_sandbox' ? qrProviderSandboxReceiptLabel(attempt.receipt_status) : qrMockReceiptLabel(attempt.receipt_status) }}</p></div>
        </div>
        <p v-if="attempt.payment_status === 'paid' && !canHandover" class="rounded-2xl bg-amber-50 p-4 font-semibold text-amber-800">Оплачено, чек ще не видано. Нову оплату не запитуйте. Видача заблокована до відновлення чека. Натисніть «Перевірити статус QR».</p>
        <p v-if="canHandover" class="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-800">{{ attempt.mode === 'provider_sandbox' ? 'Тестова оплата і тестовий чек Checkbox підтверджені.' : 'Оплата і MOCK чек підтверджені.' }} Фізичну видачу підтвердіть окремо{{ simulator ? ' на сторінці замовлення' : ' нижче в блоці «3. Передайте товар»' }}.</p>
        <p v-if="attempt.mode === 'provider_sandbox' && attempt.payment_status === 'unknown'" role="alert" class="rounded-2xl bg-amber-50 p-4 text-amber-900">Результат створення або оплати невідомий. Потрібна звірка тієї самої спроби. Новий рахунок не створюйте.</p>
        <p v-if="attempt.mode === 'provider_sandbox' && attempt.payment_url && !paymentUrl" role="alert" class="text-ui-danger">Платіжне посилання не пройшло перевірку. QR приховано; зверніться до адміністратора.</p>
        <p v-if="qrMockTerminal(attempt.payment_status)" class="text-sm text-ui-secondary">Цей QR завершено. Для нової спроби повторно погодьте суму та створіть новий QR.</p>
        <template v-if="code && !qrMockTerminal(attempt.payment_status) && attempt.payment_status !== 'paid'">
          <div class="mx-auto w-fit max-w-full rounded-2xl border border-ui bg-white p-3"><svg role="img" :aria-label="attempt.mode === 'provider_sandbox' ? 'QR тестового середовища mono' : 'QR локального симулятора'" :viewBox="`0 0 ${code.size} ${code.size}`" class="qr-mock-code h-60 w-60 max-w-full" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white" /><path :d="code.path" fill="black" /></svg></div>
          <p class="text-center text-sm text-ui-secondary">Скриншот клієнта чи завершення таймера не підтверджує оплату. Натисніть «Перевірити статус QR».</p>
          <details v-if="!isBarber && attempt.mode === 'mock_only'" class="rounded-2xl border border-ui p-3 text-sm"><summary class="cursor-pointer font-medium">Як перевірити локальний QR</summary><a :href="paymentUrl!" target="_blank" rel="noopener" class="mt-3 block break-words underline">Відкрити локальний симулятор</a><p class="mt-2 text-ui-secondary">Відкрийте посилання на цьому комп’ютері. На іншому пристрої localhost вказує на сам пристрій.</p></details>
        </template>
        <div class="flex flex-wrap gap-3">
          <BaseButton v-if="attempt.allowed_actions.includes('refresh') && !transition.intent.value" variant="primary" size="lg" :disabled="busy || unresolved" @click="run('refresh')">Перевірити статус QR</BaseButton>
          <BaseButton v-if="attempt.mode === 'mock_only' && attempt.allowed_actions.includes('cancel') && !transition.intent.value" variant="neutral" :disabled="busy || unresolved" @click="run('cancel')">Скасувати очікування QR</BaseButton>
          <BaseButton v-if="attempt.receipt_status === 'issued'" variant="neutral" @click="print">{{ attempt.mode === 'provider_sandbox' ? 'Відкрити тестовий чек Checkbox' : 'Відкрити QR MOCK чек' }}</BaseButton>
        </div>
        <details v-if="isAdmin" class="rounded-2xl border border-ui p-3 text-sm text-ui-secondary"><summary class="cursor-pointer font-medium">Технічні деталі QR</summary><div class="mt-3 space-y-2"><p>Замовлення #{{ attempt.order_id }} · QR #{{ attempt.id }} · до {{ attempt.expires_at }}</p><p class="break-all">{{ attempt.mode === 'provider_sandbox' ? 'Локальний correlation ID' : 'Invoice' }}: {{ attempt.provider_invoice_id }}</p><p v-if="attempt.mode === 'provider_sandbox'" class="break-all">Тестовий чек Checkbox: {{ attempt.checkbox_receipt_id }}</p><ul><li v-for="item in attempt.snapshot.items || []" :key="item.order_item_id">{{ item.name || item.product_id }} · {{ item.quantity }} · {{ qrMockMoney(item.total_minor) }}</li></ul><p v-for="reason in attempt.blocking_reasons" :key="reason">{{ reason }}</p></div></details>
        <div v-if="simulator && attempt.mode === 'mock_only' && !isBarber && attempt.allowed_actions.includes('simulate') && readiness?.available" class="space-y-3 border-t border-ui pt-3">
          <label>Локальний сценарій QR<BaseSelect v-model="outcome" native :disabled="busy || unresolved"><option value="success">Успішна оплата і чек</option><option value="decline">Відмова</option><option value="expiry">Серверне завершення строку</option><option value="processing">Затримана обробка</option><option value="hold">HOLD — без оплати</option><option value="timeout_after_acceptance">Втрачена відповідь після прийняття</option><option value="success_receipt_error">Оплачено, помилка чека</option><option value="success_receipt_pending">Оплачено, чек очікується</option><option value="receipt_issued">Відновити лише чек</option></BaseSelect></label>
          <BaseButton variant="primary" :disabled="busy || unresolved" @click="run('simulate')">Виконати локальний сценарій</BaseButton>
        </div>
      </article>
      <BaseButton v-if="transition.intent.value && (!isBarber || transition.intent.value.body.operation !== 'simulate')" variant="primary" :disabled="busy || (transition.intent.value.body.operation === 'simulate' && !readiness?.available)" @click="run(transition.intent.value.body.operation)">Відновити ту саму QR-команду</BaseButton>
      <p v-if="readError" role="alert" class="text-ui-danger">{{ readError }}</p>
      <p v-for="message in [create.error.value, transition.error.value, printError].filter(Boolean)" :key="message" role="alert" class="text-ui-danger">{{ message }}</p>
      <div class="border-t border-ui pt-3"><BaseButton variant="neutral" :disabled="loading || busy" @click="load">{{ providerSandbox ? 'Оновити QR SANDBOX' : 'Оновити QR MOCK' }}</BaseButton></div>
      <details v-if="isAdmin && sandboxReadiness?.blocking_reasons?.length" class="text-sm text-ui-secondary"><summary class="cursor-pointer">Технічні причини недоступності sandbox</summary><p v-for="reason in sandboxReadiness.blocking_reasons" :key="reason" class="mt-2">{{ qrProviderSandboxBlockingReason(reason) }}</p></details>
      <details v-if="isAdmin && readiness?.blocking_reasons?.length" class="text-sm text-ui-secondary"><summary class="cursor-pointer">Технічні причини недоступності QR</summary><p v-for="reason in readiness.blocking_reasons" :key="reason" class="mt-2">{{ reason }}</p></details>
    </template>
  </section>
</template>

<style scoped>
.qr-mock-code {
  color-scheme: light;
  forced-color-adjust: none;
  color: #000;
  background: #fff;
}
.qr-mock-code > rect { fill: #fff !important; }
.qr-mock-code > path { fill: #000 !important; }
</style>
