<script setup lang="ts">
import type { Product } from '~/composables/useBackofficeApi'
import type { InventoryMovement } from '~/types/inventory'
import { inventoryApiErrorMessage, inventoryMovementLabel } from '~/utils/inventory'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') return navigateTo('/dashboard')
  },
})

const api = useBackofficeApi()
const route = useRoute()
const router = useRouter()
const { apiErrorMessage, formatDateTime } = useBookingFormatting()
const pageSize = 30
const productId = computed(() => {
  const value = Number(route.query.product_id)
  return Number.isInteger(value) && value > 0 ? value : null
})
const page = computed(() => {
  const value = Number(route.query.page || 1)
  return Number.isInteger(value) && value > 0 ? value : 1
})
const productSearch = ref(typeof route.query.search === 'string' ? route.query.search : '')
const searchedProducts = ref<Product[]>([])
const productsPending = ref(false)
const productsError = ref('')
const movementType = ref(typeof route.query.type === 'string' ? route.query.type : '')
const dateFrom = ref(typeof route.query.date_from === 'string' ? route.query.date_from : '')
const dateTo = ref(typeof route.query.date_to === 'string' ? route.query.date_to : '')
const movementTypeOptions = [
  { value: '', label: 'Усі типи на сторінці' },
  { value: 'opening_balance', label: 'Початковий залишок' },
  { value: 'receipt', label: 'Надходження' },
  { value: 'order_reservation', label: 'Резервування' },
  { value: 'order_release', label: 'Зняття резерву' },
  { value: 'order_fulfillment', label: 'Відвантаження' },
  { value: 'customer_return', label: 'Повернення від клієнта' },
  { value: 'write_off', label: 'Списання' },
  { value: 'inventory_adjustment', label: 'Коригування інвентаризації' },
]

const { data: selectedProduct, pending: productPending, error: productError, refresh: refreshProduct } = await useAsyncData(
  () => `inventory-movement-product-${productId.value || 'none'}`,
  async (): Promise<Product | null> => productId.value ? await api.getProduct(productId.value) : null,
  { watch: [productId] },
)
const { data, pending, error, refresh } = await useAsyncData(
  () => `inventory-movements-${productId.value || 'none'}-${page.value}`,
  async (): Promise<{ total: number, page: number, page_size: number, items: InventoryMovement[] } | null> =>
    productId.value ? await api.getProductInventoryMovements(productId.value, page.value, pageSize) : null,
  { watch: [productId, page] },
)

const movementDirection = (delta: number) => delta > 0 ? 'text-[var(--bo-success-text)]' : delta < 0 ? 'text-[var(--bo-danger-text)]' : 'text-ui-secondary'
const updateQuery = async (changes: Record<string, string | undefined>) => {
  const query = { ...route.query, ...changes }
  Object.entries(query).forEach(([key, value]) => { if (!value) delete query[key] })
  await router.replace({ query })
}
const chooseProduct = (product: Product) => updateQuery({ product_id: String(product.id), page: undefined })
const searchProducts = async () => {
  productsPending.value = true
  productsError.value = ''
  try {
    const result = await api.getProducts(1, 20, { search: productSearch.value.trim() || undefined })
    searchedProducts.value = result.items
    await updateQuery({ search: productSearch.value.trim() || undefined })
  }
  catch (cause) { productsError.value = apiErrorMessage(cause, 'Не вдалося знайти товари.') }
  finally { productsPending.value = false }
}
const retry = async () => { await Promise.all([refresh(), refreshProduct()]) }
const movementDate = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value))
const filteredMovements = computed(() => (data.value?.items || []).filter((movement) => {
  const date = movementDate(movement.created_at)
  return (!movementType.value || movement.movement_type === movementType.value)
    && (!dateFrom.value || date >= dateFrom.value)
    && (!dateTo.value || date <= dateTo.value)
}))
const applyMovementFilters = () => updateQuery({
  type: movementType.value || undefined,
  date_from: dateFrom.value || undefined,
  date_to: dateTo.value || undefined,
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div><p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Склад</p><h1 class="mt-2 text-3xl font-semibold text-ui-primary">Рух товару</h1><p class="mt-2 text-sm text-ui-secondary">Незмінна історія операцій для одного вибраного товару.</p></div>
      <NuxtLink to="/inventory" class="base-button base-button--neutral min-h-10 px-4 py-2 text-sm">До складу</NuxtLink>
    </div>

    <BaseCard as="section" padding="sm" class="space-y-4">
      <form class="flex flex-wrap gap-3" @submit.prevent="searchProducts"><BaseInput v-model="productSearch" type="search" class="min-w-[min(100%,22rem)] flex-1" placeholder="Знайти товар за назвою або SKU" aria-label="Пошук товару" /><BaseButton type="submit" variant="primary" :loading="productsPending">Знайти</BaseButton></form>
      <p v-if="productsError" class="text-sm text-ui-danger" role="alert">{{ productsError }}</p>
      <div v-if="searchedProducts.length" class="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><BaseButton v-for="product in searchedProducts" :key="product.id" variant="neutral" class="justify-start text-left" @click="chooseProduct(product)"><span class="truncate">{{ product.name }}</span><span class="ml-2 text-ui-muted">#{{ product.id }}</span></BaseButton></div>
    </BaseCard>

    <BaseEmptyState v-if="!productId" title="Оберіть товар" description="Знайдіть і виберіть товар, щоб переглянути його рух. URL містить product_id для повторного відкриття." />
    <template v-else>
      <form class="grid gap-3 rounded-[1.5rem] border border-ui-border bg-ui-surface p-4 md:grid-cols-[minmax(12rem,1fr)_12rem_12rem_auto]" @submit.prevent="applyMovementFilters">
        <BaseSelect v-model="movementType" :options="movementTypeOptions" label="Тип руху" />
        <BaseInput v-model="dateFrom" type="date" label="Від дати" />
        <BaseInput v-model="dateTo" type="date" label="До дати" />
        <BaseButton type="submit" variant="primary" class="self-end">Застосувати</BaseButton>
        <p class="text-xs text-ui-muted md:col-span-4">API руху товару не має серверних фільтрів, тому тип і дати звужують лише поточну завантажену сторінку.</p>
      </form>
      <p v-if="error || productError" class="ui-status-danger rounded-2xl px-4 py-3 text-sm" role="alert">{{ inventoryApiErrorMessage(error || productError, 'Не вдалося завантажити рух товару.') }} <BaseButton variant="unstyled" class="ml-2 font-semibold underline" @click="retry">Спробувати ще раз</BaseButton></p>
      <div v-else-if="pending || productPending" class="grid gap-3"><div v-for="index in 5" :key="index" class="h-16 animate-pulse rounded-2xl bg-ui-subtle" /></div>
      <BaseEmptyState v-else-if="!data?.items.length" title="Рухів ще немає" :description="selectedProduct ? `Для «${selectedProduct.name}» ще не зафіксовано операцій.` : 'Історія операцій порожня.'" />
      <template v-else>
        <BaseCard v-if="selectedProduct" padding="sm"><p class="text-xs uppercase tracking-[0.16em] text-ui-muted">Вибраний товар</p><p class="mt-1 text-lg font-semibold text-ui-primary">{{ selectedProduct.name }} <span class="text-ui-muted">#{{ selectedProduct.id }}</span></p></BaseCard>
        <BaseTable caption="Історія руху товару" wrapper-class="rounded-[1.5rem]" min-width="1080px" :empty="!filteredMovements.length" empty-title="За фільтрами рухів немає"><template #head><tr><th>Час</th><th>Операція</th><th>Кількість</th><th>Зміна залишку</th><th>Причина</th><th>Зв’язок</th><th>Оператор</th></tr></template><tr v-for="movement in filteredMovements" :key="movement.id"><td class="whitespace-nowrap text-ui-secondary">{{ formatDateTime(movement.created_at) }}</td><td class="font-medium text-ui-primary">{{ inventoryMovementLabel(movement.movement_type) }}</td><td class="text-ui-secondary">{{ movement.quantity }}</td><td :class="movementDirection(movement.on_hand_delta)" class="font-medium">{{ movement.on_hand_delta > 0 ? '+' : '' }}{{ movement.on_hand_delta }}</td><td class="max-w-xs text-ui-secondary">{{ movement.reason || '—' }}</td><td class="text-ui-secondary"><NuxtLink v-if="movement.order_id" :to="`/orders/${movement.order_id}`" class="font-medium text-ui-accent hover:underline">Замовлення #{{ movement.order_id }}</NuxtLink><span v-else-if="movement.receipt_id">Надходження #{{ movement.receipt_id }}</span><span v-else-if="movement.count_id">Інвентаризація #{{ movement.count_id }}</span><span v-else>—</span></td><td class="text-ui-secondary">{{ movement.admin_user_id ? `Користувач #${movement.admin_user_id}` : 'Система' }}</td></tr></BaseTable>
        <div class="flex justify-end gap-2"><BaseButton variant="neutral" :disabled="page === 1" @click="updateQuery({ page: String(page - 1) })">Попередня</BaseButton><BaseButton variant="neutral" :disabled="page * pageSize >= data.total" @click="updateQuery({ page: String(page + 1) })">Наступна</BaseButton></div>
      </template>
    </template>
  </div>
</template>
