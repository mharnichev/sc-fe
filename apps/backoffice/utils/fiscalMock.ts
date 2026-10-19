export const fiscalStatusLabel = (status: string) => ({
  queued: 'У черзі MOCK — ще не видано', submitting: 'MOCK запит виконується',
  unknown: 'Невідомий результат MOCK — потрібна звірка', processing: 'MOCK обробляється',
  issued: 'Видано MOCK чек — не надсилалось до ДПС', cancelled: 'MOCK погодження скасовано',
  error: 'Помилка MOCK — чек не підтверджено',
}[status] || 'Нерозпізнаний стан MOCK — потрібна перевірка')
export const fiscalDeliveryLabel = (status: string) => ({
  pending_document: 'Локальний показ очікує документа', queued: 'Локальний показ у черзі',
  delivered: 'Локальний показ / друк зафіксовано', failed: 'Помилка локального показу / друку',
}[status] || 'Невідомий стан локального показу')
export const fiscalApprovalIdentity = (actor: number | undefined, order: number, revision: number | undefined, register: string, preview: { id: number, snapshot_hash: string, shift_revision: number } | null) =>
  JSON.stringify([actor, order, revision, register, preview?.id, preview?.snapshot_hash, preview?.shift_revision])
export const fiscalMoney = (minor: number) => `${(minor / 100).toFixed(2)} грн`

// These server rejections occur before a new operation is accepted. Never include
// unknown transport/auth errors, provider integrity failures or idempotency conflicts.
export const fiscalDefinitiveRejections = [
  'register_forbidden', 'shift_revision_conflict', 'shift_state_conflict',
  'shift_closed', 'invalid_order_amounts', 'simulation_sale_required', 'simulation_payment_required',
  'confirmation_required', 'preview_not_found', 'preview_expired', 'stale_preview', 'preview_consumed',
  'duplicate_return_item', 'return_capacity_exceeded', 'issued_mock_sale_required', 'invalid_original_amounts',
  'refund_exists', 'return_receipt_exists', 'parcel_receipt_required', 'receipt_quantity_mismatch', 'handover_required', 'shipped_quantity_exceeded',
  'mock_refund_required', 'return_already_submitted', 'reconciliation_case_not_found',
  'sale_already_submitted', 'already_dispatched', 'receipt_not_issued',
] as const

// Accept only the backend capability path and an explicitly local shop origin.
export const localMockFiscalShareUrl = (path: string | null, origin: unknown) => {
  const token = path?.match(/^\/api\/v1\/public\/mock-fiscal-documents\/([A-Za-z0-9._~-]{20,2048})$/)?.[1]
  if (!token || typeof origin !== 'string') return null
  try {
    const base = new URL(origin)
    if (!['http:', 'https:'].includes(base.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== '/') return null
    return new URL(`/mock-fiscal-documents/${token}`, base.origin).href
  } catch { return null }
}

export const fiscalPaymentMethodLabel = (method: string) => ({ cash: 'готівка', card: 'картка', monobank_qr: 'monobank QR' }[method] || 'невідомий спосіб оплати')
