export const ruleTypes = [
  { value: 'last_visit_age', label: 'Час після останнього завершеного візиту' },
  { value: 'completed_visit_count', label: 'Кількість завершених візитів' },
  { value: 'upcoming_booking', label: 'Майбутній запис' },
  { value: 'visited_master', label: 'Візити до майстра' },
  { value: 'received_service', label: 'Отримані послуги' },
  { value: 'first_visit', label: 'Перший завершений візит' },
  { value: 'received_campaign', label: 'Отримання кампанії' },
  { value: 'marketing_contact', label: 'Маркетинговий контакт' },
]
export const periodUnits = [{ value: 'calendar_months', label: 'Календарні місяці' }, { value: 'days', label: 'Дні (по 24 години)' }]
export const defaultPeriod = () => ({ last: 3, unit: 'calendar_months' })
export const defaultCondition = (type = 'last_visit_age') => {
  switch (type) {
    case 'last_visit_age': return { type, min: 3, max: 12, unit: 'calendar_months', min_inclusive: false, max_inclusive: true }
    case 'completed_visit_count': return { type, min: 1 }
    case 'upcoming_booking': return { type, present: true }
    case 'visited_master': return { type, master_ids: [], mode: 'last' }
    case 'received_service': return { type, service_ids: [], period: defaultPeriod() }
    case 'first_visit': return { type, period: defaultPeriod() }
    case 'received_campaign': return { type, campaign_id: null }
    case 'marketing_contact': return { type, period: defaultPeriod(), present: true }
    default: throw new Error('Непідтримувана умова')
  }
}
export const defaultSegmentRules = () => ({ combine: 'all', conditions: [defaultCondition()], exclusions: [{ type: 'upcoming_booking', present: true }] })
export const formatSegmentTime = value => value ? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Kyiv' }).format(new Date(value)) : 'Немає даних'
const units = unit => unit === 'calendar_months' ? 'календ. міс.' : 'дн. (по 24 год)'
export function summarizePeriod(period) {
  if (!period) return 'за всю доступну історію'
  if (period.last != null) return `за останні ${period.last} ${units(period.unit)}`
  if (!period.start || !period.end || !Number.isFinite(Date.parse(period.start)) || !Number.isFinite(Date.parse(period.end))) return 'за період (вкажіть дати)'
  return `від ${formatSegmentTime(period.start)} включно до ${formatSegmentTime(period.end)} невключно`
}
export function summarizeCondition(rule, labels = {}) {
  const names = (kind, ids) => (ids || []).map(id => labels[kind]?.[id] || `#${id}`).join(', ') || 'не обрано'
  const bounds = (minInclusive, maxInclusive) => [rule.min != null ? `${minInclusive ? '≥' : '>'} ${rule.min}` : '', rule.max != null ? `${maxInclusive ? '≤' : '<'} ${rule.max}` : ''].filter(Boolean).join(' та ')
  switch (rule.type) {
    case 'last_visit_age': return `Останній завершений / імпортований візит: ${bounds(rule.min_inclusive ?? false, rule.max_inclusive ?? true) || 'вкажіть межі'} ${units(rule.unit)}`
    case 'completed_visit_count': return `Завершених візитів ${bounds(true, true) || 'вкажіть межі'} ${summarizePeriod(rule.period)}`
    case 'upcoming_booking': return rule.present !== false ? 'Є майбутній запис' : 'Немає майбутнього запису'
    case 'visited_master': return `${rule.mode === 'within_period' ? 'Візит до майстра' : 'Останній майстер'}: ${names('masters', rule.master_ids)}${rule.mode === 'within_period' ? ` ${summarizePeriod(rule.period)}` : ''}`
    case 'received_service': return `Отримано послуги: ${names('services', rule.service_ids)} ${summarizePeriod(rule.period)}`
    case 'first_visit': return `Перший завершений візит ${summarizePeriod(rule.period)}`
    case 'received_campaign': return `Повідомлення кампанії ${labels.campaigns?.[rule.campaign_id] || `#${rule.campaign_id || '?'}`} прийнято провайдером ${summarizePeriod(rule.period)}`
    case 'marketing_contact': return `${rule.present !== false ? 'Є' : 'Немає'} маркетингового контакту ${summarizePeriod(rule.period)}`
    default: return 'Непідтримувана умова'
  }
}
export function summarizeRules(rules, labels = {}) {
  if (!rules) return 'Критерії недоступні'
  const summary = `${rules.combine === 'any' ? 'Будь-яка умова' : 'Усі умови'}: ${(rules.conditions || []).map(rule => summarizeCondition(rule, labels)).join('; ')}.`
  return `${summary}${rules.exclusions?.length ? ` Виключити, якщо: ${rules.exclusions.map(rule => summarizeCondition(rule, labels)).join('; ')}.` : ''}`
}
export function validateRules(rules) {
  const errors = []
  if (!['all', 'any'].includes(rules?.combine)) errors.push('Оберіть спосіб поєднання умов.')
  if (!Array.isArray(rules?.conditions) || rules.conditions.length < 1 || rules.conditions.length > 20) errors.push('Потрібно від 1 до 20 умов.')
  if ((rules?.exclusions || []).length > 20) errors.push('Можна додати до 20 виключень.')
  const validInteger = (value, max) => Number.isInteger(value) && value >= 0 && value <= max
  for (const [index, rule] of [...(rules?.conditions || []), ...(rules?.exclusions || [])].entries()) {
    const add = text => errors.push(`Умова ${index + 1}: ${text}`)
    if (!ruleTypes.some(option => option.value === rule.type)) { add('тип не підтримується.'); continue }
    if (['last_visit_age', 'completed_visit_count'].includes(rule.type)) {
      const max = rule.type === 'completed_visit_count' ? 1000000 : rule.unit === 'calendar_months' ? 1200 : 36600
      if (rule.min == null && rule.max == null) add('вкажіть хоча б одну межу.')
      if ([rule.min, rule.max].some(value => value != null && !validInteger(value, max))) add(`межі мають бути цілими числами від 0 до ${max}.`)
      if (rule.min != null && rule.max != null && rule.min > rule.max) add('нижня межа перевищує верхню.')
      if (rule.type === 'last_visit_age' && !periodUnits.some(option => option.value === rule.unit)) add('оберіть одиницю часу.')
      if (rule.type === 'last_visit_age' && rule.min != null && rule.min === rule.max && (!(rule.min_inclusive ?? false) || !(rule.max_inclusive ?? true))) add('однакові межі мають бути включними, інакше інтервал порожній.')
    }
    for (const key of ['master_ids', 'service_ids']) {
      if ((rule.type === 'visited_master' && key === 'master_ids') || (rule.type === 'received_service' && key === 'service_ids')) {
        if (!Array.isArray(rule[key]) || !rule[key].length || rule[key].length > 50 || rule[key].some(id => !Number.isSafeInteger(id) || id <= 0)) add('оберіть від 1 до 50 значень.')
      }
    }
    if (rule.type === 'received_campaign' && (!Number.isSafeInteger(rule.campaign_id) || rule.campaign_id <= 0)) add('оберіть кампанію.')
    if (rule.type === 'visited_master' && !['last', 'within_period'].includes(rule.mode)) add('оберіть режим майстра.')
    if (['upcoming_booking', 'marketing_contact'].includes(rule.type) && rule.present != null && typeof rule.present !== 'boolean') add('оберіть наявність або відсутність.')
    const requiredPeriod = ['received_service', 'first_visit', 'marketing_contact'].includes(rule.type) || (rule.type === 'visited_master' && rule.mode === 'within_period')
    if (requiredPeriod && !rule.period) add('вкажіть період.')
    if (rule.type === 'visited_master' && rule.mode === 'last' && rule.period) add('для останнього майстра період не застосовується.')
    if (rule.period) {
      const p = rule.period
      if (p.last != null) {
        if (!periodUnits.some(option => option.value === p.unit) || !validInteger(p.last, p.unit === 'calendar_months' ? 120 : 3660) || p.last < 1) add('період: 1–120 календарних місяців або 1–3660 днів.')
        if (p.start != null || p.end != null) add('оберіть відносний або абсолютний період.')
      } else {
        const aware = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
        if (!aware(p.start) || !aware(p.end)) add('обидві дати мають містити час і часовий зсув (наприклад, +03:00).')
        else if (Date.parse(p.start) >= Date.parse(p.end)) add('початок періоду має бути раніше за кінець.')
      }
    }
  }
  return errors
}
export function describeMember(member) {
  const history = member.history_state === 'unknown' ? 'Історія невідома' : member.history_state === 'no_visits' ? 'Новий клієнт: відсутність візитів підтверджена' : 'Є відома історія'
  const observedCount = member.completed_visit_count ?? 'немає даних'
  const historyNote = member.history_state !== 'no_visits' && member.completed_visit_count === 0 ? ' (повна кількість невідома)' : ''
  return `${history}; останній візит: ${formatSegmentTime(member.last_visit_at)}; завершених візитів у системі: ${observedCount}${historyNote}; ${member.has_upcoming_booking == null ? 'дані про майбутній запис недоступні' : member.has_upcoming_booking ? 'є майбутній запис' : 'немає майбутнього запису'}.`
}
export function segmentApiError(error) {
  const status = error?.statusCode || error?.status || error?.response?.status
  if (status === 409) return 'Сегмент змінено іншим адміністратором або архівовано. Оновіть сторінку, перевірте актуальні критерії та повторіть зміни.'
  if (status === 401 || status === 403) return 'Для керування сегментами потрібен активний доступ адміністратора.'
  const detail = error?.data?.detail
  if (Array.isArray(detail)) return detail.map(item => `${(item.loc || []).filter(part => part !== 'body').join('.')}: ${item.msg}`).join('; ')
  return typeof detail === 'string' ? detail : 'Не вдалося отримати дані. Перевірте з’єднання та спробуйте ще раз.'
}
// A token gates success, failure and loading completion; invalidation also handles edits without a new request.
export function createPreviewGate() {
  let generation = 0
  return { begin: () => ++generation, invalidate: () => { generation += 1 }, isCurrent: token => token === generation }
}

// Segment service IDs belong to barber_services, including inactive history, never base_services.
export async function loadSegmentServiceOptions(masters, fetchMasterServices, serviceLabel) {
  const options = new Map()
  for (let offset = 0; offset < masters.length; offset += 4) {
    const batch = masters.slice(offset, offset + 4)
    const results = await Promise.allSettled(batch.map(master => fetchMasterServices(master.value)))
    const failure = results.find(result => result.status === 'rejected')
    if (failure) throw failure.reason
    results.forEach((result, index) => {
      const response = result.value
      const items = Array.isArray(response) ? response : response.items
      if (!Array.isArray(response) && response.total > items.length) throw new Error('Неповний довідник послуг майстра')
      for (const item of items) {
        const id = Number(item.id)
        options.set(id, { value: id, label: `${serviceLabel(item)} #${id} · ${batch[index].label}${item.is_active === false ? ' (неактивна)' : ''}` })
      }
    })
  }
  return [...options.values()]
}
