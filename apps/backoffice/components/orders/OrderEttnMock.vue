<script setup lang="ts">
import type { EttnMockApproval, EttnMockCommand, EttnMockList, EttnMockOutcome, EttnMockPrepare, EttnMockPreview, EttnMockProject, FiscalMockDocument, OrderResponse } from '~/composables/useBackofficeApi'
import { fiscalMoney } from '~/utils/fiscalMock'
const props = defineProps<{ order: OrderResponse, refreshToken?: number }>()
const emit = defineEmits<{ changed: [], owner: [value: 'sc_manual' | 'checkbox_ettn' | null] }>()
const api = useBackofficeApi(), auth = useAuthStore()
const resource = computed(() => String(props.order.id))
const rejected = ['preview_not_found', 'preview_expired', 'stale_preview', 'fiscal_owner_exists', 'preview_consumed', 'confirmation_required', 'mock_shipment_required', 'automation_owns_payment', 'register_forbidden', 'shift_closed', 'simulation_sale_required', 'simulation_payment_required', 'invalid_order_amounts', 'mock_condition_not_met', 'automation_not_armed', 'origin_permission_revoked', 'mock_lookup_mismatch']
const prepare = useOrderSalesCommand<EttnMockPrepare>('ettn-preview', resource, rejected)
const arm = useOrderSalesCommand<EttnMockApproval>('ettn-arm', resource, rejected)
type Action = 'process' | 'cancel' | 'reconcile' | 'trigger' | 'materialize'
type Intent = EttnMockCommand & { project_id: number, operation: Action }
const transition = useOrderSalesCommand<Intent>('ettn-command', resource, rejected)
const commands = [prepare, arm, transition]
const busy = computed(() => commands.some(item => item.busy.value))
const pendingPreview = computed(() => !!prepare.intent.value && !prepare.intent.value.resultId)
const unresolved = computed(() => pendingPreview.value || !!arm.intent.value || !!transition.intent.value)
const permission = computed(() => auth.user?.is_superuser || auth.user?.can_fiscalize_sales === true)
const state = shallowRef<EttnMockList | null>(null), preview = shallowRef<EttnMockPreview | null>(null)
const linkedDocuments = shallowRef<Record<number, FiscalMockDocument>>({})
const linkedErrors = ref<number[]>([])
const loading = ref(false), readError = ref(''), confirmed = ref(false)
const shipmentId = ref(''), registerId = 'MOCK-KASA-1', condition = 'mock_delivery_confirmed' as const
const outcome = ref<EttnMockOutcome>('accepted')
const cancelOutcome = ref<'confirmed' | 'timeout_before_acceptance' | 'timeout_after_acceptance'>('confirmed')
const shipments = computed(() => (props.order.shipments || []).filter(item => item.simulation && item.active && item.tracking_number))
const safe = (value: { mode: string, provider_contract: string, simulation: boolean, is_sent_dps: boolean } | null) => value?.mode === 'mock_only' && value.provider_contract === 'unknown' && value.simulation === true && value.is_sent_dps === false
const canRetryArm = computed(() => !!arm.intent.value && permission.value && safe(state.value))
const canPrepare = computed(() => permission.value && safe(state.value) && state.value?.available && state.value.allowed_actions.includes('preview') && shipments.value.some(item => item.id === Number(shipmentId.value)))
const previewCurrent = computed(() => safe(preview.value) && preview.value?.order_id === props.order.id && preview.value.revision === props.order.revision && preview.value.cash_register_id === registerId && preview.value.snapshot.shipment_id === Number(shipmentId.value) && preview.value.snapshot.condition === condition && preview.value.snapshot.tracking_number === shipments.value.find(item => item.id === Number(shipmentId.value))?.tracking_number)
const canArm = computed(() => canPrepare.value && previewCurrent.value && preview.value?.allowed_actions.includes('arm') && !preview.value.blocking_reasons.length && Date.parse(preview.value.expires_at) > Date.now())
const identity = computed(() => JSON.stringify([auth.user?.id, props.order.id, props.order.revision, props.order.shipments, shipmentId.value, preview.value?.id, preview.value?.snapshot_hash, preview.value?.shift_revision, state.value?.owner, state.value?.allowed_actions]))
watch(identity, () => { confirmed.value = false }, { flush: 'sync' })
const linkedDocumentMatches = (project: EttnMockProject, document: FiscalMockDocument) => {
  if (project.order_id !== props.order.id || project.status !== 'issued' || !project.allowed_actions.includes('view_document') || !safe(project)
    || document.id !== project.fiscal_document_id || document.order_id !== project.order_id || document.status !== 'issued'
    || document.kind === 'return' || document.source !== 'automation' || document.automation_id !== project.id
    || document.simulation !== true || document.is_sent_dps !== false || document.document_kind !== 'mock_fiscal_receipt'
    || document.provider_uuid !== project.provider_uuid || document.cash_register_id !== project.cash_register_id
    || document.shift_revision !== project.shift_revision || document.snapshot.kind === 'return') return false
  const snapshot = document.snapshot, origin = snapshot.automation
  return snapshot.source === 'mock_ettn' && snapshot.amount_minor === project.snapshot.amount_minor
    && origin?.id === project.id && origin.provider_uuid === project.provider_uuid
    && origin.approval_snapshot_hash === project.snapshot_hash && origin.external_id === project.external_id
    && origin.shipment_id === project.shipment_id && origin.tracking_number === project.tracking_number && origin.condition === project.condition
}
let context = 0, reads = 0, previewReads = 0
onBeforeUnmount(() => { context++; reads++; previewReads++ })
const hydratePreview = async (id: number, version: number, order: number) => {
  const request = ++previewReads
  const result = await api.getEttnMockPreview(order, id)
  if (version === context && request === previewReads && result.order_id === order && safe(result)) preview.value = result
}
const load = async () => {
  const version = context, request = ++reads, order = props.order.id
  loading.value = true; readError.value = ''; confirmed.value = false
  try {
    const result = await api.getEttnMockProjects(order)
    if (version !== context || request !== reads) return
    if (!safe(result) || !Array.isArray(result.items) || !Array.isArray(result.allowed_actions)) throw new Error('Unsafe response')
    state.value = result; linkedDocuments.value = {}; linkedErrors.value = []; emit('owner', result.owner)
    const projects = result.items.filter(item => item.status === 'issued' && item.fiscal_document_id && item.allowed_actions.includes('view_document'))
    const documents = await Promise.allSettled(projects.map(item => api.getFiscalMockDocument(item.fiscal_document_id!)))
    if (version !== context || request !== reads) return
    const verified: Record<number, FiscalMockDocument> = {}, errors: number[] = []
    documents.forEach((item, index) => {
      const project = projects[index]!
      if (item.status === 'fulfilled' && linkedDocumentMatches(project, item.value)) verified[project.id] = item.value
      else errors.push(project.id)
    })
    linkedDocuments.value = verified; linkedErrors.value = errors
    if (prepare.intent.value?.resultId) await hydratePreview(prepare.intent.value.resultId, version, order)
  }
  catch { if (version === context && request === reads) { state.value = null; preview.value = null; linkedDocuments.value = {}; linkedErrors.value = []; readError.value = 'Не вдалося прочитати ЕТТН MOCK. Нові операції заблоковано; повторіть читання.' } }
  finally { if (version === context && request === reads) loading.value = false }
}
watch([() => props.order.id, () => auth.user?.id, permission], () => {
  context++; reads++; previewReads++; state.value = null; preview.value = null; linkedDocuments.value = {}; linkedErrors.value = []; confirmed.value = false; shipmentId.value = shipments.value[0] ? String(shipments.value[0].id) : ''; emit('owner', null)
  if (import.meta.client && permission.value) void load()
}, { immediate: true, flush: 'sync' })
watch(shipments, value => { if (!value.some(item => item.id === Number(shipmentId.value))) shipmentId.value = value[0] ? String(value[0].id) : '' }, { immediate: true })
watch(() => props.refreshToken, () => { confirmed.value = false; if (import.meta.client && permission.value) void load() })
const after = async (version: number) => { if (version === context) { confirmed.value = false; await load(); if (version === context) emit('changed') } }
const createPreview = async () => {
  if (!permission.value || busy.value || (unresolved.value && !pendingPreview.value) || (!pendingPreview.value && !canPrepare.value)) return
  const version = context, order = props.order.id
  if (prepare.intent.value?.resultId) { prepare.clear(); preview.value = null }
  confirmed.value = false
  await prepare.execute({ shipment_id: Number(shipmentId.value), cash_register_id: registerId, condition }, (body, key) => api.createEttnMockPreview(order, body, key), async id => { triggerRef(prepare.intent); await hydratePreview(id, version, order) })
  if (version === context && !prepare.intent.value && prepare.error.value) await load()
}
const approve = async () => {
  if (!permission.value || (arm.intent.value && !canRetryArm.value) || busy.value || (unresolved.value && !arm.intent.value)) return
  if (!arm.intent.value && (!confirmed.value || !canArm.value || !preview.value || Date.parse(preview.value.expires_at) <= Date.now())) { confirmed.value = false; return }
  const version = context, order = props.order.id
  const body = arm.intent.value?.body || { preview_id: preview.value!.id, expected_revision: preview.value!.revision, snapshot_hash: preview.value!.snapshot_hash, cash_register_id: preview.value!.cash_register_id, confirm: true as const, mock_outcome: outcome.value }
  confirmed.value = false
  await arm.execute(body, (payload, key) => api.armEttnMock(order, payload, key), async () => { if (version !== context) return; arm.clear(); await after(version) })
  if (version === context && !arm.intent.value && arm.error.value) await load()
}
const run = async (operation: Action, project?: EttnMockProject) => {
  if (!permission.value || busy.value || (unresolved.value && !transition.intent.value)) return
  if (!transition.intent.value && (!project || !safe(project) || !project.allowed_actions.includes(operation))) return
  const version = context
  const body: Intent = transition.intent.value?.body || { project_id: project!.id, operation, expected_revision: project!.revision, ...(operation === 'cancel' ? { mock_outcome: cancelOutcome.value } : {}) }
  await transition.execute(body, (payload, key) => { const { project_id, operation: action, ...command } = payload; return api.runEttnMockProject(project_id, action, command, key) }, async () => { if (version !== context) return; transition.clear(); await after(version) })
  if (version === context && !transition.intent.value && transition.error.value) await load()
}
const labels: Record<EttnMockProject['status'], string> = {
  queued: 'MOCK у черзі — проект ще не активовано', unknown: 'MOCK результат невідомий — потрібна звірка', armed: 'MOCK активовано — очікує синтетичної умови',
  cancel_pending: 'MOCK відміну запитано — ще не підтверджено', cancel_unknown: 'MOCK відміна невідома — ручний обхід заборонено',
  cancelled: 'MOCK відміну підтверджено', issued: 'MOCK умова виконана — локальний результат ЕТТН', error: 'MOCK помилка — перевірте блокування',
}
</script>
<template>
  <section aria-label="Checkbox ЕТТН MOCK" class="space-y-4 rounded-[1.75rem] border border-amber-300 bg-white p-6">
    <h2 class="text-xl font-semibold">Checkbox ЕТТН — лише локальна MOCK автоматизація</h2>
    <p>API провайдера не перевірено (unknown). Жодного зовнішнього проекту чи чека ДПС тут не створюється. У реальній інтеграції створення проекту після погодження дозволяє майбутню автоматичну фіскалізацію при виконанні умови.</p>
    <p>Ця локальна симуляція не змінює оплату, відправлення, залишки або повідомлення. Результат ЕТТН і пов’язаний MOCK чек — окремі локальні записи. До ДПС нічого не надсилається.</p>
    <p v-if="!permission">Немає права на фіскалізацію продажів.</p>
    <template v-else>
      <BaseButton variant="neutral" :disabled="loading || busy" @click="load">Оновити ЕТТН MOCK</BaseButton>
      <p role="status">Поточний власник фіскалізації: {{ !state ? 'невідомий — потрібне читання сервера' : state.owner === 'checkbox_ettn' ? 'Checkbox ЕТТН MOCK' : state.owner === 'sc_manual' ? 'ручний worker SC' : 'ще не обраний' }}.</p>
      <p v-if="state?.owner === 'checkbox_ettn'">Ручна продажа заблокована сервером. Невідомий результат чи запит відміни не звільняє власника.</p>
      <p v-for="reason in state?.blocking_reasons || []" :key="reason">{{ reason }}</p>
      <template v-if="safe(state) && state?.available && state.allowed_actions.includes('preview')">
        <label>ТТН локальної MOCK відправки<BaseSelect v-model="shipmentId" native :disabled="busy || unresolved"><option v-for="item in shipments" :key="item.id" :value="String(item.id)">{{ item.tracking_number }} · #{{ item.id }}</option></BaseSelect></label>
        <p v-if="!shipments.length">Немає активної MOCK ТТН. Підготовка автоматизації недоступна.</p>
        <BaseButton :disabled="busy || (unresolved && !pendingPreview) || (!pendingPreview && !canPrepare)" @click="createPreview">{{ pendingPreview ? 'Повторити той самий ЕТТН MOCK preview' : 'Підготувати ЕТТН MOCK snapshot' }}</BaseButton>
      </template>
      <article v-if="preview" aria-label="ЕТТН MOCK preview" class="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h3 class="font-semibold">ЕТТН MOCK snapshot #{{ preview.id }} — незмінний локальний знімок</h3>
        <p>ТТН: {{ preview.snapshot.tracking_number }} · точна сума: {{ fiscalMoney(preview.snapshot.amount_minor) }} · каса: {{ preview.cash_register_id }} · зміна: {{ preview.shift_revision }}</p>
        <p>Умова: {{ preview.snapshot.condition }} — явна синтетична команда MOCK; потрібна локальна відправка у стані delivered; реальний tracking не запускає її.</p>
        <p class="break-all">Hash snapshot: {{ preview.snapshot_hash }} · revision {{ preview.revision }} · дійсний до {{ preview.expires_at }}</p>
        <details><summary>Повний незмінний ЕТТН MOCK snapshot</summary><pre class="overflow-auto whitespace-pre-wrap">{{ JSON.stringify(preview.snapshot, null, 2) }}</pre></details>
        <p v-for="reason in preview.blocking_reasons" :key="reason">{{ reason }}</p>
        <p v-if="!previewCurrent">Snapshot застарів або відрізняється від поточного замовлення / ТТН. Потрібне нове погодження.</p>
        <template v-if="!arm.intent.value">
          <label>Сценарій погодження ЕТТН MOCK<BaseSelect v-model="outcome" native :disabled="busy || unresolved"><option value="accepted">MOCK прийнято</option><option value="timeout_before_acceptance">MOCK timeout до прийняття</option><option value="timeout_after_acceptance">MOCK timeout після прийняття</option></BaseSelect></label>
          <BaseCheckbox v-model="confirmed" label-class="base-checkbox__label block text-sm [overflow-wrap:anywhere]" input-class="base-checkbox mr-2 align-middle" :disabled="busy || unresolved || !canArm" :label="`Погоджую ТТН ${preview.snapshot.tracking_number}, суму ${fiscalMoney(preview.snapshot.amount_minor)}, касу ${preview.cash_register_id}, умову ${preview.snapshot.condition}, hash ${preview.snapshot_hash}; дозволяю майбутню автоматичну MOCK симуляцію`" />
          <BaseButton :disabled="busy || unresolved || !confirmed || !canArm" @click="approve">Погодити саме цю ЕТТН MOCK автоматизацію</BaseButton>
        </template>
      </article>
      <BaseButton v-if="arm.intent.value" :disabled="busy || !canRetryArm" @click="approve">Повторити те саме погодження ЕТТН MOCK</BaseButton>
      <BaseButton v-if="transition.intent.value" :disabled="busy" @click="run(transition.intent.value.body.operation)">Повторити ту саму команду ЕТТН MOCK #{{ transition.intent.value.body.project_id }}</BaseButton>
      <label v-if="state?.items.some(item => item.allowed_actions.includes('cancel'))">Сценарій відміни ЕТТН MOCK<BaseSelect v-model="cancelOutcome" native :disabled="busy || unresolved"><option value="confirmed">MOCK підтверджено</option><option value="timeout_before_acceptance">MOCK timeout до прийняття</option><option value="timeout_after_acceptance">MOCK timeout після прийняття</option></BaseSelect></label>
      <article v-for="project in state?.items || []" :key="project.id" :aria-label="`ЕТТН MOCK проект #${project.id}`" class="space-y-3 border-t pt-4">
        <h3 class="font-semibold">ЕТТН MOCK проект #{{ project.id }}</h3>
        <p :class="['unknown','cancel_pending','cancel_unknown'].includes(project.status) ? 'rounded-xl bg-amber-100 p-3' : ''">{{ labels[project.status] }}</p>
        <p>ТТН {{ project.tracking_number }} · {{ fiscalMoney(project.snapshot.amount_minor) }} · {{ project.cash_register_id }} · {{ project.condition }}</p>
        <p class="break-all">MOCK external ID: {{ project.external_id || 'ще не підтверджений' }} · UUID: {{ project.provider_uuid }} · hash: {{ project.snapshot_hash }}</p>
        <p v-if="project.cancellation_confirmed_at">Підтвердження відміни: {{ project.cancellation_confirmed_at }}</p>
        <p v-for="reason in project.blocking_reasons" :key="reason">{{ reason }}</p>
        <p v-if="project.status === 'issued' && !linkedDocuments[project.id]">Пов’язаний MOCK чек ще не підтверджено. Друк, повернення та звіти доступні лише для перевіреного канонічного документа.</p>
        <p v-if="linkedErrors.includes(project.id)" role="alert">Не вдалося підтвердити зв’язок MOCK чека з цим ЕТТН проектом. Повторіть читання; ручний обхід заборонено.</p>
        <p v-if="linkedDocuments[project.id]">Перевірений канонічний MOCK чек #{{ linkedDocuments[project.id]!.id }}. Друк, локальне посилання, повернення та X/Z використовують цей самий документ; нового подання немає.</p>
        <a v-if="linkedDocuments[project.id]" :href="`#mock-fiscal-document-${linkedDocuments[project.id]!.id}`" class="underline">Перейти до пов’язаного MOCK чека #{{ linkedDocuments[project.id]!.id }}</a>
        <div class="flex flex-wrap gap-3">
          <BaseButton v-if="safe(project) && project.allowed_actions.includes('materialize')" :disabled="busy || unresolved" @click="run('materialize', project)">Відновити канонічний MOCK чек без нового подання</BaseButton>
          <BaseButton v-if="safe(project) && project.allowed_actions.includes('process')" :disabled="busy || unresolved" @click="run('process', project)">Обробити погоджений ЕТТН MOCK</BaseButton>
          <BaseButton v-if="safe(project) && project.allowed_actions.includes('reconcile')" :disabled="busy || unresolved" @click="run('reconcile', project)">Звірити той самий ЕТТН MOCK</BaseButton>
          <BaseButton v-if="safe(project) && project.allowed_actions.includes('cancel')" :disabled="busy || unresolved" @click="run('cancel', project)">Запросити відміну ЕТТН MOCK</BaseButton>
          <BaseButton v-if="safe(project) && project.allowed_actions.includes('trigger')" :disabled="busy || unresolved" @click="run('trigger', project)">Виконати синтетичну умову ЕТТН MOCK</BaseButton>
        </div>
        <details v-if="project.result"><summary>Первинний незмінний результат ЕТТН MOCK</summary><p>Це первинний результат симуляції умови, окремий від пов’язаного MOCK чека. Його історичні поля не змінюються при відновленні документа.</p><pre class="overflow-auto whitespace-pre-wrap">{{ JSON.stringify(project.result, null, 2) }}</pre></details>
      </article>
      <p v-if="readError" role="status">{{ readError }}</p>
      <p v-for="command in commands.filter(item => item.error.value)" :key="command.error.value" role="alert">{{ command.error.value }}</p>
    </template>
  </section>
</template>
