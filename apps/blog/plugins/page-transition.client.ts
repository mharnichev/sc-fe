const TRANSITION_OUT_MS = 220
const TRANSITION_IN_DELAY_MS = 80

const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration))

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const isVisible = usePageTransitionOverlay()

  router.beforeEach(async (to, from) => {
    if (!from.matched.length) {
      return
    }

    if (to.path === from.path) {
      return
    }

    isVisible.value = true
    await wait(TRANSITION_OUT_MS)
  })

  router.afterEach((to, from) => {
    if (to.path === from.path) {
      return
    }

    window.setTimeout(() => {
      isVisible.value = false
    }, TRANSITION_IN_DELAY_MS)
  })
})
