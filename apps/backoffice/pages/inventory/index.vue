<script setup lang="ts">
import { ArchiveBoxIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, FunnelIcon, CameraIcon, XMarkIcon, CubeIcon, LockClosedIcon, ShoppingBagIcon, ShoppingCartIcon } from '@heroicons/vue/24/outline'
import type { Product } from '~/composables/useBackofficeApi'
import { inventoryApiErrorMessage } from '~/utils/inventory'
provide('compactFieldHints', true)

const auth = useAuthStore()
const canPostInventory = computed(() => Boolean(auth.user?.is_superuser || auth.user?.can_post_inventory))
const cameraOpen = ref(false)
const searchInput = ref<{ focus: () => void } | null>(null)

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
  () => canPostInventory.value ? api.getProcurementQueue() : Promise.resolve([]),
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
let searchTimer: ReturnType<typeof setTimeout> | undefined
const cancelScheduledSearch = () => {
  clearTimeout(searchTimer)
  searchTimer = undefined
}
const applyFilters = () => {
  cancelScheduledSearch()
  return updateQuery({ search: search.value.trim() || undefined, stock: stockFilter.value || undefined, page: undefined })
}
const searchAsYouType = (value: string | number | null) => {
  search.value = String(value ?? '')
  cancelScheduledSearch()
  searchTimer = setTimeout(() => { void applyFilters() }, 300)
}
const clearSearch = async () => {
  search.value = ''
  await applyFilters()
  searchInput.value?.focus()
}
onBeforeUnmount(cancelScheduledSearch)
onBeforeRouteLeave(cancelScheduledSearch)
const closeCamera = async () => {
  cameraOpen.value = false
  await nextTick()
  searchInput.value?.focus()
}
const scanBarcode = async (barcode: string) => {
  cameraOpen.value = false
  search.value = barcode
  await applyFilters()
  searchInput.value?.focus()
}
watch(() => route.query.search, () => {
  cancelScheduledSearch()
  search.value = typeof route.query.search === 'string' ? route.query.search : ''
})
watch(() => route.query.stock, () => {
  stockFilter.value = typeof route.query.stock === 'string' ? route.query.stock : ''
})
watch(() => route.fullPath, () => { cameraOpen.value = false })
const changePage = (next: number) => updateQuery({ page: String(next) })
const retry = async () => { await Promise.all([refresh(), refreshProcurement()]) }
const productVariant = (item: Product | undefined) => item?.package_size || item?.model_name || (item?.volume_ml ? `${item.volume_ml} мл` : '—')
const productImage = (item: Product | undefined) => item?.image_url ? assetUrl(item.image_url) : ''
const stockState = (available: number, reserved: number, toOrder: number) => toOrder > 0 ? 'Потрібна закупівля' : available <= 0 ? 'Немає у вільному залишку' : reserved > 0 ? 'Частково зарезервовано' : 'Доступно'
const stockTone = (available: number, reserved: number, toOrder: number): 'danger' | 'warning' | 'success' => toOrder > 0 ? 'warning' : available <= 0 ? 'danger' : reserved > 0 ? 'warning' : 'success'
</script>

<template>
  <div class="inventory-page space-y-3 sm:space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex min-w-0 items-center gap-1"><h1 class="flex items-center gap-2 text-2xl font-semibold text-ui-primary sm:text-3xl"><ArchiveBoxIcon class="h-6 w-6 shrink-0" aria-hidden="true" />Склад</h1><BaseFieldHelp text="Знайдіть товар і перевірте, скільки доступно." label="Про сторінку" /></div>
      </div>
    </div>

    <InventorySectionNav />
    <section class="space-y-2" aria-labelledby="stock-summary-title">
      <div class="flex min-w-0 items-center gap-1"><h2 id="stock-summary-title" class="flex items-center gap-2 text-lg font-semibold text-ui-primary">Зведення залишків</h2><BaseFieldHelp text="Кількість одиниць товару, а не найменувань. Перші три показники — за поточною сторінкою, до фільтра залишків." label="Як рахуються залишки" /></div>
      <div class="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <BaseCard v-for="item in [
          { label: 'Є на складі', value: summary.onHand, icon: CubeIcon, tone: 'info', description: 'Усі одиниці, включно з резервом.' },
          { label: 'Зарезервовано', value: summary.reserved, icon: LockClosedIcon, tone: 'warning', description: 'Відкладено під замовлення клієнтів.' },
          { label: 'Вільно для продажу', value: summary.available, icon: ShoppingBagIcon, tone: 'success', description: 'На складі мінус зарезервоване.' },
          { label: 'Треба докупити', value: summary.toOrder, icon: ShoppingCartIcon, description: 'Бракує для замовлень у всій черзі.' },
        ]" :key="item.label" padding="sm" class="flex flex-col" :style="item.tone ? { background: `var(--bo-${item.tone}-surface)` } : undefined">
          <div class="flex items-center justify-between gap-1 text-ui-secondary">
            <component :is="item.icon" class="h-4 w-4 shrink-0 text-ui-accent" :style="item.tone ? { color: `var(--bo-${item.tone}-text)` } : undefined" aria-hidden="true" />
            <BaseFieldHelp :text="item.description" :label="item.label" />
          </div>
          <h3 class="mt-1 min-h-8 text-xs font-medium leading-4 text-ui-secondary">{{ item.label }}</h3>
          <p class="mt-1 text-xl font-semibold text-ui-primary">{{ item.value }} <span class="text-xs font-normal text-ui-muted">од.</span></p>
        </BaseCard>
      </div>
    </section>

    <form class="grid gap-4 rounded-[1.5rem] bg-ui-surface p-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-end" @submit.prevent="applyFilters">
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div class="inventory-stock-search relative min-w-0">
          <BaseInput ref="searchInput" :model-value="search" field-class="min-w-0" input-class="base-control py-3 pl-4 pr-12 text-sm" type="search" label="Пошук на складі" hint="Пошук застосовується автоматично серед усіх товарів." placeholder="Назва, SKU або штрихкод" aria-description="Шукає серед усіх товарів." @update:model-value="searchAsYouType"><template #icon><MagnifyingGlassIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseInput>
          <button v-if="search" type="button" class="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full text-ui-muted hover:text-ui-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Очистити пошук" title="Очистити пошук" @click="clearSearch"><XMarkIcon class="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <BaseButton type="button" variant="neutral" class="h-11 w-11 shrink-0 p-0" aria-label="Сканувати штрихкод" title="Сканувати штрихкод" @click="cameraOpen = true"><CameraIcon class="h-5 w-5 shrink-0" aria-hidden="true" /></BaseButton>
      </div>
      <BaseSelect v-model="stockFilter" :options="stockOptions" label="Залишок" hint="Застосовується автоматично до товарів на поточній сторінці." aria-description="Фільтрує товари на цій сторінці." @update:model-value="applyFilters"><template #icon><FunnelIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template></BaseSelect>
    </form>
    <InventoryBarcodeCamera v-if="cameraOpen" @close="closeCamera" @recognized="scanBarcode" />

    <p v-if="error || procurementError" class="ui-status-danger rounded-2xl px-4 py-3 text-sm" role="alert">
      {{ inventoryApiErrorMessage(error || procurementError, 'Не вдалося завантажити дані складу.') }}
      <BaseButton variant="unstyled" class="ml-2 font-semibold underline" :loading="pending || procurementPending" @click="retry">Спробувати ще раз</BaseButton>
    </p>
    <div v-else-if="pending || procurementPending" class="grid gap-3"><div v-for="index in 5" :key="index" class="h-16 animate-pulse rounded-2xl bg-ui-subtle" /></div>
    <BaseEmptyState v-else-if="!stockRows.length" title="Товарів не знайдено" />
    <div v-else class="grid gap-3 md:hidden">
      <BaseCard v-for="item in stockRows" :key="item.id" padding="sm">
        <InventoryProductCard :product="item" :framed="false" />
        <NuxtLink :to="`/inventory/receiving?product_id=${item.id}`" class="base-button base-button--neutral mt-3 flex min-h-11 w-full items-center justify-center gap-2 px-3 text-center"><ArrowDownTrayIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Прийняти товар</NuxtLink>
      </BaseCard>
    </div>
    <BaseTable v-if="!pending && !error && stockRows.length" caption="Поточні залишки" wrapper-class="hidden md:block rounded-[1.5rem]" min-width="1320px">
      <template #head><tr><th>Товар</th><th>Варіант / розмір</th><th>SKU / штрихкод</th><th>Фізично</th><th>Резерв</th><th>Доступно</th><th>До замовлення</th><th>Під закупівлю</th><th>Стан</th><th>Дії</th></tr></template>
      <tr v-for="item in stockRows" :key="item.id">
        <td><div class="flex items-center gap-3"><img v-if="productImage(productDetails[item.id])" :src="productImage(productDetails[item.id])" :alt="item.name" class="h-10 w-10 shrink-0 rounded-lg object-cover"><span v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ui-subtle text-xs font-semibold text-ui-muted" aria-hidden="true">{{ item.name.slice(0, 1) }}</span><div><p class="font-medium text-ui-primary">{{ item.name }}</p><p class="mt-1 text-xs text-ui-muted">#{{ item.id }}</p></div></div></td>
        <td class="text-ui-secondary">{{ productVariant(productDetails[item.id]) }}</td>
        <td class="text-ui-secondary"><p>{{ item.sku || 'SKU не вказано' }}</p><p class="mt-1 text-xs">{{ item.barcode || 'Без штрихкоду' }}</p></td>
        <td class="text-ui-secondary">{{ item.on_hand }}</td><td class="text-ui-secondary">{{ item.reserved }}</td><td class="font-medium text-ui-primary">{{ item.available }}</td>
        <td class="text-ui-secondary">{{ procurementByProduct.get(item.id) ?? 0 }}</td>
        <td><BaseBadge :tone="item.allow_backorder ? 'info' : 'neutral'">{{ item.allow_backorder ? 'Дозволено' : 'Вимкнено' }}</BaseBadge></td>
        <td><BaseBadge :tone="stockTone(item.available, item.reserved, procurementByProduct.get(item.id) || 0)">{{ stockState(item.available, item.reserved, procurementByProduct.get(item.id) || 0) }}</BaseBadge></td>
        <td><div class="flex flex-wrap gap-x-3 gap-y-1 text-sm"><NuxtLink :to="`/products/${item.id}`" class="font-medium text-ui-accent hover:underline">Товар</NuxtLink><NuxtLink :to="`/inventory/movements?product_id=${item.id}`" class="font-medium text-ui-accent hover:underline">Історія</NuxtLink><NuxtLink :to="`/inventory/receiving?product_id=${item.id}${item.barcode ? `&barcode=${encodeURIComponent(item.barcode)}` : ''}`" class="font-medium text-ui-accent hover:underline">Прийняти</NuxtLink><NuxtLink v-if="canPostInventory" :to="`/inventory/operations?product_id=${item.id}`" class="font-medium text-ui-accent hover:underline">Операція</NuxtLink></div></td>
      </tr>
    </BaseTable>
    <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-ui-secondary"><span>Усього: {{ total }}</span><div class="flex gap-2"><BaseButton variant="neutral" :disabled="page === 1" @click="changePage(page - 1)"><ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />Попередня</BaseButton><BaseButton variant="neutral" :disabled="page * pageSize >= total" @click="changePage(page + 1)">Наступна<ChevronRightIcon class="h-4 w-4" aria-hidden="true" /></BaseButton></div></div>
  </div>
</template>

<style scoped>
.inventory-stock-search :deep(input::-webkit-search-cancel-button) {
  appearance: none;
}
</style>
