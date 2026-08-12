const GOOGLE_CALENDAR_URL = 'https://calendar.google.com/calendar/render'
const SOUL_CUTS_ADDRESS = 'вул. Канатна, 6, Одеса'
const SOUL_CUTS_TIME_ZONE = 'Europe/Kyiv'

export interface GoogleCalendarBookingEvent {
  startAt: string
  durationMinutes: number
  masterName?: string
  serviceNames?: string[]
  locale?: 'uk' | 'en'
}

const googleCalendarDate = (date: Date) =>
  date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

const cleanText = (value?: string) => value?.trim() || ''

export const buildGoogleCalendarUrl = ({
  startAt,
  durationMinutes,
  masterName,
  serviceNames = [],
  locale = 'uk',
}: GoogleCalendarBookingEvent) => {
  const start = new Date(startAt)
  const normalizedDuration = Math.trunc(durationMinutes)

  if (Number.isNaN(start.getTime()) || !Number.isFinite(normalizedDuration) || normalizedDuration <= 0) return ''

  const end = new Date(start.getTime() + normalizedDuration * 60_000)
  const services = serviceNames.map(cleanText).filter(Boolean)
  const details = locale === 'en'
    ? [cleanText(masterName) && `Barber: ${cleanText(masterName)}`, services.length && `Services: ${services.join(', ')}`]
    : [cleanText(masterName) && `Майстер: ${cleanText(masterName)}`, services.length && `Послуги: ${services.join(', ')}`]

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Запис до Soul Cuts',
    dates: `${googleCalendarDate(start)}/${googleCalendarDate(end)}`,
    ctz: SOUL_CUTS_TIME_ZONE,
    location: SOUL_CUTS_ADDRESS,
  })
  const description = details.filter(Boolean).join('\n')
  if (description) params.set('details', description)

  return `${GOOGLE_CALENDAR_URL}?${params.toString()}`
}
