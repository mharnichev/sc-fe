import {
  bookingFunnelEventPayload,
  createBookingFunnelAttempt,
  createBookingFunnelId,
  parseStoredBookingFunnelAttempt,
  type BookingFunnelClientEventType,
  type BookingFunnelEventContext,
  type StoredBookingFunnelAttempt,
} from '~/utils/bookingFunnel'

const BOOKING_FUNNEL_STORAGE_KEY = 'soulcuts.booking-funnel-attempt.v1'
const BOOKING_FUNNEL_ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000

const secureRandomId = () => {
  if (!import.meta.client) return null
  return createBookingFunnelId(globalThis.crypto)
}

export const useBookingFunnel = () => {
  const domain = useBarbershopDomain()
  const storedAttempt = useState<StoredBookingFunnelAttempt | null>(
    'booking-funnel-attempt',
    () => null,
  )
  const storageHydrated = useState<boolean>('booking-funnel-attempt-hydrated', () => false)
  const completedEvents = new Set<string>()
  const inFlightEvents = new Map<string, Promise<void>>()

  const persistAttempt = () => {
    if (!import.meta.client) return

    try {
      if (storedAttempt.value) {
        window.sessionStorage.setItem(
          BOOKING_FUNNEL_STORAGE_KEY,
          JSON.stringify(storedAttempt.value),
        )
      }
      else {
        window.sessionStorage.removeItem(BOOKING_FUNNEL_STORAGE_KEY)
      }
    }
    catch {
      // Storage can be unavailable in privacy modes; in-memory tracking still works.
    }
  }

  const hydrateAttempt = () => {
    if (!import.meta.client || storageHydrated.value) return
    storageHydrated.value = true

    try {
      storedAttempt.value = parseStoredBookingFunnelAttempt(
        window.sessionStorage.getItem(BOOKING_FUNNEL_STORAGE_KEY),
      )
    }
    catch {
      storedAttempt.value = null
    }
  }

  const ensureAttempt = () => {
    if (!import.meta.client) return null
    hydrateAttempt()

    const now = Date.now()
    if (storedAttempt.value && storedAttempt.value.expiresAt > now) {
      storedAttempt.value.expiresAt = now + BOOKING_FUNNEL_ATTEMPT_TTL_MS
      persistAttempt()
      return storedAttempt.value.attempt
    }

    const randomId = secureRandomId()
    if (!randomId) return null

    const attempt = createBookingFunnelAttempt(() => randomId)
    storedAttempt.value = {
      attempt,
      expiresAt: now + BOOKING_FUNNEL_ATTEMPT_TTL_MS,
      analyticsStarted: false,
    }
    persistAttempt()
    return attempt
  }

  const sessionId = () => {
    const attempt = ensureAttempt()
    if (!attempt) throw new Error('Booking funnel session is available only in the browser')
    return attempt.anonymousSessionId
  }

  const claimAnalyticsStart = () => {
    if (!ensureAttempt() || !storedAttempt.value || storedAttempt.value.analyticsStarted) return false

    storedAttempt.value.analyticsStarted = true
    persistAttempt()
    return true
  }

  const record = (
    eventType: BookingFunnelClientEventType,
    context: BookingFunnelEventContext = {},
  ): Promise<void> => {
    const currentAttempt = ensureAttempt()
    if (!currentAttempt) return Promise.resolve()

    const payload = bookingFunnelEventPayload(
      currentAttempt,
      eventType,
      context,
      () => secureRandomId() || currentAttempt.anonymousSessionId,
    )
    persistAttempt()
    const eventId = payload.event_id

    if (completedEvents.has(eventId)) return Promise.resolve()
    const existingRequest = inFlightEvents.get(eventId)
    if (existingRequest) return existingRequest

    const request = domain.recordBookingFunnelEvent(payload)
      .then(() => {
        completedEvents.add(eventId)
      })
      .catch(() => {
        // Funnel observability is best effort and must never block a booking.
      })
      .finally(() => {
        inFlightEvents.delete(eventId)
      })

    inFlightEvents.set(eventId, request)
    return request
  }

  const recordInBackground = (
    eventType: BookingFunnelClientEventType,
    context: BookingFunnelEventContext = {},
  ) => {
    void record(eventType, context)
  }

  const reset = () => {
    storedAttempt.value = null
    persistAttempt()
    completedEvents.clear()
    inFlightEvents.clear()
  }

  return {
    record,
    recordInBackground,
    claimAnalyticsStart,
    reset,
    sessionId,
  }
}
