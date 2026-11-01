interface CheckoutPromoQuote {
  subtotal_amount: string | number
  discount_amount: string | number
  total_amount: string | number
  applied_code: string | null
}

export const useCheckoutPromo = (items: () => Array<{ productId: number, quantity: number }>, phone: () => string, scope: () => string) => {
  const api = useApi()
  const auth = useCustomerAuthStore()
  const { locale } = useShopLocale()
  const input = ref('')
  const code = ref('')
  const quote = ref<CheckoutPromoQuote | null>(null)
  const pending = ref(false)
  const error = ref('')
  const mounted = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let revision = 0
  const storageKey = () => `shop-checkout-promo-v1:${scope()}`
  const remember = (value: string) => {
    try { if (value) localStorage.setItem(storageKey(), value); else localStorage.removeItem(storageKey()) } catch {}
  }
  const refresh = () => {
    const current = ++revision
    clearTimeout(timer)
    controller?.abort()
    quote.value = null
    error.value = ''
    pending.value = false
    if (!mounted.value || !code.value || !items().length) return
    const requestedCode = code.value
    const sessionCurrent = auth.captureSession()
    const isCurrent = () => mounted.value && current === revision && sessionCurrent()
    const body = { items: items().map(item => ({ ...item })), promoCode: requestedCode, ...(phone().trim() ? { customerPhone: phone().trim() } : {}) }
    pending.value = true
    timer = setTimeout(async () => {
      controller = new AbortController()
      try {
        const result = await api<CheckoutPromoQuote>('/public/shop-promotions/quote', { method: 'POST', body, signal: controller.signal, retry: 0 })
        if (!isCurrent()) return
        if ([result.subtotal_amount, result.discount_amount, result.total_amount].some(value => !['number', 'string'].includes(typeof value) || String(value).trim() === '')) throw new Error('not_applied')
        const amounts = [result.subtotal_amount, result.discount_amount, result.total_amount].map(Number)
        if (result.applied_code !== requestedCode || amounts.some(value => !Number.isFinite(value) || value < 0)
          || Math.abs(amounts[0] - amounts[1] - amounts[2]) > 0.011) throw new Error('not_applied')
        quote.value = result
        remember(requestedCode)
      } catch (cause) {
        if (!isCurrent()) return
        const detail = (cause as { data?: { detail?: unknown } })?.data?.detail
        error.value = detail === 'Customer phone is required for this promo code'
          ? (locale.value === 'uk' ? 'Вкажіть телефон для перевірки промокоду.' : 'Enter your phone to validate this code.')
          : (locale.value === 'uk' ? 'Не вдалося застосувати промокод. Перевірте код та спробуйте ще раз.' : 'Could not apply the promo code. Check it and try again.')
      } finally { if (current === revision) pending.value = false }
    }, 250)
  }
  const apply = () => {
    const value = input.value.trim().toUpperCase()
    if (!/^[A-Z0-9_-]{3,50}$/.test(value)) {
      error.value = locale.value === 'uk' ? 'Введіть промокод: 3–50 літер, цифр, дефіс або підкреслення.' : 'Use 3–50 letters, numbers, hyphens or underscores.'
      return
    }
    if (value === code.value) refresh()
    else code.value = value
    input.value = value
  }
  const remove = () => { code.value = ''; input.value = ''; remember(''); refresh() }
  const restore = () => {
    code.value = ''; input.value = ''
    try {
      const saved = localStorage.getItem(storageKey()) || ''
      if (/^[A-Z0-9_-]{3,50}$/.test(saved)) { code.value = saved; input.value = saved }
    } catch {}
    refresh()
  }
  watch(() => JSON.stringify([items(), phone(), scope(), auth.sessionRevision]), refresh, { flush: 'sync' })
  watch(scope, () => { if (mounted.value) restore() }, { flush: 'sync' })
  watch(code, refresh, { flush: 'sync' })
  onMounted(() => { mounted.value = true; restore() })
  onBeforeUnmount(() => { mounted.value = false; revision++; clearTimeout(timer); controller?.abort() })
  const ready = computed(() => !code.value || Boolean(quote.value && !pending.value))
  return { input, code, quote, pending, error, apply, remove, ready, clearSaved: () => remember('') }
}
