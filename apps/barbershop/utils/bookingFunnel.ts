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
  serviceIds?: number[] | null
  targetDate?: string | null
  durationMinutes?: number | null
}

export interface BookingFunnelAttempt {
  anonymousSessionId: string
  eventIds: Record<string, string>
}

export interface StoredBookingFunnelAttempt {
  attempt: BookingFunnelAttempt
  expiresAt: number
  analyticsStarted: boolean
}

export interface BookingFunnelEventPayload {
  event_id: string
  anonymous_session_id: string
  event_type: BookingFunnelClientEventType
  master_id?: number
  service_id?: number
  service_ids?: number[]
  target_date?: string
  duration_minutes?: number
}

export interface NoSlotObservationState {
  canLoad: boolean
  isClosedDate: boolean
  loadedKey: string
  requestKey: string
  pending: boolean
  hasError: boolean
  slotCount: number
}

type RandomId = () => string
const SAFE_IDENTIFIER = /^[A-Za-z0-9._:-]{8,128}$/

export const createBookingFunnelId = (
  cryptoApi: Crypto | undefined,
  now: () => number = Date.now,
  random: () => number = Math.random,
) => {
  try {
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
    if (typeof cryptoApi?.getRandomValues === 'function') {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
      return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    }
  }
  catch {
    // Some legacy WebViews expose Web Crypto but throw when it is used.
  }

  // This ID is correlation-only, contains no user data, and is keyed-hashed by
  // the API. The fallback keeps attribution working in browsers without Web
  // Crypto; timestamp plus two independent random parts makes collisions
  // negligible for the two-hour attempt lifetime.
  const timestamp = Math.max(0, Math.trunc(now())).toString(36)
  const randomPart = () => Math.floor(random() * Number.MAX_SAFE_INTEGER)
    .toString(36)
    .padStart(11, '0')
  return `fallback-${timestamp}-${randomPart()}-${randomPart()}`
}

export const shouldRecordNoSlotObservation = (state: NoSlotObservationState) =>
  state.canLoad
  && !state.isClosedDate
  && state.loadedKey === state.requestKey
  && !state.pending
  && !state.hasError
  && state.slotCount === 0

const positiveInteger = (value: number | null | undefined) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined

const positiveIntegerList = (value: number[] | null | undefined) => {
  if (!Array.isArray(value)) return undefined
  const normalized = [...new Set(value.map(positiveInteger).filter((item): item is number => item !== undefined))]
    .sort((first, second) => first - second)
  return normalized.length > 0 && normalized.length <= 10 ? normalized : undefined
}

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
) => {
  const serviceId = positiveInteger(context.serviceId)
  const noSlotServiceIds = eventType === 'no_slot'
    ? positiveIntegerList(context.serviceIds) ?? (serviceId ? [serviceId] : undefined)
    : undefined
  const durationMinutes = eventType === 'no_slot'
    ? positiveInteger(context.durationMinutes)
    : undefined
  const parts: Array<string | number> = [
    eventType,
    positiveInteger(context.masterId) ?? '',
    eventType === 'no_slot' ? '' : serviceId ?? '',
    noSlotServiceIds?.join(',') ?? '',
    eventType === 'no_slot' ? isoDate(context.targetDate) ?? '' : '',
  ]
  if (eventType === 'no_slot') parts.push(durationMinutes ?? '')
  return parts.join(':')
}

export const createBookingFunnelAttempt = (randomId: RandomId): BookingFunnelAttempt => ({
  anonymousSessionId: `booking-${randomId()}`,
  eventIds: {},
})

export const parseStoredBookingFunnelAttempt = (
  value: string | null,
  now = Date.now(),
): StoredBookingFunnelAttempt | null => {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<StoredBookingFunnelAttempt>
    const attempt = parsed.attempt
    if (
      !attempt
      || !SAFE_IDENTIFIER.test(attempt.anonymousSessionId)
      || !Number.isFinite(parsed.expiresAt)
      || Number(parsed.expiresAt) <= now
      || (
        parsed.analyticsStarted !== undefined
        && typeof parsed.analyticsStarted !== 'boolean'
      )
      || !attempt.eventIds
      || typeof attempt.eventIds !== 'object'
      || Array.isArray(attempt.eventIds)
    ) {
      return null
    }

    const eventEntries = Object.entries(attempt.eventIds)
    if (
      eventEntries.length > 100
      || eventEntries.some(([key, eventId]) =>
        key.length > 256
        || typeof eventId !== 'string'
        || !SAFE_IDENTIFIER.test(eventId),
      )
    ) {
      return null
    }

    return {
      attempt: {
        anonymousSessionId: attempt.anonymousSessionId,
        eventIds: Object.fromEntries(eventEntries),
      },
      expiresAt: Number(parsed.expiresAt),
      analyticsStarted: parsed.analyticsStarted === true,
    }
  }
  catch {
    return null
  }
}

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
  const serviceIds = eventType === 'no_slot'
    ? positiveIntegerList(context.serviceIds) ?? (serviceId ? [serviceId] : undefined)
    : undefined
  const targetDate = eventType === 'no_slot' ? isoDate(context.targetDate) : undefined
  const durationMinutes = eventType === 'no_slot'
    ? positiveInteger(context.durationMinutes)
    : undefined

  return {
    event_id: eventId,
    anonymous_session_id: attempt.anonymousSessionId,
    event_type: eventType,
    ...(masterId ? { master_id: masterId } : {}),
    ...(serviceId ? { service_id: serviceId } : {}),
    ...(serviceIds ? { service_ids: serviceIds } : {}),
    ...(targetDate ? { target_date: targetDate } : {}),
    ...(durationMinutes ? { duration_minutes: durationMinutes } : {}),
  }
}

export const bookingFunnelFailureEvent = (
  status?: number | null,
): BookingFunnelClientEventType | null => {
  if (status === 409) return 'stale_schedule'
  if (!status || status >= 500) return 'booking_error'
  return null
}
