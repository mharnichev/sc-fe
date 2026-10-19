import type { ShopCustomerDto } from '@shared-types'

interface CustomerAuthSnapshot {
  accessToken?: string
  tokenType?: string
  customer?: ShopCustomerDto | null
}

const readCustomerAuthSnapshot = (): CustomerAuthSnapshot | null => {
  const key = 'shop-customer-auth'
  const stored = localStorage.getItem(key)
  if (!stored) return null

  try {
    return JSON.parse(stored) as CustomerAuthSnapshot
  }
  catch {
    localStorage.removeItem(key)
    return null
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/cabinet') || import.meta.server) return

  const nuxtApp = useNuxtApp()
  const guardRoute = async () => {
    const auth = useCustomerAuthStore()
    let restoredFromStorage = false

    if (!auth.accessToken) {
      const snapshot = readCustomerAuthSnapshot()
      if (snapshot) {
        auth.hydrate(snapshot)
        restoredFromStorage = true
      }
    }

    if (restoredFromStorage && auth.accessToken) {
      try {
        await auth.fetchMe()
      }
      catch {
        // fetchMe clears an expired or invalid persisted session.
      }
    }

    if (auth.isAuthenticated) return

    useModalStore().openModal('UserAuthModal', { redirectTo: to.fullPath })
    return navigateTo('/')
  }

  if (nuxtApp.isHydrating) {
    nuxtApp.hook('app:mounted', () => {
      window.setTimeout(() => void guardRoute(), 0)
    })
    return
  }

  return guardRoute()
})
