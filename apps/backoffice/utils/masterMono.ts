import type { MasterMonoState } from '~/composables/useBackofficeApi'

// Match the canonical provider URL byte-for-byte: URL parsing alone normalizes
// empty ports, credentials and escaped path characters before validation.
export const masterMonoPaymentUrl = (state: MasterMonoState | null): string | null => {
  if (!state || !state.invoice_id || state.invoice_id.length > 256 || /[^A-Za-z0-9_-]/.test(state.invoice_id)) return null
  const expected = `https://pay.mbnk.biz/${state.invoice_id}`
  return state.payment_url === expected ? expected : null
}

export const validMasterMonoState = (value: MasterMonoState, orderId: number): boolean => !!value &&
  value.mode === 'mono_checkbox' && value.order_id === orderId &&
  Number.isSafeInteger(value.revision) && value.revision >= 1 &&
  Number.isSafeInteger(value.amount_minor) && value.amount_minor >= 0 &&
  typeof value.enabled === 'boolean' && typeof value.paid === 'boolean' &&
  typeof value.receipt_accepted === 'boolean' && typeof value.can_handover === 'boolean' &&
  typeof value.status === 'string' && Array.isArray(value.blocking_reasons) &&
  value.blocking_reasons.every(reason => typeof reason === 'string') &&
  (value.invoice_id === null || typeof value.invoice_id === 'string') &&
  (value.payment_url === null || typeof value.payment_url === 'string') &&
  (value.receipt_pdf_path === null || typeof value.receipt_pdf_path === 'string')

export const masterMonoBlockingReason = (reason: string): string => ({
  master_mono_disabled: 'Оплату через mono тимчасово вимкнено. Зверніться до адміністратора.',
  master_mono_not_ready: 'Оплату ще не налаштовано. Зверніться до адміністратора.',
  master_mono_profile_conflict: 'Профіль оплати потребує перевірки адміністратора.',
  master_mono_checkout_owned: 'Для замовлення вже є інший платіж. Зверніться до адміністратора.',
  master_mono_binding_required: 'Потрібно налаштувати касу та платіжний профіль. Зверніться до адміністратора.',
  master_mono_proof_invalid: 'Підтвердження чека потребує перевірки адміністратора.',
  waiting: 'Очікуємо підтвердження оплати та чека.',
  paid: 'Оплату підтверджено, очікуємо чек.',
  pending: 'Чек ще обробляється.',
  processing: 'Сервер перевіряє той самий рахунок.',
  terminal_order: 'Замовлення завершено або скасовано.',
}[reason] || 'Потрібна перевірка адміністратора. Нову оплату не створюйте.')
