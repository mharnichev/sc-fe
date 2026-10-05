export const DEFAULT_NEW_MASTER_SMS = '✂ Давно не бачились! У Soul Cuts −30% на візит до {{master_name}} за акцією «Новий майстер». До {{offer_expires_short}}. Запис: {{offer_link}}'
// These are populated without an appointment by render_for_customer plus offer context.
export const NEW_MASTER_VARIABLES = ['master_name', 'offer_expires_short', 'offer_link', 'client', 'client_name', 'customer_name', 'barbershop_name', 'review_link', 'discount_code']

export function validateNewMasterTemplate(body) {
  const pattern = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}|(?<!{){\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}(?!})|(?<![\w/])#([a-zA-Z_][a-zA-Z0-9_]*)\b/g
  const found = [...body.matchAll(pattern)].map(match => match[1] || match[2] || match[3])
  const unknown = [...new Set(found.filter(name => !NEW_MASTER_VARIABLES.includes(name)))]
  const malformed = /[{}]/.test(body.replace(pattern, ''))
  const unsupported = [...body].filter(char => char.codePointAt(0) > 0xFFFF)
  return { unknown, malformed, unsupported: [...new Set(unsupported)] }
}

// datetime-local has no timezone. Resolve the entered wall time in Kyiv, including DST.
export function kyivLocalToIso(value) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return null
  const [year, month, day, hour, minute] = value.match(/\d+/g).map(Number)
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute)
  const calendar = new Date(wallUtc)
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || calendar.getUTCHours() !== hour || calendar.getUTCMinutes() !== minute) return null
  const parts = (date) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  let instant = wallUtc - 3 * 3600000
  for (let attempt = 0; attempt < 3; attempt++) {
    const shown = parts(new Date(instant))
    const difference = wallUtc - Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute)
    if (!difference) return new Date(instant).toISOString()
    instant += difference
  }
  return null // nonexistent local time during the spring DST transition
}

export function isoToKyivLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

// Runtime status and delivery counters may change after an accepted launch. Only
// immutable review conditions bind an uncertain attempt to its retry key.
export function newMasterLaunchFingerprint(campaign) {
  const fields = ['name', 'type', 'channel', 'recipient', 'purpose', 'timezone', 'template_id', 'message_body', 'segment_ids', 'audience_rules', 'channel_strategy', 'exclude_upcoming_booking', 'exclude_returned_since_snapshot', 'marketing_frequency_days', 'sending_window', 'sms_recipients_per_minute', 'offer_master_id', 'offer_promotion_id', 'offer_service_ids', 'offer_starts_at', 'offer_expires_at', 'master_name_for_message', 'marketing_max_contacts', 'marketing_cap_days', 'scheduled_at']
  return JSON.stringify(Object.fromEntries(fields.map(field => [field, campaign[field] ?? null])))
}
