import type { ProductDto } from '@shared-types'

/**
 * A private cart/wishlist snapshot can outlive the public catalog entry. Treat
 * only explicit backend signals as unavailable. Do not recompute purchase
 * availability from stock here: the backend signal already owns that rule.
 */
export const isProductEffectivelyVisible = (product: ProductDto) =>
  product.is_effectively_visible !== false && product.status !== 'inactive'

export const isProductHidden = (product: ProductDto) => !isProductEffectivelyVisible(product)

export const isProductUnavailable = (product: ProductDto) =>
  product.is_available_for_purchase === false || isProductHidden(product)
