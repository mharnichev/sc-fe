import type { ProductDto } from '@shared-types'

interface CartItem {
  product: ProductDto
  quantity: number
}

export const useCartStore = defineStore('cart', {
  state: (): { items: CartItem[] } => ({
    items: [],
  }),
  getters: {
    count: state => state.items.reduce((sum, item) => sum + item.quantity, 0),
    total: state => state.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
  },
  actions: {
    add(product: ProductDto) {
      const existing = this.items.find(item => item.product.id === product.id)
      if (existing) existing.quantity += 1
      else this.items.push({ product, quantity: 1 })
    },
    remove(productId: number) {
      this.items = this.items.filter(item => item.product.id !== productId)
    },
    update(productId: number, quantity: number) {
      const item = this.items.find(entry => entry.product.id === productId)
      if (!item) return
      item.quantity = quantity
      if (item.quantity <= 0) this.remove(productId)
    },
    clear() {
      this.items = []
    },
  },
})
