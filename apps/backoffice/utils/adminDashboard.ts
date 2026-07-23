import type {
  DashboardActionCode,
  DashboardComparableMetric,
  DashboardMasterBreakdownItem,
} from '~/utils/adminDashboardContract'

export type AdminDashboardPreset = 'today' | '7d' | '30d' | 'mtd' | 'custom'
export type AdminDashboardMasterSortKey =
  | 'gross_revenue'
  | 'completed_visits'
  | 'average_check'
  | 'utilisation_rate'
  | 'revenue_per_available_hour'
  | 'returning_clients'
  | 'approved_rating'
export type SortDirection = 'asc' | 'desc'
export interface AdminDashboardMetricComparison {
  absolute_change: null
  percentage_change: string | number | null
}

export interface DashboardDateRange {
  preset: AdminDashboardPreset
  dateFrom: string
  dateTo: string
}

const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/
export const DASHBOARD_MAX_RANGE_DAYS = 366

export const addDashboardDays = (dateInput: string, days: number) => {
  const [year, month, day] = dateInput.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days, 12))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export const isDashboardDateInput = (value: unknown): value is string => {
  if (typeof value !== 'string' || !dateInputPattern.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day, 12))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

export const resolveDashboardPreset = (
  preset: Exclude<AdminDashboardPreset, 'custom'>,
  today: string,
): DashboardDateRange => {
  if (preset === 'today') return { preset, dateFrom: today, dateTo: today }
  if (preset === '7d') return { preset, dateFrom: addDashboardDays(today, -6), dateTo: today }
  if (preset === '30d') return { preset, dateFrom: addDashboardDays(today, -29), dateTo: today }
  return { preset, dateFrom: `${today.slice(0, 7)}-01`, dateTo: today }
}

export const resolveDashboardRange = (
  query: {
    preset?: unknown
    dateFrom?: unknown
    dateTo?: unknown
  },
  today: string,
): DashboardDateRange => {
  const preset = ['today', '7d', '30d', 'mtd', 'custom'].includes(String(query.preset))
    ? query.preset as AdminDashboardPreset
    : '30d'

  if (
    preset === 'custom'
    && isDashboardDateInput(query.dateFrom)
    && isDashboardDateInput(query.dateTo)
    && dashboardDateRangeError(query.dateFrom, query.dateTo) === null
  ) {
    return { preset, dateFrom: query.dateFrom, dateTo: query.dateTo }
  }

  return resolveDashboardPreset(preset === 'custom' ? '30d' : preset, today)
}

export const dashboardRangeDays = (dateFrom: string, dateTo: string) => {
  if (!isDashboardDateInput(dateFrom) || !isDashboardDateInput(dateTo)) return null
  const start = Date.parse(`${dateFrom}T12:00:00Z`)
  const end = Date.parse(`${dateTo}T12:00:00Z`)
  return Math.floor((end - start) / 86_400_000) + 1
}

export const dashboardDateRangeError = (dateFrom: string, dateTo: string) => {
  if (!dateFrom || !dateTo) return 'Оберіть початкову та кінцеву дати.'
  if (!isDashboardDateInput(dateFrom) || !isDashboardDateInput(dateTo)) {
    return 'Вкажіть коректні календарні дати.'
  }
  if (dateFrom > dateTo) return 'Початкова дата не може бути пізніше кінцевої.'
  const days = dashboardRangeDays(dateFrom, dateTo)
  if (days !== null && days > DASHBOARD_MAX_RANGE_DAYS) {
    return `Період не може перевищувати ${DASHBOARD_MAX_RANGE_DAYS} календарних днів.`
  }
  return null
}

export const hasDashboardMetric = (value: unknown) =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))

export const normalizeDashboardRate = (value: string | number | null | undefined) => {
  if (!hasDashboardMetric(value)) return null
  return Number(value)
}

export const formatDashboardRate = (
  value: string | number | null | undefined,
  maximumFractionDigits = 1,
) => {
  const percentage = normalizeDashboardRate(value)
  if (percentage === null) return 'Недоступно'
  return `${percentage.toLocaleString('uk-UA', { maximumFractionDigits })}%`
}

export const formatDashboardHours = (value: number | null | undefined) => {
  if (!hasDashboardMetric(value)) return 'Недоступно'
  return `${Number(value).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} год`
}

export const formatDashboardMinutesAsHours = (value: number | null | undefined) =>
  hasDashboardMetric(value) ? formatDashboardHours(Number(value) / 60) : 'Недоступно'

export const dashboardMetricComparison = (
  metric: DashboardComparableMetric | null | undefined,
): AdminDashboardMetricComparison | null => {
  if (!metric || metric.previous === null) return null
  return {
    absolute_change: null,
    percentage_change: metric.percent_change,
  }
}

export const compareDashboardMasterRows = (
  first: DashboardMasterBreakdownItem,
  second: DashboardMasterBreakdownItem,
  key: AdminDashboardMasterSortKey,
  direction: SortDirection,
) => {
  const firstValue = first[key]
  const secondValue = second[key]
  const firstAvailable = hasDashboardMetric(firstValue)
  const secondAvailable = hasDashboardMetric(secondValue)

  if (firstAvailable !== secondAvailable) return firstAvailable ? -1 : 1
  if (!firstAvailable && !secondAvailable) {
    return first.master_name.localeCompare(second.master_name, 'uk')
  }

  const result = Number(firstValue) - Number(secondValue)
  return direction === 'asc' ? result : -result
}

export const dashboardActionLabels: Record<DashboardActionCode, string> = {
  pending_bookings: 'Відкрити непідтверджені записи',
  elevated_cancellations: 'Переглянути скасування',
  unfilled_capacity: 'Перевірити доступність',
  review_moderation_backlog: 'До модерації',
  failed_review_delivery: 'Перевірити доставку',
}
