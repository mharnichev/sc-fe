export type InputRule = 'text' | 'name' | 'email' | 'phone' | 'otp' | 'search' | 'address' | 'unit' | 'message' | 'review' | 'note'
export const inputLimits: Record<InputRule, number> = {
  text: 160, name: 80, email: 254, phone: 20, otp: 6, search: 120,
  address: 160, unit: 20, message: 2000, review: 2000, note: 500,
}

// Plain text only. Output must still use Vue interpolation, never v-html.
export function sanitizeInput(value: unknown, rule: InputRule = 'text'): string {
  let text = String(value ?? '').slice(0, 10000).normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/<[^>]*>/g, '').replace(/[<>]/g, '')
  if (!['message', 'review', 'note'].includes(rule)) text = text.replace(/\s/g, ' ')
  else text = text.replace(/\n{4,}/g, '\n\n\n')
  if (rule === 'name') text = text.replace(/[^\p{L}\p{M} .’'ʼ\-]/gu, '')
  if (rule === 'email') text = text.replace(/\s/g, '')
  if (rule === 'phone') text = text.replace(/[^\d+ ()-]/g, '')
  if (rule === 'otp') text = text.replace(/\D/g, '')
  if (rule === 'unit') text = text.replace(/[^\p{L}\p{M}\p{N} /.,’'ʼ#№\-]/gu, '')
  return text.slice(0, inputLimits[rule])
}

export function checkedInput(value: unknown, rule: InputRule, required = false): string {
  const raw = String(value ?? '')
  if (rule === 'email') {
    const email = raw.trim()
    if (raw.length > inputLimits.email || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff<>]/.test(raw)
      || (required && !email) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new Error('Вкажіть коректний email.')
    }
    return email
  }
  const text = sanitizeInput(raw, rule).trim()
  if (raw.length > inputLimits[rule] || (required && !text)) throw new Error('Перевірте заповнення та довжину поля.')
  if (text && rule === 'name' && !/\p{L}/u.test(text)) throw new Error('Вкажіть коректне ім’я.')
  if (rule === 'phone' && !/^\+?\d{10,15}$/.test(text.replace(/[ ()-]/g, ''))) throw new Error('Вкажіть коректний телефон: 10–15 цифр.')
  if (rule === 'otp' && !/^\d{6}$/.test(text)) throw new Error('Код має містити 6 цифр.')
  if (text && ['message', 'review', 'note'].includes(rule)) {
    const minimum = rule === 'message' ? 10 : rule === 'review' ? 3 : 0
    if (text.length < minimum || /(.)\1{20,}/u.test(text) || (text.match(/https?:\/\/|www\./gi) || []).length > 2)
      throw new Error('Перевірте текст: він закороткий або містить забагато повторів чи посилань.')
  }
  return text
}

export function checkedBirthday(value: unknown): string {
  const date = String(value ?? '')
  if (!date) return ''
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== date || date < '1900-01-01' || date > new Date().toISOString().slice(0, 10))
    throw new Error('Вкажіть коректну дату народження.')
  return date
}

/** Validate again at the API boundary, including restored state and non-UI callers. */
export function safeRequestBody(path: string, method: string, body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const data = { ...body } as Record<string, unknown>
  const field = (key: string, rule: InputRule, required = false) => {
    if ((data[key] !== undefined && data[key] !== null) || required) data[key] = checkedInput(data[key], rule, required)
  }
  if (method === 'POST' && /\/customers\/(?:auth\/(?:request-otp|verify-otp)|me\/phone-change\/(?:request-otp|confirm))$/.test(path)) {
    field('phone', 'phone', true)
    if (/verify-otp|confirm$/.test(path)) field('otp_code', 'otp', true)
  }
  if (path === '/public/customers/me' && method === 'PATCH') {
    field('name', 'name'); field('surname', 'name'); field('email', 'email'); field('notes', 'note')
    if (data.birthday !== undefined && data.birthday !== null) data.birthday = checkedBirthday(data.birthday)
  }
  if (path === '/public/feedback/email' && method === 'POST') {
    field('name', 'name', true); field('email', 'email', true); field('text', 'message', true)
    if (String(data.name).length < 2) throw new Error('Ім’я має містити щонайменше 2 символи.')
  }
  if (/^\/public\/products\/\d+\/reviews$/.test(path) && method === 'POST') {
    field('comment', 'review', true)
    if (!Number.isInteger(data.rating) || Number(data.rating) < 1 || Number(data.rating) > 5) throw new Error('Некоректна оцінка.')
  }
  if (path === '/public/orders' && method === 'POST') {
    field('firstName', 'name', true); field('lastName', 'name', true); field('email', 'email'); field('phoneNumber', 'phone', true)
    for (const key of ['shippingCity', 'shippingArea', 'shippingStreet']) field(key, 'address')
    for (const key of ['buildingNumber', 'shippingApartment', 'shippingWarehouseNumber']) field(key, 'unit')
    field('comment', 'note')
  }
  return data
}

export function requestCooldown(path: string, method: string): number {
  if (method === 'POST' && /\/customers\/(?:auth|me\/phone-change)\/request-otp$/.test(path)) return 30000
  if (method === 'POST' && path === '/public/feedback/email') return 30000
  if (method === 'POST' && /^\/public\/products\/\d+\/reviews$/.test(path)) return 15000
  if ((method === 'POST' && /verify-otp$|\/phone-change\/confirm$/.test(path)) || (method === 'PATCH' && path === '/public/customers/me')) return 1000
  return 0
}

export function boundedInteger(value: unknown, min: number, max: number): number {
  const number = Number(value)
  return Math.min(max, Math.max(min, Number.isFinite(number) ? Math.trunc(number) : min))
}
