import { sanitizeAnalyticsParams, sanitizeAnalyticsUrl, suppressBlogAnalytics } from '~/utils/blogAnalyticsPrivacy'

type BlogAnalyticsEventParams = Record<string, string | number | boolean | null | undefined>

const BLOG_ANALYTICS_EVENT_PREFIX = 'blog_'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const getPrefixedEventName = (eventName: string) =>
  eventName.startsWith(BLOG_ANALYTICS_EVENT_PREFIX) ? eventName : `${BLOG_ANALYTICS_EVENT_PREFIX}${eventName}`

export const useBlogAnalytics = () => {
  const route = useRoute()
  const app = useNuxtApp()

  const trackBlogEvent = (eventName: string, params: BlogAnalyticsEventParams = {}) => {
    if (!import.meta.client || !window.gtag) return
    if (suppressBlogAnalytics(app, window.location.href, route.fullPath, document.referrer)) return

    window.gtag('event', getPrefixedEventName(eventName), sanitizeAnalyticsParams({
      ...params,
      page_path: route.path,
      page_location: window.location.origin + route.path,
      page_referrer: sanitizeAnalyticsUrl(document.referrer),
    }))
  }

  return {
    trackBlogEvent,
  }
}
