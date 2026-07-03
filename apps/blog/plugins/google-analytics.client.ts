const GA_MEASUREMENT_ID = 'G-YYYXH2R239'
const GA_SCRIPT_ID = 'blog-google-analytics-gtag'

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
  const { trackBlogEvent } = useBlogAnalytics()
  let isGtagInitialized = false
  let isGtagLoadScheduled = false

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
      window.gtag?.('js', new Date())
      window.gtag?.('config', GA_MEASUREMENT_ID, {
        send_page_view: false,
      })
      isGtagInitialized = true
    }

    loadGtagScript()
  }

  const scheduleGtagLoad = () => {
    if (isGtagLoadScheduled) return
    isGtagLoadScheduled = true

    runAfterInitialLoad(() => {
      isGtagLoadScheduled = false
      initializeGtag()
    })
  }

  const trackPageView = () => {
    ensureGtagQueue()
    scheduleGtagLoad()
    trackBlogEvent('page_view', {
      page_location: window.location.href,
      page_path: route.fullPath,
      page_title: document.title,
    })
  }

  ensureGtagQueue()
  window.requestAnimationFrame(trackPageView)

  router.afterEach(() => {
    window.requestAnimationFrame(trackPageView)
  })
})
