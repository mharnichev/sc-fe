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
  const errorKind = ref<'access' | 'conflict' | 'connection' | ''>('')
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
  const capability = () => guestToken() || (!auth.isAuthenticated ? readStorage(tokenKey()) : null)
  const request = async (create = false, paymentMethod?: string) => {
    const change = paymentMethod !== undefined
    if (create && (!payment.value?.enabled || payment.value.status !== 'not_started' || payment.value.paid || error.value || errorKind.value === 'access' || payment.value.actions?.start === false)) return
    if (change && (!payment.value?.actions?.change_method || payment.value.status !== 'not_started'
      || payment.value.paid || error.value || errorKind.value === 'access'
      || !['cash', 'cashOnDelivery'].includes(paymentMethod)
      || !payment.value.available_payment_methods?.includes(paymentMethod)
      || !Number.isSafeInteger(payment.value.revision) || (payment.value.revision ?? 0) < 1
      || payment.value.attempt_id !== null)) return
    if (!mounted || busy.value || document.hidden) return
    const current = generation
    const context = identity()
    const token = capability()
    const authenticated = auth.isAuthenticated
    const ownsRequest = () => mounted && current === generation && context === identity() && authenticated === auth.isAuthenticated
    const isCurrent = () => ownsRequest() && token === capability()
    busy.value = true; error.value = ''
    if (errorKind.value !== 'access') errorKind.value = ''
    let missingCapability = false
    const telemetryData = () => ({ flow: 'payment' as const, order_id: orderId(), payment_status: payment.value?.status })
    if (create || change) commerceBreadcrumb(change ? 'payment.change_method' : 'payment.start', telemetryData())
    try {
      const headers: Record<string, string> = {}
      if (!auth.isAuthenticated && !token) { missingCapability = true; errorKind.value = 'access'; throw new Error('missing capability') }
      if (token && !auth.isAuthenticated) headers['X-Order-Payment-Token'] = token
      if (create || change) {
        const key = change
          ? `shop-order-payment-change:${orderId()}:${payment.value!.revision}:${payment.value!.attempt_id ?? 'none'}:${paymentMethod}`
          : `shop-order-payment-intent:${orderId()}`
        headers['Idempotency-Key'] = readStorage(key) || memoryIntents.get(key) || crypto.randomUUID()
        memoryIntents.set(key, headers['Idempotency-Key'])
        writeStorage(key, headers['Idempotency-Key'])
      }
      const body = change ? { payment_method: paymentMethod, expected_revision: payment.value!.revision, expected_attempt_id: payment.value!.attempt_id } : {}
      const result = await api<OnlinePayment>(`/public/orders/${orderId()}/online-payment${change ? '/change-method' : ''}`, { method: create || change ? 'POST' : 'GET', ...(create || change ? { body } : {}), headers, retry: 0, timeout: 15000 })
      if (isCurrent()) {
        readFailures = 0
        errorKind.value = ''
        const changed = payment.value?.status !== result.status
        payment.value = result
        if (changed || create || change) commerceBreadcrumb('payment.status', telemetryData())
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
        if (!missingCapability && (create || change || readFailures >= 3 || [403, 404].includes(status))) {
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
    if (mounted) {
      if (guestToken() && !auth.isAuthenticated) writeStorage(tokenKey(), guestToken()!)
      void request()
    }
  }
  const visibility = () => { if (document.hidden) stop(); else void request() }
  watch(identity, reset, { flush: 'sync' })
  onMounted(() => { mounted = true; document.addEventListener('visibilitychange', visibility); reset() })
  onBeforeUnmount(() => { mounted = false; stop(); document.removeEventListener('visibilitychange', visibility) })
  return {
    payment, busy, error, errorKind, refresh: () => request(), create: () => request(true),
    changeMethod: (method: string) => request(false, method),
    redirectFailed: (cause: unknown) => reportCommerceError('payment.redirect_failed', cause, { flow: 'payment', order_id: orderId() }),
  }
}
