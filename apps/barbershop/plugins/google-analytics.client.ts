const GA_MEASUREMENT_ID = 'G-YYYXH2R239'
const GA_SCRIPT_ID = 'google-analytics-gtag'

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

  const trackPageView = () => {
    if (!window.gtag) return

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
    window.gtag('js', new Date())
    window.gtag('config', GA_MEASUREMENT_ID)

    const script = document.createElement('script')
    script.id = GA_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    document.head.appendChild(script)

    isLoaded = true
  }

  watch(
    canUseAnalytics,
    (allowed) => {
      if (allowed) loadGoogleAnalytics()
    },
    { immediate: true },
  )

  router.afterEach(() => {
    if (!isLoaded) return
    requestAnimationFrame(trackPageView)
  })
})
