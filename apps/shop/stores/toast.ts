export type ShopToastKind = 'cart-added' | 'favorite-added' | 'favorite-auth-required'

interface ShopToastState {
  kind: ShopToastKind
  productName: string
  productNameEn: string | null
  productImage: string
  requestId: number
  isVisible: boolean
}

export const useToastStore = defineStore('toast', {
  state: (): ShopToastState => ({
    kind: 'cart-added',
    productName: '',
    productNameEn: null,
    productImage: '',
    requestId: 0,
    isVisible: false,
  }),
  actions: {
    show(kind: ShopToastKind, productName = '', productImage = '', productNameEn: string | null = null) {
      this.kind = kind
      this.productName = productName
      this.productNameEn = productNameEn
      this.productImage = productImage
      this.requestId += 1
      this.isVisible = true
    },
    dismiss() {
      this.isVisible = false
    },
  },
})
