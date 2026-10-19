import { BarcodeFormat, QRCodeWriter } from '@zxing/library'

export const qrMockTerminal = (status: string) => ['declined', 'expired', 'cancelled'].includes(status)
export const qrMockOwnsSale = (attempt: { payment_status: string } | null) => !!attempt && !qrMockTerminal(attempt.payment_status)
export const qrMockPaymentLabel = (status: string) => ({ waiting: 'Очікує тестової оплати', processing: 'Обробляється — оплата не підтверджена', unknown: 'Невідомий результат — звірте той самий QR', paid: 'Тестову оплату підтверджено', declined: 'Тестову оплату відхилено', expired: 'Строк QR завершено сервером', cancelled: 'Очікування скасовано сервером' }[status] || 'Невідомий стан — потрібна перевірка')
export const qrMockReceiptLabel = (status: string) => ({ pending: 'Чек очікується', issued: 'Видано MOCK чек — до ДПС не надсилалось', error: 'Помилка MOCK чека — оплату не повторюйте' }[status] || 'Стан чека невідомий')
export const qrMockMoney = (minor: number) => `${Math.trunc(minor / 100)}.${String(minor % 100).padStart(2, '0')} грн`
// Only the exact authenticated simulator path on a loopback origin may be encoded.
export const qrMockLocalUrl = (path: unknown, origin: string, attemptId: number) => {
  if (path !== `/orders/qr-simulator/${attemptId}` || !Number.isSafeInteger(attemptId) || attemptId <= 0) return null
  try {
    const base = new URL(origin)
    if (!['http:', 'https:'].includes(base.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) return null
    return new URL(path as string, base.origin).href
  } catch { return null }
}
export const qrMockCode = (url: string) => {
  const matrix = new QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, 232, 232, new Map())
  const size = matrix.getWidth()
  let path = ''
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (matrix.get(x, y)) path += `M${x},${y}h1v1h-1z`
  return { size, path }
}
