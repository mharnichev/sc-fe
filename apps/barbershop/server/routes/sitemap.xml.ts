import type {
  PublicMasterDto,
  PublicServiceCatalogItemDto,
  PublicServiceDto,
} from '../../utils/seoRoutes'
import {
  indexablePublicMasters,
  indexableServiceCatalog,
  latestIsoTimestamp,
  masterSeoPath,
  serviceSeoPath,
  serviceStableId,
} from '../../utils/seoRoutes'
import {
  createSitemapCache,
  SITEMAP_FRESH_MS,
  SITEMAP_UPSTREAM_TIMEOUT_MS,
} from '../utils/sitemapCache'

type SitemapRoute = {
  changefreq: 'weekly' | 'monthly' | 'yearly'
  lastmod?: string
  loc: string
  priority: string
}

const staticRoutes: SitemapRoute[] = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/znyzhka-dlia-zsu', priority: '0.8', changefreq: 'monthly' },
  { loc: '/barbershop-odesa', priority: '0.9', changefreq: 'monthly' },
  { loc: '/services', priority: '0.8', changefreq: 'weekly' },
  { loc: '/masters', priority: '0.8', changefreq: 'weekly' },
  { loc: '/contacts', priority: '0.8', changefreq: 'monthly' },
  { loc: '/about', priority: '0.6', changefreq: 'monthly' },
  { loc: '/blog-faq', priority: '0.6', changefreq: 'monthly' },
  { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
]

const xmlEscape = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const activeServiceRow = (service: PublicServiceDto) =>
  service.is_active ?? service.status?.toLowerCase() !== 'inactive'

const apiUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

const sitemapCache = createSitemapCache()

const normalizedSiteUrl = (value: string) => {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Invalid sitemap site URL')
  }
  return url.origin
}

const routeXml = (siteUrl: string, route: SitemapRoute) => [
  '  <url>',
  `    <loc>${xmlEscape(`${siteUrl}${route.loc}`)}</loc>`,
  route.lastmod ? `    <lastmod>${xmlEscape(route.lastmod)}</lastmod>` : '',
  `    <changefreq>${route.changefreq}</changefreq>`,
  `    <priority>${route.priority}</priority>`,
  '  </url>',
].filter(Boolean).join('\n')

const buildSitemap = async (siteUrl: string, upstreamBase: string) => {
  let catalog: PublicServiceCatalogItemDto[]
  let masters: PublicMasterDto[]
  let services: PublicServiceDto[]

  [catalog, masters, services] = await Promise.all([
    $fetch<PublicServiceCatalogItemDto[]>(apiUrl(upstreamBase, '/public/service-catalog'), { retry: 0, timeout: SITEMAP_UPSTREAM_TIMEOUT_MS }),
    $fetch<PublicMasterDto[]>(apiUrl(upstreamBase, '/public/masters'), { retry: 0, timeout: SITEMAP_UPSTREAM_TIMEOUT_MS }),
    $fetch<PublicServiceDto[]>(apiUrl(upstreamBase, '/public/services'), { retry: 0, timeout: SITEMAP_UPSTREAM_TIMEOUT_MS }),
  ])
  if (!Array.isArray(catalog) || !Array.isArray(masters) || !Array.isArray(services)) {
    throw new Error('Invalid public catalogue response')
  }

  const activeServiceRows = services.filter(activeServiceRow)
  const serviceRoutes: SitemapRoute[] = indexableServiceCatalog(catalog).map((service) => {
    const baseServiceId = serviceStableId(service)
    const lastmod = latestIsoTimestamp(
      activeServiceRows
        .filter(row => row.base_service_id === baseServiceId)
        .map(row => row.updated_at),
    )

    return {
      loc: serviceSeoPath(service),
      priority: '0.8',
      changefreq: 'weekly',
      lastmod,
    }
  })
  const masterRoutes: SitemapRoute[] = indexablePublicMasters(masters).map((master) => ({
    loc: masterSeoPath(master),
    priority: '0.7',
    changefreq: 'weekly',
    lastmod: latestIsoTimestamp([
      master.updated_at,
      ...(master.services || [])
        .filter(activeServiceRow)
        .map(service => service.updated_at),
    ]),
  }))
  const routes = [...staticRoutes, ...serviceRoutes, ...masterRoutes]
    .filter((route, index, allRoutes) =>
      (staticRoutes.includes(route) || /^\/(?:services|masters)\/[a-z0-9-]+$/.test(route.loc))
      && allRoutes.findIndex(candidate => candidate.loc === route.loc) === index,
    )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    routes.map(route => routeXml(siteUrl, route)).join('\n'),
    '</urlset>',
    '',
  ].join('\n')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  let result
  try {
    const siteUrl = normalizedSiteUrl(String(config.public.siteUrl || ''))
    const upstreamBase = String(config.apiUpstreamBase || '').replace(/\/+$/, '')
    if (!upstreamBase) throw new Error('Missing sitemap upstream')
    result = await sitemapCache(JSON.stringify([siteUrl, upstreamBase]), () => buildSitemap(siteUrl, upstreamBase))
  }
  catch (error) {
    console.error('[sitemap] No usable public catalogue snapshot', error)
    throw createError({ statusCode: 502, statusMessage: 'Unable to build sitemap from the public catalogue' })
  }

  if (result.freshness === 'stale') {
    console.error('[sitemap] Serving last-known-good public catalogue', result.error)
    setHeader(event, 'x-sitemap-error', 'upstream-unavailable')
  }
  const ageMs = Math.max(0, Date.now() - result.fetchedAt)
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', result.freshness === 'fresh'
    ? `public, max-age=${Math.max(0, Math.floor((SITEMAP_FRESH_MS - ageMs) / 1000))}, stale-while-revalidate=3600`
    : 'no-store')
  setHeader(event, 'x-sitemap-freshness', result.freshness)
  setHeader(event, 'x-sitemap-age-seconds', String(Math.floor(ageMs / 1000)))
  setHeader(event, 'x-sitemap-last-success', new Date(result.fetchedAt).toISOString())

  return result.xml
})
