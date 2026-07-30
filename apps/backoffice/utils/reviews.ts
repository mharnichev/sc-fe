import type { ReviewMetrics, ReviewModerationStatus, ReviewRequestState } from '../types/reviews'

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
  if (value == null || !Number.isFinite(Number(value))) return 'Недоступно'
  const rate = Number(value)
  if (rate < 0 || rate > 100) return 'Недоступно'
  return `${rate.toLocaleString('uk-UA', { maximumFractionDigits: 2 })}%`
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

const isoDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const isoDateTime = (value: unknown) => {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    return false
  }
  return !Number.isNaN(new Date(value).getTime())
}

const nonNegativeInteger = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 0

const nullablePercentage = (value: unknown) =>
  value === null
  || (Number.isFinite(value) && Number(value) >= 0 && Number(value) <= 100)

export const parseReviewMetricsResponse = (value: unknown): ReviewMetrics => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid review metrics response')
  }
  const metrics = value as Record<string, unknown>
  const dateFrom = metrics.date_from
  const dateTo = metrics.date_to
  if (
    metrics.timezone !== 'Europe/Kyiv'
    || typeof metrics.cohort_definition !== 'string'
    || ((dateFrom === null) !== (dateTo === null))
    || (dateFrom !== null && (!isoDate(dateFrom) || !isoDate(dateTo)))
  ) {
    throw new Error('Invalid review metrics cohort')
  }
  if (typeof dateFrom === 'string' && typeof dateTo === 'string') {
    const start = new Date(`${dateFrom}T00:00:00.000Z`).getTime()
    const end = new Date(`${dateTo}T00:00:00.000Z`).getTime()
    const inclusiveDays = Math.round((end - start) / 86_400_000) + 1
    if (inclusiveDays <= 0 || inclusiveDays > 366) {
      throw new Error('Invalid review metrics cohort range')
    }
  }

  const countFields = [
    'eligible_completed_visits',
    'requests_scheduled',
    'requests_sent',
    'requests_delivered',
    'submitted_reviews',
    'approved_reviews',
    'sent_and_submitted_count',
    'sent_and_opened_count',
    'opened_and_submitted_count',
    'submitted_without_sent_count',
  ]
  if (countFields.some(field => !nonNegativeInteger(metrics[field]))) {
    throw new Error('Invalid review metrics count')
  }
  if (
    metrics.review_form_opens_status !== 'available'
    && metrics.review_form_opens_status !== 'partial'
    && metrics.review_form_opens_status !== 'unavailable'
  ) {
    throw new Error('Invalid review form-open status')
  }
  if (
    (
      metrics.review_form_open_tracking_started_at === null
        ? metrics.review_form_opens_status !== 'partial'
        : !isoDateTime(metrics.review_form_open_tracking_started_at)
    )
    || (
      metrics.review_form_opens_status === 'unavailable'
        ? metrics.review_form_opens !== null
        : !nonNegativeInteger(metrics.review_form_opens)
    )
  ) {
    throw new Error('Invalid review form-open coverage')
  }

  for (const field of [
    'review_conversion_rate',
    'sent_to_open_rate',
    'opened_to_submitted_rate',
  ]) {
    if (!nullablePercentage(metrics[field])) {
      throw new Error(`Invalid review metric percentage: ${field}`)
    }
  }
  if (
    metrics.average_moderation_time_minutes !== null
    && (
      !Number.isFinite(metrics.average_moderation_time_minutes)
      || Number(metrics.average_moderation_time_minutes) < 0
    )
  ) {
    throw new Error('Invalid review moderation duration')
  }
  if (!Array.isArray(metrics.average_rating_by_master)) {
    throw new Error('Invalid review master ratings')
  }
  for (const rawRating of metrics.average_rating_by_master) {
    if (!rawRating || typeof rawRating !== 'object' || Array.isArray(rawRating)) {
      throw new Error('Invalid review master rating')
    }
    const rating = rawRating as Record<string, unknown>
    if (
      !Number.isInteger(rating.master_id)
      || Number(rating.master_id) <= 0
      || !nonNegativeInteger(rating.approved_review_count)
      || !nonNegativeInteger(rating.pending_review_count)
      || (
        rating.approved_average_rating !== null
        && (
          !Number.isFinite(rating.approved_average_rating)
          || Number(rating.approved_average_rating) < 1
          || Number(rating.approved_average_rating) > 5
        )
      )
    ) {
      throw new Error('Invalid review master rating')
    }
  }

  if (
    Number(metrics.requests_scheduled) > Number(metrics.eligible_completed_visits)
    || Number(metrics.submitted_reviews) > Number(metrics.eligible_completed_visits)
    || Number(metrics.submitted_without_sent_count) > Number(metrics.submitted_reviews)
    || Number(metrics.submitted_without_sent_count)
      !== Number(metrics.submitted_reviews) - Number(metrics.sent_and_submitted_count)
    || Number(metrics.requests_sent) > Number(metrics.requests_scheduled)
    || Number(metrics.requests_delivered) > Number(metrics.requests_sent)
    || Number(metrics.approved_reviews) > Number(metrics.submitted_reviews)
    || (
      metrics.review_form_opens !== null
      && Number(metrics.review_form_opens) > Number(metrics.requests_scheduled)
    )
    || Number(metrics.sent_and_submitted_count) > Number(metrics.requests_sent)
    || Number(metrics.sent_and_submitted_count) > Number(metrics.submitted_reviews)
    || Number(metrics.sent_and_opened_count) > Number(metrics.requests_sent)
    || (
      metrics.review_form_opens !== null
      && (
        Number(metrics.sent_and_opened_count) > Number(metrics.review_form_opens)
        || Number(metrics.opened_and_submitted_count) > Number(metrics.review_form_opens)
      )
    )
    || (
      metrics.review_form_opens === null
      && (
        Number(metrics.sent_and_opened_count) !== 0
        || Number(metrics.opened_and_submitted_count) !== 0
      )
    )
    || Number(metrics.opened_and_submitted_count) > Number(metrics.submitted_reviews)
    || (
      Number(metrics.requests_sent) === 0
        ? metrics.review_conversion_rate !== null
        : metrics.review_conversion_rate === null
    )
  ) {
    throw new Error('Inconsistent review conversion metrics')
  }

  const sent = Number(metrics.requests_sent)
  const opens = Number(metrics.review_form_opens || 0)
  const closeTo = (actual: unknown, expected: number) =>
    actual !== null && Math.abs(Number(actual) - expected) <= 0.011
  if (
    sent > 0
    && !closeTo(
      metrics.review_conversion_rate,
      Math.round(Number(metrics.sent_and_submitted_count) / sent * 10_000) / 100,
    )
  ) {
    throw new Error('Inconsistent review conversion rate')
  }
  if (metrics.review_form_opens_status === 'available') {
    if (
      (sent === 0
        ? metrics.sent_to_open_rate !== null
        : !closeTo(
            metrics.sent_to_open_rate,
            Math.round(Number(metrics.sent_and_opened_count) / sent * 10_000) / 100,
          ))
      || (opens === 0
        ? metrics.opened_to_submitted_rate !== null
        : !closeTo(
            metrics.opened_to_submitted_rate,
            Math.round(Number(metrics.opened_and_submitted_count) / opens * 10_000) / 100,
          ))
    ) {
      throw new Error('Inconsistent review open conversion rates')
    }
  }
  else if (
    metrics.sent_to_open_rate !== null
    || metrics.opened_to_submitted_rate !== null
  ) {
    throw new Error('Open conversion rates require complete tracking coverage')
  }

  return value as ReviewMetrics
}
