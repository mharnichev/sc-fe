import type { ProductDto } from '@shared-types'
import { isProductUnavailable } from '~/utils/product-visibility'

interface CartItem {
  product: ProductDto
  quantity: number
}

interface CartState {
  ownerScope: string
  items: CartItem[]
  syncing: boolean
  error: string
}

const upsertLocalItem = (items: CartItem[], product: ProductDto, quantity: number, mode: 'add' | 'set') => {
  const existing = items.find(item => item.product.id === product.id)
  if (existing) {
    existing.product = product
    existing.quantity = mode === 'add' ? existing.quantity + quantity : quantity
    return
  }

  items.push({ product, quantity })
}

export const useCartStore = defineStore('cart', {
  state: (): CartState => ({
    ownerScope: 'guest',
    items: [],
    syncing: false,
    error: '',
  }),
  getters: {
    count: state => state.items.reduce((sum, item) => sum + item.quantity, 0),
    total: state => state.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
    unavailableItems: state => state.items.filter(item => isProductUnavailable(item.product)),
    hasUnavailableItems: state => state.items.some(item => isProductUnavailable(item.product)),
    maxQuantity: () => (product: ProductDto, currentQuantity = 0) => {
      if (isProductUnavailable(product)) return currentQuantity
      // Public catalog exposes purchase availability, not warehouse stock.
      return useCustomerAuthStore().isAuthenticated ? Number.POSITIVE_INFINITY : 10
    },
  },
  actions: {
    prepareSession(scope: string, preserveGuest = false) {
      this.syncing = false
      this.error = ''
      if (preserveGuest && this.ownerScope === 'guest' && scope !== 'guest') return
      if (this.ownerScope !== scope || scope === 'guest') this.items = []
      this.ownerScope = scope
    },
    setItems(items: CartItem[]) {
      this.items = items.filter(item => item.quantity > 0)
    },
    async toggle(product: ProductDto) {
      const isInCart = this.items.some(item => item.product.id === product.id)
      if (isInCart) {
        await this.remove(product.id)
        return
      }

      await this.add(product)
    },
    async refreshProduct(product: ProductDto) {
      const isCurrentSession = useCustomerAuthStore().captureSession()
      let current: ProductDto
      try {
        current = await useCatalogDomain().getProduct(product.slug)
      }
      catch (error) {
        const status = (error as { statusCode?: number, status?: number }).statusCode
          ?? (error as { status?: number }).status
        if (status !== 404) throw error
        current = { ...product, is_effectively_visible: false, is_available_for_purchase: false }
      }
      const item = this.items.find(entry => entry.product.id === product.id)
      if (isCurrentSession() && item) item.product = current
      return current
    },
    async add(product: ProductDto, quantity = 1) {
      if (this.syncing) return
      const auth = useCustomerAuthStore()
      const isCurrentSession = auth.captureSession()
      const { terms } = useShopLocale()
      this.error = ''
      if (!Number.isSafeInteger(quantity) || quantity <= 0) return
      if (isProductUnavailable(product)) {
        this.error = terms.value.basket.unavailable
        return
      }
      const currentQuantity = this.items.find(item => item.product.id === product.id)?.quantity || 0
      if (currentQuantity + quantity > this.maxQuantity(product, currentQuantity)) {
        this.error = terms.value.basket.quantityLimit
        return
      }

      this.syncing = true
      try {
        const current = await this.refreshProduct(product)
        if (!isCurrentSession()) return
        if (isProductUnavailable(current)) {
          this.error = terms.value.basket.unavailable
          return
        }
        let added = current
        if (auth.isAuthenticated) {
          const serverItem = await useCatalogDomain().addServerCartItem(current.id, quantity)
          if (!isCurrentSession()) return
          this.ownerScope = `customer:${auth.customer!.id}`
          upsertLocalItem(this.items, serverItem.product, serverItem.quantity, 'set')
          added = serverItem.product
        }
        else {
          upsertLocalItem(this.items, current, quantity, 'add')
        }
        if (isProductUnavailable(added)) {
          this.error = terms.value.basket.unavailable
          return
        }
        useToastStore().show('cart-added', added.name, added.images[0]?.image || added.images[0]?.image_url || '', added.name_en ?? null)
      }
      catch {
        if (!isCurrentSession()) return
        this.error = terms.value.basket.updateFailed
      }
      finally {
        if (isCurrentSession()) this.syncing = false
      }
    },
    async remove(productId: number) {
      if (this.syncing) return
      const previousItems = [...this.items]
      this.items = this.items.filter(item => item.product.id !== productId)
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return
      const isCurrentSession = auth.captureSession()

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        await domain.deleteServerCartItem(productId)
      }
      catch (error) {
        if (!isCurrentSession()) return
        this.items = previousItems
        this.error = 'Could not remove server cart item.'
        console.error(error)
      }
      finally {
        if (isCurrentSession()) this.syncing = false
      }
    },
    async update(productId: number, quantity: number) {
      if (this.syncing || !Number.isSafeInteger(quantity)) return
      const auth = useCustomerAuthStore()
      const isCurrentSession = auth.captureSession()
      const item = this.items.find(entry => entry.product.id === productId)
      if (!item || quantity === item.quantity) return
      if (isProductUnavailable(item.product) && quantity > item.quantity) return
      if (quantity <= 0) {
        await this.remove(productId)
        return
      }
      const { terms } = useShopLocale()
      this.error = ''
      if (quantity > item.quantity && quantity > this.maxQuantity(item.product, item.quantity)) {
        this.error = terms.value.basket.quantityLimit
        return
      }
      const previousQuantity = item.quantity
      this.syncing = true
      try {
        if (quantity > previousQuantity) {
          const current = await this.refreshProduct(item.product)
          if (!isCurrentSession()) return
          if (isProductUnavailable(current)) {
            this.error = terms.value.basket.unavailable
            return
          }
        }
        if (!auth.isAuthenticated) {
          item.quantity = quantity
          return
        }
        const domain = useCatalogDomain()
        // Increasing is additive: keep the existing server row if the request fails.
        if (quantity > previousQuantity) {
          const serverItem = await domain.addServerCartItem(productId, quantity - previousQuantity)
          if (!isCurrentSession()) return
          upsertLocalItem(this.items, serverItem.product, serverItem.quantity, 'set')
        }
        else {
          await domain.deleteServerCartItem(productId)
          if (!isCurrentSession()) return
          try {
            const serverItem = await domain.addServerCartItem(productId, quantity)
            if (!isCurrentSession()) return
            upsertLocalItem(this.items, serverItem.product, serverItem.quantity, 'set')
          }
          catch (error) {
            if (!isCurrentSession()) return
            await this.syncFromServer()
            throw error
          }
        }
      }
      catch {
        if (!isCurrentSession()) return
        this.error = terms.value.basket.updateFailed
      }
      finally {
        if (isCurrentSession()) this.syncing = false
      }
    },
    clear() {
      this.items = []
      this.error = ''
    },
    async syncFromServer() {
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return
      const isCurrentSession = auth.captureSession()

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        const serverItems = await domain.getServerCart()
        if (!isCurrentSession()) return
        this.ownerScope = `customer:${auth.customer!.id}`
        this.items = serverItems.map(item => ({
          product: item.product,
          quantity: item.quantity,
        }))
      }
      catch (error) {
        if (!isCurrentSession()) return
        this.error = 'Could not load server cart.'
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
      const localItems = this.ownerScope === 'guest' ? [...this.items] : []
      this.ownerScope = `customer:${auth.customer!.id}`
      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        for (const item of localItems) {
          if (!isCurrentSession()) return
          await domain.addServerCartItem(item.product.id, item.quantity)
          if (!isCurrentSession()) return
        }
        await this.syncFromServer()
      }
      catch (error) {
        if (!isCurrentSession()) return
        this.error = 'Could not merge cart.'
        throw error
      }
      finally {
        if (isCurrentSession()) this.syncing = false
      }
    },
  },
})
