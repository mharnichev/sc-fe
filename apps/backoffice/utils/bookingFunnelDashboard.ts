import type {
  DashboardBookingFunnel,
  DashboardBookingFunnelAlertCode,
  DashboardBookingFunnelAlertThresholds,
  DashboardBookingFunnelConversion,
  DashboardBookingFunnelDropOff,
  DashboardBookingFunnelMetricStatus,
  DashboardBookingFunnelOperationalAlert,
  DashboardBookingFunnelStep,
  DashboardDecimal,
} from '~/utils/adminDashboardContract'
import { dashboardBookingFunnelSteps } from '~/utils/adminDashboardContract'

export const bookingFunnelStepLabels: Record<DashboardBookingFunnelStep, string> = {
  booking_start: 'Почали запис',
  service_selected: 'Обрали послугу',
  master_selected: 'Обрали майстра',
  slot_selected: 'Обрали час',
  contact_entered: 'Ввели контакти',
  booking_success: 'Завершили запис',
}

export const bookingFunnelStepDescriptions: Record<DashboardBookingFunnelStep, string> = {
  booking_start: 'Унікальна анонімна сесія, у якій клієнт зробив першу змістовну дію у формі запису — обрав послугу або майстра. Простий перегляд сторінки сюди не входить.',
  service_selected: 'Сесія, у якій клієнт обрав щонайменше одну послугу.',
  master_selected: 'Сесія, у якій клієнт обрав майстра.',
  slot_selected: 'Сесія, у якій клієнт обрав доступний час.',
  contact_entered: 'Сесія, у якій клієнт заповнив обов’язкові контакти та спробував завершити запис.',
  booking_success: 'Запис, який успішно створив backend і прив’язав до анонімної сесії. Ця подія не покладається на повідомлення браузера про успіх.',
}

export const bookingFunnelAlertContent: Record<
  DashboardBookingFunnelAlertCode,
  { title: string, description: string, action: string }
> = {
  no_slot: {
    title: 'Сесії з порожнім пошуком часу',
    description: 'Зафіксовано сесії з порожньою відповіддю на пошук часу для обраної клієнтом дати. Це не кількість втрачених записів.',
    action: 'Перевірте дати, майстрів і вікна доступності; звірте подальші дії сесій у картці перед висновком про нестачу часу.',
  },
  stale_schedule: {
    title: 'Розклад встигає застаріти',
    description: 'Обраний час стає недоступним до завершення запису.',
    action: 'Звірте фактичний календар із доступністю та перевірте конфлікти одночасних записів.',
  },
  booking_error: {
    title: 'Помилки під час завершення',
    description: 'Клієнти стикаються з технічною помилкою на шляху до підтвердження.',
    action: 'Перевірте помилки API та останні зміни форми запису; успішні записи рахує backend окремо.',
  },
}

const formatBookingFunnelThreshold = (value: DashboardDecimal) =>
  Number(value).toLocaleString('uk-UA', { maximumFractionDigits: 1 })

export const bookingFunnelAlertTriggerExplanation = (
  code: DashboardBookingFunnelAlertCode,
  thresholds: DashboardBookingFunnelAlertThresholds,
) => {
  if (code === 'no_slot') {
    return `Сигнал з’являється, коли кількість сесій з порожнім пошуком сягає порога ${thresholds.no_slot_min_count}, а їхня частка становить не менше ${formatBookingFunnelThreshold(thresholds.no_slot_rate_percent)}% від сесій після вибору майстра. Поріг лише вмикає сигнал, а не доводить втрату запису.`
  }
  if (code === 'stale_schedule') {
    return `Сигнал з’являється після щонайменше ${thresholds.stale_schedule_count} конфліктів, коли обраний слот уже зайнятий на момент створення запису.`
  }
  return `Сигнал з’являється після щонайменше ${thresholds.booking_error_count} технічних помилок під час запису.`
}

export interface BookingFunnelDisplayRow {
  step: DashboardBookingFunnelStep
  label: string
  count: number | null
  conversion: DashboardBookingFunnelConversion | null
  dropOff: DashboardBookingFunnelDropOff | null
}

export const bookingFunnelDisplayState = (
  funnel: DashboardBookingFunnel | null | undefined,
) => funnel?.status || 'unavailable'

export const mapBookingFunnelRows = (
  funnel: DashboardBookingFunnel | null | undefined,
): BookingFunnelDisplayRow[] => {
  const counts = new Map((funnel?.steps || []).map(item => [item.event_type, item.count]))
  const conversions = new Map(
    (funnel?.step_to_step_conversion || []).map(item => [`${item.from_step}:${item.to_step}`, item]),
  )
  const dropOffs = new Map(
    (funnel?.drop_offs || []).map(item => [`${item.from_step}:${item.to_step}`, item]),
  )

  return dashboardBookingFunnelSteps.map((step, index) => {
    const previousStep = dashboardBookingFunnelSteps[index - 1]
    const transitionKey = previousStep ? `${previousStep}:${step}` : null
    return {
      step,
      label: bookingFunnelStepLabels[step],
      count: counts.get(step) ?? null,
      conversion: transitionKey ? conversions.get(transitionKey) || null : null,
      dropOff: transitionKey ? dropOffs.get(transitionKey) || null : null,
    }
  })
}

export const formatBookingFunnelPercentage = (
  value: DashboardDecimal | null | undefined,
  status: DashboardBookingFunnelMetricStatus = 'available',
) => {
  if (
    status !== 'available'
    || value === null
    || value === undefined
    || value === ''
    || !Number.isFinite(Number(value))
  ) {
    return 'Недоступно'
  }
  return `${Number(value).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%`
}

export const triggeredBookingFunnelAlerts = (
  funnel: DashboardBookingFunnel | null | undefined,
): DashboardBookingFunnelOperationalAlert[] =>
  (funnel?.operational_alerts || []).filter(alert => alert.triggered)

export const bookingNoSlotOutcomeDisplay = (funnel: DashboardBookingFunnel | null | undefined) => {
  const outcomes = funnel?.no_slot_outcomes
  if (!outcomes || outcomes.status !== 'available') return null
  return {
    affected: outcomes.affected_sessions,
    booked: outcomes.booked_sessions,
    selected: outcomes.time_selected_sessions,
    unresolved: outcomes.unresolved_sessions,
    pending: outcomes.pending_sessions,
    denominator: outcomes.denominator_sessions,
    rateSessions: outcomes.unresolved_rate_sessions,
    ratePercent: outcomes.unresolved_rate_percent,
  }
}

export const bookingFunnelBottleneckLabel = (
  funnel: DashboardBookingFunnel | null | undefined,
) => {
  const basedOn = funnel?.recommended_action?.based_on
  if (!basedOn) return null

  const labels: Record<string, string> = {
    no_slot: 'Пошук вільного часу',
    stale_schedule: 'Актуальність розкладу',
    booking_error: 'Завершення запису',
    booking_start_to_service_selected: 'Від початку до вибору послуги',
    service_selected_to_master_selected: 'Від послуги до вибору майстра',
    master_selected_to_slot_selected: 'Від майстра до вибору часу',
    slot_selected_to_contact_entered: 'Від часу до введення контактів',
    contact_entered_to_booking_success: 'Від контактів до підтвердження',
  }
  return labels[basedOn] || funnel.recommended_action?.title_uk || null
}
