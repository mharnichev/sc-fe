<script setup lang="ts">
const cart = useCartStore()
const domain = useCatalogDomain()
const auth = useCustomerAuthStore()
const { terms } = useShopLocale()
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
const delivery = reactive({
  cityQuery: '',
  selectedCityRef: '',
  selectedWarehouse: '',
  loadingCities: false,
  loadingWarehouses: false,
})
const cities = ref<Array<Record<string, unknown>>>([])
const warehouses = ref<Array<Record<string, unknown>>>([])
const state = reactive({ loading: false, done: false, error: '' })
let cityTimer: ReturnType<typeof setTimeout> | undefined

const deliveryMethodOptions = computed(() => [
  { label: terms.value.checkout.deliveryOptions.warehouse, value: 'warehouse' },
  { label: terms.value.checkout.deliveryOptions.courier, value: 'courier' },
])
const paymentOptions = computed(() => [
  { label: terms.value.checkout.paymentOptions.cashOnDelivery, value: 'cashOnDelivery' },
  { label: terms.value.checkout.paymentOptions.cardOnDelivery, value: 'cardOnDelivery' },
])
const isDeliveryValid = computed(() => {
  if (!delivery.selectedCityRef) return false

  if (form.shippingMethod === 'warehouse') {
    return Boolean(delivery.selectedWarehouse)
  }

  return Boolean(form.shippingStreet.trim() && form.buildingNumber.trim())
})
const canSubmit = computed(() =>
  Boolean(
    cart.items.length
    && form.firstName.trim()
    && form.lastName.trim()
    && form.phoneNumber.trim()
    && isDeliveryValid.value,
  ),
)

const readDeliveryField = (item: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' || typeof value === 'number') return String(value)
  }
  return ''
}

const cityOptions = computed(() =>
  cities.value.map(city => {
    const ref = readDeliveryField(city, ['Ref', 'ref'])
    const label = readDeliveryField(city, ['Present', 'Description', 'MainDescription', 'description'])
    const area = readDeliveryField(city, ['AreaDescription', 'Area', 'Region'])
    return { label: area ? `${label}, ${area}` : label, value: ref }
  }).filter(option => option.value && option.label),
)
const warehouseOptions = computed(() =>
  warehouses.value.map(warehouse => {
    const number = readDeliveryField(warehouse, ['Number', 'WarehouseNumber', 'number'])
    const label = readDeliveryField(warehouse, ['Description', 'ShortAddress', 'description'])
    return { label: number ? `${number} - ${label}` : label, value: number || label }
  }).filter(option => option.value && option.label),
)

watch(() => auth.customer, customer => {
  if (!customer) return
  form.firstName ||= customer.name || ''
  form.lastName ||= customer.surname || ''
  form.email ||= customer.email || ''
  form.phoneNumber ||= customer.phone || ''
}, { immediate: true })

watch(() => delivery.cityQuery, value => {
  if (cityTimer) clearTimeout(cityTimer)
  const query = value.trim()
  form.shippingCity = query

  if (delivery.selectedCityRef) {
    const selectedCity = cities.value.find(item => readDeliveryField(item, ['Ref', 'ref']) === delivery.selectedCityRef)
    const selectedCityNames = selectedCity
      ? [
          readDeliveryField(selectedCity, ['Description', 'description']),
          readDeliveryField(selectedCity, ['Present']),
          readDeliveryField(selectedCity, ['MainDescription']),
        ].filter(Boolean)
      : []

    if (!selectedCityNames.includes(query)) {
      delivery.selectedCityRef = ''
    }
  }

  if (query.length < 2) {
    cities.value = []
    return
  }

  cityTimer = setTimeout(async () => {
    delivery.loadingCities = true
    try {
      const response = await domain.searchNovaPoshtaCities(query)
      cities.value = response.items
    }
    finally {
      delivery.loadingCities = false
    }
  }, 300)
})

watch(() => delivery.selectedCityRef, async cityRef => {
  const city = cities.value.find(item => readDeliveryField(item, ['Ref', 'ref']) === cityRef)
  if (city) {
    form.shippingCity = readDeliveryField(city, ['Description', 'Present', 'MainDescription', 'description']) || delivery.cityQuery
    form.shippingArea = readDeliveryField(city, ['AreaDescription', 'Area', 'Region'])
    delivery.cityQuery = form.shippingCity
  }

  delivery.selectedWarehouse = ''
  form.shippingWarehouseNumber = ''
  warehouses.value = []
  if (!cityRef) return

  delivery.loadingWarehouses = true
  try {
    const response = await domain.getNovaPoshtaWarehouses(cityRef)
    warehouses.value = response.items
  }
  finally {
    delivery.loadingWarehouses = false
  }
})

watch(() => delivery.selectedWarehouse, value => {
  const warehouse = warehouses.value.find(item => {
    const number = readDeliveryField(item, ['Number', 'WarehouseNumber', 'number'])
    const label = readDeliveryField(item, ['Description', 'ShortAddress', 'description'])
    return value === (number || label)
  })
  form.shippingWarehouseNumber = warehouse
    ? readDeliveryField(warehouse, ['Number', 'WarehouseNumber', 'Description', 'ShortAddress', 'description'])
    : value
})

const submit = async () => {
  if (!canSubmit.value) return
  state.loading = true
  state.error = ''
  state.done = false
  try {
    await domain.createOrder({
      ...form,
      shippingCity: form.shippingCity || delivery.cityQuery,
      items: cart.items.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
    })
    state.done = true
    cart.clear()
  }
  catch (error) {
    state.error = terms.value.checkout.failed
    console.error(error)
  }
  finally {
    state.loading = false
  }
}

useSeo(
  () => terms.value.seo.checkoutTitle,
  () => terms.value.seo.checkoutDescription,
)
</script>

<template>
  <section class="checkout-page">
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
                :alt="item.product.images[0]?.alt || item.product.name"
              >
              <div class="checkout-order-list__body">
                <p class="checkout-order-list__brand">{{ item.product.brand.name }}</p>
                <div class="checkout-order-list__title-row">
                  <div class="checkout-order-list__title-copy">
                    <h3>{{ item.product.name }}</h3>
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
                      :max="Math.max(1, item.product.stock)"
                      :disabled="cart.syncing"
                      :aria-label="terms.checkout.quantityFor(item.product.name)"
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

        <form class="checkout-form" @submit.prevent="submit">
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
              <BaseInput
                v-model="delivery.cityQuery"
                :label="terms.checkout.city"
                :placeholder="terms.checkout.cityPlaceholder"
                autocomplete="address-level2"
                :description="delivery.loadingCities ? terms.checkout.searching : ''"
              />
              <BaseSelect
                v-if="cityOptions.length"
                v-model="delivery.selectedCityRef"
                :label="terms.checkout.selectCity"
                :placeholder="terms.checkout.chooseCity"
                :options="cityOptions"
              />
              <BaseSelect
                v-if="form.shippingMethod === 'warehouse'"
                v-model="delivery.selectedWarehouse"
                :label="terms.checkout.warehouse"
                :placeholder="terms.checkout.chooseWarehouse"
                :options="warehouseOptions"
                :description="delivery.loadingWarehouses ? terms.checkout.loadingWarehouses : ''"
                :disabled="!delivery.selectedCityRef || delivery.loadingWarehouses"
                required
              />
              <div v-else class="checkout-form__grid checkout-form__grid--three">
                <BaseInput v-model="form.shippingStreet" :label="terms.checkout.street" autocomplete="address-line1" required />
                <BaseInput v-model="form.buildingNumber" :label="terms.checkout.building" autocomplete="address-line2" required />
                <BaseInput v-model="form.shippingApartment" :label="terms.checkout.apartment" />
              </div>
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
            <BaseButton type="submit" block :disabled="state.loading || !canSubmit">
              {{ state.loading ? terms.checkout.processing : terms.checkout.placeOrder }}
            </BaseButton>
            <p v-if="state.done" class="checkout-page__success">{{ terms.checkout.orderSuccess }}</p>
            <p v-if="state.error" class="checkout-page__error">{{ state.error }}</p>
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
                  :alt="item.product.images[0]?.alt || item.product.name"
                >
                <div class="checkout-order-list__body">
                  <p class="checkout-order-list__brand">{{ item.product.brand.name }}</p>
                  <div class="checkout-order-list__title-row">
                    <div class="checkout-order-list__title-copy">
                      <h3>{{ item.product.name }}</h3>
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
                        :max="Math.max(1, item.product.stock)"
                        :disabled="cart.syncing"
                        :aria-label="terms.checkout.quantityFor(item.product.name)"
                        @update:model-value="cart.update(item.product.id, $event)"
                      />
                    </div>
                  </div>
                </div>
                </article>
              </template>
            </div>
            <p v-else class="checkout-page__muted">{{ terms.checkout.cartEmpty }}</p>
            <p v-if="cart.error" class="checkout-page__error">{{ cart.error }}</p>
          </section>

          <section class="checkout-card checkout-card--finish">
            <div class="checkout-total">
              <span>{{ terms.common.total }}</span>
              <strong>{{ formatPrice(cart.total) }}</strong>
            </div>
            <BaseButton type="button" block :disabled="state.loading || !canSubmit" @click="submit">
              {{ state.loading ? terms.checkout.processing : terms.checkout.placeOrder }}
            </BaseButton>
            <p v-if="state.done" class="checkout-page__success">{{ terms.checkout.orderSuccess }}</p>
            <p v-if="state.error" class="checkout-page__error">{{ state.error }}</p>
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
