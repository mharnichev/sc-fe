<script setup lang="ts">
import type { Product } from '~/composables/useBackofficeApi'
import { inventoryApiErrorMessage } from '~/utils/inventory'
definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') return navigateTo('/dashboard')
  },
})

const api = useBackofficeApi()
const route = useRoute()
const router = useRouter()
const assetUrl = useAssetUrl()
const pageSize = 20
const page = computed(() => {
  const candidate = Number(route.query.page || 1)
  return Number.isInteger(candidate) && candidate > 0 ? candidate : 1
})
const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const stockFilter = ref(typeof route.query.stock === 'string' ? route.query.stock : '')
const stockOptions = [
  { value: '', label: 'Усі товари на сторінці' },
  { value: 'available', label: 'Є у вільному залишку' },
  { value: 'out-of-stock', label: 'Немає в наявності' },
  { value: 'backorder', label: 'Дозволене замовлення під закупівлю' },
  { value: 'missing-barcode', label: 'Без штрихкоду' },
  { value: 'needs-to-order', label: 'Потрібно замовити' },
]

const { data, pending, error, refresh } = await useAsyncData(
  () => `inventory-stock-${page.value}-${route.query.search || ''}`,
  () => api.getInventoryStock(page.value, pageSize, { search: typeof route.query.search === 'string' ? route.query.search || undefined : undefined }),
  { watch: [page, () => route.query.search] },
)
const { data: procurement, pending: procurementPending, error: procurementError, refresh: refreshProcurement } = await useAsyncData(
  'inventory-procurement-queue',
  () => api.getProcurementQueue(),
)

const procurementByProduct = computed(() => new Map((procurement.value || []).map(item => [item.product_id, item.total_quantity_required])))
const productDetails = ref<Record<number, Product>>({})
let productDetailsRequest = 0

watch(
  () => (data.value?.items || []).map(item => item.id).join(','),
  async () => {
    const request = ++productDetailsRequest
    const products = await Promise.all((data.value?.items || []).map(async (item) => {
      try { return await api.getProduct(item.id) }
      catch { return null }
    }))
    if (request !== productDetailsRequest) return
    productDetails.value = Object.fromEntries(products.filter((item): item is Product => Boolean(item)).map(item => [item.id, item]))
  },
  { immediate: true },
)

const stockRows = computed(() => (data.value?.items || []).filter((item) => {
  const needed = procurementByProduct.value.get(item.id) || 0
  if (stockFilter.value === 'available') return item.available > 0
  if (stockFilter.value === 'out-of-stock') return item.available === 0
  if (stockFilter.value === 'backorder') return item.allow_backorder
  if (stockFilter.value === 'missing-barcode') return !item.barcode
  if (stockFilter.value === 'needs-to-order') return needed > 0
  return true
}))
const total = computed(() => data.value?.total || 0)
const summary = computed(() => ({
  onHand: (data.value?.items || []).reduce((sum, item) => sum + item.on_hand, 0),
  reserved: (data.value?.items || []).reduce((sum, item) => sum + item.reserved, 0),
  available: (data.value?.items || []).reduce((sum, item) => sum + item.available, 0),
  toOrder: (procurement.value || []).reduce((sum, item) => sum + item.total_quantity_required, 0),
}))

const updateQuery = async (changes: Record<string, string | undefined>) => {
  const query = { ...route.query, ...changes }
  Object.entries(query).forEach(([key, value]) => { if (!value) delete query[key] })
  await router.replace({ query })
}
const applyFilters = () => updateQuery({ search: search.value.trim() || undefined, stock: stockFilter.value || undefined, page: undefined })
const changePage = (next: number) => updateQuery({ page: String(next) })
const retry = async () => { await Promise.all([refresh(), refreshProcurement()]) }
const productVariant = (item: Product | undefined) => item?.package_size || item?.model_name || (item?.volume_ml ? `${item.volume_ml} мл` : '—')
const productImage = (item: Product | undefined) => item?.image_url ? assetUrl(item.image_url) : ''
const stockState = (available: number, reserved: number, toOrder: number) => toOrder > 0 ? 'Потрібна закупівля' : available <= 0 ? 'Немає у вільному залишку' : reserved > 0 ? 'Частково зарезервовано' : 'Доступно'
const stockTone = (available: number, reserved: number, toOrder: number): 'danger' | 'warning' | 'success' => toOrder > 0 ? 'warning' : available <= 0 ? 'danger' : reserved > 0 ? 'warning' : 'success'
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Онлайн-магазин</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Склад</h1>
        <p class="mt-2 text-sm text-ui-secondary">Фактичний залишок, резерв і потреба в закупівлі з поточних даних API.</p>
      </div>
    </div>

    <InventorySectionNav />

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <BaseCard v-for="item in [
        { label: 'Фізично · сторінка', value: summary.onHand }, { label: 'Резерв · сторінка', value: summary.reserved },
        { label: 'Доступно · сторінка', value: summary.available }, { label: 'Потрібно замовити · черга', value: summary.toOrder },
      ]" :key="item.label" padding="sm">
        <p class="text-xs uppercase tracking-[0.16em] text-ui-muted">{{ item.label }}</p><p class="mt-2 text-2xl font-semibold text-ui-primary">{{ item.value }}</p>
      </BaseCard>
    </div>

    <form class="grid gap-3 rounded-[1.5rem] border border-ui-border bg-ui-surface p-4 md:grid-cols-[minmax(0,1fr)_18rem_auto]" @submit.prevent="applyFilters">
      <BaseInput v-model="search" type="search" placeholder="Пошук за назвою, SKU або штрихкодом" aria-label="Пошук на складі" />
      <BaseSelect v-model="stockFilter" :options="stockOptions" aria-label="Фільтр складу" />
      <BaseButton type="submit" variant="primary">Застосувати</BaseButton>
    </form>

    <p v-if="error || procurementError" class="ui-status-danger rounded-2xl px-4 py-3 text-sm" role="alert">
      {{ inventoryApiErrorMessage(error || procurementError, 'Не вдалося завантажити дані складу.') }}
      <BaseButton variant="unstyled" class="ml-2 font-semibold underline" :loading="pending || procurementPending" @click="retry">Спробувати ще раз</BaseButton>
    </p>
    <div v-else-if="pending || procurementPending" class="grid gap-3"><div v-for="index in 5" :key="index" class="h-16 animate-pulse rounded-2xl bg-ui-subtle" /></div>
    <BaseEmptyState v-else-if="!stockRows.length" title="Товарів не знайдено" description="Змініть пошук або фільтр. Фільтри застосовуються до поточної сторінки авторитетного списку складу." />
    <BaseTable v-else caption="Поточні залишки" wrapper-class="rounded-[1.5rem]" min-width="1320px">
      <template #head><tr><th>Товар</th><th>Варіант / розмір</th><th>SKU / штрихкод</th><th>Фізично</th><th>Резерв</th><th>Доступно</th><th>До замовлення</th><th>Під закупівлю</th><th>Стан</th><th>Дії</th></tr></template>
      <tr v-for="item in stockRows" :key="item.id">
        <td><div class="flex items-center gap-3"><img v-if="productImage(productDetails[item.id])" :src="productImage(productDetails[item.id])" :alt="item.name" class="h-10 w-10 shrink-0 rounded-lg object-cover"><span v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ui-subtle text-xs font-semibold text-ui-muted" aria-hidden="true">{{ item.name.slice(0, 1) }}</span><div><p class="font-medium text-ui-primary">{{ item.name }}</p><p class="mt-1 text-xs text-ui-muted">#{{ item.id }}</p></div></div></td>
        <td class="text-ui-secondary">{{ productVariant(productDetails[item.id]) }}</td>
        <td class="text-ui-secondary"><p>{{ item.sku || 'SKU не вказано' }}</p><p class="mt-1 text-xs">{{ item.barcode || 'Без штрихкоду' }}</p></td>
        <td class="text-ui-secondary">{{ item.on_hand }}</td><td class="text-ui-secondary">{{ item.reserved }}</td><td class="font-medium text-ui-primary">{{ item.available }}</td>
        <td class="text-ui-secondary">{{ procurementByProduct.get(item.id) ?? 0 }}</td>
        <td><BaseBadge :tone="item.allow_backorder ? 'info' : 'neutral'">{{ item.allow_backorder ? 'Дозволено' : 'Вимкнено' }}</BaseBadge></td>
        <td><BaseBadge :tone="stockTone(item.available, item.reserved, procurementByProduct.get(item.id) || 0)">{{ stockState(item.available, item.reserved, procurementByProduct.get(item.id) || 0) }}</BaseBadge></td>
        <td><div class="flex flex-wrap gap-x-3 gap-y-1 text-sm"><NuxtLink :to="`/products/${item.id}`" class="font-medium text-ui-accent hover:underline">Товар</NuxtLink><NuxtLink :to="`/inventory/movements?product_id=${item.id}`" class="font-medium text-ui-accent hover:underline">Історія</NuxtLink><NuxtLink :to="`/inventory/receiving?product_id=${item.id}${item.barcode ? `&barcode=${encodeURIComponent(item.barcode)}` : ''}`" class="font-medium text-ui-accent hover:underline">Прийняти</NuxtLink><NuxtLink :to="`/inventory/operations?product_id=${item.id}`" class="font-medium text-ui-accent hover:underline">Операція</NuxtLink></div></td>
      </tr>
    </BaseTable>
    <div class="flex items-center justify-between gap-3 text-sm text-ui-secondary"><span>Усього: {{ total }}</span><div class="flex gap-2"><BaseButton variant="neutral" :disabled="page === 1" @click="changePage(page - 1)">Попередня</BaseButton><BaseButton variant="neutral" :disabled="page * pageSize >= total" @click="changePage(page + 1)">Наступна</BaseButton></div></div>
  </div>
</template>
