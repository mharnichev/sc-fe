const CUSTOMER_ACTIVITY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/

/** Reads an opaque magic token from an SMS fragment, never from a query. */
export const customerActivityTokenFromHash = (hash: string) => {
  const encodedToken = hash.replace(/^#/, '')
  if (!encodedToken) return ''

  try {
    const token = decodeURIComponent(encodedToken)
    return CUSTOMER_ACTIVITY_TOKEN_PATTERN.test(token) ? token : ''
  }
  catch {
    return ''
  }
}

export const customerActivityStateFromStatus = (status: number) =>
  status === 401 || status === 404 || status === 410 ? 'expired' : 'error'
