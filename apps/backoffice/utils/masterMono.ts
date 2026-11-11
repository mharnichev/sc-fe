import type { MasterMonoState } from '~/composables/useBackofficeApi'

const authenticatedCreate = 'mono_authenticated_create_v1'
const publicDnsShape = (host: string) => {
  const labels = host.split('.'), suffix = labels.at(-1) || ''
  return host.length <= 253 && labels.length >= 2 && /^[a-z]{2,63}$/.test(suffix)
    && !/^(?:alt|arpa|corp|example|home|internal|intranet|invalid|lan|local|localdomain|localhost|onion|private|test)$/.test(suffix)
    && labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) && !label.startsWith('xn--'))
}

// A new origin is eligible only when the backend attests the immutable create response.
// Host syntax and exact serialization are defense in depth, not a DNS or redirect check.
export const masterMonoPaymentUrl = (state: Pick<MasterMonoState, 'invoice_id' | 'payment_url' | 'payment_url_source'> | null): string | null => {
  const id = state?.invoice_id, payload = state?.payment_url, source = state?.payment_url_source
  if (typeof id !== 'string' || !id || id.length > 100 || /[^A-Za-z0-9_-]/.test(id)
    || typeof payload !== 'string' || payload.length > 240
    || /[\s\x00-\x1f\x7f#\\]|%(?![\da-f]{2})|%(?:0[\da-f]|1[\da-f]|7f|5c)/i.test(payload)) return null
  if (source === authenticatedCreate) {
    const parts = /^https:\/\/([^/]+)\/([^?]*)(?:\?(.*))?$/.exec(payload)
    if (!parts || /[^!-~]/.test(payload) || !publicDnsShape(parts[1])
      || /["<>\x60{}^|]/.test(parts[2]) || /["'<>]/.test(parts[3] || '')) return null
  } else if (source != null || !payload.startsWith('https://pay.mbnk.biz/')) return null
  try {
    const url = new URL(payload)
    return url.href === payload && (url.pathname !== '/' || payload.includes('?')) ? payload : null
  } catch { return null }
}

type PaymentDeadline = Pick<MasterMonoState, 'payment_url_source' | 'payment_url_expires_at'>

// A browser may keep the last state while polling is disabled or the tab is suspended.
export const useMasterMonoPaymentWindow = (state: () => PaymentDeadline | null | undefined) => {
  const current = ref(false)
  watchEffect((onCleanup) => {
    const payment = state()
    if (payment?.payment_url_source !== authenticatedCreate) {
      current.value = payment?.payment_url_source == null
      return
    }
    const raw = payment.payment_url_expires_at
    const deadline = typeof raw === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(raw)
      ? Date.parse(raw) : NaN
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      if (timer !== undefined) clearTimeout(timer)
      const remaining = deadline - Date.now()
      const active = Number.isFinite(remaining) && remaining > 0 && remaining <= 16 * 60_000
      current.value = active
      if (active) timer = setTimeout(update, remaining)
    }
    update()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', update)
      window.addEventListener('pageshow', update)
    }
    onCleanup(() => {
      if (timer !== undefined) clearTimeout(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', update)
        window.removeEventListener('pageshow', update)
      }
    })
  }, { flush: 'sync' })
  return current
}

export const validMasterMonoState = (value: MasterMonoState, orderId: number): boolean => !!value &&
  value.mode === 'mono_checkbox' && value.order_id === orderId &&
  Number.isSafeInteger(value.revision) && value.revision >= 1 &&
  Number.isSafeInteger(value.amount_minor) && value.amount_minor >= 0 &&
  typeof value.enabled === 'boolean' && typeof value.paid === 'boolean' &&
  typeof value.receipt_accepted === 'boolean' && typeof value.can_handover === 'boolean' &&
  typeof value.status === 'string' && Array.isArray(value.blocking_reasons) &&
  value.blocking_reasons.every(reason => typeof reason === 'string') &&
  (value.invoice_id === null || typeof value.invoice_id === 'string') &&
  (value.payment_url === null || typeof value.payment_url === 'string') &&
  (value.receipt_pdf_path === null || typeof value.receipt_pdf_path === 'string')

export const masterMonoBlockingReason = (reason: string): string => ({
  master_mono_disabled: 'Оплату через mono тимчасово вимкнено. Зверніться до адміністратора.',
  master_mono_not_ready: 'Оплату ще не налаштовано. Зверніться до адміністратора.',
  master_mono_profile_conflict: 'Профіль оплати потребує перевірки адміністратора.',
  master_mono_checkout_owned: 'Для замовлення вже є інший платіж. Зверніться до адміністратора.',
  master_mono_binding_required: 'Потрібно налаштувати касу та платіжний профіль. Зверніться до адміністратора.',
  master_mono_proof_invalid: 'Підтвердження чека потребує перевірки адміністратора.',
  waiting: 'Очікуємо підтвердження оплати та чека.',
  paid: 'Оплату підтверджено, очікуємо чек.',
  pending: 'Чек ще обробляється.',
  processing: 'Сервер перевіряє той самий рахунок.',
  terminal_order: 'Замовлення завершено або скасовано.',
}[reason] || 'Потрібна перевірка адміністратора. Нову оплату не створюйте.')
