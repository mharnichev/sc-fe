export type AvailabilityTrigger = 'initial' | 'date_change' | 'refresh'
export interface BookingObservationContext {
  master_id: number
  service_ids: number[]
  target_date: string
  duration_minutes: number
  trigger: AvailabilityTrigger
}
export type AvailabilityFailure = 'timeout' | 'network' | 'http_4xx' | 'http_5xx' | 'invalid_response'
type ObservationFields =
  { event_type: 'time_step_viewed' }
  | { event_type: 'availability_requested', availability_request_id: string }
  | { event_type: 'availability_result', availability_request_id: string, slot_count: number }
  | { event_type: 'availability_failed', availability_request_id: string, error_code: AvailabilityFailure }
  | { event_type: 'availability_cancelled', availability_request_id: string, cancel_reason: 'superseded' | 'navigation' }
export type BookingObservation = BookingObservationContext & {
  event_id: string
  anonymous_session_id: string
} & ObservationFields

export const availabilityFailure = (error: unknown): AvailabilityFailure => {
  const value = error as { name?: string, cause?: { name?: string }, response?: { status?: number }, status?: number }
  if (value?.name === 'TimeoutError' || value?.cause?.name === 'TimeoutError') return 'timeout'
  const status = value?.response?.status || value?.status
  return status && status >= 500 ? 'http_5xx' : status && status >= 400 ? 'http_4xx' : 'network'
}

/** Snapshot the attempt and payload before delivery. Retries never adopt a new attempt. */
export const createBookingObservationTracker = (
  sessionId: () => string,
  randomId: () => string,
  deliver: (payload: BookingObservation) => void,
) => {
  let current: { cancel: (reason: 'superseded' | 'navigation') => void } | undefined
  const snapshot = (context: BookingObservationContext) => ({ ...context, service_ids: [...new Set(context.service_ids)].sort((a, b) => a - b), anonymous_session_id: sessionId() })
  const send = (payload: BookingObservationContext & { anonymous_session_id: string } & ObservationFields) => deliver({ ...payload, event_id: `event-${randomId()}` } as BookingObservation)
  return {
    view(context: BookingObservationContext) { send({ ...snapshot(context), event_type: 'time_step_viewed' }) },
    cancel(reason: 'superseded' | 'navigation') { current?.cancel(reason); current = undefined },
    begin(context: BookingObservationContext) {
      current?.cancel('superseded')
      const base = { ...snapshot(context), availability_request_id: `availability-${randomId()}` }
      let finished = false
      const terminal = (fields: { event_type: 'availability_result', slot_count: number } | { event_type: 'availability_failed', error_code: AvailabilityFailure } | { event_type: 'availability_cancelled', cancel_reason: 'superseded' | 'navigation' }) => {
        if (finished) return
        finished = true
        send({ ...base, ...fields })
      }
      const request = {
        result(slotCount: number) { terminal({ event_type: 'availability_result', slot_count: slotCount }) },
        fail(code: AvailabilityFailure) { terminal({ event_type: 'availability_failed', error_code: code }) },
        cancel(reason: 'superseded' | 'navigation') { terminal({ event_type: 'availability_cancelled', cancel_reason: reason }) },
      }
      current = request
      send({ ...base, event_type: 'availability_requested' })
      return request
    },
  }
}

export const deliverBookingObservation = async (
  payload: BookingObservation,
  post: (payload: BookingObservation) => Promise<unknown>,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 200)),
) => {
  // One bounded retry, with exactly the same immutable identity and content.
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await post(payload); return }
    catch (error) {
      const status = (error as { response?: { status?: number }, status?: number })?.response?.status || (error as { status?: number })?.status
      if (attempt || (status && status >= 400 && status < 500 && status !== 429)) return
      await pause()
    }
  }
}
