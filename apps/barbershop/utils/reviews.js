export const REVIEW_TEXT_MAX_LENGTH = 1000

const REVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/

export const reviewTokenFromHash = (hash) => {
  if (typeof hash !== 'string') return ''

  const encodedToken = hash.replace(/^#/, '')
  if (!encodedToken) return ''

  try {
    const token = decodeURIComponent(encodedToken)
    return REVIEW_TOKEN_PATTERN.test(token) ? token : ''
  }
  catch {
    return ''
  }
}

const normalizedPathname = pathname =>
  typeof pathname === 'string'
    ? pathname.replace(/\/+$/, '') || '/'
    : ''

export const isTokenizedReviewLocation = (pathname, hash) =>
  (normalizedPathname(pathname) === '/masters' || normalizedPathname(pathname) === '/review')
  && Boolean(reviewTokenFromHash(hash))

export const isValidReviewRating = rating =>
  Number.isInteger(rating) && rating >= 1 && rating <= 5

export const reviewRequestStateFromStatus = (status) => {
  if (status === 404) return 'invalid'
  if (status === 409) return 'submitted'
  if (status === 410) return 'expired'
  if (status === 422) return 'validation'
  return 'network'
}

const REVIEW_ANALYTICS_REASONS = new Set([
  'validation',
  'invalid',
  'expired',
  'submitted',
  'network',
])

/**
 * @param {{ rating?: number, hasText?: boolean, reason?: string, masterId?: number }} [values]
 * @returns {Record<string, string | number | boolean | null | undefined>}
 */
export const reviewAnalyticsPayload = ({ rating, hasText, reason, masterId } = {}) => {
  const payload = {}

  if (isValidReviewRating(rating)) payload.rating = rating
  if (typeof hasText === 'boolean') payload.has_text = hasText
  if (REVIEW_ANALYTICS_REASONS.has(reason)) payload.reason = reason
  if (Number.isInteger(masterId) && masterId > 0) payload.master_id = masterId

  return payload
}
