import type { Brand, Product } from '../composables/useBackofficeApi'

type VisibilityProduct = Pick<Product, 'brand_id' | 'is_active' | 'is_effectively_visible' | 'hidden_reason'>

export const summarizeBrandProducts = (products: VisibilityProduct[]) => {
  const summaries: Record<number, { total: number, active: number, visible: number, category: number, parentCategory: number }> = {}
  for (const product of products) {
    if (product.brand_id === null) continue
    const summary = summaries[product.brand_id] ??= { total: 0, active: 0, visible: 0, category: 0, parentCategory: 0 }
    summary.total++
    if (!product.is_active) continue
    summary.active++
    if (product.is_effectively_visible) summary.visible++
    else if (product.hidden_reason === 'category') summary.category++
    else if (product.hidden_reason === 'parent_category') summary.parentCategory++
  }
  return summaries
}

export const getBrandVisibility = (
  brand: Pick<Brand, 'id' | 'is_active'>,
  summaries: ReturnType<typeof summarizeBrandProducts> | null | undefined,
) => {
  if (brand.is_active === false) return { visible: false, reason: 'Приховано вручну.' }
  if (!summaries) return { visible: null, reason: null }
  const summary = summaries[brand.id]
  if (!summary?.total) return { visible: false, reason: 'У бренду ще немає товарів.' }
  if (summary.visible) return { visible: true, reason: null }
  if (!summary.active) return { visible: false, reason: 'Усі товари бренду неактивні.' }
  const reasons: string[] = []
  if (summary.category) reasons.push('закриті категорії')
  if (summary.parentCategory) reasons.push('закриті батьківські категорії')
  return {
    visible: false,
    reason: reasons.length
      ? `Активні товари приховані через ${reasons.join(' та ')}.`
      : 'Немає товарів, видимих у каталозі.',
  }
}
