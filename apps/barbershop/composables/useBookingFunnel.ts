import {
  bookingFunnelEventPayload,
  createBookingFunnelAttempt,
  type BookingFunnelAttempt,
  type BookingFunnelClientEventType,
  type BookingFunnelEventContext,
} from '~/utils/bookingFunnel'

const secureRandomId = () => {
  if (!import.meta.client) return null

  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  if (typeof cryptoApi?.getRandomValues !== 'function') return null

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export const useBookingFunnel = () => {
  const domain = useBarbershopDomain()
  let attempt: BookingFunnelAttempt | null = null
  const completedEvents = new Set<string>()
  const inFlightEvents = new Map<string, Promise<void>>()

  const ensureAttempt = () => {
    if (attempt) return attempt

    const randomId = secureRandomId()
    if (!randomId) return null

    attempt = createBookingFunnelAttempt(() => randomId)
    return attempt
  }

  const sessionId = () => ensureAttempt()?.anonymousSessionId

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
    attempt = null
    completedEvents.clear()
    inFlightEvents.clear()
  }

  return {
    record,
    recordInBackground,
    reset,
    sessionId,
  }
}
