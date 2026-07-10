import type { ProductDto } from '@shared-types'

interface CartItem {
  product: ProductDto
  quantity: number
}

interface CartState {
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
    items: [],
    syncing: false,
    error: '',
  }),
  getters: {
    count: state => state.items.reduce((sum, item) => sum + item.quantity, 0),
    total: state => state.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
  },
  actions: {
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
    async add(product: ProductDto, quantity = 1) {
      upsertLocalItem(this.items, product, quantity, 'add')
      const auth = useCustomerAuthStore()
      const toast = useToastStore()
      if (!auth.isAuthenticated) {
        toast.show('cart-added', product.name, product.images[0]?.image || product.images[0]?.image_url || '')
        return
      }

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        const serverItem = await domain.addServerCartItem(product.id, quantity)
        upsertLocalItem(this.items, serverItem.product, serverItem.quantity, 'set')
        toast.show(
          'cart-added',
          serverItem.product.name,
          serverItem.product.images[0]?.image || serverItem.product.images[0]?.image_url || '',
        )
      }
      catch (error) {
        this.error = 'Could not update server cart.'
        console.error(error)
      }
      finally {
        this.syncing = false
      }
    },
    async remove(productId: number) {
      const previousItems = [...this.items]
      this.items = this.items.filter(item => item.product.id !== productId)
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        await domain.deleteServerCartItem(productId)
      }
      catch (error) {
        this.items = previousItems
        this.error = 'Could not remove server cart item.'
        console.error(error)
      }
      finally {
        this.syncing = false
      }
    },
    async update(productId: number, quantity: number) {
      const item = this.items.find(entry => entry.product.id === productId)
      if (!item) return
      if (quantity <= 0) {
        await this.remove(productId)
        return
      }

      const previousQuantity = item.quantity
      item.quantity = quantity
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        await domain.deleteServerCartItem(productId)
        const serverItem = await domain.addServerCartItem(productId, quantity)
        upsertLocalItem(this.items, serverItem.product, serverItem.quantity, 'set')
      }
      catch (error) {
        item.quantity = previousQuantity
        this.error = 'Could not update server cart quantity.'
        console.error(error)
      }
      finally {
        this.syncing = false
      }
    },
    clear() {
      this.items = []
      this.error = ''
    },
    async syncFromServer() {
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return

      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        const serverItems = await domain.getServerCart()
        this.items = serverItems.map(item => ({
          product: item.product,
          quantity: item.quantity,
        }))
      }
      catch (error) {
        this.error = 'Could not load server cart.'
        throw error
      }
      finally {
        this.syncing = false
      }
    },
    async mergeAnonymousIntoServer() {
      const auth = useCustomerAuthStore()
      if (!auth.isAuthenticated) return

      const localItems = [...this.items]
      this.syncing = true
      this.error = ''
      try {
        const domain = useCatalogDomain()
        for (const item of localItems) {
          await domain.addServerCartItem(item.product.id, item.quantity)
        }
        await this.syncFromServer()
      }
      catch (error) {
        this.error = 'Could not merge cart.'
        throw error
      }
      finally {
        this.syncing = false
      }
    },
  },
})
