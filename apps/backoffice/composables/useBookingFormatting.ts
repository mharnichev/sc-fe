import type { Booking, BookingStatus, Master, PaginatedResponse } from '~/composables/useBackofficeApi'

interface LocalizedServiceText {
  id?: number | string
  name?: string | null
  title_uk?: string | null
  title_en?: string | null
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
}

interface BookingServiceOption extends LocalizedServiceText {
  duration_minutes?: number
  price?: string | number
}

const timeZone = 'Europe/Kyiv'
const statuses: BookingStatus[] = ['confirmed', 'cancelled', 'completed']
const statusLabels: Record<BookingStatus, string> = {
  confirmed: 'Підтверджено',
  cancelled: 'Скасовано',
  completed: 'Завершено',
}

const pad = (value: number) => String(value).padStart(2, '0')

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
})

const getTimeZoneOffsetMs = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )

  return asUtc - date.getTime()
}

const parseDateTime = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const customerName = (booking: Booking) => {
  if (booking.customer_name) return booking.customer_name
  const first = booking.customer?.first_name || booking.customer?.name || ''
  const last = booking.customer?.last_name || booking.customer?.surname || ''
  return `${first} ${last}`.trim() || 'Невідомий клієнт'
}

const localizedMasterName = (master?: Master | null, locale: 'uk' | 'en' = 'uk') => {
  if (!master) return ''
  const first = locale === 'en'
    ? master.first_name_en
    : master.first_name_uk || master.full_name
  const last = locale === 'en'
    ? master.last_name_en
    : master.last_name_uk || master.last_name
  const fullName = `${first || ''} ${last || ''}`.trim()
  return locale === 'en'
    ? master.full_name_en || fullName
    : master.full_name_uk || fullName || master.full_name || master.name || ''
}

const masterName = (master?: Master | null) =>
  localizedMasterName(master) || (master?.id ? `Майстер #${master.id}` : 'Не призначено')

const masterNameEn = (master?: Master | null) =>
  localizedMasterName(master, 'en') || masterName(master)

const bookingRedirectMasterId = (master?: Master | null) =>
  master?.bookingRedirectMasterId ?? master?.booking_redirect_master_id ?? null

const redirectedFromMaster = (booking: Booking) =>
  booking.redirectedFromMaster || booking.redirected_from_master || null

const redirectedFromMasterId = (booking: Booking) =>
  booking.redirectedFromMasterId ?? booking.redirected_from_master_id ?? redirectedFromMaster(booking)?.id ?? null

const redirectedFromMasterName = (booking: Booking) => {
  const master = redirectedFromMaster(booking)
  if (master?.full_name) return master.full_name
  const masterId = redirectedFromMasterId(booking)
  return masterId ? `Майстер #${masterId}` : ''
}

const bookingRedirectSourceLabel = (booking: Booking) => {
  const name = redirectedFromMasterName(booking)
  return name ? `Перенаправлено від: ${name}` : ''
}

const serviceName = (service?: LocalizedServiceText | null) =>
  service?.title_uk || service?.name || service?.title_en || (service?.id ? `Послуга #${service.id}` : 'Немає послуги')

const bookingServiceIds = (booking: Booking) => {
  const ids = booking.service_ids?.length
    ? booking.service_ids
    : booking.services?.length
      ? booking.services.map(service => service.id)
      : booking.service_id
        ? [booking.service_id]
        : booking.service?.id
          ? [booking.service.id]
          : []

  return [...new Set(ids.map(id => Number(id)).filter(Number.isFinite))]
}

const bookingServices = (booking: Booking, services: BookingServiceOption[] = []) => {
  const byId = new Map<number, BookingServiceOption>()
  for (const service of [...(booking.services || []), ...(booking.service ? [booking.service] : []), ...services]) {
    byId.set(Number(service.id), service)
  }

  return bookingServiceIds(booking).map(id => byId.get(id)).filter(Boolean) as BookingServiceOption[]
}

const bookingServicesLabel = (booking: Booking, services: BookingServiceOption[] = []) => {
  const labels = bookingServices(booking, services).map(service => serviceName(service))
  if (labels.length) return labels.join(', ')
  return booking.service_id ? `Послуга #${booking.service_id}` : 'Немає послуги'
}

const serviceNameEn = (service?: LocalizedServiceText | null) =>
  service?.title_en || ''

const serviceDescriptionUk = (service?: LocalizedServiceText | null) =>
  service?.description_uk || service?.description || ''

const serviceDescriptionEn = (service?: LocalizedServiceText | null) =>
  service?.description_en || ''

const formatDuration = (minutes?: number | null) => {
  const value = Number(minutes || 0)
  if (!value || value < 0) return '0 хв'
  const hours = Math.floor(value / 60)
  const rest = value % 60
  if (!hours) return `${rest} хв`
  if (!rest) return `${hours} год`
  return `${hours} год ${rest} хв`
}

const formatPrice = (price?: number | string | null) => {
  const value = Number(price || 0)
  return `${Number.isInteger(value) ? value : value.toFixed(2)} грн`
}

const formatMoney = (amount?: number | string | null) => {
  const value = Number(amount || 0)
  return `${value.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`
}

export const useBookingFormatting = () => {
  const todayInput = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
  }

  const addDaysInput = (dateInput: string, days: number) => {
    const [year, month, day] = dateInput.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day + days, 12))
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  }

  const toKyivIso = (dateInput: string, timeInput: string) => {
    const [year, month, day] = dateInput.split('-').map(Number)
    const [hour, minute] = timeInput.split(':').map(Number)
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
    const offset = getTimeZoneOffsetMs(utcGuess)
    return new Date(utcGuess.getTime() - offset).toISOString()
  }

  const formatDate = (value?: string | null) => {
    const date = parseDateTime(value)
    return date ? dateFormatter.format(date) : '-'
  }

  const formatDateTime = (value?: string | null) => {
    const date = parseDateTime(value)
    return date ? dateTimeFormatter.format(date) : '-'
  }

  const formatTime = (value?: string | null) => {
    const date = parseDateTime(value)
    return date ? timeFormatter.format(date) : '-'
  }

  const bookingStart = (booking: Booking) => booking.start_at || booking.scheduled_at || ''

  const bookingEnd = (booking: Booking) => booking.end_at || ''

  const bookingComment = (booking: Booking) =>
    booking.customer_comment || booking.comment || booking.note || ''

  const bookingPhone = (booking: Booking) =>
    booking.customer_phone || booking.customer?.phone || ''

  const normalizeItems = <T>(response?: T[] | PaginatedResponse<T> | null) =>
    Array.isArray(response) ? response : response?.items || []

  const normalizeTotal = <T>(response?: T[] | PaginatedResponse<T> | null) =>
    Array.isArray(response) ? response.length : response?.total || 0

  const isValidBookingStatus = (status: string): status is BookingStatus =>
    statuses.includes(status as BookingStatus)

  const formatBookingStatus = (status: BookingStatus | string) =>
    statusLabels[status as BookingStatus] || status

  const apiErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error && 'response' in error) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status === 403) return 'У вас немає прав для цієї дії.'
      if (status === 404) return 'Запитаний ресурс бронювання не знайдено.'
      if (status === 409) return 'Це бронювання конфліктує з іншою зміною в календарі.'
    }
    if (typeof error === 'object' && error && 'data' in error) {
      const data = (error as { data?: { detail?: unknown } }).data
      if (data?.detail) return String(data.detail)
    }
    return fallback
  }

  return {
    timeZone,
    statuses,
    todayInput,
    addDaysInput,
    toKyivIso,
    formatDate,
    formatDateTime,
    formatTime,
    bookingStart,
    bookingEnd,
    bookingComment,
    bookingPhone,
    customerName,
    masterName,
    masterNameEn,
    bookingRedirectMasterId,
    redirectedFromMaster,
    redirectedFromMasterId,
    redirectedFromMasterName,
    bookingRedirectSourceLabel,
    serviceName,
    bookingServiceIds,
    bookingServices,
    bookingServicesLabel,
    serviceNameEn,
    serviceDescriptionUk,
    serviceDescriptionEn,
    formatDuration,
    formatPrice,
    formatMoney,
    normalizeItems,
    normalizeTotal,
    isValidBookingStatus,
    formatBookingStatus,
    apiErrorMessage,
  }
}
