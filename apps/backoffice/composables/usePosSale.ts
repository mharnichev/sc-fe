import type { PosCapabilities, PosCartCreate, PosCartQuote, PosCartRequest, PosCheckout, PosCreate, PosOffer, PosPage } from '~/types/posSale'
const root = '/backoffice/pos'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
type SaleSelection = { intent_id: string; currency: 'UAH'; selection_only: true }
interface SavedSale { key?: string; body: PosCreate | PosCartCreate | SaleSelection; offer?: PosOffer; proposed?: PosOffer; proposedQuote?: PosCartQuote; itemNames?: Record<number, string>; checkout_id?: string; command?: { operation: 'resume' | 'refresh' | 'handover'; key: string; revision: number } }
type ActiveSale = Pick<PosCheckout, 'checkout_id' | 'order_id' | 'status' | 'amount_minor' | 'revision'> & { products: string }
interface DeferredSale { record: SavedSale; summary: ActiveSale }
const saleSummary = (c: PosCheckout): ActiveSale => ({
  checkout_id: c.checkout_id, order_id: c.order_id, status: c.status, amount_minor: c.amount_minor, revision: c.revision,
  products: c.items.map(item => item.name).join(', '),
})
const unresolvedCreate = (c: PosCheckout) => c.status === 'requires_review' && c.payment.status === 'unknown'
  && c.payment.invoice_id === null && c.payment.qr_payload === null && c.receipt.status === 'not_requested'
  && c.handover.status === 'not_ready' && ['pending', 'confirmed'].includes(c.order_status)
  && c.blocking_reasons?.includes('creation_unknown')
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
const reasonLabels: Record<string, string> = {
  creation_unknown: 'Рахунок міг бути створений. Перечитайте стан цього продажу.',
  master_mono_disabled: 'Інтеграція mono недоступна.',
  master_mono_profile_conflict: 'Налаштування mono відрізняються від налаштувань на момент продажу.',
  master_mono_fiscal_policy_required: 'Потрібно перевірити фіскальні налаштування.',
  master_mono_proof_invalid: 'Дані від платіжного провайдера потребують перевірки.',
  master_mono_recovery_verification_required: 'Рахунок прив’язано. Спочатку потрібно звірити оплату.',
}
export const posBlockingReasons = (reasons?: string[]) => [...new Set((reasons || [])
  .map(reason => Object.hasOwn(reasonLabels, reason) ? reasonLabels[reason] : '').filter(Boolean))]
export const posMoney = (minor: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(minor / 100)
export const usePosSale = () => {
  const api = useApi(), auth = useAuthStore()
  const capabilities = shallowRef<PosCapabilities | null>(null), checkout = shallowRef<PosCheckout | null>(null)
  const offers = shallowRef<PosPage<PosOffer>>({ items: [], total: 0, page: 1, page_size: 20 })
  const active = shallowRef<PosPage<PosCheckout>>({ items: [], total: 0, page: 1, page_size: 20 })
  const deferred = shallowRef<DeferredSale[]>([])
  const otherSelection = shallowRef<SavedSale | null>(null)
  const activeLoading = ref(false)
  const moreActive = computed(() => active.value.total > active.value.items.length)
  const activeSales = computed(() => {
    const summaries = new Map(deferred.value.map(row => [row.summary.checkout_id, row.summary]))
    for (const c of active.value.items) {
      const previous = summaries.get(c.checkout_id)
      if (c.employee?.user_id === auth.user?.id && uuid(c.checkout_id) && Array.isArray(c.items)
        && (!previous || c.revision > previous.revision)) summaries.set(c.checkout_id, saleSummary(c))
    }
    return [...summaries.values()]
  })
  const saved = shallowRef<SavedSale | null>(null), priceOffer = shallowRef<PosOffer | null>(null)
  const priceQuote = computed(() => saved.value?.proposedQuote || null)
  const cartLimits = computed(() => {
    const limits = capabilities.value?.cart_limits
    return positive(limits?.max_items) && positive(limits?.max_quantity) ? limits : null
  })
  const busy = ref(false), loading = ref(false), searchBusy = ref(false), error = ref(''), searchError = ref(''), storageFault = ref(false)
  let generation = 0, searchGeneration = 0, timer: ReturnType<typeof setTimeout> | undefined
  let storageSnapshot: string | null = null, selectionToken: string | null = null
  let initFlight: Promise<void> | null = null, readFlight: Promise<void> | null = null
  const scope = computed(() => auth.user?.id && auth.user.is_active && auth.accessToken ? `sc-pos:v1:${auth.user.id}` : '')
  const session = computed(() => JSON.stringify([scope.value, auth.accessToken, auth.user?.is_superuser, auth.user?.can_record_sales, auth.user?.can_accept_qr_payments]))
  const access = computed(() => !!scope.value && capabilities.value?.mode === 'mono_checkbox' && capabilities.value.can_search && !!auth.user?.is_active && (auth.user.is_superuser || (auth.user.can_record_sales === true && auth.user.can_accept_qr_payments === true)) && !storageFault.value)
  const allowed = computed(() => access.value && capabilities.value?.can_start === true && !otherSelection.value)
  const selectionKey = () => `${scope.value}:selection`
  const hasInvoiceAttachment = (orderId: number) => localStorage.getItem(`sc-sales:v1:${auth.user?.id}:pos-attach-invoice:${orderId}`) !== null
  const canDefer = computed(() => allowed.value && !!checkout.value && !!saved.value?.checkout_id
    && saved.value.checkout_id === checkout.value.checkout_id && !saved.value.command && unresolvedCreate(checkout.value))
  const paymentUrl = computed(() => {
    const c = checkout.value
    if (!access.value || !c || error.value || c.status !== 'awaiting_payment'
      || !['pending', 'confirmed'].includes(c.order_status) || c.payment.status !== 'pending'
      || c.payment.confirmed_at !== null || c.receipt.status !== 'not_requested'
      || c.handover.status !== 'not_ready') return null
    const { invoice_id: id, qr_payload: payload } = c.payment
    if (typeof id !== 'string' || !id || id.length > 100 || /[^A-Za-z0-9_-]/.test(id)
      || typeof payload !== 'string' || payload.length > 240 || !payload.startsWith('https://pay.mbnk.biz/')
      || /[\s\x00-\x1f\x7f#\\]|%(?![\da-f]{2})|%(?:0[\da-f]|1[\da-f]|7f|5c)/i.test(payload)) return null
    try {
      // The server binds the provider URL to the verified invoice. Encode it verbatim.
      const url = new URL(payload)
      if (url.href !== payload || (url.pathname === '/' && !payload.includes('?'))) return null
      if (/^\/[A-Za-z0-9_-]{1,100}$/.test(url.pathname) && url.pathname !== `/${id}`) return null
      return payload
    } catch { return null }
  })
  const canHandover = computed(() => access.value && !busy.value && !loading.value && !error.value && checkout.value?.status === 'ready_to_handover' && checkout.value.payment.status === 'paid' && checkout.value.receipt.status === 'accepted' && checkout.value.handover.status === 'ready' && checkout.value.actions.can_handover)
  const stopTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined }
  const current = (v: number) => generation === v && !!scope.value
  const persist = (value: SavedSale | null, parked = deferred.value) => {
    if (!scope.value) return
    try {
      const token = value ? (saved.value?.body.intent_id === value.body.intent_id && selectionToken || crypto.randomUUID()) : null
      const raw = value || parked.length ? JSON.stringify({ version: 2, current: value, selection_token: token, deferred: parked }) : null
      sessionStorage.setItem(selectionKey(), token ?? '')
      if (raw) localStorage.setItem(scope.value, raw)
      else localStorage.removeItem(scope.value)
      storageSnapshot = raw
      selectionToken = token
      saved.value = value
      otherSelection.value = null
      deferred.value = parked
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
  const validateCheckout = (c: PosCheckout) => {
    if (!uuid(c.checkout_id) || !uuid(c.intent_id) || !positive(c.order_id) || !positive(c.revision) || !positive(c.amount_minor) || c.currency !== 'UAH' || !Array.isArray(c.items) || !c.items.length || !c.items.every(item => positive(item.product_id) && positive(item.quantity) && Number.isSafeInteger(item.total_minor) && item.total_minor >= 0) || c.employee.user_id !== auth.user?.id || !c.payment || !c.receipt || !c.handover || !c.actions || c.payment.provider !== 'monobank' || c.receipt.issuer !== 'checkbox' || !['can_resume','can_refresh','can_handover','can_recover_invoice','can_start_new'].every(key => typeof c.actions[key as keyof PosCheckout['actions']] === 'boolean')) throw new Error('invalid state')
    if (saved.value && (c.intent_id !== saved.value.body.intent_id || (saved.value.checkout_id && c.checkout_id !== saved.value.checkout_id))) throw new Error('foreign intent')
  }
  const accept = (c: PosCheckout, v: number) => {
    if (!current(v)) return
    validateCheckout(c)
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
    if (!(operation === 'handover' ? canHandover.value : operation === 'resume' ? c.actions.can_resume && c.status === 'prepared' && !c.payment.invoice_id : c.actions.can_refresh && !!c.payment.invoice_id)) return
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
    if (!intent.key || 'selection_only' in intent.body || intent.checkout_id) return
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
        if (allowed.value && retryMissing) await create()
        else error.value = allowed.value ? 'Рахунок ще не знайдено. Відновіть той самий запит.' : 'Нові рахунки призупинено. Збережений запит не створює нову оплату.'
        return
      }
      error.value = message(cause); return
    } finally { if (current(v)) loading.value = false }
    if (!current(v) || !checkout.value) return
    if (retryMissing) {
      const pending = saved.value?.command
      if (pending) await command(pending.operation)
      else if (checkout.value.actions.can_resume && checkout.value.status === 'prepared') await command('resume')
    }
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
  const readSaved = async () => {
    let readOk = false
    await withSaleLock(async () => {
      if (!access.value || !checkout.value || busy.value || loading.value) return
      const v = generation
      loading.value = true
      try { await pollState(); readOk = current(v) && !error.value }
      finally { if (current(v)) loading.value = false }
    })
    return readOk
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
    if (!priceOffer.value || 'selection_only' in saved.value.body) return
    try { persist({ ...saved.value, body: { ...saved.value.body, expected_amount_minor: priceOffer.value.amount_minor }, offer: priceOffer.value, proposed: undefined }); priceOffer.value = null; await create() }
    catch (cause) { error.value = message(cause) }
  }
  const deferCurrent = async () => {
    let didDefer = false
    await withSaleLock(async () => {
      if (!canDefer.value || busy.value || loading.value || !checkout.value || !saved.value) return
      const record = saved.value, c = checkout.value, v = generation
      loading.value = true; error.value = ''; stopTimer()
      try {
        if (hasInvoiceAttachment(c.order_id)) {
          error.value = 'Є незавершена звірка рахунку. Спочатку перечитайте стан цього продажу.'
          return
        }
        const freshCapabilities = await read<PosCapabilities>('/capabilities')
        if (!current(v)) return
        capabilities.value = freshCapabilities
        if (!allowed.value) {
          error.value = 'Нові продажі зараз недоступні. Поточний продаж залишився відкритим.'
          return
        }
        const latest = await read<PosCheckout>(`/checkouts/${c.checkout_id}`)
        if (!current(v)) return
        validateCheckout(latest)
        if (latest.revision < c.revision || !unresolvedCreate(latest)) {
          accept(latest, v)
          error.value = 'Стан продажу змінився. Перевірте його перед наступною дією.'
          return
        }
        if (hasInvoiceAttachment(c.order_id)) {
          error.value = 'Є незавершена звірка рахунку. Спочатку перечитайте стан цього продажу.'
          return
        }
        persist(null, [{ record, summary: saleSummary(latest) }, ...deferred.value.filter(row => row.summary.checkout_id !== c.checkout_id)])
        checkout.value = null
        priceOffer.value = null
        searchGeneration++
        offers.value = { items: [], total: 0, page: 1, page_size: 20 }
        searchBusy.value = false
        searchError.value = ''
        didDefer = true
      } catch (cause) { if (current(v)) error.value = message(cause) }
      finally { if (current(v)) { loading.value = false; schedule() } }
    })
    return didDefer
  }
  const selectExisting = async (record: SavedSale, parked = deferred.value) => {
    const v = generation
    loading.value = true; error.value = ''
    try {
      const latest = await read<PosCheckout>(`/checkouts/by-intent/${record.body.intent_id}`)
      if (!current(v)) return
      validateCheckout(latest)
      if (latest.intent_id !== record.body.intent_id || (record.checkout_id && latest.checkout_id !== record.checkout_id)) throw new Error('foreign selection')
      persist({ ...record, checkout_id: latest.checkout_id }, parked)
      accept(latest, v)
    } catch (cause) { if (current(v)) error.value = message(cause) }
    finally { if (current(v)) { loading.value = false; schedule() } }
  }
  const resumeActive = async (selection: Pick<ActiveSale, 'checkout_id'>) => {
    if (busy.value || loading.value || saved.value || otherSelection.value || !access.value) return
    const parked = deferred.value.find(row => row.summary.checkout_id === selection.checkout_id)
    if (parked) {
      await selectExisting(parked.record, deferred.value.filter(row => row !== parked))
      return
    }
    const c = active.value.items.find(row => row.checkout_id === selection.checkout_id)
    if (c && c.employee.user_id === auth.user?.id && uuid(c.checkout_id) && uuid(c.intent_id)) {
      await selectExisting({ body: { intent_id: c.intent_id, currency: 'UAH', selection_only: true }, checkout_id: c.checkout_id })
    }
  }
  const openOtherSelection = async () => {
    if (!otherSelection.value || saved.value || loading.value || busy.value || !access.value) return
    const record = otherSelection.value
    if (record.checkout_id) await selectExisting(record)
    else {
      persist(record)
      await recover(false)
    }
  }
  const loadMoreActive = async () => {
    if (!access.value || !moreActive.value || activeLoading.value) return
    const v = generation, page = active.value.page + 1
    activeLoading.value = true
    try {
      const result = await read<PosPage<PosCheckout>>('/checkouts/active', { page, page_size: 20 })
      if (!current(v)) return
      if (result.page !== page || !Array.isArray(result.items)) throw new Error('invalid active page')
      const byId = new Map([...active.value.items, ...result.items].map(c => [c.checkout_id, c]))
      active.value = { ...result, items: [...byId.values()] }
    } catch (cause) { if (current(v)) error.value = message(cause) }
    finally { if (current(v)) activeLoading.value = false }
  }
  const validateRecord = (value: SavedSale) => {
    if (!uuid(value.body?.intent_id) || value.body.currency !== 'UAH' || (value.checkout_id && !uuid(value.checkout_id)) || (value.command && (!uuid(value.command.key) || !['resume','refresh','handover'].includes(value.command.operation) || !positive(value.command.revision)))) throw new Error('invalid saved sale')
    if ('selection_only' in value.body) {
      if (value.body.selection_only !== true || !uuid(value.checkout_id) || value.key || value.proposed || value.proposedQuote) throw new Error('invalid selection')
      return value
    }
    if (!uuid(value.key)) throw new Error('invalid saved key')
    if ('items' in value.body) {
      const items = value.body.items
      if (!Array.isArray(items) || !items.length || !items.every(item => positive(item.product_id) && positive(item.quantity)) || new Set(items.map(item => item.product_id)).size !== items.length || !quoteRevision(value.body.quote_revision) || (value.body.promo_code !== null && typeof value.body.promo_code !== 'string') || (value.body.promotion_id != null && (!positive(value.body.promotion_id) || !!value.body.promo_code)) || (value.proposedQuote && !matchesQuote(value.proposedQuote, value.body))) throw new Error('invalid saved cart')
    } else if (!positive(value.body.product_id) || !positive(value.body.expected_amount_minor) || value.body.quantity !== 1 || !value.offer) throw new Error('invalid saved sale')
    return value
  }
  const restore = (raw: string) => {
    const parsed = JSON.parse(raw)
    if (parsed?.version === 2) {
      if (!Array.isArray(parsed.deferred)) throw new Error('invalid deferred sales')
      const records: DeferredSale[] = parsed.deferred
      const ids = new Set<string>()
      for (const { record, summary } of records) {
        validateRecord(record)
        if (!summary || !uuid(summary.checkout_id) || record.checkout_id !== summary.checkout_id || ids.has(summary.checkout_id)
          || !positive(summary.order_id) || !positive(summary.revision) || !positive(summary.amount_minor) || typeof summary.products !== 'string' || typeof summary.status !== 'string') throw new Error('invalid deferred sale')
        ids.add(summary.checkout_id)
      }
      const selected = parsed.current === null ? null : validateRecord(parsed.current)
      if (selected?.checkout_id && ids.has(selected.checkout_id)) throw new Error('duplicate checkout')
      if (selected && !uuid(parsed.selection_token)) throw new Error('invalid selection token')
      deferred.value = records
      if (selected && sessionStorage.getItem(selectionKey()) === parsed.selection_token) {
        saved.value = selected
        selectionToken = parsed.selection_token
      } else {
        otherSelection.value = selected
        sessionStorage.setItem(selectionKey(), '')
      }
    } else {
      saved.value = validateRecord(parsed)
      selectionToken = crypto.randomUUID()
      sessionStorage.setItem(selectionKey(), selectionToken)
    }
    priceOffer.value = saved.value?.proposed || null
  }
  const startNew = async () => {
    if (busy.value || loading.value || !checkout.value?.actions.can_start_new || checkout.value.status !== 'completed' || checkout.value.handover.status !== 'handed_over') return
    try { persist(null); checkout.value = null; priceOffer.value = null; error.value = ''; await init() } catch (cause) { error.value = message(cause) }
  }
  const reset = () => {
    generation++; searchGeneration++; stopTimer(); initFlight = null; readFlight = null
    capabilities.value = null; checkout.value = null; saved.value = null; priceOffer.value = null; busy.value = false; loading.value = false; searchBusy.value = false; error.value = ''; searchError.value = ''; storageFault.value = false
    offers.value = {items:[],total:0,page:1,page_size:20}; active.value = {items:[],total:0,page:1,page_size:20}
    deferred.value = []; otherSelection.value = null; activeLoading.value = false
    storageSnapshot = null; selectionToken = null
    if (!scope.value) return
    try { storageSnapshot = localStorage.getItem(scope.value); if (storageSnapshot) restore(storageSnapshot) } catch { storageFault.value = true; error.value = 'Не вдалося прочитати збережений продаж. Зверніться до адміністратора; нову оплату не створюйте.' }
    if (!storageFault.value) void init()
  }
  watch(session, reset, { immediate: true, flush: 'sync' })
  const storageChanged = (event: StorageEvent) => { if (event.key === scope.value) reset() }
  if (import.meta.client) window.addEventListener('storage', storageChanged)
  onScopeDispose(() => { generation++; stopTimer(); if (import.meta.client) window.removeEventListener('storage', storageChanged) })
  return { capabilities, checkout, offers, active, activeSales, activeLoading, moreActive, loadMoreActive, otherSelection, openOtherSelection: () => withSaleLock(openOtherSelection), canDefer, deferCurrent, priceOffer, priceQuote, cartLimits, saved, busy, loading, searchBusy, error, searchError, storageFault, access, allowed, paymentUrl, canHandover, init, search, getCartQuote, startCart, confirmPrice: () => withSaleLock(confirmPrice), resumeActive: (c: Pick<ActiveSale, 'checkout_id'>) => withSaleLock(() => resumeActive(c)), recover: () => withSaleLock(() => recover()), readSelection: () => withSaleLock(() => recover(false)), readSaved, poll, resume: () => withSaleLock(() => command('resume')), handover: () => withSaleLock(() => command('handover')), refresh: () => withSaleLock(() => command('refresh')), startNew: () => withSaleLock(startNew) }
}
