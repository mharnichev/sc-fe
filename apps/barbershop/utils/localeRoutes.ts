export type PublicLocale = 'uk' | 'en'

const publicPages = new Set(['/', '/services', '/masters', '/contacts', '/about', '/terms', '/blog-faq', '/barbershop-odesa', '/znyzhka-dlia-zsu'])

export const unlocalizedPath = (path: string) => {
  const clean = path.split(/[?#]/, 1)[0] || '/'
  const base = clean === '/en' || clean.startsWith('/en/') ? clean.slice(3) || '/' : clean
  return base === '/' ? base : base.replace(/\/+$/, '')
}

export const isPublicLocalizedPage = (path: string) => {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  const base = unlocalizedPath(path)
  return publicPages.has(base) || /^\/(services|masters)\/[a-z0-9-]+$/.test(base)
}

export const publicRouteLocale = (path: string): PublicLocale =>
  path === '/en' || path.startsWith('/en/') ? 'en' : 'uk'

// Only public HTML pages belong to the language namespace. API, assets, blog
// and private booking/token routes keep their own routing and privacy rules.
export const localizedPublicPath = (path: string, locale: PublicLocale): string => {
  if (!path.startsWith('/') || path.startsWith('//') || !isPublicLocalizedPage(path)) return path
  const suffix = path.match(/[?#].*$/)?.[0] || ''
  const base = unlocalizedPath(path)
  return `${locale === 'en' ? '/en' : ''}${base}${suffix}`
}
