// Shop fiscal DTOs are deliberately separate from the legacy MOCK/POS contracts.
export interface ShopFiscalAuthority { authority: 'test', simulation: true, is_sent_dps: false, notice: string }
export type ShopFiscalActions = Record<string, boolean>
export interface ShopFiscalLine { order_item_id: number, product_id: number, name: string | null, quantity: number, total_minor: number }
export interface ShopFiscalSnapshot { items: ShopFiscalLine[], amount_minor: number, currency: string, payment?: { id: number, method: string } }
export interface ShopFiscalPreview extends ShopFiscalAuthority { id: number, order_id: number, return_id: number | null, kind: 'sale' | 'return', expected_revision: number, shift_revision: number, snapshot: ShopFiscalSnapshot, snapshot_hash: string, expires_at: string }
export interface ShopFiscalDocument extends ShopFiscalAuthority { id: number, order_id: number, return_id: number | null, kind: 'sale' | 'return', status: 'queued' | 'unknown' | 'issued' | 'cancelled' | 'error', revision: number, provider_uuid: string, shift_revision: number, amount_minor: number, currency: string, snapshot: ShopFiscalSnapshot, snapshot_hash: string, dispatched_at: string | null, issued_at: string | null, created_at: string, actions: ShopFiscalActions, blocking_reasons: string[] }
export interface ShopFiscalReturn extends ShopFiscalAuthority { id: number, order_id: number, sale_document_id: number, carrier_receipt_id?: number | null, revision: number, shift_revision: number, amount_minor: number, currency: string, lines: ShopFiscalLine[], reason: string, refund: null | { id: number, amount_minor: number, method: string, external_reference: string, evidence: string, created_at: string }, physical_receipt: null | { id: number, carrier_receipt_id?: number | null, lines: Array<{ order_item_id: number, quantity: number, disposition: 'restock' | 'not_restock' }>, evidence: string, created_at: string }, fiscal_document: ShopFiscalDocument | null, created_at: string, actions: ShopFiscalActions, blocking_reasons: string[] }
export interface ShopFiscalOrder extends ShopFiscalAuthority { enabled: boolean, order_id: number, revision: number, sale_document: ShopFiscalDocument | null, returns: ShopFiscalReturn[], actions: ShopFiscalActions, blocking_reasons: string[] }
export interface ShopFiscalReconciliation { carrier_return_case_ids?: number[], pending_document_ids: number[], unreceipted_payment_ids: number[], unresolved_return_ids: number[], unknown_document_ids: number[] }
export interface ShopFiscalReport extends ShopFiscalAuthority { id: number, kind: 'x' | 'z', register_id: string, shift_revision: number, totals: { sale_count: number, return_count: number, sales_minor: number, returns_minor: number, net_minor: number, document_ids: number[] }, reconciliation: ShopFiscalReconciliation, created_at: string }
export interface ShopFiscalRegister extends ShopFiscalAuthority { id: string, enabled: boolean, shift_status: 'closed' | 'open', shift_revision: number, actions: ShopFiscalActions, blocking_reasons: string[], reconciliation: ShopFiscalReconciliation | null, reports: ShopFiscalReport[] }
export const shopFiscalPrefix = '/backoffice/shop-fiscal'
export const shopFiscalMoney = (minor: number) => `${(minor / 100).toFixed(2)} грн`
export const shopFiscalStatus = (status: string) => ({ queued: 'У черзі — ще не видано', unknown: 'Результат невідомий — потрібна звірка', issued: 'Видано тестовий чек', cancelled: 'Погодження скасовано', error: 'Помилка — чек не підтверджено' }[status] || 'Стан не підтверджено')
const reasonLabels: Record<string, string> = {
  unsupported_zero_total: 'Оберіть сукупність позицій із додатною сумою повернення. Позиції з нульовою вартістю додайте до останнього запиту з додатною сумою.',
  shop_fiscal_disabled: 'Нові тестові фіскальні операції вимкнено.', shop_fiscal_test_unsafe: 'Тестове середовище не підтверджено. Дії заблоковано.',
  payment_required: 'Спочатку підтвердьте окремий факт оплати.', handover_required: 'Спочатку підтвердьте видачу або відправлення.', sale_receipt_required: 'Потрібен виданий чек вихідного продажу.',
  active_return: 'Спочатку завершіть окремі факти активного повернення.', pre_handover_return_blocked: 'Повернення до видачі товару цим сценарієм не підтримується.', carrier_return_pending_b3: 'Фізичне приймання повернення перевізника поки недоступне. Автоматичного оприбуткування немає.',
  carrier_receipt_required: 'Спочатку прийміть зворотну посилку НП.', carrier_receipt_quantity_exceeded: 'Кількість перевищує ще не використане приймання НП.', carrier_receipt_disposition_mismatch: 'Рішення щодо складу має відповідати незмінному прийманню НП.', carrier_return_not_received: 'Посилку ще не прийнято фізично.',
  shift_closed: 'Спочатку відкрийте тестову зміну.', shift_unsettled: 'Є незавершені документи, оплати або повернення. Закриття зміни заблоковано.',
  document_exists: 'Документ уже створено.', document_unknown: 'Потрібна звірка за оригінальним ідентифікатором.', document_dispatched: 'Відправлений документ не можна скасувати.',
  fiscal_provider_unavailable: 'Фіскальний адаптер недоступний.', incompatible_sales_facts: 'Підстава продажу потребує перевірки.',
  record_sales_required: 'Немає дозволу на облік продажів.', post_inventory_required: 'Немає дозволу на фізичне приймання.', fiscalize_sales_required: 'Немає дозволу на чеки продажу.', fiscalize_returns_required: 'Немає дозволу на повернення чека.', manage_fiscal_settings_required: 'Немає дозволу на керування зміною та звітами.',
}
export const shopFiscalReason = (code: string) => reasonLabels[code] || 'Дію заблоковано сервером. Оновіть стан або перевірте підставу операції.'
// Only known rejections before acceptance release an intent. Unknown outcomes retain it.
export const shopFiscalRejected = ['unsupported_zero_total', 'shop_fiscal_disabled', 'shop_fiscal_test_unsafe', 'shop_order_required', 'incompatible_sales_facts', 'payment_required', 'handover_required', 'sale_receipt_required', 'active_return', 'pre_handover_return_blocked', 'carrier_return_pending_b3', 'carrier_receipt_required', 'carrier_receipt_quantity_exceeded', 'carrier_receipt_disposition_mismatch', 'carrier_return_not_received', 'shift_revision_conflict', 'shift_closed', 'shift_unsettled', 'preview_stale', 'preview_expired', 'preview_consumed', 'document_exists', 'document_unknown', 'document_dispatched', 'return_quantity_exceeded', 'refund_exists', 'external_reference_used', 'physical_receipt_exists', 'receipt_quantity_mismatch', 'shipped_quantity_exceeded', 'fiscal_provider_unavailable'] as const
export const shopFiscalAuthorityValid = (value: ShopFiscalAuthority) => value?.authority === 'test' && value.simulation === true && value.is_sent_dps === false && typeof value.notice === 'string'
// One read context per panel; actor/permissions, resource and unmount invalidate late reads.
export const useShopFiscalRead = <T extends ShopFiscalAuthority>(context: () => string, read: () => Promise<T>, matches: (value: T) => boolean) => {
  const state = shallowRef<T | null>(null), loading = ref(false), error = ref('')
  let generation = 0, request = 0, active = true
  const version = () => generation
  const current = (value: number) => active && generation === value
  const load = async () => {
    const started = generation, sequence = ++request
    loading.value = true; error.value = ''
    try {
      const value = await read()
      if (!current(started) || sequence !== request) return false
      if (!shopFiscalAuthorityValid(value) || !matches(value)) throw new Error('Invalid fiscal state')
      state.value = value; return true
    } catch {
      if (current(started) && sequence === request) { state.value = null; error.value = 'Не вдалося перевірити поточний стан. Дії заблоковано; оновіть дані.' }
      return false
    } finally { if (current(started) && sequence === request) loading.value = false }
  }
  watch(context, () => { generation++; request++; state.value = null; loading.value = false; error.value = ''; if (import.meta.client) void load() }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { active = false; generation++; request++ })
  return { state, loading, error, load, version, current }
}

// Only the complete server brand routes a simulated reverse parcel through canonical Shop panels.
interface ShopShipmentBrand { simulation: boolean, carrier: string, source?: string, shop_carrier_return_case_id?: number | null, provenance?: string | null, authority?: string | null, return_of_shipment_id?: number | null }
export const isShopCarrierReturnShipment = (shipment: ShopShipmentBrand) => shipment.simulation === true && shipment.carrier === 'shop_mock_np_return' && shipment.source === 'shop_return'
  && Number.isSafeInteger(shipment.shop_carrier_return_case_id) && Number(shipment.shop_carrier_return_case_id) > 0
  && Number.isSafeInteger(shipment.return_of_shipment_id) && Number(shipment.return_of_shipment_id) > 0
  && shipment.provenance === 'shop_carrier_return_test' && shipment.authority === 'test'
// Presentation routing preserves existing Shop MOCK/QR history. Server actions remain authoritative.
export const shopFiscalUsesCanonicalPanel = (order: { channel?: string | null, simulation?: boolean, payments?: Array<{ simulation: boolean, source: string }>, handovers?: Array<{ simulation: boolean }>, shipments?: ShopShipmentBrand[] }) => order.channel === 'shop' && order.simulation === false
  && !(order.shipments || []).some(shipment => (shipment.simulation === true || shipment.carrier === 'mock_nova_poshta') && !isShopCarrierReturnShipment(shipment))
  && (order.payments || []).every(payment => payment.simulation === false && ['shop_manual', 'shop_provider'].includes(payment.source))
  && (order.handovers || []).every(handover => handover.simulation === false)
