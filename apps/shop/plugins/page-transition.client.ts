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
    if (!failure) return

    revealPage(to.fullPath, 0)
  })

  router.onError(() => {
    if (pendingPath) revealPage(pendingPath, 0)
  })

  nuxtApp.hook('page:finish', () => {
    revealPage(router.currentRoute.value.fullPath)
  })
})
