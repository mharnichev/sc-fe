import { localizedCategoryName } from './category-localization'

interface LocalizedProduct {
  name: string
  name_en?: string | null
  product_type?: string | null
  product_type_en?: string | null
  category?: { name: string, name_en?: string | null }
}

export const localizedProductName = (product: LocalizedProduct, locale: string): string =>
  locale === 'en' && product.name_en?.trim() ? product.name_en : product.name

export const localizedProductType = (product: LocalizedProduct, locale: string): string =>
  (locale === 'en' && product.product_type_en?.trim() ? product.product_type_en : product.product_type)
  || (product.category ? localizedCategoryName(product.category, locale) : '')

export const localizedProductSuggestion = (
  suggestion: string,
  products: Array<LocalizedProduct & { old_name?: string | null }>,
  locale: string,
): string => {
  if (locale !== 'en') return suggestion
  const product = products.find(product => [product.name, product.old_name].includes(suggestion))
  return product?.name_en?.trim() ? localizedProductName(product, locale) : suggestion
}
