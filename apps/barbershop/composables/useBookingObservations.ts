import { createBookingFunnelId } from '~/utils/bookingFunnel'
import { createBookingObservationTracker, deliverBookingObservation } from '~/utils/bookingObservations'

export const useBookingObservations = (sessionId: () => string) => {
  const api = useApi()
  return createBookingObservationTracker(sessionId, () => createBookingFunnelId(globalThis.crypto), payload => {
    void deliverBookingObservation(payload, body => api('/public/booking-funnel/observations', {
      method: 'POST', body, keepalive: true, retry: 0, timeout: 5000,
    }))
  })
}
