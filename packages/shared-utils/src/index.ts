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
