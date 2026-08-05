export interface BookingRecoverySummary {
  timezone: 'Europe/Kyiv'
  date_from: string
  date_to: string
  no_slot_sessions: number
  alternatives_requested: number
  alternatives_returned: number
  alternative_slots_returned: number
  alternative_slots_selected: number
  bookings_after_alternative: number
  alternative_recovery_rate_percent: number | string | null
  waitlist_requests: number
  offers_sent: number
  offers_delivered: number
  offers_claimed: number
  offers_expired: number
  cancelled_slots_refilled: number
  average_cancellation_to_refill_seconds: number | null
}

const isIsoDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const isNonNegativeInteger = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 0

const isNullablePercentage = (value: unknown) => {
  if (value === null) return true
  if (typeof value !== 'number' && typeof value !== 'string') return false
  if (typeof value === 'string' && value.trim() === '') return false

  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100
}

export const parseBookingRecoverySummary = (value: unknown): BookingRecoverySummary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid booking recovery summary response')
  }

  const summary = value as Record<string, unknown>
  if (
    summary.timezone !== 'Europe/Kyiv'
    || !isIsoDate(summary.date_from)
    || !isIsoDate(summary.date_to)
    || new Date(`${summary.date_from}T00:00:00.000Z`) > new Date(`${summary.date_to}T00:00:00.000Z`)
  ) {
    throw new TypeError('Invalid booking recovery summary period')
  }

  const countFields = [
    'no_slot_sessions',
    'alternatives_requested',
    'alternatives_returned',
    'alternative_slots_returned',
    'alternative_slots_selected',
    'bookings_after_alternative',
    'waitlist_requests',
    'offers_sent',
    'offers_delivered',
    'offers_claimed',
    'offers_expired',
    'cancelled_slots_refilled',
  ]
  if (countFields.some(field => !isNonNegativeInteger(summary[field]))) {
    throw new TypeError('Invalid booking recovery summary counter')
  }
  if (!isNullablePercentage(summary.alternative_recovery_rate_percent)) {
    throw new TypeError('Invalid booking recovery summary rate')
  }
  if (
    summary.average_cancellation_to_refill_seconds !== null
    && !isNonNegativeInteger(summary.average_cancellation_to_refill_seconds)
  ) {
    throw new TypeError('Invalid booking recovery refill duration')
  }

  return summary as unknown as BookingRecoverySummary
}
