import type { OnlinePayment, OnlinePaymentCapabilities } from '~/types/order'
import { commerceBreadcrumb, reportCommerceError } from '~/utils/commerceTelemetry'

export const safePaymentUrl = (value: string | null | undefined, receipt = false): string | null => {
  if (!value) return null
  try {
    const url = new URL(value)
    const hosts = receipt ? ['cabinet.tax.gov.ua'] : ['pay.mbnk.biz']
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) return null
    if (receipt && !url.pathname.startsWith('/cashregs/')) return null
    if (!receipt && !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) return null
    return url.href
  } catch { return null }
}

// Unlike a hosted invoice path, the provider's authenticated widget URL is opaque.
export const safePaymentEmbedUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)
    || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value) || /\s/u.test(value)
    || !value.startsWith('https://pay.mbnk.biz/') || value.includes('#')) return null
  try {
    const url = new URL(value)
    return url.origin === 'https://pay.mbnk.biz' && !url.username && !url.password && !url.port ? value : null
  } catch { return null }
}

export const useOrderPayment = (orderId: () => number, guestToken: () => string | undefined, resumeGuest = false) => {
  const api = useApi()
  const auth = useCustomerAuthStore()
  const router = useRouter()
  const persistenceReady = useState<boolean>('shop-persistence-ready', () => false)
  const payment = ref<OnlinePayment | null>(null)
  const busy = ref(false)
  const error = ref('')
  const errorKind = ref<'access' | 'conflict' | 'connection' | ''>('')
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let mounted = false
  let readFailures = 0
  let telemetryActive = false
  let removeTelemetryGuard: (() => void) | undefined
  let redirectCurrent = () => false
  const identity = () => `${orderId()}:${guestToken() || ''}:${auth.customer?.id}:${auth.sessionRevision}:${auth.accessToken}`
  const stop = () => { generation++; clearTimeout(timer); busy.value = false }
  const memoryIntents = new Map<string, string>()
  const presentationIntents = new Map<string, { key: string, presentation: 'iframe' | 'redirect' }>()
  const readStorage = (key: string) => { try { return sessionStorage.getItem(key) } catch { return null } }
  const writeStorage = (key: string, value: string) => { try { sessionStorage.setItem(key, value) } catch {} }
  const tokenKey = () => `shop-order-payment-token:${orderId()}`
  const capability = () => resumeGuest || !auth.isAuthenticated ? guestToken() || readStorage(tokenKey()) : null
  const request = async (create = false, paymentMethod?: string, presentation: 'iframe' | 'redirect' = 'redirect') => {
    const change = paymentMethod !== undefined
    if (create && (!payment.value?.enabled || payment.value.status !== 'not_started' || payment.value.paid || error.value || errorKind.value === 'access' || payment.value.actions?.start === false)) return
    if (change && (!payment.value?.actions?.change_method || payment.value.status !== 'not_started'
      || payment.value.paid || error.value || errorKind.value === 'access'
      || !['cash', 'cashOnDelivery'].includes(paymentMethod)
      || !payment.value.available_payment_methods?.includes(paymentMethod)
      || !Number.isSafeInteger(payment.value.revision) || (payment.value.revision ?? 0) < 1
      || payment.value.attempt_id !== null)) return
    if (!mounted || !persistenceReady.value || busy.value || document.hidden) return
    const current = generation
    const context = identity()
    const token = capability()
    const authenticated = auth.isAuthenticated
    const ownsRequest = () => mounted && current === generation && context === identity() && authenticated === auth.isAuthenticated
    const isCurrent = () => ownsRequest() && token === capability()
    busy.value = true; error.value = ''
    if (errorKind.value !== 'access') errorKind.value = ''
    let missingCapability = false
    const telemetryData = () => ({ flow: 'payment' as const, order_id: orderId(), attempt_id: payment.value?.attempt_id, payment_status: payment.value?.status })
    if (telemetryActive && isCurrent() && (create || change)) commerceBreadcrumb(change ? 'payment.change_method' : 'payment.start', telemetryData())
    try {
      const headers: Record<string, string> = {}
      if (!auth.isAuthenticated && !token) { missingCapability = true; errorKind.value = 'access'; throw new Error('missing capability') }
      if (token) headers['X-Order-Payment-Token'] = token
      let createBody: { presentation?: 'iframe' } = {}
      if (create || change) {
        const key = change
          ? `shop-order-payment-change:${orderId()}:${payment.value!.revision}:${payment.value!.attempt_id ?? 'none'}:${paymentMethod}`
          : `shop-order-payment-intent:${orderId()}`
        if (create) {
          let intent = presentationIntents.get(key)
          if (!intent) {
            try {
              const saved = JSON.parse(readStorage(`${key}:request`) || 'null')
              if (saved && typeof saved.key === 'string' && saved.key.length > 0
                && ['iframe', 'redirect'].includes(saved.presentation)) intent = saved
            } catch {}
          }
          if (!intent) {
            const legacy = readStorage(key) || memoryIntents.get(key)
            intent = { key: legacy || crypto.randomUUID(), presentation: legacy ? 'redirect' : presentation }
          }
          // Persist the key and body as one record before dispatch, including across reloads.
          presentationIntents.set(key, intent)
          writeStorage(`${key}:request`, JSON.stringify(intent))
          headers['Idempotency-Key'] = intent.key
          if (intent.presentation === 'iframe') createBody = { presentation: 'iframe' }
        } else headers['Idempotency-Key'] = readStorage(key) || memoryIntents.get(key) || crypto.randomUUID()
        memoryIntents.set(key, headers['Idempotency-Key'])
        writeStorage(key, headers['Idempotency-Key'])
      }
      const body = change ? { payment_method: paymentMethod, expected_revision: payment.value!.revision, expected_attempt_id: payment.value!.attempt_id } : createBody
      const result = await api<OnlinePayment>(`/public/orders/${orderId()}/online-payment${change ? '/change-method' : ''}`, { method: create || change ? 'POST' : 'GET', ...(create || change ? { body } : {}), headers, retry: 0, timeout: 15000 })
      if (isCurrent()) {
        if (!create && !change && token && token === guestToken() && result.order_id === orderId()) writeStorage(tokenKey(), token)
        readFailures = 0
        errorKind.value = ''
        const changed = payment.value?.status !== result.status || payment.value?.attempt_id !== result.attempt_id
        payment.value = result
        const snapshot = payment.value
        // Only an accepted response from this mounted route may produce new signals.
        redirectCurrent = () => telemetryActive && isCurrent() && payment.value === snapshot && !error.value
          && result.order_id === orderId() && !result.paid && result.status === 'waiting'
          && result.actions?.continue_payment !== false && Boolean(safePaymentUrl(result.page_url))
        if (telemetryActive && isCurrent()) {
          if (changed || create || change) commerceBreadcrumb('payment.status', telemetryData())
          if (result.order_id === orderId() && !result.paid && result.status === 'waiting'
            && result.actions?.continue_payment !== false && !safePaymentUrl(result.page_url)) {
            reportCommerceError('payment.invalid_provider_url', new Error('Invalid payment provider URL'), telemetryData())
          }
        }
        return result
      }
    } catch (cause) {
      if (isCurrent()) {
        const failure = cause as { statusCode?: number, status?: number, response?: { status?: number } }
        const status = Number(failure?.statusCode || failure?.status || failure?.response?.status)
        errorKind.value = errorKind.value === 'access' || missingCapability || [401, 403, 404, 410].includes(status) ? 'access'
          : [409, 422].includes(status) ? 'conflict' : 'connection'
        if (errorKind.value === 'access') payment.value = null
        error.value = 'Не вдалося оновити оплату. Спробуйте ще раз.'
        if (!create && !change) readFailures++
        if (telemetryActive && isCurrent() && !missingCapability && !(resumeGuest && token && errorKind.value === 'access')
          && (create || change || readFailures >= 3 || [403, 404].includes(status))) {
          reportCommerceError(change ? 'payment.change_method_failed' : create ? 'payment.start_failed' : 'payment.read_failed', cause, { ...telemetryData(), failure_count: create || change ? undefined : readFailures })
        }
      }
    }
    finally {
      if (ownsRequest()) {
        busy.value = false
        clearTimeout(timer)
        if (!isCurrent()) {
          payment.value = null
          errorKind.value = 'access'
          return
        }
        const seconds = payment.value?.retry_after_seconds
        const delay = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.min(120, Math.max(5, seconds)) * 1000 : 30000
        if (!document.hidden && errorKind.value !== 'access' && payment.value?.actions?.refresh !== false && !['accepted', 'requires_review'].includes(payment.value?.status || '')) timer = setTimeout(() => { void request() }, delay)
      }
    }
  }
  const reset = () => {
    stop(); readFailures = 0; payment.value = null; error.value = ''; errorKind.value = ''
    if (mounted && persistenceReady.value) void request()
  }
  const visibility = () => { if (document.hidden) stop(); else void request() }
  watch(identity, reset, { flush: 'sync' })
  // Persisted identity must settle before the first owned read exposes payment actions.
  watch(persistenceReady, ready => { if (ready && mounted) reset() }, { flush: 'sync' })
  onMounted(() => {
    mounted = true
    telemetryActive = true
    // Retire this instance's signals on any navigation attempt, including an aborted one.
    removeTelemetryGuard = router.beforeEach(() => { telemetryActive = false })
    document.addEventListener('visibilitychange', visibility)
    reset()
  })
  onBeforeUnmount(() => { mounted = false; telemetryActive = false; removeTelemetryGuard?.(); stop(); document.removeEventListener('visibilitychange', visibility) })
  const getCapabilities = async (): Promise<OnlinePaymentCapabilities | null | undefined> => {
    if (!mounted || !persistenceReady.value) return undefined
    const current = generation, context = identity(), token = capability(), authenticated = auth.isAuthenticated
    const isCurrent = () => mounted && current === generation && context === identity()
      && token === capability() && authenticated === auth.isAuthenticated
    try {
      const result = await api<OnlinePaymentCapabilities>('/public/orders/online-payment-capabilities', { retry: 0, timeout: 5000 })
      return isCurrent() ? result : undefined
    } catch { return isCurrent() ? null : undefined }
  }
  return {
    getCapabilities, hasGuestCapability: () => Boolean(capability()),
    payment, busy, error, errorKind, refresh: () => request(), create: (presentation: 'iframe' | 'redirect' = 'redirect') => request(true, undefined, presentation),
    changeMethod: (method: string) => request(false, method),
    recordRedirect: () => { if (redirectCurrent()) commerceBreadcrumb('payment.redirect', { flow: 'payment', order_id: orderId(), attempt_id: payment.value?.attempt_id, payment_status: payment.value?.status }) },
    redirectFailed: (cause: unknown) => { if (redirectCurrent()) reportCommerceError('payment.redirect_failed', cause, { flow: 'payment', order_id: orderId() }) },
  }
}
