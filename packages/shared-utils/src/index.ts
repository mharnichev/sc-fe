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
  file_url?: string | null
}

export type ApiAssetValue = string | ApiUploadAssetLike | null | undefined

const absoluteUrlPattern = /^[a-z][a-z\d+\-.]*:/i

export const resolveApiAssetUrl = (value: ApiAssetValue, apiBase: string, clientOrigin = '') => {
  const rawValue = typeof value === 'string' ? value : value?.file_url
  if (!rawValue) return ''
  if (absoluteUrlPattern.test(rawValue) || rawValue.startsWith('//')) return rawValue
  if (!rawValue.startsWith('/')) return rawValue

  if (apiBase.startsWith('/')) {
    return clientOrigin ? `${clientOrigin}${rawValue}` : rawValue
  }

  try {
    return `${new URL(apiBase).origin}${rawValue}`
  }
  catch {
    return rawValue
  }
}
