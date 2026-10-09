const suppressedApps = new WeakSet<object>()

export const isPersonalCapabilityKey = (key: string) =>
  /token|secret|capability|signature|authorization/i.test(key)
  || /^(code|key|sig|auth|state|otp|otp_code|session|session_id|email)$/i.test(key)

export const hasPersonalCapability = (value: string) => {
  try {
    const url = new URL(value, 'https://analytics.invalid')
    return url.pathname.startsWith('/newsletter/')
      || [...url.searchParams.keys()].some(isPersonalCapabilityKey)
      || [...new URLSearchParams(url.hash.slice(1)).keys()].some(isPersonalCapabilityKey)
  }
  catch { return true }
}

export const sanitizeAnalyticsUrl = (value: string) => {
  if (!value) return ''
  try {
    const url = new URL(value, 'https://analytics.invalid')
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return /^(https?:)?\/\//i.test(value) ? url.origin + url.pathname : url.pathname
  }
  catch { return '' }
}

// Never restart GA after URL cleanup: automatic collection could retain dl/dr.
export const suppressBlogAnalytics = (app: object, ...urls: string[]) => {
  if (urls.some(hasPersonalCapability)) suppressedApps.add(app)
  return suppressedApps.has(app)
}

export const sanitizeAnalyticsParams = (params: Record<string, string | number | boolean | null | undefined>) =>
  Object.fromEntries(Object.entries(params)
    .filter(([key, value]) => !isPersonalCapabilityKey(key) && value !== undefined && value !== '')
    .map(([key, value]) => [key, typeof value === 'string'
      && (/url|uri|location|path|refer+er|referrer/i.test(key) || /[?#]|https?:\/\//i.test(value))
      ? sanitizeAnalyticsUrl(value) : value]))
