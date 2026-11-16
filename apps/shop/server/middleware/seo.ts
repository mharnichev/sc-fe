import { shopIndexableUrl } from '../../utils/shopSeo'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const request = getRequestURL(event)
  const base = config.app.baseURL.replace(/\/+$/, '')
  const path = base && (request.pathname === base || request.pathname.startsWith(base + '/'))
    ? request.pathname.slice(base.length) || '/'
    : request.pathname

  if (request.host !== new URL(config.public.siteUrl).host
    || (path !== '/robots.txt' && path !== '/sitemap.xml'
      && !shopIndexableUrl(config.public.siteUrl, config.app.baseURL, path, request.searchParams))) {
    setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  }
})
