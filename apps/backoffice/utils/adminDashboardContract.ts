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
  new_database_customers: DashboardComparableMetric<number>
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

export const dashboardBookingFunnelSteps = [
  'booking_start',
  'service_selected',
  'master_selected',
  'slot_selected',
  'contact_entered',
  'booking_success',
] as const

export type DashboardBookingFunnelStep = typeof dashboardBookingFunnelSteps[number]
export type DashboardBookingFunnelStatus = 'available' | 'partial' | 'empty' | 'unavailable'
export type DashboardBookingFunnelMetricStatus = 'available' | 'unavailable'
export type DashboardBookingFunnelAlertCode = 'no_slot' | 'stale_schedule' | 'booking_error'

export interface DashboardBookingFunnelStepMetric {
  event_type: DashboardBookingFunnelStep
  count: number
}

export interface DashboardBookingFunnelConversion {
  from_step: DashboardBookingFunnelStep
  to_step: DashboardBookingFunnelStep
  from_count: number
  to_count: number
  conversion_percent: DashboardDecimal | null
  status: DashboardBookingFunnelMetricStatus
  unavailable_reason: string | null
}

export interface DashboardBookingFunnelDropOff {
  from_step: DashboardBookingFunnelStep
  to_step: DashboardBookingFunnelStep
  count: number | null
  drop_off_percent: DashboardDecimal | null
  status: DashboardBookingFunnelMetricStatus
}

export interface DashboardBookingFunnelOverallConversion {
  started: number
  succeeded: number
  conversion_percent: DashboardDecimal | null
  status: DashboardBookingFunnelMetricStatus
  unavailable_reason: string | null
}

export interface DashboardBookingFunnelAlertThresholds {
  no_slot_min_count: number
  no_slot_rate_percent: DashboardDecimal
  stale_schedule_count: number
  booking_error_count: number
  meaningful_step_sessions: number
}

export interface DashboardBookingFunnelOperationalAlert {
  code: DashboardBookingFunnelAlertCode
  count: number
  rate_percent: DashboardDecimal | null
  triggered: boolean
}

export interface DashboardBookingFunnelNoSlotDate {
  target_date: string
  observations: number
  unique_sessions: number
  affected_masters: number
  first_observed_at: string
  last_observed_at: string
}

export interface DashboardBookingFunnelNoSlotService {
  service_id: number
  service_name: string | null
}

export interface DashboardBookingFunnelNoSlotContext {
  target_date: string
  master_id: number | null
  master_name: string | null
  services: DashboardBookingFunnelNoSlotService[]
  observations: number
  unique_sessions: number
  first_observed_at: string
  last_observed_at: string
}

export type DashboardBookingFunnelActionCode =
  | 'review_availability'
  | 'refresh_schedule'
  | 'investigate_booking_errors'
  | 'improve_service_discovery'
  | 'clarify_master_choice'
  | 'simplify_contact_step'
  | 'investigate_booking_completion'

export interface DashboardBookingFunnelRecommendedAction {
  code: DashboardBookingFunnelActionCode
  title_uk: string
  explanation_uk: string
  recommended_backoffice_route: string
  based_on: string
}

export interface DashboardBookingFunnelWeeklyDigest {
  scope: 'all_masters'
  period_start: string
  period_end: string
  generated_at: string
  status: DashboardBookingFunnelStatus
  insight_uk: string
  recommended_action: DashboardBookingFunnelRecommendedAction | null
  step_counts: DashboardBookingFunnelStepMetric[]
  operational_alerts: DashboardBookingFunnelOperationalAlert[]
}

export interface DashboardBookingFunnel {
  calculation_version: 2
  timezone: 'Europe/Kyiv'
  cohort_definition: string
  master_attribution_definition: string
  status: DashboardBookingFunnelStatus
  status_reason: string | null
  tracking_gap_count: number
  steps: DashboardBookingFunnelStepMetric[]
  step_to_step_conversion: DashboardBookingFunnelConversion[]
  overall_conversion: DashboardBookingFunnelOverallConversion | null
  drop_offs: DashboardBookingFunnelDropOff[]
  operational_alerts: DashboardBookingFunnelOperationalAlert[]
  alert_thresholds: DashboardBookingFunnelAlertThresholds
  no_slot_dates: DashboardBookingFunnelNoSlotDate[]
  no_slot_contexts: DashboardBookingFunnelNoSlotContext[]
  no_slot_context_limit: number
  no_slot_contexts_truncated: boolean
  no_slot_unknown_date_count: number
  unattributed_booking_successes: number
  weekly_insight_uk: string
  recommended_action: DashboardBookingFunnelRecommendedAction | null
  latest_weekly_digest: DashboardBookingFunnelWeeklyDigest | null
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
  booking_funnel: DashboardBookingFunnel
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
const nullableStringAt = (value: unknown, path: string) => {
  if (value !== null) stringAt(value, path)
}
const booleanAt = (value: unknown, path: string) => typeof value === 'boolean' ? value : fail(path)
const nonNegativeIntegerAt = (value: unknown, path: string) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fail(path)
const percentageAt = (value: unknown, path: string) => {
  const percentage = Number(numberAt(value, path))
  if (percentage < 0 || percentage > 100) fail(path)
  return percentage
}
const closeTo = (actual: number, expected: number) =>
  Math.abs(actual - expected) <= 0.011
const isoDateAt = (value: unknown, path: string) => {
  const date = stringAt(value, path)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(path)
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) fail(path)
  return date
}
const isoDateTimeAt = (value: unknown, path: string) => {
  const dateTime = stringAt(value, path)
  if (Number.isNaN(Date.parse(dateTime))) fail(path)
  return dateTime
}
const literalAt = <T extends string>(value: unknown, values: readonly T[], path: string): T => {
  const literal = stringAt(value, path)
  return values.includes(literal as T) ? literal as T : fail(path)
}
const safeBackofficeRouteAt = (value: unknown, path: string) => {
  const route = stringAt(value, path)
  if (!route.startsWith('/') || route.startsWith('//')) fail(path)
  return route
}

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

const funnelStepMetricAt = (value: unknown, path: string) => {
  const metric = recordAt(value, path)
  literalAt(metric.event_type, dashboardBookingFunnelSteps, `${path}.event_type`)
  nonNegativeIntegerAt(metric.count, `${path}.count`)
}

const funnelAlertAt = (value: unknown, path: string) => {
  const alert = recordAt(value, path)
  const code = literalAt(
    alert.code,
    ['no_slot', 'stale_schedule', 'booking_error'],
    `${path}.code`,
  )
  const count = nonNegativeIntegerAt(alert.count, `${path}.count`)
  const ratePercent = alert.rate_percent === null
    ? null
    : percentageAt(alert.rate_percent, `${path}.rate_percent`)
  if (code !== 'no_slot' && ratePercent !== null) fail(`${path}.rate_percent`)
  const triggered = booleanAt(alert.triggered, `${path}.triggered`)
  return { code, count, ratePercent, triggered }
}

const funnelActionAt = (value: unknown, path: string) => {
  const action = recordAt(value, path)
  literalAt(action.code, [
    'review_availability',
    'refresh_schedule',
    'investigate_booking_errors',
    'improve_service_discovery',
    'clarify_master_choice',
    'simplify_contact_step',
    'investigate_booking_completion',
  ], `${path}.code`)
  stringAt(action.title_uk, `${path}.title_uk`)
  stringAt(action.explanation_uk, `${path}.explanation_uk`)
  safeBackofficeRouteAt(action.recommended_backoffice_route, `${path}.recommended_backoffice_route`)
  stringAt(action.based_on, `${path}.based_on`)
}

const funnelStepListAt = (value: unknown, path: string) => {
  const steps = arrayAt(value, path)
  steps.forEach((step, index) => funnelStepMetricAt(step, `${path}.${index}`))
  return steps
}

const funnelAlertListAt = (value: unknown, path: string) => {
  const alerts = arrayAt(value, path)
  if (alerts.length !== 0 && alerts.length !== 3) fail(path)
  const normalized = alerts.map((alert, index) => funnelAlertAt(alert, `${path}.${index}`))
  const expectedCodes = ['no_slot', 'stale_schedule', 'booking_error'] as const
  normalized.forEach((alert, index) => {
    if (alert.code !== expectedCodes[index]) fail(`${path}.${index}.code`)
  })
  return normalized
}

const funnelNoSlotDateListAt = (value: unknown, path: string) => {
  const dates = arrayAt(value, path)
  dates.forEach((rawDate, index) => {
    const datePath = `${path}.${index}`
    const date = recordAt(rawDate, datePath)
    isoDateAt(date.target_date, `${datePath}.target_date`)
    const observations = nonNegativeIntegerAt(date.observations, `${datePath}.observations`)
    const uniqueSessions = nonNegativeIntegerAt(date.unique_sessions, `${datePath}.unique_sessions`)
    const affectedMasters = nonNegativeIntegerAt(date.affected_masters, `${datePath}.affected_masters`)
    if (uniqueSessions > observations || affectedMasters > observations) {
      fail(datePath)
    }
    const firstObservedAt = isoDateTimeAt(date.first_observed_at, `${datePath}.first_observed_at`)
    const lastObservedAt = isoDateTimeAt(date.last_observed_at, `${datePath}.last_observed_at`)
    if (Date.parse(firstObservedAt) > Date.parse(lastObservedAt)) {
      fail(`${datePath}.last_observed_at`)
    }
  })
  return dates
}

const funnelNoSlotContextListAt = (value: unknown, path: string, limit: number) => {
  const contexts = arrayAt(value, path)
  if (contexts.length > limit) fail(path)
  contexts.forEach((rawContext, index) => {
    const contextPath = `${path}.${index}`
    const context = recordAt(rawContext, contextPath)
    isoDateAt(context.target_date, `${contextPath}.target_date`)
    if (context.master_id !== null) {
      const masterId = nonNegativeIntegerAt(context.master_id, `${contextPath}.master_id`)
      if (masterId === 0) fail(`${contextPath}.master_id`)
    }
    nullableStringAt(context.master_name, `${contextPath}.master_name`)
    const services = arrayAt(context.services, `${contextPath}.services`)
    if (services.length > 10) fail(`${contextPath}.services`)
    const serviceIds = new Set<number>()
    services.forEach((rawService, serviceIndex) => {
      const servicePath = `${contextPath}.services.${serviceIndex}`
      const service = recordAt(rawService, servicePath)
      const serviceId = nonNegativeIntegerAt(service.service_id, `${servicePath}.service_id`)
      if (serviceId === 0 || serviceIds.has(serviceId)) fail(`${servicePath}.service_id`)
      serviceIds.add(serviceId)
      nullableStringAt(service.service_name, `${servicePath}.service_name`)
    })
    const observations = nonNegativeIntegerAt(context.observations, `${contextPath}.observations`)
    const uniqueSessions = nonNegativeIntegerAt(context.unique_sessions, `${contextPath}.unique_sessions`)
    if (uniqueSessions > observations) fail(contextPath)
    const firstObservedAt = isoDateTimeAt(context.first_observed_at, `${contextPath}.first_observed_at`)
    const lastObservedAt = isoDateTimeAt(context.last_observed_at, `${contextPath}.last_observed_at`)
    if (Date.parse(firstObservedAt) > Date.parse(lastObservedAt)) {
      fail(`${contextPath}.last_observed_at`)
    }
  })
  return contexts
}

const funnelAt = (value: unknown, path: string) => {
  const funnel = recordAt(value, path)
  if (funnel.calculation_version !== 2) fail(`${path}.calculation_version`)
  if (funnel.timezone !== 'Europe/Kyiv') fail(`${path}.timezone`)
  stringAt(funnel.cohort_definition, `${path}.cohort_definition`)
  stringAt(funnel.master_attribution_definition, `${path}.master_attribution_definition`)
  const trackingGapCount = nonNegativeIntegerAt(
    funnel.tracking_gap_count,
    `${path}.tracking_gap_count`,
  )
  const status = literalAt(
    funnel.status,
    ['available', 'partial', 'empty', 'unavailable'],
    `${path}.status`,
  )
  nullableStringAt(funnel.status_reason, `${path}.status_reason`)

  const steps = funnelStepListAt(funnel.steps, `${path}.steps`)
  const conversions = arrayAt(funnel.step_to_step_conversion, `${path}.step_to_step_conversion`)
  const dropOffs = arrayAt(funnel.drop_offs, `${path}.drop_offs`)
  if (status === 'empty') {
    if (steps.length || conversions.length || dropOffs.length || funnel.overall_conversion !== null) {
      fail(`${path}.status`)
    }
  }
  else {
    if (steps.length !== dashboardBookingFunnelSteps.length) fail(`${path}.steps`)
    steps.forEach((rawStep, index) => {
      const step = recordAt(rawStep, `${path}.steps.${index}`)
      if (step.event_type !== dashboardBookingFunnelSteps[index]) fail(`${path}.steps.${index}.event_type`)
    })
    if (conversions.length !== dashboardBookingFunnelSteps.length - 1) {
      fail(`${path}.step_to_step_conversion`)
    }
    if (dropOffs.length !== dashboardBookingFunnelSteps.length - 1) fail(`${path}.drop_offs`)
  }

  const stepCounts = new Map<DashboardBookingFunnelStep, number>()
  steps.forEach((rawStep, index) => {
    const step = recordAt(rawStep, `${path}.steps.${index}`)
    stepCounts.set(
      step.event_type as DashboardBookingFunnelStep,
      nonNegativeIntegerAt(step.count, `${path}.steps.${index}.count`),
    )
  })
  const transitionMetrics: Array<{
    fromCount: number
    toCount: number
    conversionPercent: number | null
    status: DashboardBookingFunnelMetricStatus
  }> = []
  conversions.forEach((rawConversion, index) => {
    const conversionPath = `${path}.step_to_step_conversion.${index}`
    const conversion = recordAt(rawConversion, conversionPath)
    const fromStep = literalAt(conversion.from_step, dashboardBookingFunnelSteps, `${conversionPath}.from_step`)
    const toStep = literalAt(conversion.to_step, dashboardBookingFunnelSteps, `${conversionPath}.to_step`)
    if (
      fromStep !== dashboardBookingFunnelSteps[index]
      || toStep !== dashboardBookingFunnelSteps[index + 1]
    ) {
      fail(conversionPath)
    }
    const fromCount = nonNegativeIntegerAt(conversion.from_count, `${conversionPath}.from_count`)
    const toCount = nonNegativeIntegerAt(conversion.to_count, `${conversionPath}.to_count`)
    const metricStatus = literalAt(
      conversion.status,
      ['available', 'unavailable'],
      `${conversionPath}.status`,
    )
    const conversionPercent = conversion.conversion_percent === null
      ? null
      : percentageAt(conversion.conversion_percent, `${conversionPath}.conversion_percent`)
    if (
      (metricStatus === 'available' && conversionPercent === null)
      || (metricStatus === 'unavailable' && conversionPercent !== null)
    ) {
      fail(`${conversionPath}.conversion_percent`)
    }
    const expectedFromCount = stepCounts.get(fromStep)
    const destinationCount = stepCounts.get(toStep)
    if (
      expectedFromCount === undefined
      || destinationCount === undefined
      || fromCount !== expectedFromCount
      || toCount > destinationCount
    ) {
      fail(conversionPath)
    }
    if (metricStatus === 'available') {
      if (
        fromCount === 0
        || toCount > fromCount
        || conversionPercent === null
        || !closeTo(
          conversionPercent,
          Math.round(toCount / fromCount * 10_000) / 100,
        )
      ) {
        fail(conversionPath)
      }
    }
    nullableStringAt(conversion.unavailable_reason, `${conversionPath}.unavailable_reason`)
    transitionMetrics.push({
      fromCount,
      toCount,
      conversionPercent,
      status: metricStatus,
    })
  })

  dropOffs.forEach((rawDropOff, index) => {
    const dropOffPath = `${path}.drop_offs.${index}`
    const dropOff = recordAt(rawDropOff, dropOffPath)
    const fromStep = literalAt(dropOff.from_step, dashboardBookingFunnelSteps, `${dropOffPath}.from_step`)
    const toStep = literalAt(dropOff.to_step, dashboardBookingFunnelSteps, `${dropOffPath}.to_step`)
    if (
      fromStep !== dashboardBookingFunnelSteps[index]
      || toStep !== dashboardBookingFunnelSteps[index + 1]
    ) {
      fail(dropOffPath)
    }
    const metricStatus = literalAt(dropOff.status, ['available', 'unavailable'], `${dropOffPath}.status`)
    const count = dropOff.count === null
      ? null
      : nonNegativeIntegerAt(dropOff.count, `${dropOffPath}.count`)
    const dropOffPercent = dropOff.drop_off_percent === null
      ? null
      : percentageAt(dropOff.drop_off_percent, `${dropOffPath}.drop_off_percent`)
    if (
      (metricStatus === 'available' && (count === null || dropOffPercent === null))
      || (metricStatus === 'unavailable' && (count !== null || dropOffPercent !== null))
    ) {
      fail(dropOffPath)
    }
    const transition = transitionMetrics[index]
    if (!transition || transition.status !== metricStatus) fail(dropOffPath)
    if (
      metricStatus === 'available'
      && (
        count !== transition.fromCount - transition.toCount
        || transition.conversionPercent === null
        || dropOffPercent === null
        || !closeTo(dropOffPercent, 100 - transition.conversionPercent)
      )
    ) {
      fail(dropOffPath)
    }
  })

  const derivedTrackingGapCount = transitionMetrics.reduce(
    (total, transition, index) =>
      total
      + Number(stepCounts.get(dashboardBookingFunnelSteps[index + 1]) || 0)
      - transition.toCount,
    0,
  )
  if (trackingGapCount !== derivedTrackingGapCount) {
    fail(`${path}.tracking_gap_count`)
  }

  if (funnel.overall_conversion !== null) {
    const overall = recordAt(funnel.overall_conversion, `${path}.overall_conversion`)
    const started = nonNegativeIntegerAt(overall.started, `${path}.overall_conversion.started`)
    const succeeded = nonNegativeIntegerAt(overall.succeeded, `${path}.overall_conversion.succeeded`)
    const overallStatus = literalAt(
      overall.status,
      ['available', 'unavailable'],
      `${path}.overall_conversion.status`,
    )
    const conversionPercent = overall.conversion_percent === null
      ? null
      : percentageAt(
          overall.conversion_percent,
          `${path}.overall_conversion.conversion_percent`,
        )
    if (
      (overallStatus === 'available' && conversionPercent === null)
      || (overallStatus === 'unavailable' && conversionPercent !== null)
    ) {
      fail(`${path}.overall_conversion.conversion_percent`)
    }
    const marginalSuccesses = Number(stepCounts.get('booking_success') || 0)
    if (started !== Number(stepCounts.get('booking_start') || 0)) {
      fail(`${path}.overall_conversion.started`)
    }
    if (succeeded > marginalSuccesses) {
      fail(`${path}.overall_conversion.succeeded`)
    }
    if (
      overallStatus === 'available'
      && (
        started === 0
        || succeeded > started
        || conversionPercent === null
        || !closeTo(
          conversionPercent,
          Math.round(succeeded / started * 10_000) / 100,
        )
      )
    ) {
      fail(`${path}.overall_conversion`)
    }
    nullableStringAt(overall.unavailable_reason, `${path}.overall_conversion.unavailable_reason`)
  }
  else if (status !== 'empty') {
    fail(`${path}.overall_conversion`)
  }

  const operationalAlerts = funnelAlertListAt(
    funnel.operational_alerts,
    `${path}.operational_alerts`,
  )
  if (
    (status === 'empty' && operationalAlerts.length !== 0)
    || (status !== 'empty' && operationalAlerts.length !== 3)
  ) {
    fail(`${path}.operational_alerts`)
  }
  const thresholds = recordAt(funnel.alert_thresholds, `${path}.alert_thresholds`)
  const noSlotMinCount = nonNegativeIntegerAt(
    thresholds.no_slot_min_count,
    `${path}.alert_thresholds.no_slot_min_count`,
  )
  const noSlotRateThreshold = percentageAt(
    thresholds.no_slot_rate_percent,
    `${path}.alert_thresholds.no_slot_rate_percent`,
  )
  const staleScheduleThreshold = nonNegativeIntegerAt(
    thresholds.stale_schedule_count,
    `${path}.alert_thresholds.stale_schedule_count`,
  )
  const bookingErrorThreshold = nonNegativeIntegerAt(
    thresholds.booking_error_count,
    `${path}.alert_thresholds.booking_error_count`,
  )
  nonNegativeIntegerAt(thresholds.meaningful_step_sessions, `${path}.alert_thresholds.meaningful_step_sessions`)
  if (operationalAlerts.length) {
    const [noSlot, staleSchedule, bookingError] = operationalAlerts
    if (
      !noSlot
      || !staleSchedule
      || !bookingError
      || noSlot.triggered !== (
        noSlot.count >= noSlotMinCount
        && noSlot.ratePercent !== null
        && noSlot.ratePercent >= noSlotRateThreshold
      )
      || staleSchedule.triggered !== (staleSchedule.count >= staleScheduleThreshold)
      || bookingError.triggered !== (bookingError.count >= bookingErrorThreshold)
    ) {
      fail(`${path}.operational_alerts`)
    }
  }
  funnelNoSlotDateListAt(funnel.no_slot_dates, `${path}.no_slot_dates`)
  const noSlotContextLimit = nonNegativeIntegerAt(
    funnel.no_slot_context_limit,
    `${path}.no_slot_context_limit`,
  )
  if (noSlotContextLimit === 0) fail(`${path}.no_slot_context_limit`)
  funnelNoSlotContextListAt(
    funnel.no_slot_contexts,
    `${path}.no_slot_contexts`,
    noSlotContextLimit,
  )
  booleanAt(funnel.no_slot_contexts_truncated, `${path}.no_slot_contexts_truncated`)
  nonNegativeIntegerAt(
    funnel.no_slot_unknown_date_count,
    `${path}.no_slot_unknown_date_count`,
  )
  nonNegativeIntegerAt(funnel.unattributed_booking_successes, `${path}.unattributed_booking_successes`)
  stringAt(funnel.weekly_insight_uk, `${path}.weekly_insight_uk`)
  if (funnel.recommended_action !== null) {
    funnelActionAt(funnel.recommended_action, `${path}.recommended_action`)
  }

  if (funnel.latest_weekly_digest !== null) {
    const digest = recordAt(funnel.latest_weekly_digest, `${path}.latest_weekly_digest`)
    if (digest.scope !== 'all_masters') fail(`${path}.latest_weekly_digest.scope`)
    const digestPeriodStart = isoDateAt(
      digest.period_start,
      `${path}.latest_weekly_digest.period_start`,
    )
    const digestPeriodEnd = isoDateAt(
      digest.period_end,
      `${path}.latest_weekly_digest.period_end`,
    )
    if (
      (
        Date.parse(`${digestPeriodEnd}T00:00:00.000Z`)
        - Date.parse(`${digestPeriodStart}T00:00:00.000Z`)
      ) / 86_400_000 !== 6
    ) {
      fail(`${path}.latest_weekly_digest.period_end`)
    }
    isoDateTimeAt(digest.generated_at, `${path}.latest_weekly_digest.generated_at`)
    const digestStatus = literalAt(
      digest.status,
      ['available', 'partial', 'empty', 'unavailable'],
      `${path}.latest_weekly_digest.status`,
    )
    stringAt(digest.insight_uk, `${path}.latest_weekly_digest.insight_uk`)
    if (digest.recommended_action !== null) {
      funnelActionAt(digest.recommended_action, `${path}.latest_weekly_digest.recommended_action`)
    }
    const digestSteps = funnelStepListAt(
      digest.step_counts,
      `${path}.latest_weekly_digest.step_counts`,
    )
    const digestAlerts = funnelAlertListAt(
      digest.operational_alerts,
      `${path}.latest_weekly_digest.operational_alerts`,
    )
    if (
      (digestStatus === 'empty' && (digestSteps.length || digestAlerts.length))
      || (
        digestStatus !== 'empty'
        && (
          digestSteps.length !== dashboardBookingFunnelSteps.length
          || digestAlerts.length !== 3
        )
      )
    ) {
      fail(`${path}.latest_weekly_digest`)
    }
    digestSteps.forEach((rawStep, index) => {
      const step = recordAt(rawStep, `${path}.latest_weekly_digest.step_counts.${index}`)
      if (step.event_type !== dashboardBookingFunnelSteps[index]) {
        fail(`${path}.latest_weekly_digest.step_counts.${index}.event_type`)
      }
    })
  }
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
  for (const key of [
    'gross_revenue',
    'available_minutes',
    'booked_minutes',
    'cancellation_rate',
    'retention_cohort',
    'service_allocation',
    'no_show',
    'prime_time',
  ]) {
    stringAt(definitions[key], `period.definitions.${key}`)
  }
  const signalThresholds = recordAt(period.signal_thresholds, 'period.signal_thresholds')
  for (const key of [
    'pending_bookings_min_count',
    'cancellation_min_count',
    'unfilled_capacity_min_minutes',
    'review_moderation_backlog_min_count',
    'failed_review_delivery_min_count',
  ]) {
    nonNegativeIntegerAt(signalThresholds[key], `period.signal_thresholds.${key}`)
  }
  for (const key of [
    'cancellation_min_rate_percent',
    'cancellation_min_increase_percentage_points',
    'unfilled_capacity_min_percent',
  ]) {
    numberAt(signalThresholds[key], `period.signal_thresholds.${key}`)
  }

  const executive = recordAt(response.executive, 'executive')
  for (const key of [
    'gross_revenue',
    'completed_visits',
    'unique_clients',
    'new_database_customers',
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

  funnelAt(response.booking_funnel, 'booking_funnel')

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
    literalAt(
      signal.metric_unit,
      ['bookings', 'percentage_points', 'minutes', 'reviews', 'deliveries'],
      `actionable_signals.${index}.metric_unit`,
    )
    safeBackofficeRouteAt(
      signal.recommended_backoffice_route,
      `actionable_signals.${index}.recommended_backoffice_route`,
    )
  }

  return value as AdminDashboardResponse
}
