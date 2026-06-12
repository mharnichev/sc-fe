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

const getCleanParams = (params: BlogAnalyticsEventParams) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )

export const useBlogAnalytics = () => {
  const route = useRoute()

  const trackBlogEvent = (eventName: string, params: BlogAnalyticsEventParams = {}) => {
    if (!import.meta.client || !window.gtag) return

    window.gtag('event', getPrefixedEventName(eventName), getCleanParams({
      page_path: route.fullPath,
      ...params,
    }))
  }

  return {
    trackBlogEvent,
  }
}
