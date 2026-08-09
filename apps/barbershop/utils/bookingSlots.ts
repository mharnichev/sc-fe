interface BookingSlotLike {
  start_at: string
}

export const sameBookingInstant = (first?: string | null, second?: string | null) => {
  if (!first || !second) return false
  const firstTime = new Date(first).getTime()
  const secondTime = new Date(second).getTime()
  return Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime === secondTime
}

export const includesBookingStart = (slots: BookingSlotLike[], startAt: string) =>
  slots.some(slot => sameBookingInstant(slot.start_at, startAt))
