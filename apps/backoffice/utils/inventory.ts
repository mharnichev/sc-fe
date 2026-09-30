import type { InventoryDocumentStatus, InventoryMovementType, ProcurementStatus } from '~/types/inventory'

const documentStatusLabels: Record<string, string> = {
  draft: 'Чернетка',
  posted: 'Проведено',
}

const movementLabels: Record<string, string> = {
  opening_balance: 'Початковий залишок',
  receipt: 'Надходження',
  customer_return: 'Повернення від клієнта',
  write_off: 'Списання',
  order_reservation: 'Резервування для замовлення',
  order_release: 'Зняття резерву',
  order_fulfillment: 'Відвантаження замовлення',
  inventory_adjustment: 'Коригування інвентаризації',
}

const procurementLabels: Record<string, string> = {
  not_required: 'Не потрібно',
  to_order: 'Потрібно замовити',
  ordered: 'Замовлено',
  received: 'Отримано',
}

export const inventoryDocumentStatusLabel = (status: InventoryDocumentStatus | null | undefined) =>
  documentStatusLabels[status || ''] || status || '—'

export const inventoryMovementLabel = (movementType: InventoryMovementType | null | undefined) =>
  movementLabels[movementType || ''] || movementType || '—'

export const procurementStatusLabel = (status: ProcurementStatus | null | undefined) =>
  procurementLabels[status || ''] || status || '—'

export const normalizeInventoryBarcode = (value: string | null | undefined) =>
  (value || '').replace(/\s+/g, '').toUpperCase()

export const shouldSuppressBarcodeSubmission = (
  barcode: string,
  lastBarcode: string,
  now: number,
  lastSubmittedAt: number,
  duplicateWindowMs: number,
) => normalizeInventoryBarcode(barcode) === normalizeInventoryBarcode(lastBarcode)
  && now - lastSubmittedAt < duplicateWindowMs

export const repeatedReceiptScanQuantity = (
  currentBarcode: string | null | undefined,
  scannedBarcode: string,
  currentQuantity: number | null | undefined,
) => normalizeInventoryBarcode(currentBarcode) === normalizeInventoryBarcode(scannedBarcode)
  ? Math.max(1, Number(currentQuantity || 0) + 1)
  : null

const formatDetail = (detail: unknown): string | null => {
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (!Array.isArray(detail)) return null

  const messages = detail.map((item) => {
    if (typeof item === 'string') return item
    if (!item || typeof item !== 'object') return null
    const value = item as { msg?: unknown, loc?: unknown }
    const message = typeof value.msg === 'string' ? value.msg : null
    if (!message) return null
    const location = Array.isArray(value.loc)
      ? value.loc.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number').join('.')
      : ''
    return location ? `${location}: ${message}` : message
  }).filter((item): item is string => Boolean(item))

  return messages.length ? messages.join('; ') : null
}

export const inventoryApiErrorMessage = (error: unknown, fallback = 'Не вдалося виконати операцію зі складом.') => {
  if (!error || typeof error !== 'object') return fallback
  const source = error as {
    data?: { detail?: unknown, message?: unknown }
    response?: { status?: number, _data?: { detail?: unknown, message?: unknown } }
  }
  const data = source.data || source.response?._data
  const detail = formatDetail(data?.detail)
  if (detail) return detail
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim()

  if (source.response?.status === 409) return 'Операцію відхилено через конфлікт даних. Оновіть дані та повторіть спробу.'
  if (source.response?.status === 422) return 'Перевірте заповнені поля та повторіть спробу.'
  if (source.response?.status === 404) return 'Товар або складський документ не знайдено.'
  if (source.response?.status === 403) return 'У вас немає прав для цієї складської операції.'
  return fallback
}

const fallbackIdempotencyKey = () => {
  const values = new Uint8Array(16)
  globalThis.crypto?.getRandomValues?.(values)
  if (values.some(value => value !== 0)) {
    values[6] = (values[6] & 0x0f) | 0x40
    values[8] = (values[8] & 0x3f) | 0x80
    const hex = [...values].map(value => value.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return `inventory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

export const createInventoryIdempotencyKey = (): string => globalThis.crypto?.randomUUID?.() || fallbackIdempotencyKey()
