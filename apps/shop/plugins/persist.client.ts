const readSnapshot = <T>(key: string): Partial<T> | null => {
  const snapshot = localStorage.getItem(key)
  if (!snapshot) return null

  try {
    return JSON.parse(snapshot) as Partial<T>
  }
  catch {
    localStorage.removeItem(key)
    return null
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  let isRestored = false

  nuxtApp.hook('page:finish', () => {
    if (isRestored) return
    isRestored = true

    const cart = useCartStore()
    const favorites = useFavoritesStore()
    const customerAuth = useCustomerAuthStore()

    const cartSnapshot = readSnapshot<typeof cart.$state>('shop-cart')
    if (cartSnapshot) cart.$patch(cartSnapshot)

    const favoritesSnapshot = readSnapshot<typeof favorites.$state>('shop-favorites')
    if (favoritesSnapshot) favorites.$patch(favoritesSnapshot)

    const authSnapshot = readSnapshot<typeof customerAuth.$state>('shop-customer-auth')
    if (authSnapshot) customerAuth.hydrate(authSnapshot)

    cart.$subscribe((_mutation, state) => {
      localStorage.setItem('shop-cart', JSON.stringify({ items: state.items }))
    })

    favorites.$subscribe((_mutation, state) => {
      localStorage.setItem('shop-favorites', JSON.stringify({
        items: state.items,
        products: state.products,
      }))
    })

    customerAuth.$subscribe((_mutation, state) => {
      localStorage.setItem('shop-customer-auth', JSON.stringify({
        accessToken: state.accessToken,
        tokenType: state.tokenType,
        customer: state.customer,
      }))
    })

    if (customerAuth.accessToken) {
      void Promise.allSettled([
        customerAuth.fetchMe(),
        cart.syncFromServer(),
        favorites.syncFromServer(),
      ])
    }
  })
})
