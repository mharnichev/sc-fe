import { shopSeoUrl } from '../../utils/shopSeo'

export default defineEventHandler((event) => {
  const { app, public: { siteUrl } } = useRuntimeConfig(event)
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')

  if (getRequestURL(event).host !== new URL(siteUrl).host) return 'User-agent: *\nDisallow: /\n'
  return `User-agent: *\nAllow: /\nSitemap: ${shopSeoUrl(siteUrl, app.baseURL, '/sitemap.xml')}\n`
})
