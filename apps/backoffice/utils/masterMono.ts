import type { MasterMonoState } from '~/composables/useBackofficeApi'

// Both endpoints supply the bank URL already bound to the invoice by the server.
// Keep its exact bytes after checking the trusted origin and browser serialization.
export const masterMonoPaymentUrl = (state: Pick<MasterMonoState, 'invoice_id' | 'payment_url'> | null): string | null => {
  const id = state?.invoice_id, payload = state?.payment_url
  if (typeof id !== 'string' || !id || id.length > 100 || /[^A-Za-z0-9_-]/.test(id)
    || typeof payload !== 'string' || payload.length > 240 || !payload.startsWith('https://pay.mbnk.biz/')
    || /[\s\x00-\x1f\x7f#\\]|%(?![\da-f]{2})|%(?:0[\da-f]|1[\da-f]|7f|5c)/i.test(payload)) return null
  try {
    const url = new URL(payload)
    return url.href === payload && (url.pathname !== '/' || payload.includes('?')) ? payload : null
  } catch { return null }
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
