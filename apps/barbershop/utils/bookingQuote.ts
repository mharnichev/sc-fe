export interface BookingQuoteRequest {
  master_id: number
  service_ids: number[]
  start_at: string
  customer_phone: string
  promotion_code: string | null
}

export interface BookingQuote {
  subtotal_amount: number
  discount_amount: number
  total_amount: number
  applied_promotion: {
    id: number
    code: string | null
    name_uk: string
    name_en: string
    discount_percent: number
    application_mode: 'code' | 'automatic'
    eligibility_type: string
  } | null
  eligibility: { status: 'applied' | 'customer_required' | 'not_available', explanation: string }
}

export interface QuoteReviewState {
  quote: BookingQuote | null
  pending: boolean
  failed: boolean
  accepted: boolean
  changed: boolean
}

const priceIdentity = (quote: BookingQuote) => JSON.stringify([
  quote.subtotal_amount, quote.discount_amount, quote.total_amount,
  quote.applied_promotion, quote.eligibility.status,
])

// Reject malformed or contradictory responses instead of presenting a confirmed price.
export const isBookingQuote = (value: BookingQuote): boolean => {
  if (!value || ![value.subtotal_amount, value.discount_amount, value.total_amount]
    .every(amount => Number.isSafeInteger(amount) && amount >= 0)) return false
  if (value.subtotal_amount - value.discount_amount !== value.total_amount) return false
  if (!['applied', 'customer_required', 'not_available'].includes(value.eligibility?.status)) return false
  const promotion = value.applied_promotion
  if (value.eligibility.status === 'applied') {
    return Boolean(promotion && Number.isInteger(promotion.discount_percent)
      && promotion.discount_percent > 0 && promotion.discount_percent <= 100)
  }
  return !promotion && value.discount_amount === 0
}

// Request generations prevent a late response from approving a different customer/master/slot.
export const createBookingQuoteReview = (
  request: (payload: BookingQuoteRequest) => Promise<BookingQuote>,
  publish: (state: QuoteReviewState) => void,
) => {
  let generation = 0
  let state: QuoteReviewState = { quote: null, pending: false, failed: false, accepted: false, changed: false }
  const update = (patch: Partial<QuoteReviewState>) => {
    state = { ...state, ...patch }
    publish(state)
  }
  const invalidate = () => {
    generation += 1
    update({ quote: null, pending: false, failed: false, accepted: false, changed: false })
  }
  const accept = (accepted: boolean) => update({
    accepted: accepted && Boolean(state.quote && !state.pending && !state.failed
      && state.quote.eligibility.status !== 'customer_required'),
  })
  const verify = async (payload: BookingQuoteRequest): Promise<boolean> => {
    const current = ++generation
    const previous = state.quote
    update({ pending: true, failed: false })
    try {
      const quote = await request({ ...payload, service_ids: [...payload.service_ids] })
      if (current !== generation) return false
      if (!isBookingQuote(quote)) throw new Error('Invalid booking quote')
      const changed = Boolean(previous && priceIdentity(previous) !== priceIdentity(quote))
      update({ quote, pending: false, changed: state.changed || changed,
        accepted: state.accepted && !changed && quote.eligibility.status !== 'customer_required' })
      return state.accepted
    }
    catch {
      if (current === generation) update({ quote: null, pending: false, failed: true, accepted: false })
      return false
    }
  }
  const approvedTotal = (): number | null => state.accepted && !state.pending && !state.failed
    ? state.quote?.total_amount ?? null : null
  return { invalidate, accept, verify, approvedTotal }
}

export const isPromotionConflict = (error: unknown): boolean => {
  const detail = (error as { data?: { detail?: { code?: string } } })?.data?.detail
  return Boolean(detail?.code && [
    'entitlement_reserved', 'not_eligible', 'promotion_no_longer_applicable',
    'promotion_unavailable', 'customer_required', 'price_changed',
  ].includes(detail.code))
}
