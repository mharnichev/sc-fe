export const SHOP_CATALOG_PAGE_SIZE = 20

export const shopPublicPaths = ['/', '/catalog', '/brands', '/sale', '/top', '/contacts', '/delivery-payment']

export const shopSeoUrl = (origin: string, base: string, path: string) =>
  new URL(base.replace(/\/+$/, '') + path, origin)

export const shopIndexableUrl = (origin: string, base: string, path: string, query: URLSearchParams) => {
  const pathname = path.replace(/\/+$/, '') || '/'
  const isListing = ['/catalog', '/sale', '/top'].includes(pathname)
  if (!shopPublicPaths.includes(pathname) && !/^\/products\/[^/]+$/.test(pathname)) return null

  const url = shopSeoUrl(origin, base, pathname)
  for (const [key, value] of query) {
    if (key.startsWith('utm_') || ['gclid', 'fbclid', 'msclkid', 'srsltid'].includes(key)) continue
    if (!isListing || query.getAll(key).length > 1) return null
    if (key === 'category' && pathname === '/catalog' && /^[\p{L}\p{N}-]+$/u.test(value)) {
      url.searchParams.set(key, value)
    }
    else if (key === 'offset' && /^\d{1,9}$/.test(value)) {
      const offset = Number(value)
      if (offset % SHOP_CATALOG_PAGE_SIZE) return null
      if (offset) url.searchParams.set(key, String(offset))
    }
    else return null
  }
  url.searchParams.sort()
  return url.href
}
