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
  targetDate?: string | null
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
  target_date?: string
}

type RandomId = () => string

const positiveInteger = (value: number | null | undefined) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined

const isoDate = (value: string | null | undefined) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined
}

const eventKey = (
  eventType: BookingFunnelClientEventType,
  context: BookingFunnelEventContext,
) => [
  eventType,
  positiveInteger(context.masterId) ?? '',
  positiveInteger(context.serviceId) ?? '',
  eventType === 'no_slot' ? isoDate(context.targetDate) ?? '' : '',
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
  const targetDate = eventType === 'no_slot' ? isoDate(context.targetDate) : undefined

  return {
    event_id: eventId,
    anonymous_session_id: attempt.anonymousSessionId,
    event_type: eventType,
    ...(masterId ? { master_id: masterId } : {}),
    ...(serviceId ? { service_id: serviceId } : {}),
    ...(targetDate ? { target_date: targetDate } : {}),
  }
}

export const bookingFunnelFailureEvent = (status?: number | null): BookingFunnelClientEventType =>
  status === 409 ? 'stale_schedule' : 'booking_error'
