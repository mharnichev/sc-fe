export const reminderStorageKey = (scope: string) => `shop-checkout-reminder-v1:${scope}`
export function isRecoveryPath(pathname: string, baseURL = '/'): boolean {
  const base = `/${baseURL.split('/').filter(Boolean).join('/')}`.replace(/\/$/, '')
  return pathname.replace(/\/$/, '') === `${base}/checkout/recover`
}
export function recoveryPrivacyScript(baseURL: string): string {
  const path = `${baseURL.replace(/\/$/, '')}/checkout/recover`
  return `(function(){var p=${JSON.stringify(path)};var current=location.pathname;if(current.endsWith('/'))current=current.slice(0,-1);if(current!==p)return;var t=new URLSearchParams(location.hash.slice(1)).get('token')||'';window.__scCheckoutRecoveryToken=/^[A-Za-z0-9_-]{32,256}$/.test(t)?t:'';history.replaceState(null,'',location.pathname)})()`
}
export interface ReminderIdentity { key: string, fingerprint: string, revision: number, confirmed?: boolean, pendingCancel?: boolean, cartSignature?: string }

export function readReminder(storage: Pick<Storage, 'getItem'>, scope: string): ReminderIdentity | null {
  try {
    const value = JSON.parse(storage.getItem(reminderStorageKey(scope)) || 'null')
    return value && /^(?:[a-f0-9-]{36}|[a-f0-9]{64})$/.test(value.key) && typeof value.fingerprint === 'string' ? { ...value, revision: Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0 } : null
  } catch { return null }
}

export function cartFingerprint(items: Array<{ product: { id: number, price: string | number }, quantity: number }>): string {
  return JSON.stringify(items.map(item => [item.product.id, item.quantity, String(item.product.price)]).sort((a, b) => Number(a[0]) - Number(b[0])))
}

export function takeRecoveryToken(location: Pick<Location, 'hash' | 'pathname' | 'search'>, history: Pick<History, 'replaceState'>): string {
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || ''
  // Strip even malformed fragments and queries before plugins or widgets run.
  history.replaceState(null, '', location.pathname)
  return /^[A-Za-z0-9_-]{32,256}$/.test(token) ? token : ''
}

export const reminderOrderStorageKey = (scope: string) => `shop-checkout-reminder-order-v1:${scope}`
export function readReminderOrderKey(storage: Pick<Storage, 'getItem'>, scope: string): string | undefined {
  try {
    const key = storage.getItem(reminderOrderStorageKey(scope)) || ''
    return /^(?:[a-f0-9-]{36}|[a-f0-9]{64})$/.test(key) ? key : undefined
  } catch { return undefined }
}
