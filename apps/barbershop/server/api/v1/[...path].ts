import { appendResponseHeader, splitCookiesString } from 'h3'

const publicApiPrefix = 'public/'
const customerActivityCookieName = 'sc_customer_activity'
const reviewTokenHeaderPaths = new Set([
  'public/reviews/request',
  'public/reviews/request/open',
])
const repeatBookingTokenHeaderPaths = new Set([
  'public/repeat-booking/context',
  'public/repeat-booking/start',
  'public/bookings',
])
const isCustomerActivityPath = (path: string) =>
  path === 'public/customer-activity' || path.startsWith('public/customer-activity/')
const canSetCustomerActivitySession = (path: string) =>
  path === 'public/bookings' || isCustomerActivityPath(path)

const normalizeUpstreamBase = (value: string) => value.replace(/\/+$/, '')

export default defineEventHandler(async (event) => {
  const path = event.context.params?.path || ''
  const pathSegments = Array.isArray(path) ? path : [path]
  const apiPath = pathSegments.filter(Boolean).join('/')

  if (!apiPath.startsWith(publicApiPrefix) || apiPath.includes('..')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'API route not found',
    })
  }

  const config = useRuntimeConfig()
  const upstreamUrl = new URL(`${normalizeUpstreamBase(config.apiUpstreamBase)}/${apiPath}`)
  upstreamUrl.search = getRequestURL(event).search

  const method = getMethod(event)
  const requestHeaders = new Headers()
  const contentType = getHeader(event, 'content-type')
  const accept = getHeader(event, 'accept')
  const reviewToken = reviewTokenHeaderPaths.has(apiPath)
    ? getHeader(event, 'x-review-token')
    : undefined
  const repeatBookingToken = repeatBookingTokenHeaderPaths.has(apiPath)
    ? getHeader(event, 'x-repeat-booking-token')
    : undefined
  const customerActivityToken = isCustomerActivityPath(apiPath)
    ? getHeader(event, 'x-customer-activity-token')
    : undefined
  const customerActivityCookie = isCustomerActivityPath(apiPath)
    ? getHeader(event, 'cookie')
    : undefined

  if (contentType) requestHeaders.set('content-type', contentType)
  if (accept) requestHeaders.set('accept', accept)
  if (reviewToken) requestHeaders.set('x-review-token', reviewToken)
  if (repeatBookingToken) requestHeaders.set('x-repeat-booking-token', repeatBookingToken)
  if (customerActivityToken) requestHeaders.set('x-customer-activity-token', customerActivityToken)
  if (customerActivityCookie) requestHeaders.set('cookie', customerActivityCookie)

  const response = await $fetch.raw(upstreamUrl.toString(), {
    method,
    body: method === 'GET' || method === 'HEAD' ? undefined : await readRawBody(event),
    headers: requestHeaders,
    ignoreResponseError: true,
    retry: 0,
  })

  setResponseStatus(event, response.status)

  const responseContentType = response.headers.get('content-type')
  const cacheControl = response.headers.get('cache-control')
  const etag = response.headers.get('etag')
  const setCookieHeaders = canSetCustomerActivitySession(apiPath)
    ? ((response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
        || splitCookiesString(response.headers.get('set-cookie') || ''))
    : []
  const browserSessionWasSet = apiPath === 'public/bookings'
    && setCookieHeaders.some(cookie => cookie.trimStart().startsWith(`${customerActivityCookieName}=`))

  if (responseContentType) setHeader(event, 'content-type', responseContentType)
  if (cacheControl) setHeader(event, 'cache-control', cacheControl)
  if (etag) setHeader(event, 'etag', etag)
  for (const setCookie of setCookieHeaders) {
    appendResponseHeader(event, 'set-cookie', setCookie)
  }
  if (browserSessionWasSet) {
    // This exposes only the fact that the HttpOnly session was set, never its value.
    setHeader(event, 'x-customer-activity-session', 'set')
  }
  if (isCustomerActivityPath(apiPath)) {
    setHeader(event, 'cache-control', 'no-store, private')
    setHeader(event, 'pragma', 'no-cache')
    setHeader(event, 'vary', 'Cookie, X-Customer-Activity-Token')
  }
  if (apiPath.startsWith('public/repeat-booking/')) {
    setHeader(event, 'cache-control', 'no-store, private')
    setHeader(event, 'pragma', 'no-cache')
    setHeader(event, 'vary', 'X-Repeat-Booking-Token')
  }

  return response._data
})
