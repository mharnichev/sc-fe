type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export const useAnalytics = () => {
  const { canUseAnalytics } = useCookieConsent()
  const { isPrivateReviewRoute } = useReviewPrivacy()
  const route = useRoute()

  const privateCustomerActivityContext = () => [
    '/booking', '/booking/', '/booking/manage', '/booking/manage/',
    '/booking/cancel', '/booking/cancel/', '/booking/repeat', '/booking/repeat/',
  ].includes(route.path)
  const canTrackEvent = () => import.meta.client && canUseAnalytics.value && Boolean(window.gtag)
    && !privateCustomerActivityContext()

  const trackEvent = (eventName: string, params: AnalyticsEventParams = {}) => {
    if (!canTrackEvent()) return false

    const privateWaitlistOfferContext =
      route.path === '/booking/waitlist-offer' || route.path === '/booking/waitlist-offer/'
    const waitlistSafeParams = privateWaitlistOfferContext
      ? {
          ...params,
          page_path: '/booking/waitlist-offer',
          page_location: `${window.location.origin}/booking/waitlist-offer`,
        }
      : params
    const contextualParams = isPrivateReviewRoute.value
      ? {
          ...params,
          page_path: '/masters',
          page_location: `${window.location.origin}/masters`,
        }
      : waitlistSafeParams
    const cleanParams = Object.fromEntries(
      Object.entries(contextualParams).filter(([, value]) => value !== undefined && value !== ''),
    )

    window.gtag!('event', eventName, cleanParams)
    return true
  }

  const trackContactClick = (linkType: string, location: string) => {
    trackEvent(`click_${linkType}`, {
      location,
    })
    trackEvent('contact_link_click', {
      link_type: linkType,
      location,
    })
  }

  return {
    trackEvent,
    canTrackEvent,
    trackContactClick,
  }
}
