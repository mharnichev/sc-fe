const GA_MEASUREMENT_ID = 'G-YYYXH2R239'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  const route = useRoute()
  const router = useRouter()
  const { trackBlogEvent } = useBlogAnalytics()

  const trackPageView = () => {
    trackBlogEvent('page_view', {
      page_location: window.location.href,
      page_path: route.fullPath,
      page_title: document.title,
    })
  }

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments)
    }
  }

  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: route.fullPath,
    page_location: window.location.href,
    page_title: document.title,
    send_page_view: false,
  })

  requestAnimationFrame(trackPageView)

  router.afterEach(() => {
    requestAnimationFrame(trackPageView)
  })
})
