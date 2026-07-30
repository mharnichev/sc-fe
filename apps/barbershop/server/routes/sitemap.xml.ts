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

type SitemapRoute = {
  changefreq: 'weekly' | 'monthly' | 'yearly'
  lastmod?: string
  loc: string
  priority: string
}

const staticRoutes: SitemapRoute[] = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const activeServiceRow = (service: PublicServiceDto) =>
  service.is_active ?? service.status?.toLowerCase() !== 'inactive'

const apiUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

const routeXml = (siteUrl: string, route: SitemapRoute) => [
  '  <url>',
  `    <loc>${xmlEscape(`${siteUrl}${route.loc}`)}</loc>`,
  route.lastmod ? `    <lastmod>${xmlEscape(route.lastmod)}</lastmod>` : '',
  `    <changefreq>${route.changefreq}</changefreq>`,
  `    <priority>${route.priority}</priority>`,
  '  </url>',
].filter(Boolean).join('\n')

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl || '').replace(/\/+$/, '')
  const upstreamBase = String(config.apiUpstreamBase || '').replace(/\/+$/, '')

  let catalog: PublicServiceCatalogItemDto[]
  let masters: PublicMasterDto[]
  let services: PublicServiceDto[]

  try {
    [catalog, masters, services] = await Promise.all([
      $fetch<PublicServiceCatalogItemDto[]>(apiUrl(upstreamBase, '/public/service-catalog'), { retry: 0 }),
      $fetch<PublicMasterDto[]>(apiUrl(upstreamBase, '/public/masters'), { retry: 0 }),
      $fetch<PublicServiceDto[]>(apiUrl(upstreamBase, '/public/services'), { retry: 0 }),
    ])
  }
  catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Unable to build sitemap from the public catalogue',
    })
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
      Boolean(route.loc)
      && allRoutes.findIndex(candidate => candidate.loc === route.loc) === index,
    )

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=900, stale-while-revalidate=3600')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    routes.map(route => routeXml(siteUrl, route)).join('\n'),
    '</urlset>',
    '',
  ].join('\n')
})
