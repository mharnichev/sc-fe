import type { ProductDto } from '@shared-types'

type ProductMetadata = Record<string, unknown>

type ProductWithStatusMetadata = ProductDto & {
  attributes_json?: ProductMetadata | null
  is_new?: unknown
  is_top?: unknown
  is_popular?: unknown
  badges?: unknown
  product_badges?: unknown
}

export interface ProductDiscount {
  price: number
  compareAtPrice: number
  percent: number
}

export interface ProductStatusFlags {
  isNew: boolean
  isTop: boolean
}

const toFiniteNumber = (value: string | number | null | undefined) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value !== 'string') return false

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const markerValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(markerValues)
  if (typeof value === 'string') return value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean)
  if (value && typeof value === 'object') {
    const record = value as ProductMetadata
    return markerValues(record.code ?? record.slug ?? record.name ?? record.type)
  }
  return []
}

const hasMarker = (markers: string[], accepted: string[]) =>
  markers.some(marker => accepted.includes(marker.replace(/[\s-]+/g, '_')))

export const getProductDiscount = (
  product: Pick<ProductDto, 'price' | 'compare_at_price'>,
): ProductDiscount | null => {
  const price = toFiniteNumber(product.price)
  const compareAtPrice = toFiniteNumber(product.compare_at_price)

  if (price === null || compareAtPrice === null || compareAtPrice <= price) return null

  return {
    price,
    compareAtPrice,
    percent: Math.round(((compareAtPrice - price) / compareAtPrice) * 10_000) / 100,
  }
}

export const getProductStatusFlags = (product: ProductDto): ProductStatusFlags => {
  const source = product as ProductWithStatusMetadata
  const attributes = source.attributes_json ?? {}
  const markers = [
    source.badges,
    source.product_badges,
    attributes.badges,
    attributes.product_badges,
    attributes.labels,
  ].flatMap(markerValues)

  return {
    isNew: toBoolean(source.is_new)
      || toBoolean(attributes.is_new)
      || toBoolean(attributes.new)
      || hasMarker(markers, ['new', 'is_new', 'new_product']),
    isTop: toBoolean(source.is_top)
      || toBoolean(source.is_popular)
      || toBoolean(attributes.is_top)
      || toBoolean(attributes.top)
      || toBoolean(attributes.is_popular)
      || toBoolean(attributes.popular)
      || hasMarker(markers, ['top', 'is_top', 'top_product', 'popular', 'is_popular']),
  }
}

export const formatProductDiscountPercent = (percent: number) =>
  String(Math.floor(percent))
