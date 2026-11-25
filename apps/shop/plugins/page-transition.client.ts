import type { RouteLocationNormalized } from 'vue-router'

const SHOW_DELAY_MS = 120
const isCabinetPath = (path: string) => path === '/cabinet' || path.startsWith('/cabinet/')

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const isVisible = usePageTransitionOverlay()
  let pendingRoute: RouteLocationNormalized | null = null
  let transitionOwner = {}
  let showTimer: ReturnType<typeof setTimeout> | null = null
  // Nuxt passes the same vnode to page:start and page:finish. Remember its
  // route so a superseded Suspense cannot finish a newer navigation.
  const pageOwners = new WeakMap<object, object>()

  const clearShowTimer = () => {
    if (showTimer === null) return
    window.clearTimeout(showTimer)
    showTimer = null
  }

  const revealPage = (route: typeof pendingRoute) => {
    if (!route || pendingRoute !== route) return
    clearShowTimer()
    isVisible.value = false
    pendingRoute = null
  }

  router.beforeEach((to, from) => {
    if (!from.matched.length || to.fullPath === from.fullPath) return

    // A query/hash change does not own the page already being rendered.
    // Keeping its original owner also prevents a rejected query guard from
    // releasing that page while its Suspense is still pending.
    if (to.path === from.path && pendingRoute?.path === from.path) return
    clearShowTimer()
    if (to.path === from.path || (isCabinetPath(from.path) && isCabinetPath(to.path))) {
      pendingRoute = null
      isVisible.value = false
      return
    }

    transitionOwner = {}
    pendingRoute = to
    if (!isVisible.value) {
      showTimer = window.setTimeout(() => {
        showTimer = null
        if (pendingRoute === to) isVisible.value = true
      }, SHOW_DELAY_MS)
    }
  })

  router.afterEach((to, _from, failure) => {
    // Duplicate pushes never ran our guard and must not release a page whose
    // Suspense is still pending. Other failures only own their own guard.
    if (failure && failure.type !== 16 && pendingRoute === to) revealPage(to)
  })

  router.onError((_error, to) => {
    if (pendingRoute === to) revealPage(to)
  })

  nuxtApp.hook('page:start', (page) => {
    if (page && pendingRoute?.path === router.currentRoute.value.path) pageOwners.set(page, transitionOwner)
  })
  nuxtApp.hook('page:finish', (page) => {
    if (!page) return
    const route = pendingRoute
    const current = router.currentRoute.value
    if (!route || current.path !== route.path) return
    const owner = pageOwners.get(page)
    if (owner && owner !== transitionOwner) return
    // Synchronous pages can resolve without page:start. Ignore parent or
    // stale pages; only the current route's leaf can reveal the destination.
    const leaf = current.matched[current.matched.length - 1]
    if (leaf?.components?.default !== page.type) return
    revealPage(route)
  })

  nuxtApp.hook('app:error', () => {
    if (pendingRoute) revealPage(pendingRoute)
  })
})
