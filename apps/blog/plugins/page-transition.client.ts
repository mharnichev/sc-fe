const TRANSITION_OUT_MS = 300
const TRANSITION_IN_DELAY_MS = 80
const TRANSITION_FINISH_FALLBACK_MS = 900

const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration))

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const isVisible = usePageTransitionOverlay()
  let transitionIsActive = false
  let revealTimer: ReturnType<typeof setTimeout> | null = null

  const clearRevealTimer = () => {
    if (revealTimer === null) return

    window.clearTimeout(revealTimer)
    revealTimer = null
  }

  const revealPage = (delay = TRANSITION_IN_DELAY_MS) => {
    if (!transitionIsActive) return

    clearRevealTimer()
    revealTimer = window.setTimeout(() => {
      isVisible.value = false
      transitionIsActive = false
      revealTimer = null
    }, delay)
  }

  router.beforeEach(async (to, from) => {
    if (!from.matched.length) {
      return
    }

    if (to.fullPath === from.fullPath) {
      return
    }

    clearRevealTimer()
    transitionIsActive = true
    isVisible.value = true
    await wait(TRANSITION_OUT_MS)
  })

  router.afterEach((to, from, failure) => {
    if (failure) {
      revealPage(0)
      return
    }

    if (to.fullPath === from.fullPath || !transitionIsActive) {
      return
    }

    clearRevealTimer()
    revealTimer = window.setTimeout(() => {
      revealPage(0)
    }, TRANSITION_FINISH_FALLBACK_MS)
  })

  router.onError(() => revealPage(0))
  nuxtApp.hook('page:finish', () => revealPage())
})
