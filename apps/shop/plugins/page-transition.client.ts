import type { RouteLocationNormalized } from 'vue-router'

const TRANSITION_OUT_MS = 300
const TRANSITION_IN_DELAY_MS = 80
const isCabinetPath = (path: string) => path === '/cabinet' || path.startsWith('/cabinet/')

const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration))

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const isVisible = usePageTransitionOverlay()
  let pendingRoute: RouteLocationNormalized | null = null
  let transitionOwner = {}
  let revealTimer: ReturnType<typeof setTimeout> | null = null
  // Nuxt passes the same vnode to page:start and page:finish. Remember its
  // route so a superseded Suspense cannot finish a newer navigation.
  const pageOwners = new WeakMap<object, object>()

  const clearRevealTimer = () => {
    if (revealTimer === null) return
    window.clearTimeout(revealTimer)
    revealTimer = null
  }

  const revealPage = (route: typeof pendingRoute, delay = TRANSITION_IN_DELAY_MS) => {
    if (!route || pendingRoute !== route) return
    clearRevealTimer()
    revealTimer = window.setTimeout(() => {
      if (pendingRoute !== route) return
      isVisible.value = false
      pendingRoute = null
      revealTimer = null
    }, delay)
  }

  router.beforeEach(async (to, from) => {
    if (!from.matched.length || to.fullPath === from.fullPath) return

    // A query/hash change does not own the page already being rendered.
    // Keeping its original owner also prevents a rejected query guard from
    // releasing that page while its Suspense is still pending.
    if (to.path === from.path && pendingRoute?.path === from.path) return
    clearRevealTimer()
    if (to.path === from.path || (isCabinetPath(from.path) && isCabinetPath(to.path))) {
      pendingRoute = null
      isVisible.value = false
      return
    }

    transitionOwner = {}
    pendingRoute = to
    isVisible.value = true
    await wait(TRANSITION_OUT_MS)
  })

  router.afterEach((to, _from, failure) => {
    // Duplicate pushes never ran our guard and must not release a page whose
    // Suspense is still pending. Other failures only own their own guard.
    if (failure && failure.type !== 16 && pendingRoute === to) revealPage(to, 0)
  })

  router.onError((_error, to) => {
    if (pendingRoute === to) revealPage(to, 0)
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
    if (pendingRoute) revealPage(pendingRoute, 0)
  })
})
