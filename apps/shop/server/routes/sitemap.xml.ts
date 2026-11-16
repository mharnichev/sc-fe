import type { PaginatedResponse } from '@shared-types'
import { shopPublicPaths, shopSeoUrl } from '../../utils/shopSeo'

type SitemapImage = string | { image?: string | null, image_url?: string | null }

type SitemapProduct = {
  slug: string
  status?: string
  is_active?: boolean
  is_effectively_visible?: boolean
  category?: { slug: string } | null
  category_tree?: { slug: string }[]
  image_url?: string | null
  images?: SitemapImage[]
  attributes_json?: { image_urls?: unknown } | null
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const productImageUrls = (product: SitemapProduct, origin: string) => {
  const legacy = product.attributes_json?.image_urls
  const paths = product.images?.length
    ? product.images.map(image => typeof image === 'string' ? image : image?.image ?? image?.image_url)
    : [product.image_url, ...(Array.isArray(legacy) ? legacy : [])]
  const urls = new Set<string>()

  for (const path of paths) {
    if (typeof path !== 'string' || !path.trim()) continue
    try {
      const url = new URL(path, origin)
      if (url.origin !== origin || url.username || url.password) continue
      url.hash = ''
      if (url.pathname === '/') continue
      urls.add(url.href)
      if (urls.size === 1000) break
    }
    catch {
      // Ignore malformed optional image URLs and keep the product in the sitemap.
    }
  }
  return urls
}

export default defineEventHandler(async (event) => {
  const { apiBase, app, public: { siteUrl } } = useRuntimeConfig(event)
  const site = new URL(siteUrl)
  if (getRequestURL(event).host !== site.host) throw createError({ statusCode: 404 })

  const urls = new Set(shopPublicPaths.map(path => shopSeoUrl(siteUrl, app.baseURL, path).href))
  const imagesByUrl = new Map<string, Set<string>>()
  const upstream = apiBase.replace(/\/+$/, '') + '/public/products'
  const signal = AbortSignal.timeout(10_000)
  let seen = 0
  try {
    for (let page = 1; ; page += 1) {
      const { items, total, page: responsePage } = await $fetch<PaginatedResponse<SitemapProduct>>(upstream, {
        query: { page, page_size: 100 },
        retry: 0,
        signal,
      })
      if (responsePage !== page || !Number.isSafeInteger(total) || total < 0 || total > 49_000 || (!items.length && seen < total)) {
        throw new Error('Invalid sitemap catalog page')
      }
      for (const product of items) {
        if (product.is_effectively_visible === false || product.is_active === false || product.status === 'inactive') continue
        if (!/^[\p{L}\p{N}-]+$/u.test(product.slug)) continue
        const productUrl = shopSeoUrl(siteUrl, app.baseURL, '/products/' + encodeURIComponent(product.slug)).href
        urls.add(productUrl)
        imagesByUrl.set(productUrl, productImageUrls(product, site.origin))
        for (const category of [...(product.category_tree ?? []), product.category]) {
          if (!category?.slug || !/^[\p{L}\p{N}-]+$/u.test(category.slug)) continue
          const url = shopSeoUrl(siteUrl, app.baseURL, '/catalog')
          url.searchParams.set('category', category.slug)
          urls.add(url.href)
        }
      }
      seen += items.length
      if (urls.size > 50_000) throw new Error('Sitemap URL limit exceeded')
      if (seen >= total) break
    }
  }
  catch {
    throw createError({ statusCode: 503, statusMessage: 'Shop sitemap temporarily unavailable' })
  }

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...[...urls].map(url => [
      `  <url><loc>${escapeXml(url)}</loc>`,
      ...[...(imagesByUrl.get(url) ?? [])].map(image => `<image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`),
      '</url>',
    ].join('')),
    '</urlset>',
  ].join('\n')
})
