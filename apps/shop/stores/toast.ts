export type ShopToastKind = 'cart-added' | 'favorite-added' | 'favorite-auth-required'

interface ShopToastState {
  kind: ShopToastKind
  productName: string
  productImage: string
  requestId: number
  isVisible: boolean
}

export const useToastStore = defineStore('toast', {
  state: (): ShopToastState => ({
    kind: 'cart-added',
    productName: '',
    productImage: '',
    requestId: 0,
    isVisible: false,
  }),
  actions: {
    show(kind: ShopToastKind, productName = '', productImage = '') {
      this.kind = kind
      this.productName = productName
      this.productImage = productImage
      this.requestId += 1
      this.isVisible = true
    },
    dismiss() {
      this.isVisible = false
    },
  },
})
