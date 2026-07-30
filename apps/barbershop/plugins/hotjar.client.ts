import { isTokenizedReviewLocation } from '~/utils/reviews.js'

const HOTJAR_ID = 6726165
const HOTJAR_VERSION = 6
const HOTJAR_SCRIPT_ID = 'hotjar-tracking-code'

declare global {
  interface Window {
    hj?: {
      (...args: unknown[]): void
      q?: IArguments[]
    }
    _hjSettings?: {
      hjid: number
      hjsv: number
    }
  }
}

export default defineNuxtPlugin(() => {
  const route = useRoute()
  const { canUseAnalytics } = useCookieConsent()
  const { isPrivateReviewRoute } = useReviewPrivacy()
  let isLoaded = false
  let isLoadScheduled = false

  const hasPrivateReviewContext = () => {
    if (isPrivateReviewRoute.value) return true
    return isTokenizedReviewLocation(
      route.path,
      route.hash || window.location.hash,
    )
  }

  const runWhenIdle = (callback: () => void) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 3000 })
      return
    }

    window.setTimeout(callback, 1200)
  }

  const loadHotjar = () => {
    if (hasPrivateReviewContext()) return
    if (isLoaded || document.getElementById(HOTJAR_SCRIPT_ID)) return

    window.hj = window.hj || function hj() {
      ;(window.hj!.q = window.hj!.q || []).push(arguments)
    }
    window._hjSettings = {
      hjid: HOTJAR_ID,
      hjsv: HOTJAR_VERSION,
    }

    const script = document.createElement('script')
    script.id = HOTJAR_SCRIPT_ID
    script.async = true
    script.src = `https://static.hotjar.com/c/hotjar-${HOTJAR_ID}.js?sv=${HOTJAR_VERSION}`
    document.head.appendChild(script)

    isLoaded = true
  }

  const scheduleHotjarLoad = () => {
    if (hasPrivateReviewContext()) return
    if (isLoadScheduled || isLoaded) return
    isLoadScheduled = true

    const loadAfterIdle = () => {
      window.setTimeout(() => {
        runWhenIdle(() => {
          isLoadScheduled = false
          if (canUseAnalytics.value && !hasPrivateReviewContext()) loadHotjar()
        })
      }, 2200)
    }

    const loadAfterPageSettles = () => {
      window.setTimeout(() => {
        runWhenIdle(() => {
          isLoadScheduled = false
          if (canUseAnalytics.value && !hasPrivateReviewContext()) loadHotjar()
        })
      }, 12000)
    }

    window.addEventListener('pointerdown', loadAfterIdle, { once: true, passive: true })
    window.addEventListener('keydown', loadAfterIdle, { once: true })

    if (document.readyState === 'complete') {
      loadAfterPageSettles()
      return
    }

    window.addEventListener('load', loadAfterPageSettles, { once: true })
  }

  watch(
    canUseAnalytics,
    (allowed) => {
      if (allowed) {
        scheduleHotjarLoad()
        return
      }
      // Hotjar cannot stop an in-progress recording programmatically. Reloading
      // removes its runtime after consent is withdrawn; the fresh page will not
      // load the script while analytics consent remains disabled.
      if (isLoaded || document.getElementById(HOTJAR_SCRIPT_ID)) {
        window.location.reload()
      }
    },
    { immediate: true },
  )

  watch(
    isPrivateReviewRoute,
    (isPrivate) => {
      if (!isPrivate && canUseAnalytics.value) scheduleHotjarLoad()
    },
  )
})
