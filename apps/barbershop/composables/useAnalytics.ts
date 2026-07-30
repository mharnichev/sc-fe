type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export const useAnalytics = () => {
  const { canUseAnalytics } = useCookieConsent()
  const { isPrivateReviewRoute } = useReviewPrivacy()

  const trackEvent = (eventName: string, params: AnalyticsEventParams = {}) => {
    if (!import.meta.client || !canUseAnalytics.value || !window.gtag) return

    const contextualParams = isPrivateReviewRoute.value
      ? {
          ...params,
          page_path: '/masters',
          page_location: `${window.location.origin}/masters`,
        }
      : params
    const cleanParams = Object.fromEntries(
      Object.entries(contextualParams).filter(([, value]) => value !== undefined && value !== ''),
    )

    window.gtag('event', eventName, cleanParams)
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
    trackContactClick,
  }
}
