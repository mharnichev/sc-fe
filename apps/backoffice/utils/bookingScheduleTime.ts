/** Same-day, 24-hour appointment times. */
export const parseBookingTime = (value: string): number | null => {
  if (!/^\d{2}:\d{2}$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null
}

export const bookingEndTime = (start: string, duration: number): string => {
  const minutes = parseBookingTime(start)
  if (minutes === null || !Number.isInteger(duration) || duration < 1 || minutes + duration >= 1440) return ''
  const end = minutes + duration
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

export const bookingTimeDuration = (start: string, end: string): number | null => {
  const from = parseBookingTime(start), to = parseBookingTime(end)
  return from !== null && to !== null && to > from ? to - from : null
}
