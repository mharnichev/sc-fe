const labels: Record<string, [string, string]> = {
  preparing: ['Готуємо', 'Preparing'], ready_for_pickup: ['У відділенні', 'Ready to collect'],
  created: ['Підготовлено', 'Prepared'], unknown: ['Результат не визначено — потрібна звірка', 'Unknown result — review needed'],
  handed_over: ['Передано пошті', 'With carrier'], in_transit: ['У дорозі', 'In transit'], delivered: ['Доставлено', 'Delivered'], refused: ['Відмова', 'Refused'],
  returning: ['Повертається', 'Returning'], returned: ['Повернено', 'Returned'], cancelled: ['Скасовано', 'Cancelled'],
  requires_review: ['Потрібне уточнення', 'Needs attention'],
}
export const shipmentStatusLabel = (status: string, locale = 'uk', real = false) => {
  if (real && status === 'delivered') return locale === 'en' ? 'Received' : 'Отримано'
  return (labels[status] || labels.requires_review)![locale === 'en' ? 1 : 0]
}

export const guestShipmentPath = (url?: string | null): string | null => {
  const match = /^\/api\/v1\/public\/orders\/tracking\/([A-Za-z0-9._~-]{20,2048})$/.exec(url || '')
  return match ? `/tracking/${match[1]}` : null
}

// A legacy completed/status value is never receipt evidence for a real shipment.
export const deliveryStatus = (shipment: { simulation: boolean, status: string, delivery_status?: string }) =>
  shipment.simulation ? shipment.status : shipment.delivery_status || 'requires_review'

export const deliverySummaryEntries = (summary?: Record<string, number>, locale = 'uk', real = false) =>
  Object.entries(summary || {}).filter(([, count]) => Number.isSafeInteger(count) && count > 0)
    .map(([status, count]) => ({ status, count, label: shipmentStatusLabel(status, locale, real) }))

export const retrySeconds = (value: unknown, fallback = 60) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return fallback
  if (typeof value !== 'number' && typeof value !== 'string') return fallback
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 2147483 ? Math.ceil(seconds) : fallback
}


export const shipmentStatusIcon = (status: string) => {
  const normalized = status.includes(':') ? status.split(':')[1] || '' : status
  return ({ accepted: 'box', partial: 'box', preparing: 'box', created: 'box', handed_over: 'nova-post', in_transit: 'truck',
    ready_for_pickup: 'pin', delivered: 'check-outline', refused: 'circle-close', returning: 'circle-arrow-left',
    returned: 'circle-arrow-left', cancelled: 'circle-close' } as Record<string, string>)[normalized] || 'info-outline'
}


export type ShipmentTone = 'neutral' | 'warning' | 'info' | 'success' | 'danger'
export const shipmentStatusTone = (status: string): ShipmentTone => {
  const state = status.includes(':') ? status.split(':')[1] || '' : status
  if (state === 'delivered') return 'success'
  if (['cancelled', 'refused'].includes(state)) return 'danger'
  if (['handed_over', 'in_transit', 'ready_for_pickup'].includes(state)) return 'info'
  if (['preparing', 'created', 'returning', 'requires_review', 'partial'].includes(state)) return 'warning'
  return 'neutral'
}
