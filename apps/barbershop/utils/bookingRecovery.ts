interface RecoveryServiceLike {
  id: number
  base_service_id?: number | null
  name?: string | null
  title_uk?: string | null
  title_en?: string | null
  duration_minutes?: number | null
  price?: string | number | null
}

interface BookingAlternativesPayloadInput {
  masterId: number
  serviceIds: number[]
  desiredDate: string
  durationMinutes: number
  funnelSessionId?: string | null
}

interface WaitlistPayloadInput {
  customerName: string
  customerPhone: string
  serviceIds: number[]
  selectedMasterId: number | null
  desiredDate: string
  durationMinutes: number
  anotherMasterAcceptable: boolean
  nearbyDatesAcceptable: boolean
  maxBookableDate: string
}

const WAITLIST_OFFER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/

export const waitlistOfferTokenFromHash = (hash: string) => {
  const encodedToken = hash.replace(/^#/, '')
  if (!encodedToken) return ''

  try {
    const token = decodeURIComponent(encodedToken)
    return WAITLIST_OFFER_TOKEN_PATTERN.test(token) ? token : ''
  }
  catch {
    return ''
  }
}

const normalizeCustomTitle = (value: string | null | undefined, locale: string) =>
  value?.trim().toLocaleLowerCase(locale) || null

const normalizedPrice = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null
  const price = Number(value)
  return Number.isFinite(price) ? price : null
}

const customServiceKey = (service: RecoveryServiceLike) => JSON.stringify([
  normalizeCustomTitle(service.title_uk || service.name, 'uk-UA'),
  normalizeCustomTitle(service.title_en, 'en-US'),
  service.duration_minutes ?? null,
  normalizedPrice(service.price),
])

export const remapRecoveryServiceIds = (
  selectedServiceIds: number[],
  sourceServices: RecoveryServiceLike[],
  targetServices: RecoveryServiceLike[],
) => {
  const selected = selectedServiceIds.map(id => sourceServices.find(service => service.id === id))
  if (selected.some(service => !service)) return null

  const mapped = selected.map((source) => {
    if (!source) return undefined
    const exact = targetServices.find(candidate => candidate.id === source.id)
    if (exact) return exact.id

    if (source.base_service_id !== null && source.base_service_id !== undefined) {
      return targetServices.find(candidate => candidate.base_service_id === source.base_service_id)?.id
    }

    const sourceKey = customServiceKey(source)
    return targetServices.find(candidate =>
      (candidate.base_service_id === null || candidate.base_service_id === undefined)
      && customServiceKey(candidate) === sourceKey,
    )?.id
  })
  const ids = mapped.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
  return ids.length === selectedServiceIds.length && new Set(ids).size === ids.length ? ids : null
}

export const addRecoveryCalendarDays = (value: string, days: number) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  const date = new Date(Date.UTC(year, month - 1, day + days, 12))
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export const addRecoveryCalendarMonths = (value: string, months: number) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  const monthIndex = month - 1 + months
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 12)).getUTCDate()
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`
}

export const kyivRecoveryDateInput = (date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const bookingAlternativesPayload = (input: BookingAlternativesPayloadInput) => ({
  master_id: input.masterId,
  service_ids: [...input.serviceIds],
  desired_date: input.desiredDate,
  duration_minutes: input.durationMinutes,
  another_master_acceptable: true,
  ...(input.funnelSessionId ? { funnel_session_id: input.funnelSessionId } : {}),
})

export const publicWaitlistPayload = (input: WaitlistPayloadInput) => {
  const nearbyDateEnd = addRecoveryCalendarDays(input.desiredDate, 7)
  const acceptableDateTo = input.nearbyDatesAcceptable
    ? (nearbyDateEnd > input.maxBookableDate ? input.maxBookableDate : nearbyDateEnd)
    : input.desiredDate

  return {
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    service_ids: [...input.serviceIds],
    preferred_master_id: input.anotherMasterAcceptable ? null : input.selectedMasterId,
    desired_date: input.desiredDate,
    acceptable_date_from: input.desiredDate,
    acceptable_date_to: acceptableDateTo,
    duration_minutes: input.durationMinutes,
    notification_consent: true as const,
  }
}
