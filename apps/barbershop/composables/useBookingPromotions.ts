import type { PublicBookingPromotion } from '~/utils/bookingPromotions'

const OFFER_REFRESH_INTERVAL_MS = 5 * 60 * 1000
let refreshInFlight: Promise<void> | null = null

/** Public offer terms only. Customer eligibility is confirmed by booking quotes. */
export const useBookingPromotions = () => {
  const api = useApi()
  const { data: offers, pending, refresh: refreshAsyncData } = useAsyncData<PublicBookingPromotion[]>(
    'public-booking-promotions',
    async () => {
      try {
        return await api<PublicBookingPromotion[]>('/public/booking-promotions')
      }
      catch {
        // Expired or disabled terms must disappear instead of remaining in the payload cache.
        return []
      }
    },
    {
      default: () => [],
    },
  )

  const refresh = async () => {
    if (!refreshInFlight) {
      refreshInFlight = refreshAsyncData().finally(() => {
        refreshInFlight = null
      })
    }
    await refreshInFlight
  }

  if (import.meta.client) {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return
      void refresh()
    }
    let refreshInterval: number | undefined
    let disposed = false

    // onMounted can still run during hydration, when Nuxt reuses the SSR payload.
    onNuxtReady(() => {
      if (!disposed) void refresh()
    })

    onMounted(() => {
      window.addEventListener('focus', refreshWhenVisible)
      document.addEventListener('visibilitychange', refreshWhenVisible)
      refreshInterval = window.setInterval(refreshWhenVisible, OFFER_REFRESH_INTERVAL_MS)
    })

    onBeforeUnmount(() => {
      disposed = true
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      if (refreshInterval !== undefined) window.clearInterval(refreshInterval)
    })
  }

  return { offers, pending, refresh }
}
