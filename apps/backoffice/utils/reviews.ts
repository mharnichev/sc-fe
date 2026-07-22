import type { ReviewModerationStatus, ReviewRequestState } from '../types/reviews'

export const reviewModerationLabels: Record<ReviewModerationStatus, string> = {
  pending: 'Очікує модерації',
  approved: 'Схвалено',
  rejected: 'Відхилено',
}

export const reviewRequestStateLabels: Record<ReviewRequestState, string> = {
  scheduled: 'Заплановано',
  sent: 'Надіслано',
  delivered: 'Доставлено',
  submitted: 'Відгук надіслано',
  expired: 'Термін минув',
  failed: 'Помилка',
}

export const clampRating = (value?: number | null) => Math.max(0, Math.min(5, Math.round(Number(value || 0))))

export const formatRating = (value?: number | null) => {
  const rating = Number(value)
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : '—'
}

export const formatReviewConversionRate = (value?: number | null) => {
  const rate = Number(value || 0)
  const normalized = rate > 0 && rate <= 1 ? rate * 100 : rate
  return `${Math.max(0, Math.min(100, normalized)).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%`
}

export const formatModerationDuration = (minutes?: number | null) => {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '—'
  const value = Math.max(0, Math.round(Number(minutes)))
  if (value < 60) return `${value} хв`
  const hours = Math.floor(value / 60)
  const remainder = value % 60
  return remainder ? `${hours} год ${remainder} хв` : `${hours} год`
}

export const reviewStatusClass = (status?: ReviewModerationStatus | ReviewRequestState | string | null) => {
  if (status === 'approved' || status === 'delivered' || status === 'submitted') return 'bg-emerald-50 text-emerald-700'
  if (status === 'pending' || status === 'scheduled' || status === 'sent') return 'bg-amber-50 text-amber-700'
  if (status === 'rejected' || status === 'failed' || status === 'expired') return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

export const safeBookingReference = (value?: string | null) => value?.trim() || 'Підтверджений запис'
