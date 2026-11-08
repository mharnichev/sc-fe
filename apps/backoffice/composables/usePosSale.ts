import type { PosCapabilities, PosCheckout, PosCreate, PosOffer, PosPage } from '~/types/posSale'
const root = '/backoffice/pos'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
interface SavedSale { key: string; body: PosCreate; offer: PosOffer; proposed?: PosOffer; checkout_id?: string; command?: { operation: 'resume' | 'refresh' | 'handover'; key: string; revision: number } }
export const posMoney = (minor: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(minor / 100)
export const usePosSale = () => {
  const api = useApi(), auth = useAuthStore()
  const capabilities = shallowRef<PosCapabilities | null>(null), checkout = shallowRef<PosCheckout | null>(null)
  const offers = shallowRef<PosPage<PosOffer>>({ items: [], total: 0, page: 1, page_size: 20 })
  const active = shallowRef<PosPage<PosCheckout>>({ items: [], total: 0, page: 1, page_size: 20 })
  const saved = shallowRef<SavedSale | null>(null), priceOffer = shallowRef<PosOffer | null>(null)
  const busy = ref(false), loading = ref(false), searchBusy = ref(false), error = ref(''), searchError = ref(''), storageFault = ref(false)
  let generation = 0, searchGeneration = 0, timer: ReturnType<typeof setTimeout> | undefined
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
    try { if (value) localStorage.setItem(scope.value, JSON.stringify(value)); else localStorage.removeItem(scope.value); saved.value = value }
    catch { storageFault.value = true; throw new Error('storage') }
  }
  const message = (cause: unknown) => {
    const status = (cause as { response?: { status?: number } })?.response?.status
    if (status === 401 || status === 403) { capabilities.value = null; return 'Доступ до продажу втрачено. Зверніться до адміністратора.' }
    if (status === 404) return 'Продаж не знайдено або немає доступу до нього.'
    return 'Результат ще не підтверджено. Відновіть цей самий продаж; не створюйте нову оплату.'
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
      persist({ ...saved.value, checkout_id: c.checkout_id, proposed: undefined, command: resolved ? undefined : pending })
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
    if (busy.value || !allowed.value || !saved.value || priceOffer.value) return
    const v = generation, intent = saved.value
    busy.value = true; error.value = ''; stopTimer()
    try {
      const result = await api<PosCheckout>(`${root}/checkouts`, { method: 'POST', body: intent.body, headers: { 'Idempotency-Key': intent.key }, retry: 0, cache: 'no-store' })
      accept(result, v)
    } catch (cause) {
      if (!current(v)) return
      const detail = (cause as { data?: { detail?: { code?: string; current_offer?: PosOffer } } })?.data?.detail
      if (detail?.code === 'price_changed' && detail.current_offer?.id === intent.body.product_id && detail.current_offer.currency === 'UAH' && positive(detail.current_offer.amount_minor)) {
        priceOffer.value = detail.current_offer; persist({ ...intent, proposed: detail.current_offer })
      } else error.value = message(cause)
    } finally { if (current(v)) { busy.value = false; schedule() } }
  }
  const recover = async () => {
    if (!saved.value || busy.value || !access.value || priceOffer.value) return
    const v = generation
    loading.value = true; error.value = ''
    try {
      const value = await read<PosCheckout>(`/checkouts/by-intent/${saved.value.body.intent_id}`)
      accept(value, v)
    } catch (cause) {
      if (!current(v)) return
      if ((cause as { response?: { status?: number } }).response?.status === 404) { loading.value = false; if (allowed.value) await create(); else error.value = 'Нові рахунки призупинено. Збережений запит не створює нову оплату.'; return }
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
  const poll = (): Promise<void> => {
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
      if (current(v) && access.value && saved.value && !priceOffer.value) await recover()
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
  const selectOffer = async (offer: PosOffer) => {
    if (!allowed.value || busy.value || loading.value || saved.value || !offer.can_sell || offer.available_quantity < 1 || !positive(offer.amount_minor) || offer.currency !== 'UAH') return
    try {
      const existing = localStorage.getItem(scope.value)
      if (existing) { restore(existing); await recover(); return }
      persist({ key: crypto.randomUUID(), body: { intent_id: crypto.randomUUID(), product_id: offer.id, quantity: 1, expected_amount_minor: offer.amount_minor, currency: 'UAH' }, offer })
      await create()
    } catch (cause) { error.value = message(cause) }
  }
  const confirmPrice = async () => {
    if (!saved.value || !priceOffer.value || busy.value || !allowed.value) return
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
    if (!uuid(value.key) || !uuid(value.body?.intent_id) || !positive(value.body.product_id) || !positive(value.body.expected_amount_minor) || value.body.quantity !== 1 || value.body.currency !== 'UAH' || !value.offer || (value.command && (!uuid(value.command.key) || !['resume','refresh','handover'].includes(value.command.operation) || !positive(value.command.revision)))) throw new Error('invalid saved sale')
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
    if (!scope.value) return
    try { const value = localStorage.getItem(scope.value); if (value) restore(value) } catch { storageFault.value = true; error.value = 'Не вдалося прочитати збережений продаж. Зверніться до адміністратора; нову оплату не створюйте.' }
    if (!storageFault.value) void init()
  }
  watch(session, reset, { immediate: true, flush: 'sync' })
  const storageChanged = (event: StorageEvent) => { if (event.key === scope.value) reset() }
  if (import.meta.client) window.addEventListener('storage', storageChanged)
  onScopeDispose(() => { generation++; stopTimer(); if (import.meta.client) window.removeEventListener('storage', storageChanged) })
  return { capabilities, checkout, offers, active, priceOffer, saved, busy, loading, searchBusy, error, searchError, storageFault, access, allowed, paymentUrl, canHandover, init, search, selectOffer, confirmPrice, resumeActive, recover, poll, handover: () => command('handover'), refresh: () => command('refresh'), startNew }
}
