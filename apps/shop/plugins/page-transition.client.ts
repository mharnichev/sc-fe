const TRANSITION_OUT_MS = 300
const TRANSITION_IN_DELAY_MS = 80

const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration))

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const isVisible = usePageTransitionOverlay()
  let pendingPath: string | null = null
  let revealTimer: ReturnType<typeof setTimeout> | null = null

  const clearRevealTimer = () => {
    if (revealTimer === null) return

    window.clearTimeout(revealTimer)
    revealTimer = null
  }

  const revealPage = (path: string, delay = TRANSITION_IN_DELAY_MS) => {
    if (pendingPath !== path) return

    clearRevealTimer()
    revealTimer = window.setTimeout(() => {
      if (pendingPath !== path) return

      isVisible.value = false
      pendingPath = null
      revealTimer = null
    }, delay)
  }

  router.beforeEach(async (to, from) => {
    if (!from.matched.length || to.fullPath === from.fullPath) return

    clearRevealTimer()
    pendingPath = to.fullPath
    isVisible.value = true
    await wait(TRANSITION_OUT_MS)
  })

  router.afterEach((to, _from, failure) => {
    // Query-only navigations (pagination, filters and sorting) do not always
    // trigger Nuxt's `page:finish` hook because the page component is reused.
    // Always schedule the reveal after the router completes, otherwise the
    // transition overlay remains above the application as a black screen.
    revealPage(to.fullPath, failure ? 0 : TRANSITION_IN_DELAY_MS)
  })

  router.onError(() => {
    if (pendingPath) revealPage(pendingPath, 0)
  })

  nuxtApp.hook('page:finish', () => {
    revealPage(router.currentRoute.value.fullPath)
  })
})
