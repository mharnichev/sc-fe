<script setup lang="ts">
import { guestShipmentPath } from '~/utils/shipmentStatus'
import type { CheckoutOrder, CheckoutOrderRequest } from '~/types/order'
import type { NpSettlement, NpBranch, NpStreet } from '~/types/nova-poshta'
import { isProductUnavailable } from '~/utils/product-visibility'
const { runtimeText, runtimeMessage, orderItemName } = useShopRuntimeDisplay()

const { productDisplayName } = useProductDisplay()

const cart = useCartStore()
const domain = useCatalogDomain()
const auth = useCustomerAuthStore()
const { terms, locale } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
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
  branch: 'Номер відділення або адреса', street: 'Почніть вводити назву вулиці',
  manualStreet: 'Вулиці немає у списку — ввести вручну',
  popular: 'Популярні міста', noCourier: 'Кур’єрська доставка недоступна для цього населеного пункту.',
  stale: 'Використовуємо останню збережену версію довідника.', choose: 'Оберіть варіант із підказок.',
} : {
  empty: 'No results. Try another name.', short: 'Enter at least 2 characters.', loading: 'Searching…',
  failed: 'Could not load the directory.', retry: 'Try again', branch: 'Branch number or address',
  manualStreet: 'Street is missing — enter manually',
  street: 'Start typing the street name', popular: 'Popular cities', noCourier: 'Courier delivery is unavailable for this settlement.',
  stale: 'Showing the last saved directory.', choose: 'Choose a suggestion.',
})
const popularCities = ['Київ', 'Львів', 'Одеса', 'Дніпро', 'Харків', 'Запоріжжя', 'Вінниця', 'Івано-Франківськ']
const cities = useNovaPoshtaSearch<NpSettlement>('settlements', () => selectedCity.value || cityQuery.value.trim().length < 2 ? null : { q: cityQuery.value.trim(), limit: '20' }, () => deliveryText.value.failed)
const branches = useNovaPoshtaSearch<NpBranch>('branches', () => !selectedCity.value || form.shippingMethod !== 'warehouse' || selectedBranch.value ? null : { settlement_ref: selectedCity.value.ref, q: branchQuery.value.trim(), limit: '30' }, () => deliveryText.value.failed)
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
  const branch = selectedBranch.value?.ref === ref ? selectedBranch.value : branches.items.value.find(branch => branch.ref === ref)
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
  { label: terms.value.checkout.deliveryOptions.warehouse, value: 'warehouse' },
  { label: terms.value.checkout.deliveryOptions.courier, value: 'courier' },
])
const onlinePaymentEnabled = ref(false)
onMounted(async () => {
  try {
    const result = await useApi()<{ enabled: boolean }>('/public/orders/online-payment-capabilities', { retry: 0 })
    onlinePaymentEnabled.value = result.enabled === true
  } catch { onlinePaymentEnabled.value = false }
})
const paymentOptions = computed(() => [
  { label: terms.value.checkout.paymentOptions.cashOnDelivery, value: 'cashOnDelivery' },
  { label: terms.value.checkout.paymentOptions.cardOnDelivery, value: 'cardOnDelivery' },
  ...(onlinePaymentEnabled.value ? [{ label: 'Онлайн карткою', value: 'onlineCard' }] : []),
])
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
    && !cart.hasUnavailableItems
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
interface PendingCheckout { key: string, body: CheckoutOrderRequest, scope: string }
const pendingIntent = ref<PendingCheckout | null>(null)
const intentStorageKey = 'shop-checkout-intent-v1'
const customerScope = computed(() => auth.isAuthenticated ? `customer:${auth.customer?.id}` : 'guest')
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
onNuxtReady(() => { sessionReady.value = true; restoreIntent() })
watch([customerScope, () => auth.sessionRevision], ([_scope], [previousScope]) => {
  state.order = null
  state.error = ''
  if (previousScope !== 'guest') {
    // Contact and delivery belong to the previous buyer, even after confirmation.
    Object.assign(form, { firstName: '', lastName: '', email: '', phoneNumber: '', comment: '', shippingCity: '', shippingArea: '' })
    selectedCity.value = null
    cityQuery.value = ''
    resetAddress()
    const customer = auth.customer
    if (customer) Object.assign(form, { firstName: customer.name || '', lastName: customer.surname || '', email: customer.email || '', phoneNumber: customer.phone || '' })
  }
  restoreIntent()
})

const sendIntent = async (intent: PendingCheckout) => {
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
  try {
    const result = await domain.createOrder(intent.body, intent.key)
    if (!ownsIntent()) return
    state.order = result
    pendingIntent.value = null
    sessionStorage.removeItem(intentStorageKey)
    if (auth.isAuthenticated) await cart.syncFromServer()
    else if (cartMayClear.value) cart.clear()
    else cartPreserved.value = cart.items.length > 0
  }
  catch (error: unknown) {
    if (!ownsIntent()) return
    cartMayClear.value = false
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0
    // Validation rejection is conclusive. Auth expiry/network/5xx/409 retain the intent.
    const detail = typeof error === 'object' && error && 'data' in error
      ? (error.data as { detail?: unknown })?.detail : undefined
    const stockRejected = status === 409 && typeof detail === 'string'
      && /^Insufficient stock for product \d+; backorders are disabled$/.test(detail)
    if ([400, 422].includes(status) || stockRejected) {
      pendingIntent.value = null
      sessionStorage.removeItem(intentStorageKey)
    }
    state.error = terms.value.checkout.failed
  }
  finally { state.loading = false }
}
const retryIntent = () => { if (pendingIntent.value) void sendIntent(pendingIntent.value) }
const submit = async () => {
  if (state.loading) return
  if (retryAvailable.value) { retryIntent(); return }
  if (unavailableItems.value.length) { state.error = unavailableMessage.value; return }
  if (!canSubmit.value) return
  const body: CheckoutOrderRequest = {
    ...form,
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
  const intent = { key: crypto.randomUUID(), body, scope: customerScope.value }
  // Persist before the HTTP request; never send if durable retry storage is unavailable.
  try { sessionStorage.setItem(intentStorageKey, JSON.stringify(intent)) }
  catch { state.error = 'Дозвольте збереження сесії браузера для безпечного оформлення замовлення.'; return }
  pendingIntent.value = intent
  cartMayClear.value = true
  await sendIntent(intent)
}

useSeo(
  () => terms.value.seo.checkoutTitle,
  () => terms.value.seo.checkoutDescription,
)
</script>

<template>
  <section v-if="state.order" class="checkout-page checkout-confirmation" data-testid="order-confirmation">
    <div class="checkout-card checkout-confirmation__card">
      <p class="checkout-page__success" role="status">{{ terms.checkout.orderSuccess }}</p>
      <h1 ref="confirmationHeading" tabindex="-1" data-testid="order-number">№ {{ state.order.id }}</h1>
      <div class="checkout-order-list" data-testid="confirmed-order-items">
        <article v-for="item in state.order.items" :key="item.id" class="checkout-confirmation__item">
          <span>{{ orderItemName(item) }}</span>
          <span>× {{ item.quantity }}</span>
        </article>
      </div>
      <div class="checkout-total">
        <span>{{ terms.common.total }}</span>
        <strong data-testid="confirmed-order-total">{{ formatPrice(state.order.total_amount) }}</strong>
      </div>
      <p v-if="cartPreserved" role="status">{{ runtimeText.cartPreserved }}</p>
      <OrderProjections :order="state.order" />
      <BaseButton v-if="state.order.payment_method === 'onlineCard'" :to="`/payment/${state.order.id}`" variant="outline-dark">Сторінка статусу оплати</BaseButton>
      <OrderPayment v-if="state.order.payment_method === 'onlineCard'" :order-id="state.order.id" :guest-token="state.order.guest_payment_token || undefined" />
      <OrderDocuments :order-id="state.order.id" :documents="state.order.preliminary_documents" :guest="!auth.isAuthenticated" />
      <BaseButton v-if="!auth.isAuthenticated && guestShipmentPath(state.order.guest_tracking_url)" :to="guestShipmentPath(state.order.guest_tracking_url)!">{{ runtimeText.trackingTitle }}</BaseButton>
      <BaseButton to="/catalog" variant="outline-dark">{{ terms.common.catalog }}</BaseButton>
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
        <aside class="checkout-card checkout-card--mobile">
          <h2>{{ terms.checkout.orderSummary }}</h2>
          <div v-if="cart.items.length" class="checkout-order-list">
            <template v-for="(item, index) in cart.items" :key="item.product.id">
              <div v-if="index > 0" class="checkout-order-list__divider" aria-hidden="true">
                <span class="checkout-order-list__divider-line" />
              </div>
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
          <div class="checkout-total">
            <span>{{ terms.common.total }}</span>
            <strong>{{ formatPrice(cart.total) }}</strong>
          </div>
        </aside>

        <form id="shop-checkout-form" class="checkout-form" @submit.prevent="submit">
          <p v-if="unavailableItems.length" class="checkout-page__error checkout-page__unavailable" role="alert">
            {{ unavailableMessage }}
          </p>
          <section class="checkout-card">
            <div class="checkout-card__head">
              <span>1</span>
              <h2>{{ terms.checkout.contact }}</h2>
            </div>
            <div class="checkout-form__grid checkout-form__grid--two">
              <BaseInput v-model="form.firstName" :label="terms.checkout.firstName" required autocomplete="given-name" />
              <BaseInput v-model="form.lastName" :label="terms.checkout.lastName" required autocomplete="family-name" />
              <BaseInput v-model="form.email" type="email" :label="terms.checkout.email" autocomplete="email" />
              <BasePhoneInput v-model="form.phoneNumber" :label="terms.checkout.phone" required />
            </div>
            <CustomerAuthDialog v-if="!auth.isAuthenticated" />
          </section>

          <section class="checkout-card">
            <div class="checkout-card__head">
              <span>2</span>
              <h2>{{ terms.checkout.delivery }}</h2>
            </div>
            <div class="checkout-form__grid">
              <BaseField :label="terms.checkout.method">
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
              <BaseAutocomplete v-model="cityQuery" :label="terms.checkout.city" :placeholder="terms.checkout.cityPlaceholder"
                :options="(selectedCity ? [selectedCity] : cities.items.value).map(item => ({ value: item.ref, label: item.label }))" :loading="cities.loading.value"
                :error="runtimeMessage(cities.error.value)" :empty-text="cityQuery.trim().length < 2 ? deliveryText.short : deliveryText.empty"
                :loading-text="deliveryText.loading" :retry-text="deliveryText.retry" required @select="chooseCity" @retry="cities.retry" />
              <div class="checkout-popular" :aria-label="deliveryText.popular">
                <span>{{ deliveryText.popular }}:</span>
                <BaseButton v-for="city in popularCities" :key="city" size="xs" variant="text" @click="choosePopularCity(city)">{{ city }}</BaseButton>
              </div>
              <p v-if="popular.loading.value" role="status">{{ deliveryText.loading }}</p>
              <div v-if="popular.error.value" role="alert">{{ runtimeMessage(popular.error.value) }} <BaseButton variant="text" size="sm" @click="popular.retry">{{ deliveryText.retry }}</BaseButton></div>
              <BaseAutocomplete v-if="form.shippingMethod === 'warehouse'" v-model="branchQuery" :label="terms.checkout.warehouse"
                :placeholder="deliveryText.branch" :options="(selectedBranch ? [selectedBranch] : branches.items.value).map(item => ({ value: item.ref, label: item.label }))"
                :loading="branches.loading.value" :error="runtimeMessage(branches.error.value)" :empty-text="deliveryText.empty"
                :loading-text="deliveryText.loading" :retry-text="deliveryText.retry" :disabled="!selectedCity" required
                @select="chooseBranch" @retry="branches.retry" />
              <template v-else>
                <p v-if="selectedCity && !selectedCity.delivery_available" role="status">{{ deliveryText.noCourier }}</p>
                <BaseCheckbox id="manual-delivery-street" v-model="manualStreet" :label="deliveryText.manualStreet" :disabled="!selectedCity?.delivery_available" />
                <div class="checkout-form__grid checkout-form__grid--three">
                  <BaseInput v-if="manualStreet" v-model="form.shippingStreet" :label="terms.checkout.street" autocomplete="address-line1" :disabled="!selectedCity?.delivery_available" required />
                  <BaseAutocomplete v-else v-model="streetQuery" :label="terms.checkout.street" :placeholder="deliveryText.street"
                    :options="(selectedStreet ? [selectedStreet] : streets.items.value).map(item => ({ value: item.ref, label: item.label }))" :loading="streets.loading.value"
                    :error="runtimeMessage(streets.error.value)" :empty-text="streetQuery.trim().length < 2 ? deliveryText.short : deliveryText.empty"
                    :loading-text="deliveryText.loading" :retry-text="deliveryText.retry" :disabled="!selectedCity?.delivery_available"
                    required @select="chooseStreet" @retry="streets.retry" />
                  <BaseInput v-model="form.buildingNumber" :label="terms.checkout.building" autocomplete="address-line2" :disabled="!selectedStreet && !manualStreet" required />
                  <BaseInput v-model="form.shippingApartment" :label="terms.checkout.apartment" :disabled="!selectedStreet && !manualStreet" />
                </div>
              </template>
              <p v-if="cities.stale.value || branches.stale.value || streets.stale.value" role="status">{{ deliveryText.stale }}</p>
            </div>
          </section>

          <section class="checkout-card">
            <div class="checkout-card__head">
              <span>3</span>
              <h2>{{ terms.common.payment }}</h2>
            </div>
            <BaseField :label="terms.common.payment">
              <div class="checkout-choice-list">
                <BaseRadio
                  v-for="option in paymentOptions"
                  :id="`payment-method-${option.value}`"
                  :key="option.value"
                  v-model="form.paymentMethod"
                  name="paymentMethod"
                  :label="option.label"
                  :value="option.value"
                />
              </div>
            </BaseField>
          </section>

          <section class="checkout-card">
            <div class="checkout-card__head">
              <span>4</span>
              <h2>{{ terms.checkout.notes }}</h2>
            </div>
            <div class="checkout-form__grid">
              <BaseTextarea v-model="form.comment" :label="terms.checkout.deliveryNotes" :rows="3" />
            </div>
          </section>

          <section class="checkout-card checkout-card--finish checkout-card--mobile">
            <BaseButton type="submit" block :disabled="state.loading || retryAvailable || !canSubmit">
              {{ state.loading ? terms.checkout.processing : terms.checkout.placeOrder }}
            </BaseButton>
            <p v-if="state.error || cart.error" class="checkout-page__error" role="alert">{{ runtimeMessage(state.error || cart.error) }}</p>
          </section>
        </form>
      </div>

      <aside class="checkout-page__basket">
        <div class="checkout-page__basket-inner">
          <section class="checkout-card">
            <h2>{{ terms.checkout.orderSummary }}</h2>
            <div v-if="cart.items.length" class="checkout-order-list">
              <template v-for="(item, index) in cart.items" :key="item.product.id">
                <div v-if="index > 0" class="checkout-order-list__divider" aria-hidden="true">
                  <span class="checkout-order-list__divider-line" />
                </div>
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
            <div class="checkout-total">
              <span>{{ terms.common.total }}</span>
              <strong>{{ formatPrice(cart.total) }}</strong>
            </div>
            <BaseButton type="submit" form="shop-checkout-form" block :disabled="state.loading || retryAvailable || !canSubmit">
              {{ state.loading ? terms.checkout.processing : terms.checkout.placeOrder }}
            </BaseButton>
            <p v-if="state.error || cart.error" class="checkout-page__error" role="alert">{{ runtimeMessage(state.error || cart.error) }}</p>
          </section>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
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
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 800;
}

.checkout-confirmation__item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
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
  background: #ffffff;
  padding: 1rem;
}

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

.checkout-popular { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; font-size: .8rem; }

.checkout-choice-list {
  display: grid;
  gap: 0.5rem;
}

.checkout-page :deep(.base-control) {
  border-width: 0;
}

.checkout-page :deep(.base-control:focus),
.checkout-page :deep(.base-control:focus-visible) {
  border-color: transparent;
  box-shadow: none;
  outline: none;
}

.checkout-page :deep(.base-choice) {
  border-width: 0;
}

.checkout-card--finish {
  align-content: start;
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

.checkout-order-list__divider {
  padding: 0.75rem 0.65rem;
}

.checkout-order-list__divider-line {
  display: block;
  height: 1px;
  background: rgb(10 10 10 / 0.08);
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
  font-weight: 800;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.checkout-order-list__price {
  display: block;
  margin-top: 0.3rem;
  font-size: inherit;
  font-weight: 800;
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
  font-weight: 800;
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
