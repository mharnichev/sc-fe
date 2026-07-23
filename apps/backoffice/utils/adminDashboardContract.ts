export type DashboardDecimal = string | number

export interface DashboardDatePeriod {
  date_from: string
  date_to: string
  days: number
}

export interface DashboardDefinitions {
  gross_revenue: string
  available_minutes: string
  booked_minutes: string
  cancellation_rate: string
  retention_cohort: string
  service_allocation: string
  no_show: string
  prime_time: string
}

export interface DashboardSignalThresholds {
  pending_bookings_min_count: number
  cancellation_min_count: number
  cancellation_min_rate_percent: DashboardDecimal
  cancellation_min_increase_percentage_points: DashboardDecimal
  unfilled_capacity_min_minutes: number
  unfilled_capacity_min_percent: DashboardDecimal
  review_moderation_backlog_min_count: number
  failed_review_delivery_min_count: number
}

export interface DashboardPeriodMetadata {
  current: DashboardDatePeriod
  previous: DashboardDatePeriod | null
  timezone: 'Europe/Kyiv'
  applied_master_id: number | null
  comparison_requested: boolean
  max_range_days: number
  definitions: DashboardDefinitions
  signal_thresholds: DashboardSignalThresholds
}

export interface DashboardComparableMetric<T extends DashboardDecimal = DashboardDecimal> {
  current: T
  previous: T | null
  percent_change: DashboardDecimal | null
}

export interface DashboardExecutiveMetrics {
  gross_revenue: DashboardComparableMetric
  completed_visits: DashboardComparableMetric<number>
  unique_clients: DashboardComparableMetric<number>
  average_check: DashboardComparableMetric
  booking_subtotal: DashboardComparableMetric
  promotion_discount_amount: DashboardComparableMetric
}

export interface DashboardRateMetric {
  current: DashboardDecimal
  previous: DashboardDecimal | null
  change_percentage_points: DashboardDecimal | null
}

export interface DashboardPrimeTimeWindow {
  master_id: number
  master_name: string
  start_at: string
  end_at: string
  available_minutes: number
  definition_code: 'weekday_evening' | 'weekend_midday'
}

export interface DashboardCapacityLeakage {
  available_minutes: number
  booked_minutes: number
  utilisation_rate: DashboardDecimal
  cancelled_visits: number
  cancellation_rate: DashboardRateMetric
  pending_unconfirmed_upcoming_bookings: number
  empty_upcoming_capacity_minutes: number
  empty_upcoming_capacity_rate: DashboardDecimal
  prime_time_empty_windows: DashboardPrimeTimeWindow[]
  no_show_visits: null
  no_show_status: 'unavailable'
}

export interface DashboardRepeatMetric {
  window_days: 30 | 45 | 60
  repeated_clients: number
  eligible_clients: number
  repeat_rate: DashboardDecimal | null
}

export interface DashboardRetention {
  new_clients: number
  returning_clients: number
  repeat_30_day: DashboardRepeatMetric
  repeat_45_day: DashboardRepeatMetric
  repeat_60_day: DashboardRepeatMetric
}

export interface DashboardMasterBreakdownItem {
  master_id: number
  master_name: string
  gross_revenue: DashboardDecimal
  completed_visits: number
  average_check: DashboardDecimal
  available_minutes: number
  booked_minutes: number
  utilisation_rate: DashboardDecimal
  revenue_per_available_hour: DashboardDecimal
  new_clients: number
  returning_clients: number
  approved_rating: DashboardDecimal | null
  approved_review_count: number
}

export interface DashboardServiceBreakdownItem {
  service_id: number
  service_name: string
  completed_visits: number
  gross_revenue: DashboardDecimal
  subtotal: DashboardDecimal
  discounts: DashboardDecimal
  average_realized_revenue_per_completed_service: DashboardDecimal
}

export type DashboardActionSeverity = 'info' | 'warning' | 'critical'
export type DashboardActionCode =
  | 'pending_bookings'
  | 'elevated_cancellations'
  | 'unfilled_capacity'
  | 'review_moderation_backlog'
  | 'failed_review_delivery'

export interface DashboardActionSignal {
  severity: DashboardActionSeverity
  code: DashboardActionCode
  title_uk: string
  explanation_uk: string
  metric_value: DashboardDecimal
  metric_unit: 'bookings' | 'percentage_points' | 'minutes' | 'reviews' | 'deliveries'
  recommended_backoffice_route: string
}

export interface AdminDashboardResponse {
  period: DashboardPeriodMetadata
  executive: DashboardExecutiveMetrics
  capacity_and_leakage: DashboardCapacityLeakage
  retention: DashboardRetention
  masters: DashboardMasterBreakdownItem[]
  services: DashboardServiceBreakdownItem[]
  actionable_signals: DashboardActionSignal[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNumeric = (value: unknown) =>
  (typeof value === 'number' && Number.isFinite(value))
  || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))

const fail = (path: string): never => {
  throw new TypeError(`Invalid admin dashboard response at ${path}`)
}

const recordAt = (value: unknown, path: string) => isRecord(value) ? value : fail(path)
const arrayAt = (value: unknown, path: string) => Array.isArray(value) ? value : fail(path)
const numberAt = (value: unknown, path: string) => isNumeric(value) ? value : fail(path)
const stringAt = (value: unknown, path: string) => typeof value === 'string' ? value : fail(path)

const comparableMetricAt = (value: unknown, path: string) => {
  const metric = recordAt(value, path)
  numberAt(metric.current, `${path}.current`)
  if (metric.previous !== null) numberAt(metric.previous, `${path}.previous`)
  if (metric.percent_change !== null) numberAt(metric.percent_change, `${path}.percent_change`)
}

const repeatMetricAt = (value: unknown, path: string) => {
  const metric = recordAt(value, path)
  numberAt(metric.window_days, `${path}.window_days`)
  numberAt(metric.repeated_clients, `${path}.repeated_clients`)
  numberAt(metric.eligible_clients, `${path}.eligible_clients`)
  if (metric.repeat_rate !== null) numberAt(metric.repeat_rate, `${path}.repeat_rate`)
}

export const parseAdminDashboardResponse = (value: unknown): AdminDashboardResponse => {
  const response = recordAt(value, 'root')
  const period = recordAt(response.period, 'period')
  const current = recordAt(period.current, 'period.current')
  stringAt(current.date_from, 'period.current.date_from')
  stringAt(current.date_to, 'period.current.date_to')
  numberAt(current.days, 'period.current.days')
  if (period.previous !== null) {
    const previous = recordAt(period.previous, 'period.previous')
    stringAt(previous.date_from, 'period.previous.date_from')
    stringAt(previous.date_to, 'period.previous.date_to')
    numberAt(previous.days, 'period.previous.days')
  }
  if (period.timezone !== 'Europe/Kyiv') fail('period.timezone')
  if (period.applied_master_id !== null) numberAt(period.applied_master_id, 'period.applied_master_id')
  if (typeof period.comparison_requested !== 'boolean') fail('period.comparison_requested')
  numberAt(period.max_range_days, 'period.max_range_days')
  const definitions = recordAt(period.definitions, 'period.definitions')
  stringAt(definitions.retention_cohort, 'period.definitions.retention_cohort')
  recordAt(period.signal_thresholds, 'period.signal_thresholds')

  const executive = recordAt(response.executive, 'executive')
  for (const key of [
    'gross_revenue',
    'completed_visits',
    'unique_clients',
    'average_check',
    'booking_subtotal',
    'promotion_discount_amount',
  ]) {
    comparableMetricAt(executive[key], `executive.${key}`)
  }

  const capacity = recordAt(response.capacity_and_leakage, 'capacity_and_leakage')
  for (const key of [
    'available_minutes',
    'booked_minutes',
    'utilisation_rate',
    'cancelled_visits',
    'pending_unconfirmed_upcoming_bookings',
    'empty_upcoming_capacity_minutes',
    'empty_upcoming_capacity_rate',
  ]) {
    numberAt(capacity[key], `capacity_and_leakage.${key}`)
  }
  const cancellationRate = recordAt(capacity.cancellation_rate, 'capacity_and_leakage.cancellation_rate')
  numberAt(cancellationRate.current, 'capacity_and_leakage.cancellation_rate.current')
  if (cancellationRate.previous !== null) {
    numberAt(cancellationRate.previous, 'capacity_and_leakage.cancellation_rate.previous')
  }
  if (cancellationRate.change_percentage_points !== null) {
    numberAt(
      cancellationRate.change_percentage_points,
      'capacity_and_leakage.cancellation_rate.change_percentage_points',
    )
  }
  for (
    const [index, rawWindow]
    of arrayAt(capacity.prime_time_empty_windows, 'capacity_and_leakage.prime_time_empty_windows').entries()
  ) {
    const window = recordAt(rawWindow, `capacity_and_leakage.prime_time_empty_windows.${index}`)
    numberAt(window.master_id, `capacity_and_leakage.prime_time_empty_windows.${index}.master_id`)
    stringAt(window.master_name, `capacity_and_leakage.prime_time_empty_windows.${index}.master_name`)
    stringAt(window.start_at, `capacity_and_leakage.prime_time_empty_windows.${index}.start_at`)
    stringAt(window.end_at, `capacity_and_leakage.prime_time_empty_windows.${index}.end_at`)
    numberAt(window.available_minutes, `capacity_and_leakage.prime_time_empty_windows.${index}.available_minutes`)
  }
  if (capacity.no_show_visits !== null || capacity.no_show_status !== 'unavailable') {
    fail('capacity_and_leakage.no_show_status')
  }

  const retention = recordAt(response.retention, 'retention')
  numberAt(retention.new_clients, 'retention.new_clients')
  numberAt(retention.returning_clients, 'retention.returning_clients')
  repeatMetricAt(retention.repeat_30_day, 'retention.repeat_30_day')
  repeatMetricAt(retention.repeat_45_day, 'retention.repeat_45_day')
  repeatMetricAt(retention.repeat_60_day, 'retention.repeat_60_day')

  for (const [index, rawMaster] of arrayAt(response.masters, 'masters').entries()) {
    const master = recordAt(rawMaster, `masters.${index}`)
    stringAt(master.master_name, `masters.${index}.master_name`)
    for (const key of [
      'master_id',
      'gross_revenue',
      'completed_visits',
      'average_check',
      'available_minutes',
      'booked_minutes',
      'utilisation_rate',
      'revenue_per_available_hour',
      'new_clients',
      'returning_clients',
      'approved_review_count',
    ]) {
      numberAt(master[key], `masters.${index}.${key}`)
    }
    if (master.approved_rating !== null) numberAt(master.approved_rating, `masters.${index}.approved_rating`)
  }

  for (const [index, rawService] of arrayAt(response.services, 'services').entries()) {
    const service = recordAt(rawService, `services.${index}`)
    stringAt(service.service_name, `services.${index}.service_name`)
    for (const key of [
      'service_id',
      'completed_visits',
      'gross_revenue',
      'subtotal',
      'discounts',
      'average_realized_revenue_per_completed_service',
    ]) {
      numberAt(service[key], `services.${index}.${key}`)
    }
  }

  for (const [index, rawSignal] of arrayAt(response.actionable_signals, 'actionable_signals').entries()) {
    const signal = recordAt(rawSignal, `actionable_signals.${index}`)
    const severity = stringAt(signal.severity, `actionable_signals.${index}.severity`)
    if (!['info', 'warning', 'critical'].includes(severity)) {
      fail(`actionable_signals.${index}.severity`)
    }
    const code = stringAt(signal.code, `actionable_signals.${index}.code`)
    if (![
      'pending_bookings',
      'elevated_cancellations',
      'unfilled_capacity',
      'review_moderation_backlog',
      'failed_review_delivery',
    ].includes(code)) {
      fail(`actionable_signals.${index}.code`)
    }
    stringAt(signal.title_uk, `actionable_signals.${index}.title_uk`)
    stringAt(signal.explanation_uk, `actionable_signals.${index}.explanation_uk`)
    numberAt(signal.metric_value, `actionable_signals.${index}.metric_value`)
    const route = stringAt(
      signal.recommended_backoffice_route,
      `actionable_signals.${index}.recommended_backoffice_route`,
    )
    if (!route.startsWith('/') || route.startsWith('//')) {
      fail(`actionable_signals.${index}.recommended_backoffice_route`)
    }
  }

  return value as AdminDashboardResponse
}
