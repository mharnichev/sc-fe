interface ProductPhotoSource {
  display_image_url?: string | null
  display_image_urls?: string[]
  image_url?: string | null
  images?: { id: number, sort_order: number, is_active: boolean, image_url: string | null }[]
  attributes_json?: Record<string, unknown> | null
}

const usableUrls = (values: unknown[]) => values
  .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  .map(value => value.trim())

// Keep display projections separate from original URLs used in edit payloads.
export const productDisplayImages = (product: ProductPhotoSource | null | undefined): string[] => {
  if (!product) return []
  if (Array.isArray(product.display_image_urls)) {
    return [...new Set(usableUrls(product.display_image_urls))]
  }
  if (product.display_image_url?.trim()) return [product.display_image_url.trim()]
  if (Array.isArray(product.images) && product.images.length) {
    return [...product.images].filter(image => image.is_active && image.image_url?.trim())
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map(image => image.image_url!.trim())
  }
  const legacy = product.attributes_json?.image_urls
  return [...new Set(usableUrls([product.image_url, ...(Array.isArray(legacy) ? legacy : [])]))]
}

export const productDisplayImage = (product: ProductPhotoSource | null | undefined) =>
  productDisplayImages(product)[0] || ''
