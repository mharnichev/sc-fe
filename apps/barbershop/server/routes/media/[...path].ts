const normalizeUpstreamOrigin = (apiBase: string) => {
  try {
    return new URL(apiBase).origin
  }
  catch {
    return 'https://api.soulcuts.com.ua'
  }
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method !== 'GET' && method !== 'HEAD') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed',
    })
  }

  const path = event.context.params?.path || ''
  const pathSegments = Array.isArray(path) ? path : [path]
  const mediaPath = pathSegments.filter(Boolean).join('/')

  if (!mediaPath || mediaPath.includes('..')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Media not found',
    })
  }

  const config = useRuntimeConfig()
  const upstreamUrl = new URL(`/media/${mediaPath}`, normalizeUpstreamOrigin(config.apiUpstreamBase))
  upstreamUrl.search = getRequestURL(event).search

  const response = await $fetch.raw(upstreamUrl.toString(), {
    method,
    ignoreResponseError: true,
    retry: 0,
  })

  setResponseStatus(event, response.status)

  const contentType = response.headers.get('content-type')
  const cacheControl = response.headers.get('cache-control')
  const etag = response.headers.get('etag')

  if (contentType) setHeader(event, 'content-type', contentType)
  if (cacheControl) setHeader(event, 'cache-control', cacheControl)
  if (etag) setHeader(event, 'etag', etag)

  return response._data
})
