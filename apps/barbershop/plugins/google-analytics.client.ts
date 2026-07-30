import { isTokenizedReviewLocation } from '~/utils/reviews.js'

const GA_MEASUREMENT_ID = 'G-YYYXH2R239'
const GA_SCRIPT_ID = 'google-analytics-gtag'

const deniedConsent = {
  ad_personalization: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  analytics_storage: 'denied',
} as const

const grantedConsent = {
  ad_personalization: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  analytics_storage: 'granted',
} as const

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const runAfterInitialLoad = (callback: () => void) => {
  const scheduleIdle = () => {
    window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(callback, { timeout: 2500 })
        return
      }

      callback()
    }, 10000)
  }

  if (document.readyState === 'complete') {
    scheduleIdle()
    return
  }

  window.addEventListener('load', scheduleIdle, { once: true })
}

export default defineNuxtPlugin(() => {
  const route = useRoute()
  const router = useRouter()
  const { canUseAnalytics } = useCookieConsent()
  const { isPrivateReviewRoute } = useReviewPrivacy()
  let hasTrackedInitialPageView = false
  let isGtagInitialized = false
  let isGtagLoadScheduled = false
  const pendingCallbacks: (() => void)[] = []
  const hasPrivateReviewContext = () => {
    if (isPrivateReviewRoute.value) return true
    return isTokenizedReviewLocation(
      route.path,
      route.hash || window.location.hash,
    )
  }

  const ensureGtagQueue = () => {
    window.dataLayer = window.dataLayer || []
    if (window.gtag) return

    window.gtag = function gtag() {
      window.dataLayer?.push(arguments)
    }
  }

  const loadGtagScript = () => {
    if (document.getElementById(GA_SCRIPT_ID)) return

    const script = document.createElement('script')
    script.id = GA_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    document.head.appendChild(script)
  }

  const initializeGtag = () => {
    ensureGtagQueue()

    if (!isGtagInitialized) {
      window.gtag?.('consent', 'default', grantedConsent)
      window.gtag?.('js', new Date())
      window.gtag?.('config', GA_MEASUREMENT_ID, {
        send_page_view: false,
      })
      isGtagInitialized = true
    }

    loadGtagScript()
  }

  const scheduleGtagLoad = (callback?: () => void) => {
    if (callback) {
      pendingCallbacks.push(callback)
    }

    if (isGtagLoadScheduled) return
    isGtagLoadScheduled = true

    runAfterInitialLoad(() => {
      isGtagLoadScheduled = false

      if (!canUseAnalytics.value) {
        pendingCallbacks.length = 0
        return
      }

      initializeGtag()

      const callbacks = pendingCallbacks.splice(0)
      callbacks.forEach(queuedCallback => queuedCallback())
    })
  }

  const trackPageView = () => {
    if (!canUseAnalytics.value) return

    const fragmentFreePath = route.fullPath.split('#', 1)[0] || route.path
    const privateReviewContext = hasPrivateReviewContext()
    const pagePath = privateReviewContext ? '/masters' : fragmentFreePath
    const pageLocation = privateReviewContext
      ? `${window.location.origin}/masters`
      : `${window.location.origin}${fragmentFreePath}`
    const pageTitle = document.title

    scheduleGtagLoad(() => {
      window.gtag?.('event', 'page_view', {
        page_path: pagePath,
        page_location: pageLocation,
        page_title: pageTitle,
      })
    })
  }

  ensureGtagQueue()
  window.gtag?.('consent', 'default', deniedConsent)

  watch(
    canUseAnalytics,
    (allowed) => {
      ensureGtagQueue()
      window.gtag?.('consent', 'update', allowed ? grantedConsent : deniedConsent)

      if (allowed && !hasTrackedInitialPageView) {
        hasTrackedInitialPageView = true
        trackPageView()
      }
    },
    { immediate: true },
  )

  router.afterEach(async () => {
    if (!canUseAnalytics.value) return

    await nextTick()
    trackPageView()
  })
})
