export interface ShopCarrierAuthority { authority: 'test', simulation: true, notice: string }
export interface ShopCarrierLine { order_item_id: number, product_id: number, name: string | null, quantity: number }
export interface ShopCarrierReceiptLine { order_item_id: number, quantity: number, disposition: 'restock' | 'not_restock' }
export interface ShopCarrierReceipt { id: number, lines: ShopCarrierReceiptLine[], evidence: string, created_at: string }
export interface ShopCarrierCase extends ShopCarrierAuthority {
  id: number, order_id: number, revision: number, order_revision: number, original_shipment_id: number, return_shipment_id: number,
  tracking_number: string | null, provider_uuid: string, status: 'unknown' | 'returning' | 'returned' | 'received' | 'closed_unpaid', financial_mode: 'paid' | 'unpaid_cod',
  shift_revision: number | null, sale_document_id: number | null, lines: ShopCarrierLine[],
  observation: null | { status: string, event_at: string | null, observed_at: string, last_attempt_status: string }, receipt: ShopCarrierReceipt | null,
  closure: null | { id: number, evidence: string, created_at: string }, financial_remaining_lines: ShopCarrierLine[], actions: Record<string, boolean>, blocking_reasons: string[]
}
export interface ShopCarrierState extends ShopCarrierAuthority { order_id: number, revision: number, enabled: boolean, original_shipment_id: number | null, financial_mode: 'paid' | 'unpaid_cod' | null, eligible_lines: ShopCarrierLine[], cases: ShopCarrierCase[], actions: Record<string, boolean>, blocking_reasons: string[] }
export const shopCarrierPrefix = (orderId: number) => `/backoffice/orders/${orderId}/carrier-returns`
export const shopCarrierAuthorityValid = (value: ShopCarrierAuthority) => value?.authority === 'test' && value.simulation === true && typeof value.notice === 'string'
export const shopCarrierStatus = (value: string) => ({ unknown: 'Результат невідомий — потрібна звірка', returning: 'Зворотна посилка в дорозі', returned: 'Перевізник підтвердив повернення — сам статус не змінює склад', received: 'Фізичне приймання зафіксовано окремо', closed_unpaid: 'Неоплачену відмову закрито без фінансових фактів' }[value] || 'Стан не підтверджено')
const reasons: Record<string, string> = {
  unsupported_zero_total: 'Оберіть сукупність позицій із додатною сумою повернення. Позиції з нульовою вартістю додайте до останнього запиту з додатною сумою.',
  shop_carrier_returns_disabled: 'Нові тестові повернення перевізника вимкнено.', shop_carrier_return_test_unsafe: 'Тестове середовище не підтверджено. Дії заблоковано.',
  carrier_return_exists: 'Окремий зворотний випадок уже створено.', carrier_return_active: 'Завершіть окремі факти поточного повернення.', carrier_return_required: 'Потрібен канонічний випадок повернення перевізника.',
  carrier_return_unknown: 'Результат невідомий. Звірте той самий опорний UUID.', carrier_return_not_received: 'Спочатку окремо підтвердьте фізичне приймання посилки.', carrier_return_not_ready: 'Повернення перевізником ще не підтверджено.',
  carrier_return_binding_invalid: 'Зв’язок посилки та замовлення потребує перевірки.', carrier_return_financial_required: 'Гроші, чек і зв’язок приймання оформлюються окремо в розділі «Повернення».',
  carrier_return_unpaid_full_required: 'Неоплачена відмова має охоплювати всю відправлену кількість.', carrier_return_unpaid_facts_conflict: 'Виявлено фінансові факти. Закрити випадок як неоплачену відмову не можна.',
  carrier_return_refusal_required: 'Потрібна окремо підтверджена відмова перевізника.', carrier_return_tracking_stale: 'Дані перевізника застаріли. Потрібна окрема дозволена перевірка.',
  carrier_return_quantity_exceeded: 'Обрана кількість перевищує доступну відправлену кількість.', carrier_receipt_required: 'Потрібне зафіксоване приймання поверненої посилки.', carrier_receipt_quantity_exceeded: 'Цю прийняту кількість уже пов’язано з фінансовим поверненням.', carrier_receipt_disposition_mismatch: 'Рішення щодо складу має збігатися з первинним прийманням посилки.',
  physical_receipt_exists: 'Приймання вже зафіксовано. Повторного оприбуткування немає.', shift_closed: 'Для оплаченої посилки спочатку відкрийте тестову зміну.', shift_unsettled: 'Є незавершені документи або факти повернення; закриття зміни заблоковано.',
}
export const shopCarrierReason = (code: string) => reasons[code] || 'Дію заблоковано сервером. Оновіть стан або перевірте підставу операції.'
export const shopCarrierRejected = ['unsupported_zero_total', 'shop_carrier_returns_disabled', 'shop_carrier_return_test_unsafe', 'shop_order_required', 'carrier_return_exists', 'carrier_return_active', 'carrier_return_required', 'carrier_return_unknown', 'carrier_return_not_received', 'carrier_return_not_ready', 'carrier_return_binding_invalid', 'carrier_return_financial_required', 'carrier_return_unpaid_full_required', 'carrier_return_unpaid_facts_conflict', 'carrier_return_refusal_required', 'carrier_return_tracking_stale', 'carrier_return_quantity_exceeded', 'carrier_receipt_required', 'carrier_receipt_quantity_exceeded', 'carrier_receipt_disposition_mismatch', 'physical_receipt_exists', 'shift_closed', 'shift_unsettled'] as const
export const useShopCarrierRead = <T extends ShopCarrierAuthority>(context: () => string, read: () => Promise<T>, matches: (value: T) => boolean, available: () => boolean = () => true) => {
  const state = shallowRef<T | null>(null), loading = ref(false), error = ref('')
  let generation = 0, request = 0, active = true
  const version = () => generation, current = (value: number) => active && generation === value
  const load = async () => {
    if (!available()) { state.value = null; error.value = ''; return false }
    const started = generation, sequence = ++request; loading.value = true; error.value = ''
    try { const value = await read(); if (!current(started) || sequence !== request) return false; if (!shopCarrierAuthorityValid(value) || !matches(value)) throw new Error('Invalid carrier return state'); state.value = value; return true }
    catch { if (current(started) && sequence === request) { state.value = null; error.value = 'Не вдалося перевірити повернення посилки. Дії заблоковано; оновіть дані.' } return false }
    finally { if (current(started) && sequence === request) loading.value = false }
  }
  watch(context, () => { generation++; request++; state.value = null; loading.value = false; error.value = ''; if (import.meta.client && available()) void load() }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { active = false; generation++; request++ })
  return { state, loading, error, load, version, current }
}
