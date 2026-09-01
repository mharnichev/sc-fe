import type { ProductDto } from '@shared-types'
import { isProductEffectivelyVisible } from '~/utils/product-visibility'

interface RecentlyViewedSnapshot {
  version: 1
  products: ProductDto[]
}

interface RecentlyViewedState {
  products: ProductDto[]
  hydrated: boolean
}

const STORAGE_KEY = 'shop-recently-viewed'
const STORAGE_VERSION = 1
const HISTORY_LIMIT = 12

const persistProducts = (products: ProductDto[]) => {
  try {
    const snapshot: RecentlyViewedSnapshot = {
      version: STORAGE_VERSION,
      products,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
  catch (error) {
    console.error('Failed to persist recently viewed products', error)
  }
}

const isStoredProduct = (value: unknown): value is ProductDto => {
  if (!value || typeof value !== 'object') return false

  const product = value as Partial<ProductDto>
  return Number.isFinite(product.id)
    && typeof product.name === 'string'
    && typeof product.slug === 'string'
    && typeof product.price === 'string'
    && Array.isArray(product.images)
}

export const useRecentlyViewedStore = defineStore('recently-viewed', {
  state: (): RecentlyViewedState => ({
    products: [],
    hydrated: false,
  }),
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      this.hydrated = true

      const storedValue = localStorage.getItem(STORAGE_KEY)
      if (!storedValue) return

      try {
        const snapshot = JSON.parse(storedValue) as Partial<RecentlyViewedSnapshot>
        if (snapshot.version !== STORAGE_VERSION || !Array.isArray(snapshot.products)) {
          localStorage.removeItem(STORAGE_KEY)
          return
        }

        this.products = snapshot.products
          .filter(isStoredProduct)
          .filter(isProductEffectivelyVisible)
          .filter((product, index, products) =>
            products.findIndex(candidate => candidate.id === product.id) === index,
          )
          .slice(0, HISTORY_LIMIT)
      }
      catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    },
    add(product: ProductDto) {
      if (!import.meta.client) return
      this.hydrate()

      this.products = [
        product,
        ...this.products.filter(candidate => candidate.id !== product.id),
      ].slice(0, HISTORY_LIMIT)

      persistProducts(this.products)
    },
    removeBySlug(slug: string) {
      if (!import.meta.client) return
      this.hydrate()
      const nextProducts = this.products.filter(product => product.slug !== slug)
      if (nextProducts.length === this.products.length) return
      this.products = nextProducts
      persistProducts(this.products)
    },
  },
})
