const REPEAT_BOOKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,512}$/

export const repeatBookingTokenFromHash = (hash: string) => {
  const candidate = hash.startsWith('#') ? hash.slice(1) : ''
  return REPEAT_BOOKING_TOKEN_PATTERN.test(candidate) ? candidate : ''
}
