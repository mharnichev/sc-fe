interface BookingSlotLike {
  start_at: string
}

export const sameBookingInstant = (first?: string | null, second?: string | null) => {
  if (!first || !second) return false
  const firstTime = new Date(first).getTime()
  const secondTime = new Date(second).getTime()
  return Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime === secondTime
}

// Keep the availability response as the source of truth for the submitted
// representation. It may contain a free-window boundary such as 10:07, rather
// than a quarter-hour start.
export const matchingBookingSlotStart = (slots: BookingSlotLike[], startAt: string) =>
  slots.find(slot => sameBookingInstant(slot.start_at, startAt))?.start_at || ''

export const includesBookingStart = (slots: BookingSlotLike[], startAt: string) =>
  Boolean(matchingBookingSlotStart(slots, startAt))
