export const formatPrice = (value: string | number, currency = 'UAH') =>
  new Intl.NumberFormat('UAH', { style: 'currency', currency }).format(Number(value))

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

export const initials = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')

const brandLogoFileAliases: Record<string, string> = {
  'morgan-s-pomade': 'morgans-pomade',
  'the-bluebeards-revenge': 'bluebeards-revenge',
}

const availableBrandLogoSlugs = new Set([
  'american-crew',
  'barba-italiana',
  'barberito',
  'barbertime',
  'barbicide',
  'bluebeards-revenge',
  'comair',
  'dapper-dan',
  'depot',
  'derby',
  'floid',
  'hawkins-brimble',
  'high-top-capes',
  'kent-brushes',
  'marmara',
  'marvis',
  'morgans-pomade',
  'nishman',
  'pacinos',
  'proraso',
  'reuzel',
  'shave-factory',
  'slick-gorilla',
  'standard-issue',
  'uppercut-deluxe',
  'wahl',
  'yope',
])

const vectorBrandLogoSlugs = new Set([
  'depot',
  'kent-brushes',
  'marvis',
  'morgans-pomade',
  'nishman',
  'standard-issue',
  'yope',
])

const monochromeBrandLogoSlugs = new Set([
  'american-crew',
  'barbertime',
  'depot',
  'derby',
  'hawkins-brimble',
  'kent-brushes',
  'marvis',
  'morgans-pomade',
  'nishman',
])

const normalizedBrandLogoSlug = (slug: string) => {
  const normalized = slug.trim().toLowerCase()
  return brandLogoFileAliases[normalized] || normalized
}

export const localBrandLogoUrl = (slug: string) => {
  const normalized = normalizedBrandLogoSlug(slug)
  if (!availableBrandLogoSlugs.has(normalized)) return ''

  const extension = vectorBrandLogoSlugs.has(normalized) ? 'svg' : 'webp'
  return `/brand-logos/${normalized}.${extension}`
}

export const isMonochromeBrandLogo = (slug: string) =>
  monochromeBrandLogoSlugs.has(normalizedBrandLogoSlug(slug))

export interface ApiUploadAssetLike {
  id?: number | string | null
  file_url?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type ApiAssetValue = string | ApiUploadAssetLike | null | undefined

const absoluteUrlPattern = /^[a-z][a-z\d+\-.]*:/i

const assetVersion = (value: ApiAssetValue) => {
  if (!value || typeof value === 'string') return ''
  return value.id ?? value.updated_at ?? value.created_at ?? ''
}

const appendAssetVersion = (url: string, version: number | string | null | undefined) => {
  if (!version) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${encodeURIComponent(String(version))}`
}

export const resolveApiAssetUrl = (value: ApiAssetValue, apiBase: string, clientOrigin = '') => {
  const rawValue = typeof value === 'string' ? value : value?.file_url
  if (!rawValue) return ''
  const version = assetVersion(value)
  if (absoluteUrlPattern.test(rawValue) || rawValue.startsWith('//')) return appendAssetVersion(rawValue, version)
  if (!rawValue.startsWith('/')) return appendAssetVersion(rawValue, version)

  if (apiBase.startsWith('/')) {
    return appendAssetVersion(clientOrigin ? `${clientOrigin}${rawValue}` : rawValue, version)
  }

  try {
    return appendAssetVersion(`${new URL(apiBase).origin}${rawValue}`, version)
  }
  catch {
    return appendAssetVersion(rawValue, version)
  }
}
