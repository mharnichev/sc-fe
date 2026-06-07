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

export default defineNuxtPlugin(() => {
  const route = useRoute()
  const router = useRouter()
  const { canUseAnalytics } = useCookieConsent()
  let isLoaded = false
  let hasTrackedInitialPageView = false

  const trackPageView = () => {
    if (!canUseAnalytics.value || !window.gtag) return

    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: route.fullPath,
      page_location: window.location.href,
      page_title: document.title,
    })
  }

  const loadGoogleAnalytics = () => {
    if (isLoaded || document.getElementById(GA_SCRIPT_ID)) return

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments)
    }
    window.gtag('consent', 'default', {
      ...deniedConsent,
      wait_for_update: 500,
    })
    window.gtag('js', new Date())
    window.gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: false,
    })

    const script = document.createElement('script')
    script.id = GA_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    document.head.appendChild(script)

    isLoaded = true
  }

  loadGoogleAnalytics()

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
    if (!isLoaded) return
    requestAnimationFrame(trackPageView)
  })
})
