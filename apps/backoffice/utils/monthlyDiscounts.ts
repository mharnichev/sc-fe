export type MonthlyDiscountWarning =
  | 'missing_pricing_snapshot'
  | 'invalid_pricing_snapshot'
  | 'discount_exceeds_subtotal'
  | 'snapshot_total_mismatch'

export interface MonthlyDiscountItem {
  booking_id: number
  start_at: string
  completed_at: string | null
  customer_id: number | null
  customer_name: string
  customer_phone: string
  master_id: number
  master_name: string | null
  subtotal_amount: string | null
  promotion_discount_amount: string | null
  manual_discount_amount: string | null
  discount_amount: string | null
  total_amount: string | null
  promotion_id: number | null
  promotion_code: string | null
  promotion_name_uk: string | null
  promotion_name_en: string | null
  promotion_discount_percent: number | null
  promotion_application_mode_snapshot: string | null
  promotion_eligibility_type_snapshot: string | null
  campaign_offer_id: number | null
  amount_status: 'known' | 'unknown' | 'invalid'
  warnings: MonthlyDiscountWarning[]
}

export interface MonthlyDiscountsResponse {
  period: { year: number, month: number, timezone: 'Europe/Kyiv', time_basis: 'start_at' }
  scope: 'booking_services'
  historical_completeness: 'not_verifiable'
  generated_at: string
  summary: {
    completed_bookings: number
    discounted_bookings: number
    unknown_discount_bookings: number
    invalid_discount_bookings: number
    known_discount_amount: string
  }
  items: MonthlyDiscountItem[]
  total: number
  offset: number
  limit: number
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid monthly discounts response')
  return value as Record<string, unknown>
}
const integer = (value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
const money = (value: unknown) => typeof value === 'string' && /^-?\d+\.\d{2}$/.test(value)
const dateTime = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))

export const parseMonthlyDiscountsResponse = (value: unknown): MonthlyDiscountsResponse => {
  const response = record(value)
  const period = record(response.period)
  const summary = record(response.summary)
  if (
    response.scope !== 'booking_services'
    || response.historical_completeness !== 'not_verifiable'
    || period.timezone !== 'Europe/Kyiv'
    || period.time_basis !== 'start_at'
    || !integer(period.year, 2000, 2100)
    || !integer(period.month, 1, 12)
    || !dateTime(response.generated_at)
    || !integer(response.total, 0)
    || !integer(response.offset, 0)
    || !integer(response.limit, 1, 100)
    || !Array.isArray(response.items)
    || response.items.length > Number(response.limit)
    || !money(summary.known_discount_amount)
  ) throw new TypeError('Invalid monthly discounts period or totals')

  for (const key of ['completed_bookings', 'discounted_bookings', 'unknown_discount_bookings', 'invalid_discount_bookings']) {
    if (!integer(summary[key], 0)) throw new TypeError(`Invalid monthly discounts summary: ${key}`)
  }
  if (response.total !== Number(summary.discounted_bookings) + Number(summary.unknown_discount_bookings) + Number(summary.invalid_discount_bookings)) {
    throw new TypeError('Invalid monthly discounts row count')
  }

  const warnings: MonthlyDiscountWarning[] = ['missing_pricing_snapshot', 'invalid_pricing_snapshot', 'discount_exceeds_subtotal', 'snapshot_total_mismatch']
  for (const value of response.items) {
    const item = record(value)
    if (
      !integer(item.booking_id, 1) || !integer(item.master_id, 1)
      || !dateTime(item.start_at) || (item.completed_at !== null && !dateTime(item.completed_at))
      || typeof item.customer_name !== 'string' || typeof item.customer_phone !== 'string'
      || !['known', 'unknown', 'invalid'].includes(String(item.amount_status))
      || !Array.isArray(item.warnings) || item.warnings.some(warning => !warnings.includes(warning))
    ) throw new TypeError('Invalid monthly discount item')
    for (const key of ['customer_id', 'promotion_id', 'campaign_offer_id']) {
      if (item[key] !== null && !integer(item[key], 1)) throw new TypeError(`Invalid monthly discount ${key}`)
    }
    for (const key of ['subtotal_amount', 'promotion_discount_amount', 'manual_discount_amount', 'discount_amount', 'total_amount']) {
      if (item[key] !== null && !money(item[key])) throw new TypeError(`Invalid monthly discount ${key}`)
    }
    for (const key of ['master_name', 'promotion_code', 'promotion_name_uk', 'promotion_name_en', 'promotion_application_mode_snapshot', 'promotion_eligibility_type_snapshot']) {
      if (item[key] !== null && typeof item[key] !== 'string') throw new TypeError(`Invalid monthly discount ${key}`)
    }
    if (item.promotion_discount_percent !== null && !Number.isSafeInteger(item.promotion_discount_percent)) {
      throw new TypeError('Invalid monthly discount percentage')
    }
  }
  return response as unknown as MonthlyDiscountsResponse
}
