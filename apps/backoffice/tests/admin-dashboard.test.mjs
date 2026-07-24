import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const utilitySource = await readFile(new URL('../utils/adminDashboard.ts', import.meta.url), 'utf8')
const compiledUtility = ts.transpileModule(utilitySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const dashboard = await import(`data:text/javascript;base64,${Buffer.from(compiledUtility).toString('base64')}`)
const contractSource = await readFile(new URL('../utils/adminDashboardContract.ts', import.meta.url), 'utf8')
const compiledContract = ts.transpileModule(contractSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const contractModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledContract).toString('base64')}`
const contract = await import(contractModuleUrl)
const bookingFunnelUtilitySource = await readFile(new URL('../utils/bookingFunnelDashboard.ts', import.meta.url), 'utf8')
const compiledBookingFunnelUtility = ts.transpileModule(bookingFunnelUtilitySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(
  /from ['"]~\/utils\/adminDashboardContract['"]/,
  `from ${JSON.stringify(contractModuleUrl)}`,
)
const bookingFunnel = await import(
  `data:text/javascript;base64,${Buffer.from(compiledBookingFunnelUtility).toString('base64')}`,
)

const backendDashboardFixture = () => ({
  period: {
    current: { date_from: '2026-07-01', date_to: '2026-07-31', days: 31 },
    previous: { date_from: '2026-05-31', date_to: '2026-06-30', days: 31 },
    timezone: 'Europe/Kyiv',
    applied_master_id: null,
    comparison_requested: true,
    max_range_days: 366,
    definitions: {
      gross_revenue: 'Completed booking totals; revenue is not profit.',
      available_minutes: 'Availability less time blocks.',
      booked_minutes: 'Non-cancelled bookings inside availability.',
      cancellation_rate: 'Cancelled divided by all scheduled bookings.',
      retention_cohort: 'First completed visit in period with a fully observable repeat window.',
      service_allocation: 'Allocated snapshot values.',
      no_show: 'Unavailable.',
      prime_time: 'Kyiv local prime time.',
    },
    signal_thresholds: {
      pending_bookings_min_count: 1,
      cancellation_min_count: 3,
    },
  },
  executive: {
    gross_revenue: { current: '900.00', previous: '750.00', percent_change: '20.00' },
    completed_visits: { current: 2, previous: 1, percent_change: '100.00' },
    unique_clients: { current: 2, previous: 1, percent_change: '100.00' },
    average_check: { current: '450.00', previous: '750.00', percent_change: '-40.00' },
    booking_subtotal: { current: '1000.00', previous: '800.00', percent_change: '25.00' },
    promotion_discount_amount: { current: '100.00', previous: '50.00', percent_change: '100.00' },
  },
  capacity_and_leakage: {
    available_minutes: 600,
    booked_minutes: 120,
    utilisation_rate: '20.00',
    cancelled_visits: 1,
    cancellation_rate: { current: '25.00', previous: '10.00', change_percentage_points: '15.00' },
    pending_unconfirmed_upcoming_bookings: 1,
    empty_upcoming_capacity_minutes: 480,
    empty_upcoming_capacity_rate: '80.00',
    prime_time_empty_windows: [],
    no_show_visits: null,
    no_show_status: 'unavailable',
  },
  retention: {
    new_clients: 1,
    returning_clients: 1,
    repeat_30_day: { window_days: 30, repeated_clients: 1, eligible_clients: 1, repeat_rate: '100.00' },
    repeat_45_day: { window_days: 45, repeated_clients: 0, eligible_clients: 0, repeat_rate: null },
    repeat_60_day: { window_days: 60, repeated_clients: 0, eligible_clients: 0, repeat_rate: null },
  },
  masters: [{
    master_id: 3,
    master_name: 'Андрій',
    gross_revenue: '900.00',
    completed_visits: 2,
    average_check: '450.00',
    available_minutes: 600,
    booked_minutes: 120,
    utilisation_rate: '20.00',
    revenue_per_available_hour: '90.00',
    new_clients: 1,
    returning_clients: 1,
    approved_rating: '5.0',
    approved_review_count: 1,
  }],
  services: [{
    service_id: 9,
    service_name: 'Стрижка',
    completed_visits: 2,
    gross_revenue: '900.00',
    subtotal: '1000.00',
    discounts: '100.00',
    average_realized_revenue_per_completed_service: '450.00',
  }],
  booking_funnel: {
    status: 'available',
    status_reason: null,
    steps: [
      { event_type: 'booking_start', count: 100 },
      { event_type: 'service_selected', count: 80 },
      { event_type: 'master_selected', count: 60 },
      { event_type: 'slot_selected', count: 30 },
      { event_type: 'contact_entered', count: 15 },
      { event_type: 'booking_success', count: 0 },
    ],
    step_to_step_conversion: [
      { from_step: 'booking_start', to_step: 'service_selected', from_count: 100, to_count: 80, conversion_percent: '80.00', status: 'available', unavailable_reason: null },
      { from_step: 'service_selected', to_step: 'master_selected', from_count: 80, to_count: 60, conversion_percent: '75.00', status: 'available', unavailable_reason: null },
      { from_step: 'master_selected', to_step: 'slot_selected', from_count: 60, to_count: 30, conversion_percent: '50.00', status: 'available', unavailable_reason: null },
      { from_step: 'slot_selected', to_step: 'contact_entered', from_count: 30, to_count: 15, conversion_percent: '50.00', status: 'available', unavailable_reason: null },
      { from_step: 'contact_entered', to_step: 'booking_success', from_count: 15, to_count: 0, conversion_percent: '0.00', status: 'available', unavailable_reason: null },
    ],
    overall_conversion: {
      started: 100,
      succeeded: 0,
      conversion_percent: '0.00',
      status: 'available',
      unavailable_reason: null,
    },
    drop_offs: [
      { from_step: 'booking_start', to_step: 'service_selected', count: 20, drop_off_percent: '20.00', status: 'available' },
      { from_step: 'service_selected', to_step: 'master_selected', count: 20, drop_off_percent: '25.00', status: 'available' },
      { from_step: 'master_selected', to_step: 'slot_selected', count: 30, drop_off_percent: '50.00', status: 'available' },
      { from_step: 'slot_selected', to_step: 'contact_entered', count: 15, drop_off_percent: '50.00', status: 'available' },
      { from_step: 'contact_entered', to_step: 'booking_success', count: 15, drop_off_percent: '100.00', status: 'available' },
    ],
    operational_alerts: [
      { code: 'no_slot', count: 12, rate_percent: '20.00', triggered: true },
      { code: 'stale_schedule', count: 0, rate_percent: null, triggered: false },
      { code: 'booking_error', count: 2, rate_percent: null, triggered: true },
    ],
    alert_thresholds: {
      no_slot_min_count: 3,
      no_slot_rate_percent: '20.00',
      stale_schedule_count: 1,
      booking_error_count: 1,
      meaningful_step_sessions: 5,
    },
    unattributed_booking_successes: 0,
    weekly_insight_uk: 'Найбільше відвідувачів зупиняються перед підтвердженням запису.',
    recommended_action: {
      code: 'investigate_booking_completion',
      title_uk: 'Перевірити завершення запису',
      explanation_uk: 'Перевірте валідацію та повідомлення про помилки.',
      recommended_backoffice_route: '/bookings',
      based_on: 'contact_entered_to_booking_success',
    },
    latest_weekly_digest: null,
  },
  actionable_signals: [{
    severity: 'warning',
    code: 'pending_bookings',
    title_uk: 'Є непідтверджені записи',
    explanation_uk: 'Потрібна дія адміністратора.',
    metric_value: '1',
    metric_unit: 'bookings',
    recommended_backoffice_route: '/bookings?status=pending',
  }],
})

const emptyBookingFunnelFixture = () => ({
  status: 'empty',
  status_reason: 'No booking funnel events were recorded in the selected period.',
  steps: [],
  step_to_step_conversion: [],
  overall_conversion: null,
  drop_offs: [],
  operational_alerts: [],
  alert_thresholds: {
    no_slot_min_count: 3,
    no_slot_rate_percent: '20.00',
    stale_schedule_count: 1,
    booking_error_count: 1,
    meaningful_step_sessions: 5,
  },
  unattributed_booking_successes: 0,
  weekly_insight_uk: 'За вибраний період подій воронки ще немає.',
  recommended_action: null,
  latest_weekly_digest: null,
})

test('dashboard presets are inclusive and calendar-safe', () => {
  assert.deepEqual(
    dashboard.resolveDashboardPreset('today', '2026-07-23'),
    { preset: 'today', dateFrom: '2026-07-23', dateTo: '2026-07-23' },
  )
  assert.deepEqual(
    dashboard.resolveDashboardPreset('7d', '2026-03-02'),
    { preset: '7d', dateFrom: '2026-02-24', dateTo: '2026-03-02' },
  )
  assert.deepEqual(
    dashboard.resolveDashboardPreset('30d', '2024-03-01'),
    { preset: '30d', dateFrom: '2024-02-01', dateTo: '2024-03-01' },
  )
  assert.deepEqual(
    dashboard.resolveDashboardPreset('mtd', '2026-07-23'),
    { preset: 'mtd', dateFrom: '2026-07-01', dateTo: '2026-07-23' },
  )
})

test('custom dashboard ranges reject invalid and reversed dates', () => {
  assert.deepEqual(
    dashboard.resolveDashboardRange({
      preset: 'custom',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-23',
    }, '2026-07-23'),
    { preset: 'custom', dateFrom: '2026-07-01', dateTo: '2026-07-23' },
  )
  assert.deepEqual(
    dashboard.resolveDashboardRange({
      preset: 'custom',
      dateFrom: '2026-07-31',
      dateTo: '2026-07-01',
    }, '2026-07-23'),
    { preset: '30d', dateFrom: '2026-06-24', dateTo: '2026-07-23' },
  )
  assert.equal(dashboard.isDashboardDateInput('2026-02-30'), false)
  assert.equal(
    dashboard.dashboardDateRangeError('2025-01-01', '2026-01-02'),
    'Період не може перевищувати 366 календарних днів.',
  )
  assert.equal(dashboard.dashboardDateRangeError('2025-01-02', '2026-01-02'), null)
})

test('rates preserve backend percentage semantics and unavailable state', () => {
  assert.equal(dashboard.formatDashboardRate(0.625), '0,6%')
  assert.equal(dashboard.formatDashboardRate(62.5), '62,5%')
  assert.equal(dashboard.formatDashboardRate(null), 'Недоступно')
  assert.equal(dashboard.hasDashboardMetric(0), true)
})

test('booking funnel mapping uses backend conversion and drop-off values without recalculation', () => {
  const funnel = backendDashboardFixture().booking_funnel
  const rows = bookingFunnel.mapBookingFunnelRows(funnel)

  assert.deepEqual(rows.map(row => row.step), [
    'booking_start',
    'service_selected',
    'master_selected',
    'slot_selected',
    'contact_entered',
    'booking_success',
  ])
  assert.equal(rows[3].count, 30)
  assert.equal(rows[3].conversion.conversion_percent, '50.00')
  assert.equal(rows[3].dropOff.count, 30)
  assert.equal(rows[5].conversion.conversion_percent, '0.00')
  assert.equal(rows[5].dropOff.drop_off_percent, '100.00')
})

test('booking funnel percentages preserve backend percent units and zero conversions', () => {
  assert.equal(bookingFunnel.formatBookingFunnelPercentage(0), '0%')
  assert.equal(bookingFunnel.formatBookingFunnelPercentage(0.625), '0,6%')
  assert.equal(bookingFunnel.formatBookingFunnelPercentage(62.5), '62,5%')
  assert.equal(bookingFunnel.formatBookingFunnelPercentage(null), 'Недоступно')
  assert.equal(bookingFunnel.formatBookingFunnelPercentage(0, 'unavailable'), 'Недоступно')
})

test('booking funnel empty state is distinct from an observed zero conversion', () => {
  assert.equal(bookingFunnel.bookingFunnelDisplayState(emptyBookingFunnelFixture()), 'empty')
  assert.equal(
    bookingFunnel.bookingFunnelDisplayState(backendDashboardFixture().booking_funnel),
    'available',
  )
  assert.equal(
    bookingFunnel.mapBookingFunnelRows(emptyBookingFunnelFixture()).every(row => row.count === null),
    true,
  )
  assert.equal(
    bookingFunnel.mapBookingFunnelRows(backendDashboardFixture().booking_funnel)[5].count,
    0,
  )
})

test('master sorting uses quality metrics and always keeps unavailable rows last', () => {
  const rows = [
    { master_name: 'Андрій', gross_revenue: 5000, revenue_per_available_hour: 500 },
    { master_name: 'Богдан', gross_revenue: 7000, revenue_per_available_hour: null },
    { master_name: 'Василь', gross_revenue: 4000, revenue_per_available_hour: 800 },
  ]
  const descending = [...rows].sort((first, second) =>
    dashboard.compareDashboardMasterRows(first, second, 'revenue_per_available_hour', 'desc'))
  const ascending = [...rows].sort((first, second) =>
    dashboard.compareDashboardMasterRows(first, second, 'revenue_per_available_hour', 'asc'))

  assert.deepEqual(descending.map(row => row.master_name), ['Василь', 'Андрій', 'Богдан'])
  assert.deepEqual(ascending.map(row => row.master_name), ['Андрій', 'Василь', 'Богдан'])
})

test('BE dashboard fixture is runtime-validated before rendering', () => {
  const response = contract.parseAdminDashboardResponse(backendDashboardFixture())

  assert.equal(response.executive.gross_revenue.current, '900.00')
  assert.equal(response.retention.repeat_30_day.eligible_clients, 1)
  assert.equal(response.masters[0].master_name, 'Андрій')
  assert.equal(response.services[0].average_realized_revenue_per_completed_service, '450.00')
  assert.equal(response.booking_funnel.steps[0].event_type, 'booking_start')
  assert.equal(response.booking_funnel.overall_conversion.conversion_percent, '0.00')
  assert.equal(response.booking_funnel.recommended_action.recommended_backoffice_route, '/bookings')
  assert.equal(response.actionable_signals[0].recommended_backoffice_route, '/bookings?status=pending')
  assert.throws(
    () => contract.parseAdminDashboardResponse({ ...backendDashboardFixture(), executive: undefined }),
    /Invalid admin dashboard response at executive/,
  )
  const unsafeRoute = backendDashboardFixture()
  unsafeRoute.actionable_signals[0].recommended_backoffice_route = '//external.example'
  assert.throws(
    () => contract.parseAdminDashboardResponse(unsafeRoute),
    /recommended_backoffice_route/,
  )
  const malformedFunnel = backendDashboardFixture()
  malformedFunnel.booking_funnel.step_to_step_conversion[0].conversion_percent = null
  assert.throws(
    () => contract.parseAdminDashboardResponse(malformedFunnel),
    /booking_funnel\.step_to_step_conversion\.0\.conversion_percent/,
  )
  const emptyFunnel = backendDashboardFixture()
  emptyFunnel.booking_funnel = emptyBookingFunnelFixture()
  assert.equal(contract.parseAdminDashboardResponse(emptyFunnel).booking_funnel.status, 'empty')
})

test('dashboard page uses the single typed business endpoint without legacy metric assembly', async () => {
  const [apiSource, pageSource, bookingsSource, reviewsSource] = await Promise.all([
    readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8'),
    readFile(new URL('../pages/admin/dashboards/barbershop.vue', import.meta.url), 'utf8'),
    readFile(new URL('../pages/bookings.vue', import.meta.url), 'utf8'),
    readFile(new URL('../pages/reviews/index.vue', import.meta.url), 'utf8'),
  ])

  assert.match(apiSource, /api<unknown>\('\/backoffice\/statistics\/admin\/dashboard'/)
  assert.match(apiSource, /parseAdminDashboardResponse\(response\)/)
  assert.match(apiSource, /compare_to_previous: filters\.compare_to_previous/)
  assert.match(apiSource, /master_id: filters\.master_id \?\? undefined/)
  assert.doesNotMatch(pageSource, /adminGetMonthlyStatistics|adminGetBarbersComparison|adminGetBookings/)
  assert.doesNotMatch(pageSource, /dashboard\?\.kpis|dashboard\?\.capacity\./)
  assert.match(pageSource, /dashboard\?\.executive\.gross_revenue\.current/)
  assert.match(pageSource, /dashboard\?\.capacity_and_leakage\.available_minutes/)
  assert.match(pageSource, /dashboard\?\.booking_funnel/)
  assert.match(pageSource, /retention\.repeat_30_day/)
  assert.match(bookingsSource, /route\.query\.status/)
  assert.match(reviewsSource, /route\.query\.moderation_status/)
  assert.match(reviewsSource, /route\.query\.request_state/)
  assert.doesNotMatch(pageSource, /label="Прибуток"/)
  assert.match(pageSource, /Europe\/Kyiv/)
})
