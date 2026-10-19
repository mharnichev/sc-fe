import type { SalesIntent } from '~/utils/orderSales'

export type ShopPaymentOperation = 'invoice_intent' | 'verify' | 'manual_cod'
export type ShopPaymentMode = 'prepayment' | 'cod'
export interface ShopPaymentReadiness {
  enabled: boolean
  provider_available: boolean
  profile_id: string | null
  profile_hash: string | null
  manual_policy: null | { id: string, issuer: string, account: string, types: Array<'bank_statement' | 'carrier_settlement'>, environment: 'test' | 'production' }
  manual_policy_hash: string | null
  replay_actions: Record<string, boolean>
  authority: 'none' | 'test' | 'provider'
  transport: 'unavailable' | 'mock_http' | 'https'
  blocking_reasons: string[]
}
export interface ShopPaymentState {
  enabled: boolean
  test_context: boolean
  profile_id: string | null
  profile_hash: string | null
  authority: 'none' | 'manual' | 'test' | 'provider'
  order_id: number
  revision: number
  mode: ShopPaymentMode
  intent: null | { id: string, reference: string, amount_minor: number, currency: 'UAH', invoice_id: string | null, effective_invoice_id?: string | null, correction_id?: number | null, status: 'awaiting_invoice' | 'awaiting_verification' | 'accepted' }
  payment: null | { id: number, method: string, source: string, amount_minor: number, currency: string, external_reference: string, authority: string, created_at: string }
  evidence: null | { id: number, kind: ShopPaymentMode, authority: string, test_context: boolean, operator_id: number, created_at: string, proof_hash: string, proof: Record<string, unknown> }
  actions: Record<string, boolean>
  blocking_reasons: string[]
  readiness: ShopPaymentReadiness
  verification_status: string | null
}
export interface ShopCODFields {
  type: 'bank_statement' | 'carrier_settlement'
  source: string
  issuer: string
  account: string
  document_id: string
  line_id: string
  gross: string
  fee: string
  net: string
  settled: string
  tracking_number: string
  verified: boolean
}
export interface ShopCODEvidence {
  type: 'bank_statement' | 'carrier_settlement'
  source: string
  issuer: string
  account: string
  document_id: string
  line_id: string
  gross_amount_minor: number
  fee_minor: number
  net_amount_minor: number
  currency: 'UAH'
  settled_at: string
  tracking_number: string
  verified: true
}
export interface ShopPaymentBody { expected_revision: number, expected_profile_id: string, expected_profile_hash: string, invoice_id?: string, evidence?: ShopCODEvidence }
export interface ShopPaymentSaved { profile_id: string | null, mode: ShopPaymentMode, command: ShopPaymentBody }
export const shopPaymentPaths: Record<ShopPaymentOperation, string> = { invoice_intent: 'invoice-intent', verify: 'verify', manual_cod: 'manual-cod' }
export const shopInvoiceIdValid = (value: string) => /^[A-Za-z0-9_-]{1,100}$/.test(value)
// Decimal input is converted exactly; fees and net may be zero.
export const shopSettlementMinor = (value: string): number | null => {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  const minor = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}
export const shopCODEvidence = (fields: ShopCODFields): ShopCODEvidence | null => {
  const gross = shopSettlementMinor(fields.gross), fee = shopSettlementMinor(fields.fee), net = shopSettlementMinor(fields.net)
  if (gross === null || gross <= 0 || fee === null || net === null || gross !== fee + net || !fields.verified || !/^\d{14}$/.test(fields.tracking_number)) return null
  if (!['bank_statement', 'carrier_settlement'].includes(fields.type) || [fields.source, fields.issuer, fields.account, fields.document_id, fields.line_id].some(value => !value.trim() || value.trim().length > 100)) return null
  const date = new Date(fields.settled)
  if (!fields.settled || !Number.isFinite(date.getTime())) return null
  return { type: fields.type, source: fields.source.trim(), issuer: fields.issuer.trim(), account: fields.account.trim(), document_id: fields.document_id.trim(), line_id: fields.line_id.trim(), gross_amount_minor: gross, fee_minor: fee, net_amount_minor: net, currency: 'UAH', settled_at: date.toISOString(), tracking_number: fields.tracking_number, verified: true }
}
export const shopPaymentStateMatches = (value: ShopPaymentState, orderId: number) => !!value && typeof value.test_context === 'boolean' && value.order_id === orderId && Number.isSafeInteger(value.revision) && value.revision > 0
  && ['prepayment', 'cod'].includes(value.mode) && ['none', 'manual', 'test', 'provider'].includes(value.authority)
  && (value.profile_id === null || typeof value.profile_id === 'string') && (value.profile_hash === null || /^[0-9a-f]{64}$/.test(value.profile_hash)) && !!value.actions && Array.isArray(value.blocking_reasons)
  && !!value.readiness && !!value.readiness.replay_actions && ['unavailable', 'mock_http', 'https'].includes(value.readiness.transport)
  && ['none', 'test', 'provider'].includes(value.readiness.authority)
  && (value.readiness.authority === 'test' ? value.readiness.transport === 'mock_http' : value.readiness.authority === 'provider' ? value.readiness.transport === 'https' : value.readiness.transport === 'unavailable')
export const shopPaymentIntentMatches = (saved: SalesIntent<ShopPaymentSaved>, state: ShopPaymentState) => saved.body?.profile_id === state.profile_id && saved.body?.mode === state.mode && !!saved.body.command && Number.isSafeInteger(saved.body.command.expected_revision) && saved.body.command.expected_profile_id === state.profile_id && saved.body.command.expected_profile_hash === state.profile_hash
export const shopPaymentMoney = (value: number) => `${(value / 100).toFixed(2)} грн`
const reasons: Record<string, string> = {
  shop_payments_disabled: 'Нові платіжні дії вимкнено. Збережений невідомий результат не скасовано.',
  shop_operations_disabled: 'Операції магазину вимкнено.',
  monobank_unavailable: 'Серверна перевірка Monobank не налаштована.',
  monobank_test_unsafe: 'Ізольоване тестове середовище не підтверджено.',
  manual_cod_policy_unavailable: 'Не налаштовано дозволені джерело та рахунок для звірки післяплати.',
  manual_cod_profile_mismatch: 'Доказ або збережений запит не відповідає налаштованому джерелу та рахунку післяплати.',
  manual_cod_test_unsafe: 'Безпечне середовище перевірки післяплати не підтверджено.',
  payment_profile_conflict: 'Поточний платіжний профіль не відповідає збереженому запиту. Запит не переноситься до іншого профілю.',
  monobank_profile_mismatch: 'Платіжний intent належить іншому серверному профілю. Нову перевірку заблоковано.',
  monobank_proof_invalid: 'Банківський доказ не відповідає сумі, валюті або серверному reference. Оплату не підтверджено.',
  invoice_binding_conflict: 'До замовлення вже прив’язано інший invoiceId. Перевіряйте лише початковий invoiceId.',
  payment_intent_required: 'Спочатку збережіть серверний reference для передплати.',
  payment_intent_exists: 'Платіжний intent уже існує. Оновіть поточний стан.',
  cod_settlement_required: 'Для післяплати потрібна окрема звірка виписки або реєстру перевізника.',
  cod_order_required: 'Структуроване підтвердження післяплати доступне лише для COD.',
  amount_mismatch: 'Валова сума реєстру має точно відповідати повній сумі замовлення.',
  settlement_date_invalid: 'Дата зарахування має бути після підтвердженої доставки та не в майбутньому.',
  settlement_shipment_mismatch: 'ТТН доказу не відповідає відправленню цього замовлення.',
  settlement_reference_used: 'Цей рядок документа вже використано для іншого платежу.',
  handover_required: 'Спочатку потрібне канонічне відправлення цього замовлення.',
  tracking_delivery_required: 'Потрібне окреме свіже підтвердження доставки перевізником.',
  tracking_stale: 'Оновіть застаріле підтвердження доставки.',
  carrier_return_active: 'Для цього замовлення вже розпочато окремий процес повернення.',
  incompatible_sales_facts: 'Існуючі фінансові факти несумісні з новим платежем.',
  terminal_order: 'Замовлення вже закрите.',
  shop_order_required: 'Цей платіжний сценарій доступний лише для звичайного Shop замовлення.',
  unsupported_zero_total: 'Потрібна додатна повна сума замовлення.',
  checkbox_identity_required: 'Спочатку перевірте фіскальний профіль і касу.',
  checkbox_shift_closed: 'Спочатку відкрийте фіскальну зміну.',
  checkbox_register_busy: 'Каса має незавершену операцію. Спочатку звірте її.',
  checkbox_tax_profile_invalid: 'Податкове зіставлення товарів не налаштовано.',
  checkbox_payment_mapping_invalid: 'Спосіб оплати не має дозволеного фіскального зіставлення.',
  checkbox_cash_rounding_unsupported: 'Готівкова сума потребує підтримуваного округлення.',
  checkbox_history_unbound: 'Історичні гроші або видача не мають початкової фіскальної прив’язки. Автоматичне перенесення заборонено.',
}
export const shopPaymentReason = (code: string) => reasons[code] || 'Сервер заблокував дію. Оновіть стан та перевірте підставу платежу.'
const verificationLabels: Record<string, string> = { success: 'Остання перевірка банку: успішна. Факт оплати показано окремо нижче.', created: 'Банк ще не підтвердив оплату.', processing: 'Банк обробляє платіж; оплату ще не підтверджено.', hold: 'Кошти утримуються; завершену оплату не підтверджено.', failure: 'Банк повідомив про невдалий платіж.', reversed: 'Банк повідомив про скасування або повернення.', expired: 'Термін дії invoice минув.', monobank_unavailable: 'Відповідь банку недоступна; оплату не підтверджено.', monobank_proof_invalid: 'Банківський доказ не пройшов перевірку.' }
export const shopPaymentVerification = (status: string) => verificationLabels[status] || 'Остаточну оплату не підтверджено. Можна явно повторити серверну перевірку того самого invoiceId.'
// Only no-effect business rejections release a key. Network failures and 5xx retain it.
export const shopPaymentRejected = ['payment_profile_conflict', 'shop_payments_disabled', 'shop_operations_disabled', 'monobank_unavailable', 'monobank_test_unsafe', 'manual_cod_policy_unavailable', 'manual_cod_profile_mismatch', 'manual_cod_test_unsafe', 'monobank_profile_mismatch', 'monobank_proof_invalid', 'invoice_binding_conflict', 'payment_intent_required', 'payment_intent_exists', 'cod_settlement_required', 'cod_order_required', 'amount_mismatch', 'settlement_date_invalid', 'settlement_shipment_mismatch', 'settlement_reference_used', 'handover_required', 'tracking_delivery_required', 'tracking_stale', 'carrier_return_active', 'incompatible_sales_facts', 'terminal_order', 'shop_order_required', 'unsupported_zero_total', 'payment_binding_conflict', 'idempotency_conflict', 'checkbox_identity_required', 'checkbox_shift_closed', 'checkbox_register_busy', 'checkbox_tax_profile_invalid', 'checkbox_payment_mapping_invalid', 'checkbox_cash_rounding_unsupported', 'checkbox_history_unbound'] as const

// Read-only audit labels use a whitelist; neither this view nor a bank status creates money.
export const shopPaymentEvidenceRows = (value: ShopPaymentState['evidence']) => {
  if (!value) return []
  const fields: Array<[string, string]> = value.kind === 'cod' ? [['type', 'Тип документа'], ['source', 'Джерело'], ['issuer', 'Установа'], ['account', 'Рахунок'], ['document_id', 'Документ'], ['line_id', 'Рядок'], ['tracking_number', 'ТТН'], ['gross_amount_minor', 'Валова сума'], ['fee_minor', 'Комісія'], ['net_amount_minor', 'Зараховано'], ['currency', 'Валюта'], ['settled_at', 'Дата зарахування']] : [['invoice_id', 'invoiceId'], ['reference', 'Reference'], ['amount_minor', 'Сума'], ['currency', 'Валюта'], ['status', 'Перевірений банківський статус'], ['merchant_id', 'Merchant'], ['profile_id', 'Платіжний профіль'], ['accepted_at', 'Дата підтвердження банку']]
  return fields.map(([key, label]) => { const item = value.proof[key]; if (key === 'type') return { label, value: item === 'bank_statement' ? 'Банківська виписка' : item === 'carrier_settlement' ? 'Реєстр розрахунків перевізника' : 'Недоступно' }; return { label, value: key.endsWith('_minor') && typeof item === 'number' ? shopPaymentMoney(item) : typeof item === 'string' || typeof item === 'number' ? String(item) : 'Недоступно' } })
}
