import { safeRequestBody, requestCooldown, sanitizeInput } from '~/utils/inputSafety'

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
  const nextAllowed = useState<Record<string, number>>('shop-input-request-cooldowns', () => ({}))

  return $fetch.create({
    baseURL: import.meta.server ? config.apiBase : config.public.apiBase,
    onRequest({ request, options }) {
      const path = String(request).split('?')[0] || ''
      const method = String(options.method || 'GET').toUpperCase()
      // Checkout validates before persisting its intent; retries keep that exact body.
      if (options.body && !(path === '/public/orders' && method === 'POST')) {
        options.body = safeRequestBody(path, method, options.body) as typeof options.body
      }
      if (options.query && (/^\/public\/delivery\/np\//.test(path) || path === '/public/products/search' || path.endsWith('/products'))) {
        options.query = { ...options.query }
        if ('q' in options.query) options.query.q = sanitizeInput(options.query.q, 'search').trim()
        if ('search' in options.query) options.query.search = sanitizeInput(options.query.search, 'search').trim()
      }
      const cooldown = requestCooldown(path, method)
      if (import.meta.client && cooldown) {
        const key = `${method}:${path}`
        if ((nextAllowed.value[key] || 0) > Date.now()) throw new Error('Зачекайте перед повторним надсиланням.')
        nextAllowed.value[key] = Date.now() + cooldown
        options.retry = 0
      }
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
