/** Deliberately bounded commerce telemetry. Never pass request bodies or capabilities. */
export type CommerceFlow = 'checkout' | 'payment' | 'auth' | 'cart'
const commerceFlows: readonly CommerceFlow[] = ['checkout', 'payment', 'auth', 'cart']
export const isCommerceFlow = (value: unknown): value is CommerceFlow => commerceFlows.includes(value as CommerceFlow)
export interface CommerceData {
  flow?: CommerceFlow
  order_id?: number
  attempt_id?: number | string | null
  payment_method?: string
  payment_status?: string
  http_status?: number
  failure_count?: number
}
export interface CommerceSignal {
  step: string
  data: CommerceData
  error?: Error
}
type Sink = (signal: CommerceSignal) => void
let sink: Sink | undefined
let recent: number[] = []
// Hard ceiling per page load, kept across account switches, so one broken tab cannot drain the quota.
const pageBudget = 10
let pageReports = 0
const duplicates = new Map<string, number>()
export const configureCommerceTelemetry = (next?: Sink) => { sink = next; recent = []; duplicates.clear() }
export const safeCommerceLabel = (value: unknown) => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_.]{0,63}$/.test(value) ? value : undefined
export const safeCommerceData = (input: CommerceData = {}): CommerceData => {
  const data: CommerceData = {}
  if (isCommerceFlow(input.flow)) data.flow = input.flow
  for (const key of ['order_id', 'http_status', 'failure_count'] as const) {
    const value = input[key]
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) data[key] = value
  }
  if (typeof input.attempt_id === 'number' && Number.isSafeInteger(input.attempt_id) && input.attempt_id > 0) data.attempt_id = input.attempt_id
  for (const key of ['payment_method', 'payment_status'] as const) {
    const value = safeCommerceLabel(input[key])
    if (value) data[key] = value
  }
  return data
}
export const commerceHttpStatus = (cause: unknown): number => {
  if (!cause || typeof cause !== 'object') return 0
  const value = cause as { statusCode?: unknown, status?: unknown, response?: { status?: unknown } }
  return Number(value.statusCode || value.status || value.response?.status) || 0
}
// OTP send/attempt limits and phone-change conflicts (same or taken number) are shopper outcomes.
const expectedFlowStatuses: Partial<Record<CommerceFlow, number[]>> = { auth: [409, 429] }
export const isExpectedCommerceError = (cause: unknown, flow?: CommerceFlow) => {
  const status = commerceHttpStatus(cause)
  // Validation, expired login and expired capabilities are expected. Endpoint/
  // permission regressions (403/404/405) and unknown conflicts must stay visible.
  return [400, 401, 410, 422, ...(flow ? expectedFlowStatuses[flow] || [] : [])].includes(status)
}
// Login and cart are retried freely by shoppers, so only real defects are worth quota there:
// an unexpected backend answer or a programming error. Client-side validation and cooldown
// rejections, offline/aborted requests and gateway outages (seen by uptime checks for every
// visitor at once) stay silent.
const programmingErrors = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError']
const isShopperNoise = (cause: unknown, flow?: CommerceFlow) => {
  if (flow !== 'auth' && flow !== 'cart') return false
  const status = commerceHttpStatus(cause)
  if (status) return [502, 503, 504].includes(status)
  const value = cause as { name?: unknown, message?: unknown } | null
  return !programmingErrors.includes(String(value?.name))
    || /failed to fetch|networkerror|load failed|<no response>/i.test(String(value?.message || ''))
}
export const commerceBreadcrumb = (step: string, input: CommerceData = {}) => {
  try { if (sink && safeCommerceLabel(step)) sink({ step, data: safeCommerceData(input) }) } catch { /* Telemetry must never affect a purchase. */ }
}
export const reportCommerceError = (step: string, cause: unknown, input: CommerceData = {}) => {
  try {
    const flow = isCommerceFlow(input.flow) ? input.flow : undefined
    if (!sink || !safeCommerceLabel(step) || isExpectedCommerceError(cause, flow) || isShopperNoise(cause, flow)) return
    const data = safeCommerceData({ ...input, http_status: commerceHttpStatus(cause) || input.http_status })
    const now = Date.now()
    for (const [key, timestamp] of duplicates) if (now - timestamp >= 300_000) duplicates.delete(key)
    recent = recent.filter(timestamp => now - timestamp < 60_000)
    const key = `${data.flow}:${step}:${data.order_id || ''}:${data.attempt_id || ''}:${data.http_status || ''}`
    if (duplicates.has(key) || recent.length >= 5 || pageReports >= pageBudget) return
    duplicates.set(key, now); recent.push(now); pageReports++
    // FetchError messages may contain URLs, tokens, response bodies or contact data.
    // Preserve only stack locations; the SDK boundary scrubs them before transport.
    const error = new Error(`Commerce failure: ${step}`)
    if (cause instanceof Error && cause.stack) error.stack = `${error.name}: ${error.message}\n${cause.stack.split('\n').slice(1).join('\n')}`
    sink({ step, data, error })
  } catch { /* Never block checkout, including when the SDK itself fails. */ }
}
