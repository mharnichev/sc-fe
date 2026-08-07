const publicApiPrefix = 'public/'
const reviewTokenHeaderPaths = new Set([
  'public/reviews/request',
  'public/reviews/request/open',
])
const isCustomerActivityPath = (path: string) =>
  path === 'public/customer-activity' || path.startsWith('public/customer-activity/')

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
  const customerActivityToken = isCustomerActivityPath(apiPath)
    ? getHeader(event, 'x-customer-activity-token')
    : undefined

  if (contentType) requestHeaders.set('content-type', contentType)
  if (accept) requestHeaders.set('accept', accept)
  if (reviewToken) requestHeaders.set('x-review-token', reviewToken)
  if (customerActivityToken) requestHeaders.set('x-customer-activity-token', customerActivityToken)

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

  if (responseContentType) setHeader(event, 'content-type', responseContentType)
  if (cacheControl) setHeader(event, 'cache-control', cacheControl)
  if (etag) setHeader(event, 'etag', etag)
  if (isCustomerActivityPath(apiPath)) {
    setHeader(event, 'cache-control', 'no-store, private')
    setHeader(event, 'pragma', 'no-cache')
    setHeader(event, 'vary', 'X-Customer-Activity-Token')
  }

  return response._data
})
