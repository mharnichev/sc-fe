import type { ProductDto } from '@shared-types'

const englishFields = ['name_en', 'product_type_en', 'description_en', 'short_description_en', 'ingredients_en'] as const
const attempted = new WeakSet<ProductDto>()
const pending = new Map<string, Promise<ProductDto | null>>()

const hasText = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())

const needsTranslation = (product: ProductDto) =>
  !hasText(product.name_en)
  || Boolean(product.product_type && !hasText(product.product_type_en))
  || Boolean(product.category?.name && !hasText(product.category.name_en))

/** Merge only published English presentation fields; saved business data stays intact. */
export const enrichProductPresentation = (saved: ProductDto, fresh: ProductDto): ProductDto => {
  if (saved.id !== fresh.id || saved.slug !== fresh.slug || fresh.is_effectively_visible === false || fresh.status === 'inactive') return saved
  let enriched = saved
  for (const field of englishFields) {
    const value = fresh[field]
    if (typeof value === 'string' && value.trim() && value !== saved[field]) {
      if (enriched === saved) enriched = { ...saved }
      enriched[field] = value
    }
  }
  if (saved.category && fresh.category?.id === saved.category.id && hasText(fresh.category.name_en)
    && fresh.category.name_en !== saved.category.name_en) {
    if (enriched === saved) enriched = { ...saved }
    enriched.category = { ...saved.category, name_en: fresh.category.name_en }
  }
  return enriched
}

/** Read-only public requests, at most three in flight, once per saved object. */
export const refreshLegacyProductPresentation = async (
  products: ProductDto[],
  getProduct: (slug: string) => Promise<ProductDto>,
  update: (saved: ProductDto, enriched: ProductDto) => void,
  isCurrent: () => boolean = () => true,
): Promise<void> => {
  const queue = products.filter(product => product && Number.isSafeInteger(product.id) && product.id > 0 && typeof product.slug === 'string' && needsTranslation(product) && !attempted.has(product))
  for (const product of queue) attempted.add(product)
  const batchRequests = new Map<string, Promise<ProductDto | null>>()
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (cursor < queue.length && isCurrent()) {
      const saved = queue[cursor++]
      if (!saved) return
      const key = `${saved.id}:${saved.slug}`
      let request = batchRequests.get(key) || pending.get(key)
      if (!request) {
        request = Promise.resolve().then(() => getProduct(saved.slug)).catch(() => null)
        pending.set(key, request)
      }
      batchRequests.set(key, request)
      const fresh = await request
      if (pending.get(key) === request) pending.delete(key)
      if (!fresh || !isCurrent()) continue
      const enriched = enrichProductPresentation(saved, fresh)
      if (enriched !== saved) update(saved, enriched)
    }
  }))
}
