export const bookingFunnelClientEventTypes = [
  'booking_start',
  'service_selected',
  'master_selected',
  'slot_selected',
  'contact_entered',
  'no_slot',
  'stale_schedule',
  'booking_error',
] as const

export type BookingFunnelClientEventType = typeof bookingFunnelClientEventTypes[number]

export interface BookingFunnelEventContext {
  masterId?: number | null
  serviceId?: number | null
  /**
   * Separates repeatable observations, such as no-slot results for different
   * dates. It is used only to derive an idempotency key and is never sent.
   */
  dedupeKey?: string
}

export interface BookingFunnelAttempt {
  anonymousSessionId: string
  eventIds: Record<string, string>
}

export interface BookingFunnelEventPayload {
  event_id: string
  anonymous_session_id: string
  event_type: BookingFunnelClientEventType
  master_id?: number
  service_id?: number
}

type RandomId = () => string

const positiveInteger = (value: number | null | undefined) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined

const eventKey = (
  eventType: BookingFunnelClientEventType,
  context: BookingFunnelEventContext,
) => [
  eventType,
  positiveInteger(context.masterId) ?? '',
  positiveInteger(context.serviceId) ?? '',
  context.dedupeKey || '',
].join(':')

export const createBookingFunnelAttempt = (randomId: RandomId): BookingFunnelAttempt => ({
  anonymousSessionId: `booking-${randomId()}`,
  eventIds: {},
})

export const bookingFunnelEventPayload = (
  attempt: BookingFunnelAttempt,
  eventType: BookingFunnelClientEventType,
  context: BookingFunnelEventContext,
  randomId: RandomId,
): BookingFunnelEventPayload => {
  const key = eventKey(eventType, context)
  const eventId = attempt.eventIds[key] || `event-${randomId()}`
  attempt.eventIds[key] = eventId

  const masterId = positiveInteger(context.masterId)
  const serviceId = positiveInteger(context.serviceId)

  return {
    event_id: eventId,
    anonymous_session_id: attempt.anonymousSessionId,
    event_type: eventType,
    ...(masterId ? { master_id: masterId } : {}),
    ...(serviceId ? { service_id: serviceId } : {}),
  }
}

export const bookingFunnelFailureEvent = (status?: number | null): BookingFunnelClientEventType =>
  status === 409 ? 'stale_schedule' : 'booking_error'
