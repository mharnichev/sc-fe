<script setup lang="ts">
import { commerceBreadcrumb, reportCommerceError } from '~/utils/commerceTelemetry'
import { readCheckoutConfirmation, saveCheckoutConfirmation } from '~/utils/checkoutConfirmation'
import { readReminderOrderKey, reminderOrderStorageKey, reminderStorageKey } from '~/utils/checkoutReminder'
import { safeRequestBody } from '~/utils/inputSafety'
import { guestShipmentPath } from '~/utils/shipmentStatus'
import type { CheckoutOrder, CheckoutOrderRequest } from '~/types/order'
import type { NpSettlement, NpBranch, NpStreet } from '~/types/nova-poshta'
import { isProductUnavailable } from '~/utils/product-visibility'
const { runtimeText, runtimeMessage } = useShopRuntimeDisplay()
const { paymentText } = usePaymentDisplay()
const shopAsset = useShopAsset()

const { productDisplayName } = useProductDisplay()

const emailCheckpointRevision = ref(0)
const onCheckoutEmailCheckpoint = (event: Event) => { if (event.isTrusted) emailCheckpointRevision.value++ }

const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const domain = useCatalogDomain()
const auth = useCustomerAuthStore()
const { terms, locale } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()
const paymentTermsOpen = ref(false)
const autoPayOrderId = ref<number | null>(null)

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  callbackRequested: false,
  shippingCompany: 'novaPost',
  shippingMethod: 'warehouse',
  shippingArea: '',
  shippingCity: '',
  shippingWarehouseNumber: '',
  shippingStreet: '',
  buildingNumber: '',
  shippingApartment: '',
  paymentMethod: 'cashOnDelivery',
  comment: '',
})
const customerScope = computed(() => auth.isAuthenticated ? `customer:${auth.customer?.id}` : 'guest')
const promo = useCheckoutPromo(
  () => cart.items.map(item => ({ productId: item.product.id, quantity: item.quantity })),
  () => form.phoneNumber,
  () => customerScope.value,
)
const hasPromoDiscount = computed(() => Boolean(promo.quote.value?.applied_code && Number(promo.quote.value.discount_amount) > 0))
const checkoutTotal = computed(() => promo.quote.value?.total_amount ?? cart.total)
const totalDirection = ref<'up' | 'down'>('up')
const formattedTotal = computed(() => formatPrice(checkoutTotal.value))
const totalCharacters = computed(() => Array.from(formattedTotal.value).map((character, index, characters) => ({
  character,
  place: characters.length - index,
  isDigit: /\d/.test(character),
})))

watch(checkoutTotal, (value, previous) => {
  totalDirection.value = Number(value) >= Number(previous) ? 'up' : 'down'
}, { flush: 'sync' })

const cityQuery = ref('')
const branchQuery = ref('')
const streetQuery = ref('')
const selectedCity = ref<NpSettlement | null>(null)
const selectedBranch = ref<NpBranch | null>(null)
const selectedStreet = ref<NpStreet | null>(null)
const manualStreet = ref(false)
const deliveryText = computed(() => locale.value === 'uk' ? {
  empty: 'Нічого не знайдено. Спробуйте іншу назву.', short: 'Введіть щонайменше 2 символи.',
  loading: 'Шукаємо…', failed: 'Не вдалося завантажити довідник.', retry: 'Спробувати ще раз',
  branch: 'Номер відділення, поштомата або адреса', street: 'Почніть вводити назву вулиці',
  manualStreet: 'Вулиці немає у списку — ввести вручну',
  popular: 'Популярні міста', noCourier: 'Кур’єрська доставка недоступна для цього населеного пункту.',
  stale: 'Використовуємо останню збережену версію довідника.', choose: 'Оберіть варіант із підказок.',
} : {
  empty: 'No results. Try another name.', short: 'Enter at least 2 characters.', loading: 'Searching…',
  failed: 'Could not load the directory.', retry: 'Try again', branch: 'Branch / parcel locker number or address',
  manualStreet: 'Street is missing — enter manually',
  street: 'Start typing the street name', popular: 'Popular cities', noCourier: 'Courier delivery is unavailable for this settlement.',
  stale: 'Showing the last saved directory.', choose: 'Choose a suggestion.',
})
const popularCities = ['Київ', 'Львів', 'Одеса', 'Дніпро', 'Харків', 'Запоріжжя', 'Вінниця', 'Івано-Франківськ']
const cities = useNovaPoshtaSearch<NpSettlement>('settlements', () => selectedCity.value || cityQuery.value.trim().length < 2 ? null : { q: cityQuery.value.trim(), limit: '20' }, () => deliveryText.value.failed)
const branches = useNovaPoshtaSearch<NpBranch>('branches', () => !selectedCity.value || form.shippingMethod !== 'warehouse' || selectedBranch.value ? null : { settlement_ref: selectedCity.value.ref, q: branchQuery.value.trim(), limit: branchQuery.value.trim() ? '100' : '30' }, () => deliveryText.value.failed)
// Include parcel lockers in the initial suggestions even when low-numbered branches fill the first page.
const parcelLockers = useNovaPoshtaSearch<NpBranch>('branches', () => !selectedCity.value || form.shippingMethod !== 'warehouse' || selectedBranch.value || branchQuery.value.trim() ? null : { settlement_ref: selectedCity.value.ref, q: 'Поштомат', limit: '15' }, () => deliveryText.value.failed)
const pickupPoints = computed(() => {
  if (selectedBranch.value) return [selectedBranch.value]
  const points = [...branches.items.value, ...parcelLockers.items.value]
  return [...new Map(points.map(point => [point.ref, point])).values()].sort((a, b) =>
    Number(a.type === 'postomat') - Number(b.type === 'postomat')
    || a.number.localeCompare(b.number, 'uk', { numeric: true })
    || a.label.localeCompare(b.label, 'uk'),
  )
})
const retryPickupPoints = () => { branches.retry(); parcelLockers.retry() }
const streets = useNovaPoshtaSearch<NpStreet>('streets', () => !selectedCity.value?.delivery_available || form.shippingMethod !== 'courier' || manualStreet.value || selectedStreet.value || streetQuery.value.trim().length < 2 ? null : { settlement_ref: selectedCity.value.ref, q: streetQuery.value.trim(), limit: '20' }, () => deliveryText.value.failed)
const selectCity = (city: NpSettlement) => {
  selectedCity.value = city
  cityQuery.value = city.label
  form.shippingCity = city.name
  form.shippingArea = city.area
}
const chooseCity = (ref: string) => {
  const city = selectedCity.value?.ref === ref ? selectedCity.value : cities.items.value.find(city => city.ref === ref)
  if (city) selectCity(city)
}
const popularQuery = ref('')
const popular = useNovaPoshtaSearch<NpSettlement>('settlements', () => popularQuery.value ? { q: popularQuery.value, limit: '20' } : null, () => deliveryText.value.failed)
watch(popular.items, items => {
  const city = items.find(city => city.name === popularQuery.value)
  if (city) { selectCity(city); popularQuery.value = '' }
})
const choosePopularCity = (name: string) => {
  selectedCity.value = null
  cityQuery.value = name
  form.shippingCity = ''; form.shippingArea = ''
  popularQuery.value = name
  popular.retry()
}
const chooseBranch = (ref: string) => {
  const branch = selectedBranch.value?.ref === ref ? selectedBranch.value : pickupPoints.value.find(branch => branch.ref === ref)
  if (!branch) return
  selectedBranch.value = branch
  branchQuery.value = branch.label
  form.shippingWarehouseNumber = branch.number
}
const chooseStreet = (ref: string) => {
  const street = selectedStreet.value?.ref === ref ? selectedStreet.value : streets.items.value.find(street => street.ref === ref)
  if (!street) return
  selectedStreet.value = street
  streetQuery.value = street.label
  form.shippingStreet = street.name
}
watch(cityQuery, value => {
  if (value !== selectedCity.value?.label) popularQuery.value = ''
  if (selectedCity.value && value !== selectedCity.value.label) { selectedCity.value = null; form.shippingCity = ''; form.shippingArea = '' }
}, { flush: 'sync' })
const resetAddress = () => {
  manualStreet.value = false
  selectedBranch.value = null; selectedStreet.value = null
  branchQuery.value = ''; streetQuery.value = ''
  form.shippingWarehouseNumber = ''; form.shippingStreet = ''; form.buildingNumber = ''; form.shippingApartment = ''
}
watch(() => selectedCity.value?.ref, resetAddress, { flush: 'sync' })
watch(() => form.shippingMethod, resetAddress, { flush: 'sync' })
watch(manualStreet, () => {
  selectedStreet.value = null; streetQuery.value = ''; form.shippingStreet = ''; form.buildingNumber = ''; form.shippingApartment = ''
}, { flush: 'sync' })
watch(() => selectedStreet.value?.ref, () => { form.buildingNumber = ''; form.shippingApartment = '' }, { flush: 'sync' })
watch(branchQuery, value => { if (value !== selectedBranch.value?.label) { selectedBranch.value = null; form.shippingWarehouseNumber = '' } }, { flush: 'sync' })
watch(streetQuery, value => { if (value !== selectedStreet.value?.label) { selectedStreet.value = null; form.shippingStreet = '' } }, { flush: 'sync' })
const state = reactive<{ loading: boolean, order: CheckoutOrder | null, error: string }>({
  loading: false,
  order: null,
  error: '',
})

const confirmationHeading = ref<HTMLHeadingElement | null>(null)
watch(() => state.order, order => {
  if (!order) return
  // The confirmation replaces a long form on the same route.
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  confirmationHeading.value?.focus({ preventScroll: true })
}, { flush: 'post' })

const deliveryMethodOptions = computed(() => [
  { label: locale.value === 'uk' ? 'Відділення або поштомат Нової пошти' : 'Nova Poshta branch or parcel locker', value: 'warehouse' },
  { label: terms.value.checkout.deliveryOptions.courier, value: 'courier' },
])
const onlinePaymentEnabled = ref(false)
const onlinePaymentLoading = ref(true)
onMounted(async () => {
  try {
    const result = await useApi()<{ enabled: boolean }>('/public/orders/online-payment-capabilities', { retry: 0 })
    onlinePaymentEnabled.value = result.enabled === true
  } catch (cause) {
    onlinePaymentEnabled.value = false
    reportCommerceError('checkout.payment_capabilities_failed', cause, { flow: 'checkout' })
  } finally {
    onlinePaymentLoading.value = false
  }
})
const paymentOptions = computed(() => [
  { label: terms.value.checkout.paymentOptions.cashOnDelivery, value: 'cashOnDelivery' },
  { label: locale.value === 'uk' ? 'Карткою онлайн · monobank' : 'Pay online · monobank', value: 'onlineCard' },
])
const paymentChoiceText = computed(() => locale.value === 'uk' ? {
  introduction: 'Оберіть зручний спосіб оплати.',
  onlineUnavailable: 'Онлайн-оплата тимчасово недоступна.',
  onlineLoading: 'Перевіряємо доступність онлайн-оплати…',
  onlineDescription: 'Після створення замовлення ви зможете перейти на захищену сторінку платіжного провайдера та оплатити карткою.',
  onlineConfirmation: 'Замовлення створено. Завершіть оплату.',
} : {
  introduction: 'Choose how you would like to pay.',
  onlineUnavailable: 'Online payment is temporarily unavailable.',
  onlineLoading: 'Checking online payment availability…',
  onlineDescription: 'After placing your order, you can continue to the payment provider’s secure page and pay by card.',
  onlineConfirmation: 'Order created. Complete your payment.',
})
const isDeliveryValid = computed(() => {
  if (!selectedCity.value) return false
  if (form.shippingMethod === 'warehouse') return Boolean(selectedBranch.value)
  return Boolean(selectedCity.value.delivery_available && (manualStreet.value ? form.shippingStreet.trim() : selectedStreet.value) && form.buildingNumber.trim())
})
const canSubmit = computed(() =>
  Boolean(
    cart.items.length
    && sessionReady.value
    && !otherScopePending.value
    && !cart.syncing
    && promo.ready.value
    && !cart.hasUnavailableItems
    && (form.paymentMethod !== 'onlineCard' || onlinePaymentEnabled.value)
    && form.firstName.trim()
    && form.lastName.trim()
    && form.phoneNumber.trim()
    && isDeliveryValid.value,
  ),
)
const unavailableItems = computed(() => cart.items.filter(item => isProductUnavailable(item.product)))
const unavailableMessage = computed(() => terms.value.checkout.unavailableProducts(
  unavailableItems.value.map(item => productDisplayName(item.product)).join(', '),
))

watch(() => auth.customer, customer => {
  if (!customer) return
  form.firstName ||= customer.name || ''
  form.lastName ||= customer.surname || ''
  form.email ||= customer.email || ''
  form.phoneNumber ||= customer.phone || ''
}, { immediate: true })

// Keep the exact submitted intent after a timeout, including when BE already emptied its cart.
// sessionStorage limits contact/address retention to this tab's session.
interface PendingCheckout { key: string, body: CheckoutOrderRequest, scope: string, reminderKey?: string, expectedTotal?: number }
const pendingIntent = ref<PendingCheckout | null>(null)
const intentStorageKey = 'shop-checkout-intent-v1'
const retryAvailable = computed(() => sessionReady.value && pendingIntent.value?.scope === customerScope.value)
const sessionReady = ref(false)
const otherScopePending = ref(false)
const cartMayClear = ref(false)
const cartPreserved = ref(false)
let checkoutActive = true
onBeforeUnmount(() => { checkoutActive = false })
watch(() => cart.items, () => { if (pendingIntent.value) cartMayClear.value = false }, { deep: true, flush: 'sync' })
const restoreIntent = () => {
  pendingIntent.value = null
  cartMayClear.value = false
  otherScopePending.value = false
  if (!sessionReady.value) return
  try {
    const stored = sessionStorage.getItem(intentStorageKey)
    if (stored) {
      const intent = JSON.parse(stored) as PendingCheckout
      if (typeof intent.key === 'string' && intent.body?.items?.length) {
        if (intent.scope === customerScope.value) pendingIntent.value = intent
        else otherScopePending.value = true
      }
    }
  }
  catch { state.error = 'Не вдалося відновити запит замовлення.' }
}
const restoreConfirmation = () => {
  const id = typeof route.query.confirmation === 'string' ? Number(route.query.confirmation) : NaN
  try { state.order = readCheckoutConfirmation(sessionStorage, customerScope.value, id) } catch { state.order = null }
}
onNuxtReady(() => { sessionReady.value = true; restoreIntent(); if (!pendingIntent.value && !otherScopePending.value) restoreConfirmation() })
watch([customerScope, () => auth.sessionRevision], ([_scope], [previousScope]) => {
  state.order = null
  autoPayOrderId.value = null
  state.error = ''
  if (previousScope !== 'guest') {
    // Contact and delivery belong to the previous buyer, even after confirmation.
    Object.assign(form, { firstName: '', lastName: '', email: '', phoneNumber: '', callbackRequested: false, comment: '', shippingCity: '', shippingArea: '' })
    selectedCity.value = null
    cityQuery.value = ''
    resetAddress()
    const customer = auth.customer
    if (customer) Object.assign(form, { firstName: customer.name || '', lastName: customer.surname || '', email: customer.email || '', phoneNumber: customer.phone || '' })
  }
  restoreIntent()
  // Never reveal another buyer's receipt after login/logout, even in the same tab.
  if (previousScope !== 'guest') {
    try { sessionStorage.removeItem(`shop-checkout-confirmation-v1:${previousScope}:${route.query.confirmation}`) } catch {}
  }
})

const sendIntent = async (intent: PendingCheckout, freshCheckout = false) => {
  if (!checkoutActive || state.loading || intent.scope !== customerScope.value) return
  const sessionCurrent = auth.captureSession()
  const ownsIntent = () => {
    if (!checkoutActive || !sessionCurrent() || intent.scope !== customerScope.value || pendingIntent.value?.key !== intent.key) return false
    try {
      const stored = JSON.parse(sessionStorage.getItem(intentStorageKey) || 'null') as PendingCheckout | null
      return stored?.key === intent.key && stored.scope === intent.scope
    }
    catch { return false }
  }
  if (!ownsIntent()) return
  state.loading = true
  state.error = ''
  let createdOrderId: number | undefined
  commerceBreadcrumb('checkout.create_order', { flow: 'checkout', payment_method: intent.body.paymentMethod })
  try {
    const result = await domain.createOrder(intent.body, intent.key, intent.reminderKey)
    if (!ownsIntent()) return
    const expectedMinor = Math.round(Number(intent.expectedTotal) * 100)
    const returnedMinor = Math.round(Number(result.total_amount) * 100)
    const totalUnchanged = Number.isSafeInteger(expectedMinor) && expectedMinor >= 0
      && Number.isSafeInteger(returnedMinor) && returnedMinor === expectedMinor
    autoPayOrderId.value = null
    promo.clearSaved()
    state.order = result
    createdOrderId = result.id
    commerceBreadcrumb('checkout.order_created', { flow: 'checkout', order_id: result.id, payment_method: result.payment_method })
    try {
      saveCheckoutConfirmation(sessionStorage, intent.scope, result)
      // URL carries only the order ID; guest capabilities remain in sessionStorage.
      void Promise.resolve(router.replace({ query: { ...route.query, confirmation: String(result.id) } })).then(failure => {
        if (!failure && freshCheckout && totalUnchanged && result.payment_method === 'onlineCard'
          && checkoutActive && sessionCurrent() && intent.scope === customerScope.value && state.order?.id === result.id) {
          autoPayOrderId.value = result.id
        }
      }).catch(cause => {
        if (checkoutActive && sessionCurrent() && intent.scope === customerScope.value) {
          reportCommerceError('checkout.confirmation_navigation_failed', cause, { flow: 'checkout', order_id: result.id })
        }
      })
    } catch { /* The in-memory confirmation remains available if receipt storage fails. */ }
    sessionStorage.removeItem(reminderOrderStorageKey(intent.scope))
    sessionStorage.removeItem(reminderStorageKey(intent.scope))
    pendingIntent.value = null
    sessionStorage.removeItem(intentStorageKey)
    if (auth.isAuthenticated) await cart.syncFromServer()
    else if (cartMayClear.value) cart.clear()
    else cartPreserved.value = cart.items.length > 0
  }
  catch (error: unknown) {
    if (!checkoutActive || !sessionCurrent() || intent.scope !== customerScope.value) return
    if (createdOrderId !== undefined) {
      reportCommerceError('checkout.confirmation_cleanup_failed', error, { flow: 'checkout', order_id: createdOrderId, payment_method: intent.body.paymentMethod })
      return
    }
    if (!ownsIntent()) return
    cartMayClear.value = false
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0
    // Validation rejection is conclusive. Auth expiry/network/5xx/409 retain the intent.
    const detail = typeof error === 'object' && error && 'data' in error
      ? (error.data as { detail?: unknown })?.detail : undefined
    const stockRejected = status === 409 && typeof detail === 'string'
      && /^Insufficient stock for product \d+; backorders are disabled$/.test(detail)
    if (!stockRejected) reportCommerceError('checkout.create_order_failed', error, { flow: 'checkout', payment_method: intent.body.paymentMethod })
    if ([400, 422].includes(status) || stockRejected) {
      pendingIntent.value = null
      sessionStorage.removeItem(intentStorageKey)
    }
    state.error = terms.value.checkout.failed
  }
  finally { state.loading = false }
}
const paymentMethodChanged = (method: string) => {
  if (!state.order || !['cash', 'cashOnDelivery'].includes(method)) return
  state.order.payment_method = method
  try { saveCheckoutConfirmation(sessionStorage, customerScope.value, state.order) } catch {}
}
const retryIntent = () => { if (pendingIntent.value) void sendIntent(pendingIntent.value) }
const submit = async () => {
  if (state.loading) return
  if (retryAvailable.value) { retryIntent(); return }
  if (unavailableItems.value.length) { state.error = unavailableMessage.value; return }
  if (!canSubmit.value) return
  const body: CheckoutOrderRequest = {
    ...form,
    promoCode: promo.quote.value?.applied_code || undefined,
    email: form.email.trim() || undefined,
    shippingStreet: form.shippingStreet.trim(),
    shippingSettlementRef: selectedCity.value?.ref,
    shippingCityRef: selectedCity.value?.city_ref || undefined,
    shippingWarehouseRef: selectedBranch.value?.ref,
    shippingStreetRef: selectedStreet.value?.ref,
    shipping_payload_json: {
      settlementLabel: selectedCity.value?.label || null,
      cityLabel: selectedCity.value?.name || null,
      warehouseLabel: selectedBranch.value?.label || null,
      streetLabel: selectedStreet.value?.label || null,
    },
    items: cart.items.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
  }
  let safeBody: CheckoutOrderRequest
  try { safeBody = safeRequestBody('/public/orders', 'POST', body) as CheckoutOrderRequest }
  catch (error) { state.error = error instanceof Error ? error.message : 'Перевірте дані замовлення.'; return }
  let intent: PendingCheckout
  // Persist before the HTTP request; never send if durable retry storage is unavailable.
  try {
    intent = { key: crypto.randomUUID(), body: safeBody, scope: customerScope.value, reminderKey: readReminderOrderKey(sessionStorage, customerScope.value), expectedTotal: Number(checkoutTotal.value) }
    sessionStorage.setItem(intentStorageKey, JSON.stringify(intent))
  }
  catch (cause) {
    reportCommerceError('checkout.intent_storage_failed', cause, { flow: 'checkout', payment_method: form.paymentMethod })
    state.error = 'Дозвольте збереження сесії браузера для безпечного оформлення замовлення.'; return
  }
  pendingIntent.value = intent
  cartMayClear.value = true
  await sendIntent(intent, true)
}

useSeo(
  () => terms.value.seo.checkoutTitle,
  () => terms.value.seo.checkoutDescription,
)
</script>

<template>
  <section v-if="state.order" class="checkout-page checkout-confirmation" data-testid="order-confirmation">
    <div class="checkout-card checkout-confirmation__card">
      <h1 ref="confirmationHeading" class="checkout-page__success" tabindex="-1">{{ state.order.payment_method === 'onlineCard' ? paymentChoiceText.onlineConfirmation : terms.checkout.orderSuccess }}</h1>
      <p class="checkout-confirmation__number" data-testid="order-number">№ {{ state.order.id }}</p>
      <CheckoutOrderItems :items="state.order.items" />
      <OrderCallbackPreference :requested="state.order.callback_requested" />
      <div class="checkout-total">
        <span>{{ terms.common.total }}</span>
        <strong data-testid="confirmed-order-total">{{ formatPrice(state.order.total_amount) }}</strong>
      </div>
      <p v-if="cartPreserved" role="status">{{ runtimeText.cartPreserved }}</p>
      <OrderProjections :order="state.order" />
      <BaseButton v-if="state.order.payment_method === 'onlineCard'" :to="`/payment/${state.order.id}`" variant="borderless">{{ paymentText.statusPage }}</BaseButton>
      <OrderPayment :key="state.order.id" :auto-start="autoPayOrderId === state.order.id" v-if="state.order.payment_method === 'onlineCard'" :order-id="state.order.id" :guest-token="state.order.guest_payment_token || undefined" :order-path="auth.isAuthenticated ? `/cabinet/orders/${state.order.id}` : guestShipmentPath(state.order.guest_tracking_url) || undefined" @method-changed="paymentMethodChanged" />
      <OrderDocuments :order-id="state.order.id" :documents="state.order.preliminary_documents" :guest="!auth.isAuthenticated" />
      <BaseButton v-if="!auth.isAuthenticated && guestShipmentPath(state.order.guest_tracking_url)" :to="guestShipmentPath(state.order.guest_tracking_url)!">{{ runtimeText.trackingTitle }}</BaseButton>
      <BaseButton to="/catalog" variant="borderless">{{ terms.common.catalog }}</BaseButton>
    </div>
  </section>

  <section v-else class="checkout-page">
    <p v-if="otherScopePending" class="checkout-card" role="status">{{ runtimeText.otherSession }}</p>
    <section v-if="retryAvailable" class="checkout-card" role="status">
      <p>{{ runtimeText.retryNotice }}</p>
      <BaseButton :disabled="state.loading" @click="retryIntent">{{ runtimeText.retryOrder }}</BaseButton>
      <p v-if="state.error" role="alert">{{ runtimeMessage(state.error) }}</p>
    </section>
    <div class="checkout-page__body">
      <div class="checkout-page__user-info">


        <form id="shop-checkout-form" class="checkout-form" @submit.prevent="submit">
          <p v-if="unavailableItems.length" class="checkout-page__error checkout-page__unavailable" role="alert">
            {{ unavailableMessage }}
          </p>
          <section v-if="!auth.isAuthenticated" class="checkout-card checkout-contact">
            <div class="checkout-contact__head">
              <h2>{{ terms.checkout.yourContact }}</h2>
              <CustomerAuthDialog v-if="!auth.isAuthenticated" :label="terms.checkout.authorize" size="xs" />
            </div>
            <BaseInput v-model="form.email" type="email" :label="terms.checkout.email" autocomplete="email" @focusout="onCheckoutEmailCheckpoint" @keydown.enter.prevent="onCheckoutEmailCheckpoint" />
            <CheckoutServiceReminder :email="form.email" :checkpoint-revision="emailCheckpointRevision" :active="sessionReady && !state.loading && !pendingIntent && !otherScopePending" />
          </section>

          <section class="checkout-card">
            <div class="checkout-card__head">
              <span>1</span>
              <h2>{{ terms.checkout.contact }}</h2>
            </div>
            <div class="checkout-form__grid checkout-form__grid--two">
              <BaseInput v-model="form.firstName" rule="name" :label="terms.checkout.firstName" required autocomplete="given-name" />
              <BaseInput v-model="form.lastName" rule="name" :label="terms.checkout.lastName" required autocomplete="family-name" />
              <BasePhoneInput v-model="form.phoneNumber" :label="terms.checkout.phone" required />
              <BaseInput v-if="auth.isAuthenticated" v-model="form.email" type="email" :label="terms.checkout.email" autocomplete="email" @focusout="onCheckoutEmailCheckpoint" @keydown.enter.prevent="onCheckoutEmailCheckpoint" />
            </div>
            <CheckoutServiceReminder v-if="auth.isAuthenticated" :email="form.email" :checkpoint-revision="emailCheckpointRevision" :active="sessionReady && !state.loading && !pendingIntent && !otherScopePending" />
          </section>

          <section class="checkout-card">
            <div class="checkout-card__head">
              <span>2</span>
              <h2>{{ terms.checkout.delivery }}</h2>
            </div>
            <div class="checkout-form__grid">
              <BaseField>
                <div class="checkout-choice-list">
                  <BaseRadio
                    v-for="option in deliveryMethodOptions"
                    :id="`shipping-method-${option.value}`"
                    :key="option.value"
                    v-model="form.shippingMethod"
                    name="shippingMethod"
                    :label="option.label"
                    :value="option.value"
                  />
                </div>
              </BaseField>
              <BaseAutocomplete v-model="cityQuery" :label="terms.checkout.city" :placeholder="terms.checkout.cityPlaceholder" :animated-placeholders="popularCities"
                :options="(selectedCity ? [selectedCity] : cities.items.value).map(item => ({ value: item.ref, label: item.label }))" :loading="cities.loading.value"
                :error="runtimeMessage(cities.error.value)" :empty-text="cityQuery.trim().length < 2 ? deliveryText.short : deliveryText.empty"
                :loading-text="deliveryText.loading" :retry-text="deliveryText.retry" required @select="chooseCity" @retry="cities.retry" />
              <div class="checkout-popular" :aria-label="deliveryText.popular">
                <BaseButton v-for="city in popularCities" :key="city" size="xs" variant="text" @click="choosePopularCity(city)">{{ city }}</BaseButton>
              </div>
              <p v-if="popular.loading.value" role="status">{{ deliveryText.loading }}</p>
              <div v-if="popular.error.value" role="alert">{{ runtimeMessage(popular.error.value) }} <BaseButton variant="text" size="sm" @click="popular.retry">{{ deliveryText.retry }}</BaseButton></div>
              <Transition name="checkout-delivery" mode="out-in">
                <div :key="form.shippingMethod" class="checkout-delivery-fields">
              <BaseAutocomplete class="checkout-pickup-select" v-if="form.shippingMethod === 'warehouse'" v-model="branchQuery" :label="locale === 'uk' ? 'Відділення або поштомат' : 'Branch or parcel locker'"
                :placeholder="deliveryText.branch" :options="pickupPoints.map(item => ({ value: item.ref, label: item.label }))"
                :loading="branches.loading.value || parcelLockers.loading.value" :error="runtimeMessage(branches.error.value || parcelLockers.error.value)" :empty-text="deliveryText.empty"
                :loading-text="deliveryText.loading" :retry-text="deliveryText.retry" :disabled="!selectedCity" required
                @select="chooseBranch" @retry="retryPickupPoints">
                <template #option="{ option }">
                  <span class="checkout-pickup-option">
                    <img :src="shopAsset(`/lehko/icons/delivery/np-${pickupPoints.find(point => point.ref === option.value)?.type === 'postomat' ? 'postomat' : 'warehouse'}.svg`)" width="24" height="24" alt="" aria-hidden="true">
                    <span>{{ option.label }}</span>
                  </span>
                </template>
              </BaseAutocomplete>
              <template v-else>
                <p v-if="selectedCity && !selectedCity.delivery_available" role="status">{{ deliveryText.noCourier }}</p>
                <BaseCheckbox id="manual-delivery-street" v-model="manualStreet" :label="deliveryText.manualStreet" :disabled="!selectedCity?.delivery_available" />
                <div class="checkout-form__grid checkout-form__grid--three">
                  <BaseInput v-if="manualStreet" v-model="form.shippingStreet" rule="address" :label="terms.checkout.street" autocomplete="address-line1" :disabled="!selectedCity?.delivery_available" required />
                  <BaseAutocomplete v-else v-model="streetQuery" :label="terms.checkout.street" :placeholder="deliveryText.street"
                    :options="(selectedStreet ? [selectedStreet] : streets.items.value).map(item => ({ value: item.ref, label: item.label }))" :loading="streets.loading.value"
                    :error="runtimeMessage(streets.error.value)" :empty-text="streetQuery.trim().length < 2 ? deliveryText.short : deliveryText.empty"
                    :loading-text="deliveryText.loading" :retry-text="deliveryText.retry" :disabled="!selectedCity?.delivery_available"
                    required @select="chooseStreet" @retry="streets.retry" />
                  <BaseInput v-model="form.buildingNumber" rule="unit" :label="terms.checkout.building" autocomplete="address-line2" :disabled="!selectedStreet && !manualStreet" required />
                  <BaseInput v-model="form.shippingApartment" rule="unit" :label="terms.checkout.apartment" :disabled="!selectedStreet && !manualStreet" />
                </div>
              </template>
                </div>
              </Transition>
              <p v-if="cities.stale.value || branches.stale.value || streets.stale.value" role="status">{{ deliveryText.stale }}</p>
            </div>
          </section>

          <section class="checkout-card checkout-card--payment soft-surface">
            <div class="checkout-card__head">
              <span>3</span>
              <h2>{{ terms.common.payment }}</h2>
            </div>
            <p class="checkout-payment-introduction">{{ paymentChoiceText.introduction }}</p>
            <BaseField>
              <div class="checkout-payment-methods" role="radiogroup" :aria-label="terms.common.payment">
                <div
                  v-for="option in paymentOptions"
                  :key="option.value"
                  class="checkout-payment-method"
                  :class="{ 'checkout-payment-method--selected': form.paymentMethod === option.value }"
                >
                  <BaseRadio
                    :id="`payment-method-${option.value}`"
                    v-model="form.paymentMethod"
                    name="paymentMethod"
                    :label="option.label"
                    :value="option.value"
                    :disabled="option.value === 'onlineCard' && !onlinePaymentEnabled"
                    :description="option.value === 'onlineCard' && !onlinePaymentEnabled ? (onlinePaymentLoading ? paymentChoiceText.onlineLoading : paymentChoiceText.onlineUnavailable) : undefined"
                  />
                    <div v-if="option.value === 'onlineCard'" class="checkout-payment-method__cards" role="group" :aria-label="locale === 'uk' ? 'Онлайн-оплата: Visa, Mastercard, monobank' : 'Online payment: Visa, Mastercard, monobank'">
                      <img :src="shopAsset('/payment-brands/visa-blue.png')" alt="Visa" width="56" height="18">
                      <img :src="shopAsset('/payment-brands/mastercard.svg')" alt="Mastercard" width="50" height="32">
                      <img :src="shopAsset('/payment-brands/monobank.svg')" alt="monobank" width="108" height="24">
                    </div>
                  <div v-if="option.value === 'onlineCard' && form.paymentMethod === 'onlineCard'" class="checkout-payment-method__details">
                    <p>{{ paymentChoiceText.onlineDescription }}</p>

                  </div>
                </div>
              </div>
            </BaseField>
          </section>

          <section class="checkout-card">
            <div class="checkout-card__head">
              <span>4</span>
              <h2>{{ terms.checkout.notes }}</h2>
            </div>
            <div class="checkout-form__grid">
              <BaseTextarea v-model="form.comment" rule="note" :label="terms.checkout.deliveryNotes" :rows="3" />
            </div>
          </section>

          <aside class="checkout-card checkout-card--mobile checkout-card--mobile-summary">
            <h2>{{ terms.checkout.orderSummary }}</h2>
            <div v-if="cart.items.length" class="checkout-order-list">
              <template v-for="item in cart.items" :key="item.product.id">

                <article class="checkout-order-list__item">
                <img
                  :src="item.product.images[0]?.image || item.product.images[0]?.image_url || 'https://placehold.co/160x160?text=Product'"
                  :alt="item.product.images[0]?.alt || productDisplayName(item.product)"
                >
                <div class="checkout-order-list__body">
                  <p class="checkout-order-list__brand">{{ item.product.brand.name }}</p>
                  <div class="checkout-order-list__title-row">
                    <div class="checkout-order-list__title-copy">
                      <h3>{{ productDisplayName(item.product) }}</h3>
                      <p v-if="isProductUnavailable(item.product)" class="checkout-page__item-unavailable">
                        {{ terms.basket.unavailable }}
                      </p>
                      <strong class="checkout-order-list__price">
                        {{ formatPrice(Number(item.product.price) * item.quantity) }}
                      </strong>
                    </div>
                    <div class="checkout-order-list__actions">
                      <BaseQuantityStepper
                        class="checkout-order-list__stepper"
                        variant="stacked"
                        :model-value="item.quantity"
                        :min="0"
                        :max="cart.maxQuantity(item.product, item.quantity)"
                        :disabled="cart.syncing"
                        :disable-increase="isProductUnavailable(item.product)"
                        :aria-label="terms.checkout.quantityFor(productDisplayName(item.product))"
                        @update:model-value="cart.update(item.product.id, $event)"
                      />
                    </div>
                  </div>
                </div>
                </article>
              </template>
            </div>
            <p v-else class="checkout-page__muted">{{ terms.checkout.cartEmpty }}</p>
            <CheckoutPromoCode v-model="promo.input.value" :code="promo.code.value" :applied="Boolean(promo.quote.value)" :pending="promo.pending.value" :error="promo.error.value" :disabled="state.loading || retryAvailable || cart.syncing" @apply="promo.apply" @remove="promo.remove" />
            <div v-if="hasPromoDiscount" class="checkout-discount-row">
              <span>{{ locale === 'uk' ? 'Знижка' : 'Discount' }} · {{ promo.quote.value?.applied_code }}</span>
              <span>−{{ formatPrice(promo.quote.value?.discount_amount) }}</span>
            </div>
            <div class="checkout-total">
              <span>{{ terms.common.total }}</span>
              <div class="checkout-total__prices">
              <del v-if="hasPromoDiscount" class="checkout-total__previous">{{ formatPrice(promo.quote.value?.subtotal_amount) }}</del>
              <strong :class="{ 'checkout-total__sale': hasPromoDiscount }" :aria-label="formattedTotal" role="status">
            <span class="checkout-total-counter" aria-hidden="true">
              <span
                v-for="part in totalCharacters"
                :key="part.place"
                :class="['checkout-total-counter__character', { 'checkout-total-counter__character--digit': part.isDigit }]"
              >
                <Transition :name="`checkout-digit-${totalDirection}`">
                  <span :key="part.character" class="checkout-total-counter__value">{{ part.character }}</span>
                </Transition>
              </span>
            </span>
          </strong>
              </div>
            </div>
          </aside>

          <section class="checkout-card checkout-card--finish checkout-card--mobile">
            <BaseCheckbox class="checkout-callback" id="checkout-callback-requested-mobile" v-model="form.callbackRequested"
              :label="locale === 'uk' ? 'Передзвоніть мені' : 'Call me'"
              />
            <BaseButton type="submit" block :disabled="state.loading || retryAvailable || !canSubmit">
              {{ state.loading ? terms.checkout.processing : form.paymentMethod === 'onlineCard' ? (locale === 'uk' ? 'Перейти до оплати' : 'Proceed to payment') : terms.checkout.placeOrder }}
            </BaseButton>
            <BaseButton class="checkout-payment-terms" type="button" variant="text" size="xs" @click="paymentTermsOpen = true">
              <BaseHoverUnderlineText>{{ terms.checkout.paymentTerms }}</BaseHoverUnderlineText>
            </BaseButton>
            <PaymentStatusIllustration v-if="state.error || cart.error" tone="error" />
            <p v-if="state.error || cart.error" class="checkout-page__error" role="alert">{{ runtimeMessage(state.error || cart.error) }}</p>
          </section>
        </form>
      </div>

      <aside class="checkout-page__basket">
        <div class="checkout-page__basket-inner">
          <section class="checkout-card">
            <h2>{{ terms.checkout.orderSummary }}</h2>
            <div v-if="cart.items.length" class="checkout-order-list">
              <template v-for="item in cart.items" :key="item.product.id">

                <article class="checkout-order-list__item">
                <img
                  :src="item.product.images[0]?.image || item.product.images[0]?.image_url || 'https://placehold.co/160x160?text=Product'"
                  :alt="item.product.images[0]?.alt || productDisplayName(item.product)"
                >
                <div class="checkout-order-list__body">
                  <p class="checkout-order-list__brand">{{ item.product.brand.name }}</p>
                  <div class="checkout-order-list__title-row">
                    <div class="checkout-order-list__title-copy">
                      <h3>{{ productDisplayName(item.product) }}</h3>
                      <p v-if="isProductUnavailable(item.product)" class="checkout-page__item-unavailable">
                        {{ terms.basket.unavailable }}
                      </p>
                      <strong class="checkout-order-list__price">
                        {{ formatPrice(Number(item.product.price) * item.quantity) }}
                      </strong>
                    </div>
                    <div class="checkout-order-list__actions">
                      <BaseQuantityStepper
                        class="checkout-order-list__stepper"
                        variant="stacked"
                        :model-value="item.quantity"
                        :min="0"
                        :max="cart.maxQuantity(item.product, item.quantity)"
                        :disabled="cart.syncing"
                        :disable-increase="isProductUnavailable(item.product)"
                        :aria-label="terms.checkout.quantityFor(productDisplayName(item.product))"
                        @update:model-value="cart.update(item.product.id, $event)"
                      />
                    </div>
                  </div>
                </div>
                </article>
              </template>
            </div>
            <p v-else class="checkout-page__muted">{{ terms.checkout.cartEmpty }}</p>
            <p v-if="cart.error" class="checkout-page__error">{{ runtimeMessage(cart.error) }}</p>
          </section>

          <section class="checkout-card checkout-card--finish">
            <CheckoutPromoCode v-model="promo.input.value" :code="promo.code.value" :applied="Boolean(promo.quote.value)" :pending="promo.pending.value" :error="promo.error.value" :disabled="state.loading || retryAvailable || cart.syncing" @apply="promo.apply" @remove="promo.remove" />
            <div v-if="hasPromoDiscount" class="checkout-discount-row">
              <span>{{ locale === 'uk' ? 'Знижка' : 'Discount' }} · {{ promo.quote.value?.applied_code }}</span>
              <span>−{{ formatPrice(promo.quote.value?.discount_amount) }}</span>
            </div>
            <div class="checkout-total">
              <span>{{ terms.common.total }}</span>
              <div class="checkout-total__prices">
              <del v-if="hasPromoDiscount" class="checkout-total__previous">{{ formatPrice(promo.quote.value?.subtotal_amount) }}</del>
              <strong :class="{ 'checkout-total__sale': hasPromoDiscount }" :aria-label="formattedTotal" role="status">
            <span class="checkout-total-counter" aria-hidden="true">
              <span
                v-for="part in totalCharacters"
                :key="part.place"
                :class="['checkout-total-counter__character', { 'checkout-total-counter__character--digit': part.isDigit }]"
              >
                <Transition :name="`checkout-digit-${totalDirection}`">
                  <span :key="part.character" class="checkout-total-counter__value">{{ part.character }}</span>
                </Transition>
              </span>
            </span>
          </strong>
              </div>
            </div>
            <BaseCheckbox class="checkout-callback" id="checkout-callback-requested" v-model="form.callbackRequested"
              :label="locale === 'uk' ? 'Передзвоніть мені' : 'Call me'"
              />
            <BaseButton type="submit" form="shop-checkout-form" block :disabled="state.loading || retryAvailable || !canSubmit">
              {{ state.loading ? terms.checkout.processing : form.paymentMethod === 'onlineCard' ? (locale === 'uk' ? 'Перейти до оплати' : 'Proceed to payment') : terms.checkout.placeOrder }}
            </BaseButton>
            <BaseButton class="checkout-payment-terms" type="button" variant="text" size="xs" @click="paymentTermsOpen = true">
              <BaseHoverUnderlineText>{{ terms.checkout.paymentTerms }}</BaseHoverUnderlineText>
            </BaseButton>
            <PaymentStatusIllustration v-if="state.error || cart.error" tone="error" />
            <p v-if="state.error || cart.error" class="checkout-page__error" role="alert">{{ runtimeMessage(state.error || cart.error) }}</p>
          </section>
        </div>
      </aside>
    </div>
  </section>

  <BaseModal v-model="paymentTermsOpen" type="bottom" full-height>
    <template #header-title>{{ terms.checkout.paymentTerms }}</template>
    <CheckoutPaymentTerms />
  </BaseModal>
</template>

<style scoped>
.checkout-discount-row { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.85rem; }
.checkout-total__prices { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: baseline; gap: 0.75rem; }
.checkout-total__previous { color: #a3a3a3; font-size: 0.85rem; font-weight: 400; }
.checkout-total__sale { color: #c2410c; }

.checkout-callback { padding: 0.4rem 0; align-items: center; gap: 0.75rem; }

.checkout-delivery-fields { display: grid; gap: 1rem; min-width: 0; }
.checkout-delivery-enter-active,
.checkout-delivery-leave-active {
  transition: opacity 180ms ease, transform 220ms ease;
}
.checkout-delivery-enter-from { opacity: 0; transform: translateY(0.5rem); }
.checkout-delivery-leave-to { opacity: 0; transform: translateY(-0.5rem); }
@media (prefers-reduced-motion: reduce) {
  .checkout-delivery-enter-active,
  .checkout-delivery-leave-active { transition: none; }
}

.checkout-total-counter {
  display: inline-flex;
  font-variant-numeric: tabular-nums;
  white-space: pre;
}

.checkout-total-counter__character {
  position: relative;
  display: inline-grid;
  overflow: hidden;
  line-height: 1.3;
}

.checkout-total-counter__character--digit {
  width: 1ch;
  text-align: center;
}

.checkout-total-counter__value {
  grid-area: 1 / 1;
  display: block;
}

.checkout-digit-up-enter-active,
.checkout-digit-up-leave-active,
.checkout-digit-down-enter-active,
.checkout-digit-down-leave-active {
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 420ms ease;
}

.checkout-digit-up-enter-from,
.checkout-digit-down-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.checkout-digit-up-leave-to,
.checkout-digit-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .checkout-total-counter__value {
    transition: none;
  }
}


.checkout-pickup-option { display: flex; align-items: center; gap: 0.75rem; }
.checkout-pickup-option img { flex: 0 0 20.4px; width: 20.4px; height: 20.4px; }
.checkout-pickup-select :deep(.base-autocomplete__popup) { margin-top: 0.5rem; }

.checkout-page__body {
  display: grid;
  gap: 1rem;
}

.checkout-confirmation {
  display: grid;
  min-height: 50vh;
  place-items: center;
  padding: clamp(2rem, 8vw, 6rem) 1rem;
}

.checkout-confirmation__card {
  display: grid;
  width: min(36rem, 100%);
  gap: 1.25rem;
}

.checkout-confirmation__card h1 {
  font-size: clamp(1.75rem, 5vw, 2.75rem);
  font-weight: 800;
}

.checkout-confirmation__number {
  color: #525252;
  font-size: 1.125rem;
  font-weight: 700;
}



.checkout-page__user-info,
.checkout-form,
.checkout-page__basket-inner {
  display: grid;
  gap: 1rem;
}

.checkout-card {
  display: grid;
  gap: 1rem;

  padding: 1rem;
}

.checkout-card:not(.soft-surface) { background: #ffffff; }

.checkout-card__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.checkout-card__head span {
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 800;
}

.checkout-card h2 {
  font-size: 1.05rem;
  font-weight: 800;
}

.checkout-form__grid {
  display: grid;
  gap: 1rem;
}

.checkout-contact__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.checkout-contact__head h2 {
  font-size: 1rem;
  font-weight: 800;
}

.checkout-popular { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .3rem; font-size: .8rem; }

.checkout-choice-list {
  display: grid;
  gap: 0.5rem;
}

.checkout-payment-introduction {
  margin: -0.25rem 0 0;
  color: #737373;
  font-size: 0.875rem;
  line-height: 1.5;
}

.checkout-payment-methods {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  align-items: start;
  gap: 0.5rem;
}

.checkout-payment-method {
  min-width: 0;
  background: transparent;
}

.checkout-payment-method--selected :deep(.base-choice__label) {
  font-weight: 800;
}

.checkout-payment-method:has(input:focus-visible) {
  outline: 2px solid #0a0a0a;
  outline-offset: 3px;
}

.checkout-payment-method :deep(.base-choice) {
  width: 100%;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.checkout-payment-method__details {
  display: grid;
  gap: 0.875rem;
  padding: 0 1rem 1rem 3.25rem;
  color: #525252;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.checkout-payment-method__cards {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 1rem;
  width: fit-content;
  margin: 0 0 0 12px;
  max-width: calc(100% - 12px);
}

.checkout-payment-method__cards img {
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  width: auto;
  height: 18px;
  object-fit: contain;
  max-width: 100%;
}

.checkout-card--payment { padding: 1.25rem; }

.checkout-page :deep(.base-control) {
  border-width: 0;
}

.checkout-page :deep(.base-control:focus),
.checkout-page :deep(.base-control:focus-visible) {
  outline: none;
}

.checkout-page :deep(.base-choice) {
  border-width: 0;
}

.checkout-card--finish {
  align-content: start;
  gap: 0.5rem;
}

.checkout-payment-terms {
  justify-self: center;
  color: #737373;
  font-size: 0.75rem;
  line-height: 1.45;
  text-align: center;
}

.checkout-card--mobile-summary {
  padding-bottom: 0;
}

.checkout-card--finish.checkout-card--mobile {
  padding-top: 0;
}

.checkout-card--mobile {
  display: grid;
}

.checkout-page__basket {
  display: none;
}

.checkout-order-list {
  display: grid;
  max-height: calc(100vh - 20rem);
  overflow: auto;
}

.checkout-order-list__item {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
  background: #ffffff;
  font-size: 0.8rem;
  padding: 0.65rem;
}

.checkout-order-list__item img {
  aspect-ratio: 1;
  width: 100%;
  object-fit: cover;
}

.checkout-order-list__body,
.checkout-order-list__title-copy {
  min-width: 0;
}

.checkout-order-list__brand {
  margin-bottom: 0.25rem;
  color: rgb(82 82 82);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.checkout-order-list__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.checkout-order-list__title-copy {
  flex: 1;
}

.checkout-order-list__item h3 {
  display: -webkit-box;
  overflow: hidden;
  font-size: inherit;
  font-weight: 600;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.checkout-order-list__price {
  display: block;
  margin-top: 0.3rem;
  font-size: inherit;
  font-weight: 600;
}

.checkout-order-list__actions {
  display: grid;
  flex: 0 0 auto;
  justify-items: center;
}

.checkout-total {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.checkout-page__muted {
  color: #737373;
}

.checkout-page__success {
  color: #047857;
  font-weight: 700;
}

.checkout-page__error {
  color: #be123c;
  font-weight: 700;
}

.checkout-page__unavailable {
  margin: 0;
}

.checkout-page__item-unavailable {
  margin-top: 0.2rem;
  color: #a16207;
  font-size: 0.75rem;
  font-weight: 700;
}

@media (min-width: 768px) {
  .checkout-form__grid--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .checkout-form__grid--three {
    grid-template-columns: 1fr 0.5fr 0.5fr;
  }
}

@media (max-width: 1023px) {
  .checkout-order-list__title-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .checkout-order-list__title-copy {
    display: contents;
  }

  .checkout-order-list__title-copy h3,
  .checkout-order-list__title-copy .checkout-page__item-unavailable {
    grid-column: 1 / -1;
  }

  .checkout-order-list__price {
    margin-top: 0;

  font-weight: 600;
}
}

@media (min-width: 1024px) {
  .checkout-choice-list {
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
  }

  .checkout-page__body {
    grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.7fr);
    align-items: start;
  }

  .checkout-page__basket {
    display: block;
    position: sticky;
    top: calc(var(--shop-header-offset, 4.75rem) + 1rem);
  }

  .checkout-card--mobile {
    display: none;
  }
}
</style>
