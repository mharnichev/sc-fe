const VISITOR_ID_STORAGE_KEY = 'shop-visitor-id'

const createVisitorId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()

  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const getVisitorId = () => {
  if (!import.meta.client) return ''

  try {
    const storedVisitorId = localStorage.getItem(VISITOR_ID_STORAGE_KEY)
    if (storedVisitorId) return storedVisitorId

    const visitorId = createVisitorId()
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId)
    return visitorId
  }
  catch {
    return ''
  }
}

export const useApi = () => {
  const config = useRuntimeConfig()
  const customerAuth = useCustomerAuthStore()

  return $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      const headers = new Headers(options.headers)
      const visitorId = getVisitorId()

      if (visitorId) headers.set('X-Visitor-ID', visitorId)
      if (customerAuth.accessToken) {
        headers.set('Authorization', `${customerAuth.tokenType || 'Bearer'} ${customerAuth.accessToken}`)
      }
      options.headers = headers
    },
  })
}
