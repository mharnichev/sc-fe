// A provider mode response is required; a bank-looking URL alone proves nothing about the environment.
export const qrProviderSandboxUrl = (attempt: { mode: string, simulation: boolean, payment_url?: unknown }) => {
  if (attempt.mode !== 'provider_sandbox' || attempt.simulation !== true || typeof attempt.payment_url !== 'string') return null
  const value = attempt.payment_url
  if (value !== value.trim() || /[\\\s]/.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['pay.mbnk.biz', 'pay.monobank.ua'].includes(url.hostname) || url.port || url.username || url.password || url.hash || url.search || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) return null
    return url.href
  } catch { return null }
}
export const qrProviderSandboxReceiptLabel = (status: string) => ({ pending: 'Тестовий чек Checkbox очікується', issued: 'Видано тестовий чек Checkbox', error: 'Помилка тестового чека Checkbox — оплату не повторюйте' }[status] || 'Стан тестового чека невідомий')

export const qrProviderSandboxBlockingReason = (reason: string) => ({ local_shift_closed: 'Адміністратор має відкрити локальну тестову зміну обліку', checkbox_test_shift_required: 'Відкрийте тестову зміну Checkbox у провайдера' }[reason] || reason)
