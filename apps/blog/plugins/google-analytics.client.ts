import { sanitizeAnalyticsUrl, suppressBlogAnalytics } from '~/utils/blogAnalyticsPrivacy'

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
  const app = useNuxtApp()
  const route = useRoute()
  const router = useRouter()
  const { trackBlogEvent } = useBlogAnalytics()
  let isGtagInitialized = false
  let isGtagLoadScheduled = false
  const isSuppressed = (path = route.fullPath) => {
    const suppressed = suppressBlogAnalytics(app, path, window.location.href, document.referrer)
    if (suppressed) Object.assign(window, { [`ga-disable-${GA_MEASUREMENT_ID}`]: true })
    return suppressed
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
    if (isSuppressed()) return
    ensureGtagQueue()

    if (!isGtagInitialized) {
      window.gtag?.('js', new Date())
      window.gtag?.('config', GA_MEASUREMENT_ID, {
        send_page_view: false,
        page_location: window.location.origin + route.path,
        page_path: route.path,
        page_referrer: sanitizeAnalyticsUrl(document.referrer),
      })
      isGtagInitialized = true
    }

    loadGtagScript()
  }

  const scheduleGtagLoad = () => {
    if (isGtagLoadScheduled || isSuppressed()) return
    isGtagLoadScheduled = true

    runAfterInitialLoad(() => {
      isGtagLoadScheduled = false
      initializeGtag()
    })
  }

  const trackPageView = () => {
    if (isSuppressed()) return
    ensureGtagQueue()
    scheduleGtagLoad()
    trackBlogEvent('page_view', {
      page_location: window.location.origin + route.path,
      page_path: route.path,
      page_referrer: sanitizeAnalyticsUrl(document.referrer),
      page_title: document.title,
    })
  }

  router.beforeEach(to => { isSuppressed(to.fullPath) })
  if (isSuppressed()) return
  ensureGtagQueue()
  window.requestAnimationFrame(trackPageView)

  router.afterEach(() => {
    window.requestAnimationFrame(trackPageView)
  })
})
