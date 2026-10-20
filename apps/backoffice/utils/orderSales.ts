export interface SalesIntent<T> { key: string, body: T, resultId?: number }
export const salesIntentStorageKey = (actor: number, operation: string, resource: string) =>
  `sc-sales:v1:${actor}:${operation}:${resource}`
export const parseSalesIntent = <T>(raw: string | null): SalesIntent<T> | null => {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value.key !== 'string' || !value.key || !value.body || typeof value.body !== 'object' || Array.isArray(value.body)) return null
    if (value.resultId !== undefined && (!Number.isSafeInteger(value.resultId) || value.resultId <= 0)) return null
    return value as SalesIntent<T>
  }
  catch { return null }
}
export const salesErrorDetail = (error: unknown): { code?: string, message?: string } => {
  if (!error || typeof error !== 'object' || !('data' in error)) return {}
  const data = error.data as { detail?: unknown }
  return data?.detail && typeof data.detail === 'object' ? data.detail as { code?: string, message?: string } : {}
}
// Parse decimal strings exactly; payment totals never use binary floating point.
export const orderAmountMinor = (amount: string): number | null => {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount)
  if (!match) return null
  const minor = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'))
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null
}
export const orderStatusOptions = (legacy: boolean) => [
  { value: 'pending', label: 'Очікує' }, { value: 'confirmed', label: 'Підтверджено' },
  ...(legacy ? [{ value: 'paid', label: 'Оплачено (історичне)' }, { value: 'completed', label: 'Завершено (історичне)' }] : []),
  { value: 'cancelled', label: 'Скасовано' },
]

// Confirmation provenance, not the selected checkout method, identifies a paid
// online transaction. Keep ordinary card and COD payments distinct.
export const orderPaymentMethodLabel = (order: { payment_channel?: string | null, payment_method?: string | null }): string => {
  if (order.payment_channel === 'online_monobank') return 'Онлайн через mono'
  if (order.payment_method === 'onlineCard') return 'Онлайн через mono — очікує оплати'
  const labels: Record<string, string> = {
    cash: 'Готівка', card: 'Картка', bank_transfer: 'Банківський переказ',
    cod: 'Накладений платіж', cashOnDelivery: 'Накладений платіж (готівка)',
    cardOnDelivery: 'Накладений платіж (картка)', monobank_qr: 'QR mono',
  }
  return labels[order.payment_method || ''] || order.payment_method || '—'
}
