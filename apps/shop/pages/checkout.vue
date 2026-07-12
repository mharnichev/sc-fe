<script setup lang="ts">
import { formatPrice } from '@shared-utils'

const cart = useCartStore()
const domain = useCatalogDomain()
const auth = useCustomerAuthStore()
const { terms, dateLocale } = useShopLocale()

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
const preferredDeliveryDate = ref('')
const state = reactive({ loading: false, done: false, error: '' })
const todayInput = new Date().toISOString().slice(0, 10)
let cityTimer: ReturnType<typeof setTimeout> | undefined

const deliveryMethodOptions = computed(() => [
  { label: terms.value.checkout.deliveryOptions.warehouse, value: 'warehouse' },
  { label: terms.value.checkout.deliveryOptions.courier, value: 'courier' },
])
const paymentOptions = computed(() => [
  { label: terms.value.checkout.paymentOptions.cashOnDelivery, value: 'cashOnDelivery' },
  { label: terms.value.checkout.paymentOptions.cardOnDelivery, value: 'cardOnDelivery' },
])

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
    return {
      label: area ? `${label}, ${area}` : label,
      value: ref,
    }
  }).filter(option => option.value && option.label),
)
const warehouseOptions = computed(() =>
  warehouses.value.map(warehouse => {
    const number = readDeliveryField(warehouse, ['Number', 'WarehouseNumber', 'number'])
    const label = readDeliveryField(warehouse, ['Description', 'ShortAddress', 'description'])
    return {
      label: number ? `${number} - ${label}` : label,
      value: number || label,
    }
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
  if (!cart.items.length) return
  state.loading = true
  state.error = ''
  state.done = false
  try {
    const comment = [
      form.comment,
      preferredDeliveryDate.value ? terms.value.checkout.preferredDeliveryDateComment(preferredDeliveryDate.value) : '',
    ].filter(Boolean).join('\n')

    await domain.createOrder({
      ...form,
      shippingCity: form.shippingCity || delivery.cityQuery,
      comment,
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
  <div class="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
    <form class="space-y-6 border border-neutral-200 bg-white p-6" @submit.prevent="submit">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="type-page-title text-3xl text-neutral-900">{{ terms.common.checkout }}</h1>
          <p v-if="auth.isAuthenticated" class="mt-1 text-sm text-neutral-500">{{ terms.checkout.signedInAs(auth.displayName) }}</p>
        </div>
        <CustomerAuthDialog v-if="!auth.isAuthenticated" />
      </div>

      <section class="space-y-4">
        <h2 class="type-page-title text-lg text-neutral-900">{{ terms.checkout.contact }}</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <BaseInput v-model="form.firstName" :label="terms.checkout.firstName" required autocomplete="given-name" :placeholder="terms.checkout.firstName" />
          <BaseInput v-model="form.lastName" :label="terms.checkout.lastName" required autocomplete="family-name" :placeholder="terms.checkout.lastName" />
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <BaseInput v-model="form.email" type="email" :label="terms.checkout.email" autocomplete="email" :placeholder="terms.checkout.email" />
          <BaseInput v-model="form.phoneNumber" type="tel" :label="terms.checkout.phone" required autocomplete="tel" placeholder="+380..." />
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="type-page-title text-lg text-neutral-900">{{ terms.checkout.delivery }}</h2>
        <BaseSelect v-model="form.shippingMethod" :label="terms.checkout.method" :options="deliveryMethodOptions" />
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
        />
        <div v-else class="grid gap-4 md:grid-cols-[1fr_0.5fr_0.5fr]">
          <BaseInput v-model="form.shippingStreet" :label="terms.checkout.street" autocomplete="address-line1" :placeholder="terms.checkout.street" />
          <BaseInput v-model="form.buildingNumber" :label="terms.checkout.building" autocomplete="address-line2" placeholder="12" />
          <BaseInput v-model="form.shippingApartment" :label="terms.checkout.apartment" placeholder="45" />
        </div>
        <BaseSelect v-model="form.paymentMethod" :label="terms.common.payment" :options="paymentOptions" />
      </section>

      <section class="space-y-4">
        <h2 class="type-page-title text-lg text-neutral-900">{{ terms.checkout.notes }}</h2>
        <BaseCalendar v-model="preferredDeliveryDate" :label="terms.checkout.preferredDeliveryDate" :locale="dateLocale" :min="todayInput" :disabled-weekdays="[0]" />
        <BaseTextarea v-model="form.comment" :label="terms.checkout.deliveryNotes" :rows="3" :placeholder="terms.checkout.deliveryNotes" />
      </section>

      <BaseButton type="submit" :disabled="state.loading || !cart.items.length">
        {{ state.loading ? terms.checkout.processing : terms.checkout.placeOrder }}
      </BaseButton>
      <p v-if="state.done" class="text-sm text-emerald-700">{{ terms.checkout.orderSuccess }}</p>
      <p v-if="state.error" class="text-sm text-rose-700">{{ state.error }}</p>
    </form>

    <aside class="space-y-4 border border-neutral-200 bg-white p-6">
      <h2 class="type-page-title text-2xl text-neutral-900">{{ terms.checkout.orderSummary }}</h2>
      <div v-for="item in cart.items" :key="item.product.id" class="grid gap-3 border-b border-neutral-100 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
        <div class="min-w-0">
          <p class="font-medium text-neutral-950">{{ item.product.name }}</p>
          <BaseQuantityStepper
            class="mt-2"
            :model-value="item.quantity"
            :min="0"
            :max="Math.max(1, item.product.stock)"
            :disabled="cart.syncing"
            :aria-label="terms.checkout.quantityFor(item.product.name)"
            @update:model-value="cart.update(item.product.id, $event)"
          />
        </div>
        <span>{{ formatPrice(Number(item.product.price) * item.quantity) }}</span>
      </div>
      <p v-if="!cart.items.length" class="text-sm text-neutral-500">{{ terms.checkout.cartEmpty }}</p>
      <p v-if="cart.error" class="text-sm text-rose-700">{{ cart.error }}</p>
      <div class="flex items-center justify-between pt-2 text-lg font-semibold text-neutral-900">
        <span>{{ terms.common.total }}</span>
        <span>{{ formatPrice(cart.total) }}</span>
      </div>
    </aside>
  </div>
</template>
