export interface NoSlotService { service_id: number; service_name: string | null }
export interface NoSlotAttempt {
  attempt_id: string
  observations: number
  contexts: number
  services: NoSlotService[]
  durations_minutes: number[]
  checked_dates: number
  date_from: string | null
  date_to: string | null
  first_observed_at: string
  last_observed_at: string
  later_time_selection: boolean
  later_booking_same_master: boolean
  later_booking_other_master: boolean
  later_booking_unknown_master: boolean
  rapid_checks: number
}
export interface NoSlotCheck {
  target_date: string | null
  services: NoSlotService[]
  duration_minutes: number | null
  observed_at: string
}
export interface NoSlotPage<T> { items: T[]; total: number; offset: number; limit: number; has_more: boolean; snapshot_id: number }

export const noSlotDateRange = (from: string | null, to: string | null) => {
  const format = (value: string) => new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
  return from && to ? (from === to ? format(from) : `${format(from)} — ${format(to)}`) : 'Дата не визначена'
}
export const noSlotActivity = (value: string) => new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZone: 'Europe/Kyiv',
}).format(new Date(value))
export const noSlotServices = (services: NoSlotService[]) => services.length
  ? services.map(service => service.service_name || `Послуга #${service.service_id}`).join(', ')
  : 'Послуги не визначено'

// Reject malformed or incompatible pages instead of silently rendering partial evidence.
export const parseNoSlotPage = <T extends NoSlotAttempt | NoSlotCheck>(value: unknown, kind: 'attempts' | 'checks'): NoSlotPage<T> => {
  const fail = (): never => { throw new Error('Некоректна відповідь історії перевірок') }
  const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail()
  const count = (v: unknown): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : fail()
  const stamp = (v: unknown) => { if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) fail() }
  const date = (v: unknown) => {
    if (v === null) return
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) fail()
  }
  const page = record(value)
  const total = count(page.total), offset = count(page.offset), limit = count(page.limit)
  count(page.snapshot_id)
  if (!limit || typeof page.has_more !== 'boolean' || !Array.isArray(page.items)) fail()
  const items = page.items as unknown[]
  if (items.length > limit || (items.length > 0 && offset + items.length > total) || page.has_more !== (offset + items.length < total) || (page.has_more && items.length === 0)) fail()
  const ids = new Set<string>()
  for (const value of items) {
    const item = record(value)
    if (!Array.isArray(item.services)) fail()
    for (const value of item.services as unknown[]) {
      const service = record(value)
      if (!count(service.service_id) || (service.service_name !== null && typeof service.service_name !== 'string')) fail()
    }
    if (kind === 'checks') {
      date(item.target_date)
      stamp(item.observed_at)
      if (item.duration_minutes !== null && !count(item.duration_minutes)) fail()
    } else {
      if (typeof item.attempt_id !== 'string' || !item.attempt_id || ids.has(item.attempt_id)) fail()
      ids.add(item.attempt_id as string)
      for (const key of ['observations', 'contexts', 'checked_dates', 'rapid_checks']) count(item[key])
      for (const key of ['later_time_selection', 'later_booking_same_master', 'later_booking_other_master', 'later_booking_unknown_master']) if (typeof item[key] !== 'boolean') fail()
      date(item.date_from); date(item.date_to)
      stamp(item.first_observed_at); stamp(item.last_observed_at)
      if (!Array.isArray(item.durations_minutes) || !item.durations_minutes.every(v => count(v) > 0)) fail()
    }
  }
  return value as NoSlotPage<T>
}
