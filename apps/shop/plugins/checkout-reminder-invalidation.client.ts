import { cartFingerprint, readReminder, reminderStorageKey } from '~/utils/checkoutReminder'

export default defineNuxtPlugin(() => {
  const cart = useCartStore()
  const auth = useCustomerAuthStore()
  const api = useApi()
  const scope = () => auth.isAuthenticated ? `customer:${auth.customer?.id}` : 'guest'
  const cancelling = new Set<string>()
  const invalidateCart = (replay = false, owner = scope(), force = false) => {
    const previous = readReminder(sessionStorage, owner)
    if (!previous) return
    const changed = previous.fingerprint && (force || previous.cartSignature !== cartFingerprint(cart.items))
    if (!changed && !(replay && previous.pendingCancel)) return
    const next = changed ? { ...previous, fingerprint: '', pendingCancel: true, revision: previous.revision + 1 } : previous
    const requestId = `${owner}:${next.key}:${next.revision}`
    if (cancelling.has(requestId)) return
    try {
      sessionStorage.setItem(reminderStorageKey(owner), JSON.stringify(next))
      // A new account (or guest) has no authority to cancel the previous owner's event.
      // Keep it pending for replay when that owner returns; logout is not revocation.
      if (owner !== scope()) return
      cancelling.add(requestId)
      void api('/public/checkout-reminders/cancel', { method: 'POST', body: {}, retry: 0,
        headers: { 'X-Checkout-Key': next.key, 'X-Checkout-Revision': String(next.revision) } })
        .then(() => {
          const current = readReminder(sessionStorage, owner)
          if (current?.key === next.key && current.revision === next.revision) sessionStorage.setItem(reminderStorageKey(owner), JSON.stringify({ ...current, pendingCancel: false }))
        })
        .catch(() => {}) // Persisted cancellation retries on reconnect/reload.
        .finally(() => cancelling.delete(requestId))
    } catch { cancelling.delete(requestId) }
  }
  const onOnline = () => invalidateCart(true)
  const persistenceReady = useState<boolean>('shop-persistence-ready', () => false)
  let stopCart: (() => void) | undefined
  let stopScope: (() => void) | undefined
  const stopReady = watch(persistenceReady, ready => {
    if (!ready || stopCart) return
    // Persistence explicitly signals completion; idle callback order is irrelevant.
    stopScope = watch(scope, (_nextScope, previousScope) => {
      // Queue, do not claim server revocation or transfer the previous owner's key.
      invalidateCart(true, previousScope, true)
      invalidateCart(true)
    }, { flush: 'sync' })
    stopCart = watch(() => [scope(), cartFingerprint(cart.items)], () => invalidateCart(), { flush: 'post' })
    invalidateCart(true)
    window.addEventListener('online', onOnline)
  }, { immediate: true })
  if (import.meta.hot) import.meta.hot.dispose(() => { stopReady(); stopCart?.(); stopScope?.(); window.removeEventListener('online', onOnline) })
})
