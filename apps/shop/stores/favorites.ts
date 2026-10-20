import type { ProductDto } from '@shared-types'
import { isProductUnavailable } from '~/utils/product-visibility'

interface FavoritesState {
  ownerScope: string
  items: number[]
  products: ProductDto[]
  syncing: boolean
  error: string
}

export const useFavoritesStore = defineStore('favorites', {
  state: (): FavoritesState => ({
    ownerScope: 'guest',
    items: [],
    products: [],
    syncing: false,
    error: '',
  }),
  getters: {
    count: state => state.items.length,
  },
  actions: {
    prepareSession(scope: string, preserveGuest = false) {
      this.syncing = false
      this.error = ''
      if (preserveGuest && this.ownerScope === 'guest' && scope !== 'guest') return
      if (this.ownerScope !== scope || scope === 'guest') {
        this.items = []
        this.products = []
      }
      this.ownerScope = scope
    },
    has(productId: number) {
      const auth = useCustomerAuthStore()
      return auth.isAuthenticated && this.items.includes(productId)
    },
    async toggle(id: number, product?: ProductDto) {
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) {
        await this.add(id, product)
        return
      }

      if (this.items.includes(id)) {
        await this.remove(id)
      }
      else {
        await this.add(id, product)
      }
    },
    async add(id: number, product?: ProductDto) {
      if (product && isProductUnavailable(product)) return
      const auth = useCustomerAuthStore()
      const toast = useToastStore()
      if (!auth.isAuthenticated) {
        this.items = this.items.filter(item => item !== id)
        this.products = this.products.filter(item => item.id !== id)
        toast.show(
          'favorite-auth-required',
          product?.name,
          product?.images[0]?.image || product?.images[0]?.image_url || '',
          product?.name_en ?? null,
        )
        return
      }

      const isCurrentSession = auth.captureSession()
      const isNewFavorite = !this.items.includes(id)
      if (isNewFavorite) this.items = [...this.items, id]
      if (product && !this.products.some(item => item.id === id)) this.products = [product, ...this.products]

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        const serverItem = await domain.addWishlistItem(id)
        if (!isCurrentSession()) return
        this.ownerScope = `customer:${auth.customer!.id}`
        if (!this.products.some(item => item.id === serverItem.product.id)) {
          this.products = [serverItem.product, ...this.products]
        }
        if (isNewFavorite) {
          toast.show(
            'favorite-added',
            serverItem.product.name,
            serverItem.product.images[0]?.image || serverItem.product.images[0]?.image_url || '',
            serverItem.product.name_en ?? null,
          )
        }
      }
      catch (error) {
        if (!isCurrentSession()) return
        this.error = 'Could not update server wishlist.'
        await this.syncFromServer()
      }
      finally {
        if (isCurrentSession()) this.syncing = false
      }
    },
    async remove(id: number) {
      this.items = this.items.filter(item => item !== id)
      this.products = this.products.filter(product => product.id !== id)

      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return
      const isCurrentSession = auth.captureSession()

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        await domain.deleteWishlistItem(id)
      }
      catch (error) {
        if (!isCurrentSession()) return
        this.error = 'Could not remove server wishlist item.'
        await this.syncFromServer()
      }
      finally {
        if (isCurrentSession()) this.syncing = false
      }
    },
    async syncFromServer() {
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return
      const isCurrentSession = auth.captureSession()

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        const wishlist = await domain.getWishlist()
        if (!isCurrentSession()) return
        this.ownerScope = `customer:${auth.customer!.id}`
        this.items = wishlist.map(item => item.product_id)
        this.products = wishlist.map(item => item.product)
      }
      catch (error) {
        if (!isCurrentSession()) return
        this.error = 'Could not load server wishlist.'
        throw error
      }
      finally {
        if (isCurrentSession()) this.syncing = false
      }
    },
    async mergeAnonymousIntoServer() {
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return

      const isCurrentSession = auth.captureSession()
      const localIds = this.ownerScope === 'guest' ? [...this.items] : []
      this.ownerScope = `customer:${auth.customer!.id}`
      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        for (const productId of localIds) {
          if (!isCurrentSession()) return
          try {
            await domain.addWishlistItem(productId)
            if (!isCurrentSession()) return
          }
          catch {
            if (!isCurrentSession()) return
            // A 409 means the product was already in the server wishlist.
          }
        }
        await this.syncFromServer()
      }
      catch (error) {
        if (!isCurrentSession()) return
        this.error = 'Could not merge wishlist.'
        throw error
      }
      finally {
        if (isCurrentSession()) this.syncing = false
      }
    },
  },
})
