const GA_MEASUREMENT_ID = 'G-YYYXH2R239'

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

export default defineNuxtPlugin(() => {
  const route = useRoute()
  const router = useRouter()
  const { canUseAnalytics } = useCookieConsent()
  let hasTrackedInitialPageView = false

  const trackPageView = () => {
    if (!canUseAnalytics.value || !window.gtag) return

    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: route.fullPath,
      page_location: window.location.href,
      page_title: document.title,
    })
  }

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments)
    }
  }

  watch(
    canUseAnalytics,
    (allowed) => {
      if (!window.gtag) return

      window.gtag('consent', 'update', allowed ? grantedConsent : deniedConsent)

      if (allowed && !hasTrackedInitialPageView) {
        hasTrackedInitialPageView = true
        requestAnimationFrame(trackPageView)
      }
    },
    { immediate: true },
  )

  router.afterEach(() => {
    requestAnimationFrame(trackPageView)
  })
})
