export const shopNPPrefix = '/backoffice/shop-np-returns'
export type ShopNPMode = 'paid' | 'unpaid_cod'
export type ShopNPOperation = 'refresh' | 'receive' | 'close_unpaid' | 'financial_claim'
export type ShopNPDisposition = 'restock' | 'not_restock'
export interface ShopNPLine { order_item_id: number, product_id: number, name: string | null, quantity: number, total_minor?: number }
export interface ShopNPReceiptLine { order_item_id: number, quantity: number, disposition: ShopNPDisposition }
export interface ShopNPReadiness { enabled: boolean, available: boolean, profile_id: string | null, profile_hash: string | null, authority: 'none' | 'test' | 'provider', transport: 'unavailable' | 'mock_http' | 'https', manual_link_allowed: boolean, blocking_reasons: string[] }
export interface ShopNPManualLink { source: string, document_id: string, line_id: string, order_id: number, original_shipment_id: number, original_ttn: string, return_ttn: string, verified: true }
export interface ShopNPProof { verified: boolean, profile_id: string, authority: 'test' | 'provider', transport: 'mock_http' | 'https', original_ttn: string, return_ttn: string, linkage_kind: 'easy_return' | 'manual_document', linkage_verified: boolean, linkage_authority: 'test' | 'provider' | 'manual', original: { number: string, raw_status: string, status: string, event_at: string | null }, reverse: { number: string, raw_status: string, status: string, event_at: string | null }, observed_at: string, proof_hash: string }
export interface ShopNPReceipt { id: number, case_id: number, observation_id: number, lines: ShopNPReceiptLine[], evidence: string, snapshot_hash: string, operator_id: number, created_at: string, contents_verified: true }
export interface ShopNPCase {
  id: number, order_id: number, revision: number, order_revision: number, profile_id: string, profile_hash: string,
  authority: 'test' | 'provider', transport: 'mock_http' | 'https', test_context: boolean,
  original_shipment_id: number, original_ttn: string, return_ttn: string, financial_mode: ShopNPMode,
  linkage_kind: 'easy_return' | 'manual_document', linkage_authority: 'test' | 'provider' | 'manual', manual_link: ShopNPManualLink | null,
  sale_document_id: number | null, status: 'awaiting_return' | 'arrived' | 'received' | 'financial_claimed' | 'closed_paid' | 'closed_unpaid', lines: ShopNPLine[],
  observation: null | { id: number, proof_hash: string, proof: ShopNPProof, created_at: string }, receipt: ShopNPReceipt | null,
  closure: null | { id: number, case_id: number, order_id: number, receipt_id: number, evidence: string, snapshot_hash: string, operator_id: number, created_at: string },
  financial_return_id: number | null, financial_document_id: number | null, financial_remaining_lines: ShopNPLine[], actions: Record<string, boolean>, blocking_reasons: string[]
}
export interface ShopNPState { order_id: number, revision: number, enabled: boolean, readiness: ShopNPReadiness, original_shipment_id: number | null, original_ttn: string | null, financial_mode: ShopNPMode | null, eligible_lines: ShopNPLine[], cases: ShopNPCase[], actions: Record<string, boolean>, blocking_reasons: string[] }
export interface ShopNPCommand { expected_revision: number, expected_profile_id: string, expected_profile_hash: string }
export interface ShopNPAttach extends ShopNPCommand { original_shipment_id: number, return_ttn: string, linkage_kind: 'easy_return' | 'manual_document', manual_link: ShopNPManualLink | null, lines: Array<{ order_item_id: number, quantity: number }>, reason: string }
export interface ShopNPCaseCommand extends ShopNPCommand { case_id: number, lines?: ShopNPReceiptLine[], contents_verified?: true, evidence?: string, confirm?: true, reason?: string }
export const shopNPPaths: Record<ShopNPOperation, string> = { refresh: 'refresh', receive: 'physical-receipt', close_unpaid: 'close-unpaid', financial_claim: 'financial-claim' }
export const shopNPTTNValid = (value: string) => /^\d{14}$/.test(value)
export const shopNPDocumentIdValid = (value: string) => /^[A-Za-z0-9_.:/-]{1,100}$/.test(value)
const positive = (value: number) => Number.isSafeInteger(value) && value > 0
export const shopNPProfileMatches = (command: ShopNPCommand, profile: { profile_id: string | null, profile_hash: string | null }) => command.expected_profile_id === profile.profile_id && command.expected_profile_hash === profile.profile_hash
export const shopNPAuthorityValid = (value: { authority: string, transport: string }) => (value.authority === 'test' && value.transport === 'mock_http') || (value.authority === 'provider' && value.transport === 'https') || (value.authority === 'none' && value.transport === 'unavailable')
export const shopNPCaseMatches = (value: ShopNPCase, orderId: number, id = value?.id) => !!value && positive(value.id) && value.id === id && value.order_id === orderId && positive(value.revision) && positive(value.original_shipment_id) && shopNPTTNValid(value.original_ttn) && shopNPTTNValid(value.return_ttn)
  && typeof value.test_context === 'boolean' && ['paid', 'unpaid_cod'].includes(value.financial_mode) && ['easy_return', 'manual_document'].includes(value.linkage_kind) && ['test', 'provider', 'manual'].includes(value.linkage_authority)
  && ['awaiting_return', 'arrived', 'received', 'financial_claimed', 'closed_paid', 'closed_unpaid'].includes(value.status) && shopNPAuthorityValid(value) && !!value.profile_id && /^[0-9a-f]{64}$/.test(value.profile_hash)
  && Array.isArray(value.lines) && value.lines.every(line => positive(line.order_item_id) && positive(line.quantity)) && Array.isArray(value.financial_remaining_lines) && !!value.actions && Array.isArray(value.blocking_reasons)
  && (!value.receipt || value.receipt.case_id === value.id && positive(value.receipt.id) && value.receipt.contents_verified === true && Array.isArray(value.receipt.lines))
export const shopNPStateMatches = (value: ShopNPState, orderId: number) => !!value && value.order_id === orderId && positive(value.revision) && !!value.readiness && shopNPAuthorityValid(value.readiness) && !!value.actions && Array.isArray(value.blocking_reasons) && Array.isArray(value.eligible_lines) && Array.isArray(value.cases) && value.cases.every(item => shopNPCaseMatches(item, orderId))
const statusLabels: Record<string, string> = { awaiting_return: 'Прибуття зворотної посилки ще не підтверджено', arrived: 'НП підтвердила прибуття; вміст і склад перевіряються окремо', received: 'Вміст перевірено; фізичне приймання зафіксовано окремо', financial_claimed: 'Фінансовий запит створено; гроші та чек перевіряються окремо', closed_paid: 'Оплачений випадок повернення завершено', closed_unpaid: 'Неоплачену COD-відмову закрито без фінансових фактів' }
export const shopNPStatus = (value: string) => statusLabels[value] || 'Результат не підтверджено'
const observationLabels: Record<string, string> = { preparing: 'Дані відправлення підготовлено; фактичну передачу не підтверджено', in_transit: 'У дорозі за спостереженням НП', ready_for_pickup: 'НП повідомляє про готовність до видачі', delivered: 'Доставлено за спостереженням НП', refused: 'Відмова за спостереженням НП', returning: 'Зворотне перевезення за спостереженням НП', cancelled: 'Перевезення скасовано за даними НП', handed_over: 'Передача за спостереженням НП', requires_review: 'Дані НП потребують окремої звірки' }
export const shopNPObservationStatus = (value: string) => observationLabels[value] || 'Остаточний стан не підтверджено'
const reasons: Record<string, string> = {
  shop_np_returns_disabled: 'Нові повернення НП вимкнено. Точні збережені запити та наявні факти залишаються для звірки.',
  np_return_unavailable: 'Перевірку НП не налаштовано або вона тимчасово недоступна.', np_return_test_unsafe: 'Ізольоване тестове середовище не підтверджено.',
  np_return_unconfigured: 'Профіль перевірки НП не налаштовано. Зверніться до відповідального за налаштування.',
  np_return_profile_mismatch: 'Дані НП не відповідають збереженому профілю. Запит не переноситься до іншого профілю.',
  np_return_manual_link_disabled: 'Для цього профілю ручний документ зв’язку ТТН не дозволено.',
  np_return_linkage_mismatch: 'Зворотна ТТН не пов’язана з вихідною ТТН цього замовлення. Перевірте та виправте номер; ручний документ не перекриває суперечливих даних НП.',
  np_return_profile_conflict: 'Поточний профіль НП не відповідає збереженому випадку. Запит не переноситься в інший профіль.',
  np_return_case_exists: 'Окремий випадок уже існує. Повторну посилку тут не створюємо.', np_return_shipment_required: 'Потрібне одне канонічне вихідне відправлення НП.', np_return_shipment_mismatch: 'ТТН або відправлення не відповідають цьому замовленню.',
  np_return_history_conflict: 'Історичні факти потребують окремої звірки; автоматичне перенесення заборонено.', np_return_sale_required: 'Для оплаченого повернення потрібен підтверджений чек вихідного продажу.',
  np_return_unpaid_facts_conflict: 'Виявлено фінансові факти. Закрити випадок як неоплачену відмову не можна.', np_return_unpaid_full_required: 'Неоплачений COD-відмова має охоплювати всю відправлену кількість.',
  np_return_refusal_required: 'Потрібна окремо підтверджена відмова за вихідною ТТН.', np_return_manual_link_invalid: 'Документ не підтверджує дозволений зв’язок ТТН. Ручний документ не може перекрити суперечливі дані НП.',
  np_return_proof_invalid: 'Зв’язок або спостереження НП не пройшли серверну перевірку.', np_return_tracking_stale: 'Спостереження НП застаріло. Виконайте дозволену перевірку.', np_return_delivery_required: 'Спочатку потрібне підтверджене прибуття поверненої посилки.',
  np_return_receipt_exists: 'Приймання вже зафіксовано; повторного оприбуткування немає.', np_return_receipt_required: 'Спочатку окремо перевірте вміст і зафіксуйте фізичне приймання.', np_return_quantity_mismatch: 'Кількості мають точно відповідати обраній зворотній посилці.',
  np_return_claim_exists: 'Фінансовий запит за цим прийманням уже створено.', np_return_unpaid_required: 'Це закриття доступне лише для неоплаченої COD-відмови.', np_return_closed: 'Випадок уже завершено.',
  checkbox_profile_conflict: 'Збережені фінансові факти належать іншому профілю Checkbox.', checkbox_register_busy: 'Каса має незавершену операцію. Спочатку перевірте її результат.', checkbox_shift_closed: 'Спочатку відкрийте дозволену фіскальну зміну.',
  checkbox_cash_rounding_unsupported: 'Точне повернення готівки для цих кількостей не підтримує правило округлення. Оберіть іншу сукупну кількість або виконайте окрему фінансову звірку.',
  unsupported_zero_total: 'Оберіть додатну сукупну суму повернення. Нульові позиції мають входити до останнього додатного запиту.',
}
export const shopNPReason = (code: string) => reasons[code] || 'Сервер заблокував дію. Оновіть стан та перевірте підставу повернення.'
export const shopNPRejected = ['checkbox_cash_rounding_unsupported', 'np_return_unconfigured', 'np_return_profile_mismatch', 'np_return_manual_link_disabled', 'np_return_linkage_mismatch', 'shop_np_returns_disabled', 'np_return_unavailable', 'np_return_test_unsafe', 'np_return_profile_conflict', 'np_return_case_exists', 'np_return_shipment_required', 'np_return_shipment_mismatch', 'np_return_history_conflict', 'np_return_sale_required', 'np_return_unpaid_facts_conflict', 'np_return_unpaid_full_required', 'np_return_refusal_required', 'np_return_manual_link_invalid', 'np_return_proof_invalid', 'np_return_tracking_stale', 'np_return_delivery_required', 'np_return_receipt_exists', 'np_return_receipt_required', 'np_return_quantity_mismatch', 'np_return_claim_exists', 'np_return_unpaid_required', 'np_return_closed', 'unsupported_zero_total', 'checkbox_profile_conflict', 'checkbox_register_busy', 'checkbox_shift_closed'] as const
export const useShopNPRead = (context: () => string, read: () => Promise<ShopNPState>, orderId: () => number, available: () => boolean) => {
  const state = shallowRef<ShopNPState | null>(null), loading = ref(false), error = ref('')
  let generation = 0, sequence = 0, active = true, identity: string | null = null
  const version = () => generation, current = (value: number) => active && value === generation
  const load = async () => {
    if (!available()) return false
    const started = generation, request = ++sequence; let finished = started
    loading.value = true; error.value = ''
    try { const value = await read(); if (!current(started) || request !== sequence) return false; if (!shopNPStateMatches(value, orderId())) throw new Error('Invalid NP state'); const next = JSON.stringify([value.readiness.profile_id, value.readiness.profile_hash]); if (identity !== null && next !== identity) { generation++; finished = generation }; identity = next; state.value = value; return true }
    catch { if (current(started) && request === sequence) { state.value = null; error.value = 'Не вдалося перевірити повернення НП та поточні дозволи. Точні запити збережено; дії заблоковано.' } return false }
    finally { if (current(finished) && request === sequence) loading.value = false }
  }
  watch(context, () => { generation++; sequence++; identity = null; state.value = null; loading.value = false; error.value = ''; if (import.meta.client && available()) void load() }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { active = false; generation++; sequence++ })
  return { state, loading, error, load, version, current }
}

// Translate only known server refusals, retaining their status and code for exact-intent policy.
export const shopNPFailure = (cause: unknown): never => {
  const failure = cause as { status?: number, statusCode?: number, response?: { status?: number }, data?: { detail?: { code?: string } } }
  const code = failure?.data?.detail?.code
  if (code && Object.hasOwn(reasons, code)) throw { status: failure.response?.status ?? failure.statusCode ?? failure.status, data: { detail: { code, message: shopNPReason(code) } } }
  throw cause
}
