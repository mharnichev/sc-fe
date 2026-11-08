import type { PosCapabilities, PosCartCreate, PosCartQuote, PosCartRequest, PosCheckout, PosCreate, PosOffer, PosPage } from '~/types/posSale'
const root = '/backoffice/pos'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
interface SavedSale { key: string; body: PosCreate | PosCartCreate; offer?: PosOffer; proposed?: PosOffer; proposedQuote?: PosCartQuote; itemNames?: Record<number, string>; checkout_id?: string; command?: { operation: 'resume' | 'refresh' | 'handover'; key: string; revision: number } }
const quoteRevision = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
function matchesQuote(quote: PosCartQuote, cart: PosCartRequest) {
  return quote?.currency === 'UAH' && quoteRevision(quote.quote_revision) && quote.applied_promo_code === cart.promo_code
    && quote.promotion_id === (cart.promotion_id ?? null)
    && positive(quote.subtotal_minor) && positive(quote.amount_minor) && Number.isSafeInteger(quote.discount_minor)
    && quote.discount_minor >= 0 && quote.subtotal_minor - quote.discount_minor === quote.amount_minor
    && Array.isArray(quote.items) && quote.items.length === cart.items.length
    && cart.items.every(item => quote.items.some(line => line.product_id === item.product_id && line.quantity === item.quantity))
}
export const posCanAddOffer = (offer: PosOffer) => offer.available_quantity > 0 && (offer.can_sell
  || (offer.blocking_reasons.length === 1 && offer.blocking_reasons[0] === 'unsupported_zero_total_pos'))
export const posDiscountLabels = {
  automatic: 'Автоматична акція',
  selected_promotion: 'Обрана акція',
  promo_code: 'Промокод',
}
export const posMoney = (minor: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(minor / 100)
export const usePosSale = () => {
  const api = useApi(), auth = useAuthStore()
  const capabilities = shallowRef<PosCapabilities | null>(null), checkout = shallowRef<PosCheckout | null>(null)
  const offers = shallowRef<PosPage<PosOffer>>({ items: [], total: 0, page: 1, page_size: 20 })
  const active = shallowRef<PosPage<PosCheckout>>({ items: [], total: 0, page: 1, page_size: 20 })
  const saved = shallowRef<SavedSale | null>(null), priceOffer = shallowRef<PosOffer | null>(null)
  const priceQuote = computed(() => saved.value?.proposedQuote || null)
  const cartLimits = computed(() => {
    const limits = capabilities.value?.cart_limits
    return positive(limits?.max_items) && positive(limits?.max_quantity) ? limits : null
  })
  const busy = ref(false), loading = ref(false), searchBusy = ref(false), error = ref(''), searchError = ref(''), storageFault = ref(false)
  let generation = 0, searchGeneration = 0, timer: ReturnType<typeof setTimeout> | undefined
  let storageSnapshot: string | null = null
  let initFlight: Promise<void> | null = null, readFlight: Promise<void> | null = null
  const scope = computed(() => auth.user?.id && auth.user.is_active && auth.accessToken ? `sc-pos:v1:${auth.user.id}` : '')
  const session = computed(() => JSON.stringify([scope.value, auth.accessToken, auth.user?.is_superuser, auth.user?.can_record_sales, auth.user?.can_accept_qr_payments]))
  const access = computed(() => !!scope.value && capabilities.value?.mode === 'mono_checkbox' && capabilities.value.can_search && !!auth.user?.is_active && (auth.user.is_superuser || (auth.user.can_record_sales === true && auth.user.can_accept_qr_payments === true)) && !storageFault.value)
  const allowed = computed(() => access.value && capabilities.value?.can_start === true)
  const paymentUrl = computed(() => {
    const c = checkout.value
    if (!access.value || !c || error.value || c.status !== 'awaiting_payment' || !['pending', 'processing'].includes(c.payment.status) || c.receipt.status !== 'not_requested') return null
    const id = c.payment.invoice_id
    if (!id || id.length > 256 || /[^A-Za-z0-9_-]/.test(id)) return null
    const url = `https://pay.mbnk.biz/${id}`
    return c.payment.qr_payload === url ? url : null
  })
  const canHandover = computed(() => access.value && !busy.value && !loading.value && !error.value && checkout.value?.status === 'ready_to_handover' && checkout.value.payment.status === 'paid' && checkout.value.receipt.status === 'accepted' && checkout.value.handover.status === 'ready' && checkout.value.actions.can_handover)
  const stopTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined }
  const current = (v: number) => generation === v && !!scope.value
  const persist = (value: SavedSale | null) => {
    if (!scope.value) return
    try {
      const raw = value ? JSON.stringify(value) : null
      if (raw) localStorage.setItem(scope.value, raw)
      else localStorage.removeItem(scope.value)
      storageSnapshot = raw
      saved.value = value
    }
    catch { storageFault.value = true; throw new Error('storage') }
  }
  const message = (cause: unknown) => {
    const status = (cause as { response?: { status?: number } })?.response?.status
    if (status === 401 || status === 403) { capabilities.value = null; return 'Доступ до продажу втрачено. Зверніться до адміністратора.' }
    if (status === 404) return 'Продаж не знайдено або немає доступу до нього.'
    return 'Результат ще не підтверджено. Відновіть цей самий продаж; не створюйте нову оплату.'
  }
  const withSaleLock = async (work: () => Promise<void>) => {
    const v = generation, key = scope.value
    if (!key || storageFault.value) return
    if (!navigator.locks) { error.value = 'Для безпечної оплати відкрийте POS в актуальному браузері.'; return }
    try {
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!lock || !current(v)) return
        if (localStorage.getItem(key) !== storageSnapshot) { reset(); return }
        await work()
      })
    } catch (cause) { if (current(v)) error.value = message(cause) }
  }
  const schedule = () => {
    stopTimer()
    const c = checkout.value
    if (scope.value && capabilities.value?.automatic_reconciliation_enabled && c && c.status !== 'completed' && !busy.value && c.poll_after_ms > 0) timer = setTimeout(() => { void poll() }, Math.max(1000, c.poll_after_ms))
  }
  const accept = (c: PosCheckout, v: number) => {
    if (!current(v)) return
    if (!uuid(c.checkout_id) || !uuid(c.intent_id) || !positive(c.order_id) || !positive(c.revision) || !positive(c.amount_minor) || c.currency !== 'UAH' || !Array.isArray(c.items) || !c.items.length || !c.items.every(item => positive(item.product_id) && positive(item.quantity) && Number.isSafeInteger(item.total_minor) && item.total_minor >= 0) || c.employee.user_id !== auth.user?.id || !c.payment || !c.receipt || !c.handover || !c.actions || c.payment.provider !== 'monobank' || c.receipt.issuer !== 'checkbox' || !['can_resume','can_refresh','can_handover','can_recover_invoice','can_start_new'].every(key => typeof c.actions[key as keyof PosCheckout['actions']] === 'boolean')) throw new Error('invalid state')
    if (saved.value && c.intent_id !== saved.value.body.intent_id) throw new Error('foreign intent')
    if (checkout.value && c.checkout_id === checkout.value.checkout_id && c.revision < checkout.value.revision) return
    checkout.value = c; priceOffer.value = null
    if (saved.value) {
      const pending = saved.value.command
      const resolved = pending && ((pending.operation === 'handover' && c.handover.status === 'handed_over') || (pending.operation !== 'handover' && c.revision > pending.revision && !!c.payment.invoice_id))
      persist({ ...saved.value, checkout_id: c.checkout_id, proposed: undefined, proposedQuote: undefined, command: resolved ? undefined : pending })
    }
  }
  const read = <T,>(path: string, query?: Record<string, string | number>) => api<T>(`${root}${path}`, { query, retry: 0, cache: 'no-store' })
  const command = async (operation: 'resume' | 'refresh' | 'handover') => {
    if (busy.value || !access.value || !checkout.value || !saved.value) return
    if (saved.value.command && saved.value.command.operation !== operation) return
    const c = checkout.value
    if (!(operation === 'handover' ? canHandover.value : operation === 'resume' ? c.actions.can_resume : c.actions.can_refresh)) return
    const v = generation; busy.value = true; error.value = ''; stopTimer()
    try {
      const pending = saved.value.command || { operation, key: crypto.randomUUID(), revision: c.revision }
      persist({ ...saved.value, command: pending })
      const result = await api<PosCheckout>(`${root}/checkouts/${c.checkout_id}/${pending.operation}`, { method: 'POST', body: { expected_revision: pending.revision }, headers: { 'Idempotency-Key': pending.key }, retry: 0, cache: 'no-store' })
      if (!current(v)) return
      accept(result, v); if (saved.value) persist({ ...saved.value, command: undefined })
    } catch (cause) {
      if (current(v)) {
        const failure = cause as { response?: { status?: number }; data?: { detail?: { code?: string } } }
        if (failure.response?.status === 409 && failure.data?.detail?.code === 'revision_conflict' && saved.value) persist({ ...saved.value, command: undefined })
        error.value = message(cause)
      }
    }
    finally { if (current(v)) { busy.value = false; schedule() } }
  }
  const create = async () => {
    if (busy.value || !allowed.value || !saved.value || priceOffer.value || priceQuote.value) return
    const v = generation, intent = saved.value
    busy.value = true; error.value = ''; stopTimer()
    try {
      const result = await api<PosCheckout>(`${root}/checkouts`, { method: 'POST', body: intent.body, headers: { 'Idempotency-Key': intent.key }, retry: 0, cache: 'no-store' })
      accept(result, v)
    } catch (cause) {
      if (!current(v)) return
      const failure = cause as { response?: { status?: number }; data?: { detail?: { code?: string; current_offer?: PosOffer; current_quote?: PosCartQuote } } }
      const detail = failure.data?.detail
      if ('items' in intent.body) {
        if (failure.response?.status === 409 && detail?.code === 'price_changed' && detail.current_quote && matchesQuote(detail.current_quote, intent.body)) {
          persist({ ...intent, proposedQuote: detail.current_quote })
        } else if (!intent.checkout_id && failure.response?.status === 409 && detail?.code === 'master_mono_basket_invalid') {
          try {
            accept(await read<PosCheckout>(`/checkouts/by-intent/${intent.body.intent_id}`), v)
            if (current(v)) error.value = message(cause)
          } catch (lookup) {
            if (!current(v)) return
            const missing = lookup as { response?: { status?: number }; data?: { detail?: { code?: string } } }
            if (missing.response?.status === 404 && missing.data?.detail?.code === 'checkout_not_found') {
              persist(null)
              error.value = 'У кошику є товар, який mono не може додати до рахунку. Перевірте склад кошика.'
            } else error.value = message(lookup)
          }
        } else if (!intent.checkout_id && ((failure.response?.status === 409 && ['out_of_stock', 'promo_not_applicable', 'promotion_not_applicable', 'unsupported_zero_total_pos', 'cart_amount_unsupported'].includes(detail?.code || '')) || (failure.response?.status === 404 && detail?.code === 'product_unavailable'))) {
          persist(null)
          error.value = detail?.code === 'promo_not_applicable' ? 'Промокод більше не діє. Змініть або приберіть його.'
            : detail?.code === 'promotion_not_applicable' ? 'Акція більше не діє. Оберіть іншу або автоматичний розрахунок.'
              : 'Кошик змінився або не може бути оплачений. Перевірте товари й розрахунок.'
        } else error.value = message(cause)
      } else if (detail?.code === 'price_changed' && detail.current_offer?.id === intent.body.product_id && detail.current_offer.currency === 'UAH' && positive(detail.current_offer.amount_minor)) {
        priceOffer.value = detail.current_offer; persist({ ...intent, proposed: detail.current_offer })
      } else error.value = message(cause)
    } finally { if (current(v)) { busy.value = false; schedule() } }
  }
  const recover = async (retryMissing = true) => {
    if (!saved.value || busy.value || loading.value || !access.value || priceOffer.value || priceQuote.value) return
    const v = generation
    loading.value = true; error.value = ''
    try {
      const value = await read<PosCheckout>(`/checkouts/by-intent/${saved.value.body.intent_id}`)
      accept(value, v)
    } catch (cause) {
      if (!current(v)) return
      if ((cause as { response?: { status?: number } }).response?.status === 404 && !saved.value?.checkout_id) {
        loading.value = false
        if (allowed.value && (retryMissing || (saved.value && !('items' in saved.value.body)))) await create()
        else error.value = allowed.value ? 'Рахунок ще не знайдено. Відновіть той самий запит.' : 'Нові рахунки призупинено. Збережений запит не створює нову оплату.'
        return
      }
      error.value = message(cause); return
    } finally { if (current(v)) loading.value = false }
    if (!current(v) || !checkout.value) return
    const pending = saved.value?.command
    if (pending) {
      if ((pending.operation === 'handover' && checkout.value.handover.status === 'handed_over') || (pending.operation !== 'handover' && checkout.value.revision > pending.revision && checkout.value.payment.invoice_id)) persist({ ...saved.value!, command: undefined })
      else await command(pending.operation)
    } else if (checkout.value.actions.can_resume && checkout.value.status === 'prepared') await command('resume')
    schedule()
  }
  const pollState = (): Promise<void> => {
    if (readFlight) return readFlight
    if (!checkout.value || busy.value || !scope.value) return Promise.resolve()
    const v = generation, id = checkout.value.checkout_id
    stopTimer()
    const request = (async () => {
      try { const value = await read<PosCheckout>(`/checkouts/${id}`); accept(value, v); if (current(v)) error.value = '' }
      catch (cause) { if (current(v)) error.value = message(cause) }
      finally { if (current(v)) { readFlight = null; schedule() } }
    })()
    readFlight = request; return request
  }
  const poll = async () => {
    const v = generation
    await withSaleLock(pollState)
    if (current(v)) schedule()
  }
  const init = (): Promise<void> => {
    if (initFlight) return initFlight
    if (!scope.value) return Promise.resolve()
    const v = generation
    const request = (async () => {
      loading.value = true; error.value = ''
      try {
        const cap = await read<PosCapabilities>('/capabilities')
        if (!current(v)) return
        capabilities.value = cap
        const list = await read<PosPage<PosCheckout>>('/checkouts/active', { page: 1, page_size: 20 })
        if (!current(v)) return
        active.value = list
      } catch (cause) { if (current(v)) error.value = message(cause) }
      finally { if (current(v)) loading.value = false }
      if (current(v) && access.value && saved.value && !priceOffer.value && !priceQuote.value) await withSaleLock(() => recover(false))
    })()
    initFlight = request; void request.finally(() => { if (current(v)) initFlight = null }); return request
  }
  const search = async (query: string, page = 1) => {
    if (!access.value || checkout.value || saved.value) return
    const v = generation, request = ++searchGeneration
    searchBusy.value = true; searchError.value = ''
    try { const result = await read<PosPage<PosOffer>>('/products', { q: query.slice(0,120), page, page_size: 20 }); if (current(v) && request === searchGeneration) offers.value = result }
    catch { if (current(v) && request === searchGeneration) searchError.value = 'Не вдалося знайти товари. Спробуйте ще раз.' }
    finally { if (current(v) && request === searchGeneration) searchBusy.value = false }
  }
  const getCartQuote = async (cart: PosCartRequest) => {
    if (!allowed.value || !cartLimits.value || saved.value || checkout.value) throw new Error('cart unavailable')
    const v = generation
    try {
      const quote = await api<PosCartQuote>(`${root}/cart/quote`, { method: 'POST', body: cart, retry: 0, cache: 'no-store' })
      if (!current(v) || !matchesQuote(quote, cart)) throw new Error('invalid quote')
      return quote
    } catch (cause) {
      const status = (cause as { response?: { status?: number } })?.response?.status
      if (current(v) && (status === 401 || status === 403)) error.value = message(cause)
      throw cause
    }
  }
  const startCart = (cart: PosCartRequest, quote: PosCartQuote, itemNames: Record<number, string>) => withSaleLock(async () => {
    if (!allowed.value || !cartLimits.value || busy.value || loading.value || saved.value || !matchesQuote(quote, cart)) return
    persist({
      key: crypto.randomUUID(), itemNames,
      body: { ...cart, intent_id: crypto.randomUUID(), currency: 'UAH', quote_revision: quote.quote_revision },
    })
    await create()
  })
  const confirmPrice = async () => {
    if (!saved.value || busy.value || !allowed.value) return
    if ('items' in saved.value.body) {
      if (!priceQuote.value) return
      try {
        persist({ ...saved.value, body: { ...saved.value.body, quote_revision: priceQuote.value.quote_revision }, proposedQuote: undefined })
        await create()
      } catch (cause) { error.value = message(cause) }
      return
    }
    if (!priceOffer.value) return
    try { persist({ ...saved.value, body: { ...saved.value.body, expected_amount_minor: priceOffer.value.amount_minor }, offer: priceOffer.value, proposed: undefined }); priceOffer.value = null; await create() }
    catch (cause) { error.value = message(cause) }
  }
  const resumeActive = async (c: PosCheckout) => {
    if (busy.value || loading.value || saved.value || !access.value || c.employee.user_id !== auth.user?.id) return
    try { persist({ key: crypto.randomUUID(), body: { intent_id: c.intent_id, product_id: c.items[0].product_id, quantity: 1, expected_amount_minor: c.amount_minor, currency: 'UAH' }, checkout_id: c.checkout_id, offer: { id:c.items[0].product_id,name:c.items[0].name,brand_name:null,sku:c.items[0].sku,barcode:c.items[0].barcode,image_url:c.items[0].image_url,variant_label:c.items[0].variant_label,amount_minor:c.amount_minor,currency:'UAH',available_quantity:0,can_sell:false,blocking_reasons:[] } }); await recover() }
    catch (cause) { error.value = message(cause) }
  }
  const restore = (raw: string) => {
    const value: SavedSale = JSON.parse(raw)
    if (!uuid(value.key) || !uuid(value.body?.intent_id) || value.body.currency !== 'UAH' || (value.checkout_id && !uuid(value.checkout_id)) || (value.command && (!uuid(value.command.key) || !['resume','refresh','handover'].includes(value.command.operation) || !positive(value.command.revision)))) throw new Error('invalid saved sale')
    if ('items' in value.body) {
      const items = value.body.items
      if (!Array.isArray(items) || !items.length || !items.every(item => positive(item.product_id) && positive(item.quantity)) || new Set(items.map(item => item.product_id)).size !== items.length || !quoteRevision(value.body.quote_revision) || (value.body.promo_code !== null && typeof value.body.promo_code !== 'string') || (value.body.promotion_id != null && (!positive(value.body.promotion_id) || !!value.body.promo_code)) || (value.proposedQuote && !matchesQuote(value.proposedQuote, value.body))) throw new Error('invalid saved cart')
    } else if (!positive(value.body.product_id) || !positive(value.body.expected_amount_minor) || value.body.quantity !== 1 || !value.offer) throw new Error('invalid saved sale')
    saved.value = value; priceOffer.value = value.proposed || null
  }
  const startNew = async () => {
    if (busy.value || loading.value || !checkout.value?.actions.can_start_new || checkout.value.status !== 'completed' || checkout.value.handover.status !== 'handed_over') return
    try { persist(null); checkout.value = null; priceOffer.value = null; error.value = ''; await init() } catch (cause) { error.value = message(cause) }
  }
  const reset = () => {
    generation++; searchGeneration++; stopTimer(); initFlight = null; readFlight = null
    capabilities.value = null; checkout.value = null; saved.value = null; priceOffer.value = null; busy.value = false; loading.value = false; searchBusy.value = false; error.value = ''; searchError.value = ''; storageFault.value = false
    offers.value = {items:[],total:0,page:1,page_size:20}; active.value = {items:[],total:0,page:1,page_size:20}
    storageSnapshot = null
    if (!scope.value) return
    try { storageSnapshot = localStorage.getItem(scope.value); if (storageSnapshot) restore(storageSnapshot) } catch { storageFault.value = true; error.value = 'Не вдалося прочитати збережений продаж. Зверніться до адміністратора; нову оплату не створюйте.' }
    if (!storageFault.value) void init()
  }
  watch(session, reset, { immediate: true, flush: 'sync' })
  const storageChanged = (event: StorageEvent) => { if (event.key === scope.value) reset() }
  if (import.meta.client) window.addEventListener('storage', storageChanged)
  onScopeDispose(() => { generation++; stopTimer(); if (import.meta.client) window.removeEventListener('storage', storageChanged) })
  return { capabilities, checkout, offers, active, priceOffer, priceQuote, cartLimits, saved, busy, loading, searchBusy, error, searchError, storageFault, access, allowed, paymentUrl, canHandover, init, search, getCartQuote, startCart, confirmPrice: () => withSaleLock(confirmPrice), resumeActive: (c: PosCheckout) => withSaleLock(() => resumeActive(c)), recover: () => withSaleLock(() => recover()), poll, handover: () => withSaleLock(() => command('handover')), refresh: () => withSaleLock(() => command('refresh')), startNew: () => withSaleLock(startNew) }
}
