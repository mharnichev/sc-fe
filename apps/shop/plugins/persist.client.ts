import { refreshLegacyProductPresentation } from '~/utils/product-presentation-refresh'

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

export default defineNuxtPlugin(() => {
  let isRestored = false

  const restorePersistedState = () => {
    if (isRestored) return
    isRestored = true

    const cart = useCartStore()
    const favorites = useFavoritesStore()
    const customerAuth = useCustomerAuthStore()

    const authSnapshot = readSnapshot<typeof customerAuth.$state>('shop-customer-auth')
    // Cabinet middleware or an account action may already have established the session.
    if (authSnapshot && customerAuth.sessionRevision === 0) customerAuth.hydrate(authSnapshot)

    const scope = customerAuth.isAuthenticated ? `customer:${customerAuth.customer!.id}` : 'guest'
    // Old snapshots had no owner. Their companion auth snapshot supplies the migration scope.
    const legacyScope = authSnapshot?.accessToken && authSnapshot.customer
      ? `customer:${authSnapshot.customer.id}` : 'guest'
    const cartSnapshot = readSnapshot<typeof cart.$state>('shop-cart')
    if (cartSnapshot && (cartSnapshot.ownerScope || legacyScope) === scope) {
      cart.$patch({ items: cartSnapshot.items || [], ownerScope: scope })
    }

    const favoritesSnapshot = readSnapshot<typeof favorites.$state>('shop-favorites')
    if (favoritesSnapshot && (favoritesSnapshot.ownerScope || legacyScope) === scope) {
      favorites.$patch({ items: favoritesSnapshot.items || [], products: favoritesSnapshot.products || [], ownerScope: scope })
    }

    cart.$subscribe((_mutation, state) => {
      localStorage.setItem('shop-cart', JSON.stringify({ items: state.items, ownerScope: state.ownerScope }))
    }, { immediate: true })

    favorites.$subscribe((_mutation, state) => {
      localStorage.setItem('shop-favorites', JSON.stringify({
        items: state.items,
        ownerScope: state.ownerScope,
        products: state.products,
      }))
    }, { immediate: true })

    // Flush account changes made before this subscription was installed.
    customerAuth.$subscribe((_mutation, state) => {
      localStorage.setItem('shop-customer-auth', JSON.stringify({
        accessToken: state.accessToken,
        tokenType: state.tokenType,
        customer: state.customer,
      }))
    }, { immediate: true })

    if (scope === 'guest') {
      const snapshots = [...(cart.items || []).map(item => item.product), ...(favorites.products || [])]
      if (snapshots.length) {
        const isCurrentSession = customerAuth.captureSession()
        void refreshLegacyProductPresentation(snapshots, useCatalogDomain().getProduct, (saved, enriched) => {
          const cartItem = cart.items.find(item => item.product === saved)
          if (cartItem) cartItem.product = enriched
          const favoriteIndex = favorites.products.indexOf(saved)
          if (favoriteIndex >= 0) favorites.products.splice(favoriteIndex, 1, enriched)
        }, () => isCurrentSession() && !customerAuth.isAuthenticated && cart.ownerScope === 'guest' && favorites.ownerScope === 'guest')
      }
    }

    useState<boolean>('shop-persistence-ready', () => false).value = true

    if (customerAuth.accessToken) {
      void Promise.allSettled([
        customerAuth.fetchMe(),
        cart.syncFromServer(),
        favorites.syncFromServer(),
      ])
    }
  }

  onNuxtReady(restorePersistedState)
})
