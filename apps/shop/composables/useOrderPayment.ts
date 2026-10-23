import type { OnlinePayment } from '~/types/order'
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

export const useOrderPayment = (orderId: () => number, guestToken: () => string | undefined) => {
  const api = useApi()
  const auth = useCustomerAuthStore()
  const payment = ref<OnlinePayment | null>(null)
  const busy = ref(false)
  const error = ref('')
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let mounted = false
  let readFailures = 0
  const identity = () => `${orderId()}:${guestToken() || ''}:${auth.customer?.id}:${auth.sessionRevision}:${auth.accessToken}`
  const stop = () => { generation++; clearTimeout(timer); busy.value = false }
  const memoryIntents = new Map<string, string>()
  const readStorage = (key: string) => { try { return sessionStorage.getItem(key) } catch { return null } }
  const writeStorage = (key: string, value: string) => { try { sessionStorage.setItem(key, value) } catch {} }
  const tokenKey = () => `shop-order-payment-token:${orderId()}`
  const request = async (create = false) => {
    if (!mounted || busy.value || document.hidden) return
    const current = generation
    const context = identity()
    const isCurrent = () => mounted && current === generation && context === identity()
    busy.value = true; error.value = ''
    let missingCapability = false
    const telemetryData = () => ({ flow: 'payment' as const, order_id: orderId(), payment_status: payment.value?.status })
    if (create) commerceBreadcrumb('payment.start', telemetryData())
    try {
      const headers: Record<string, string> = {}
      const token = guestToken() || (!auth.isAuthenticated ? readStorage(tokenKey()) : null)
      if (!auth.isAuthenticated && !token) { missingCapability = true; throw new Error('missing capability') }
      if (token && !auth.isAuthenticated) headers['X-Order-Payment-Token'] = token
      if (create) {
        const key = `shop-order-payment-intent:${orderId()}`
        headers['Idempotency-Key'] = readStorage(key) || memoryIntents.get(key) || crypto.randomUUID()
        memoryIntents.set(key, headers['Idempotency-Key'])
        writeStorage(key, headers['Idempotency-Key'])
      }
      const result = await api<OnlinePayment>(`/public/orders/${orderId()}/online-payment`, { method: create ? 'POST' : 'GET', ...(create ? { body: {} } : {}), headers, retry: 0 })
      if (isCurrent()) {
        readFailures = 0
        const changed = payment.value?.status !== result.status
        payment.value = result
        if (changed || create) commerceBreadcrumb('payment.status', telemetryData())
      }
    } catch (cause) {
      if (isCurrent()) {
        error.value = 'Не вдалося оновити оплату. Спробуйте ще раз.'
        if (!create) readFailures++
        if (!missingCapability && (create || readFailures >= 3)) {
          reportCommerceError(create ? 'payment.start_failed' : 'payment.read_failed', cause, { ...telemetryData(), failure_count: create ? undefined : readFailures })
        }
      }
    }
    finally {
      if (isCurrent()) {
        busy.value = false
        clearTimeout(timer)
        if (!document.hidden && !['accepted', 'requires_review'].includes(payment.value?.status || '')) timer = setTimeout(() => { void request() }, 30000)
      }
    }
  }
  const reset = () => {
    stop(); readFailures = 0; payment.value = null; error.value = ''
    if (mounted) {
      if (guestToken() && !auth.isAuthenticated) writeStorage(tokenKey(), guestToken()!)
      void request()
    }
  }
  const visibility = () => { if (document.hidden) stop(); else void request() }
  watch(identity, reset, { flush: 'sync' })
  onMounted(() => { mounted = true; document.addEventListener('visibilitychange', visibility); reset() })
  onBeforeUnmount(() => { mounted = false; stop(); document.removeEventListener('visibilitychange', visibility) })
  return { payment, busy, error, refresh: () => request(), create: () => request(true) }
}
