<script setup lang="ts">
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  ShoppingBagIcon,
  TagIcon,
} from '@heroicons/vue/24/outline'
import type { Product } from '~/composables/useBackofficeApi'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/dashboard')
    }
  },
})

const api = useBackofficeApi()
const { apiErrorMessage, formatDateTime, formatMoney } = useBookingFormatting()

const { data, pending, error, refresh } = await useAsyncData('admin-store-dashboard', async () => {
  const [products, activeProducts, inactiveProducts, lowStockProducts, outOfStockProducts, categories, brands, orders] = await Promise.all([
    api.getProducts(1, 100),
    api.getProducts(1, 1, { is_active: true }),
    api.getProducts(1, 1, { is_active: false }),
    api.getProducts(1, 100, { availability_status: 'low_stock' }),
    api.getProducts(1, 100, { availability_status: 'out_of_stock' }),
    api.getCategories(1, 100),
    api.getBrands(1, 100),
    api.getOrders(1, 20),
  ])

  return { products, activeProducts, inactiveProducts, lowStockProducts, outOfStockProducts, categories, brands, orders }
})

const products = computed(() => data.value?.products.items || [])
const recentOrders = computed(() => data.value?.orders.items || [])
const lowStockProducts = computed(() => data.value?.lowStockProducts.items || [])
const outOfStockProducts = computed(() => data.value?.outOfStockProducts.items || [])
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const productHasImage = (product: Product) =>
  Boolean(product.image_url)
  || (Array.isArray(product.attributes_json?.image_urls) && product.attributes_json.image_urls.length > 0)
const productHasFilters = (product: Product) =>
  isRecord(product.attributes_json?.filters) && Object.keys(product.attributes_json.filters).length > 0
const productsWithoutCategory = computed(() => products.value.filter(product => !product.category_id && !product.category).length)
const productsWithoutBrand = computed(() => products.value.filter(product => !product.brand_id && !product.brand).length)
const productsWithoutImage = computed(() => products.value.filter(product => !productHasImage(product)).length)
const productsWithoutFilters = computed(() => products.value.filter(product => !productHasFilters(product)).length)
const productsWithoutSku = computed(() => products.value.filter(product => !product.sku).length)
const totalStock = computed(() => products.value.reduce((total, product) => total + Number(product.stock_quantity || 0), 0))
const catalogValue = computed(() =>
  products.value.reduce((total, product) => total + (Number(product.price || 0) * Number(product.stock_quantity || 0)), 0),
)

const orderRevenue = computed(() =>
  recentOrders.value.reduce((total, order) => total + Number(order.total_amount || 0), 0),
)

const orderStatuses = computed(() => {
  const rows = new Map<string, { status: string, count: number, revenue: number }>()
  for (const order of recentOrders.value) {
    const row = rows.get(order.status) || { status: order.status, count: 0, revenue: 0 }
    row.count += 1
    row.revenue += Number(order.total_amount || 0)
    rows.set(order.status, row)
  }
  return [...rows.values()].sort((first, second) => second.count - first.count)
})

const categoryCoverage = computed(() => {
  const rows = new Map<number | string, { id: number | string, name: string, count: number, stock: number }>()
  for (const product of products.value) {
    const id = product.category?.id || product.category_id || 'none'
    const name = product.category?.name || 'Без категорії'
    const row = rows.get(id) || { id, name, count: 0, stock: 0 }
    row.count += 1
    row.stock += Number(product.stock_quantity || 0)
    rows.set(id, row)
  }
  return [...rows.values()].sort((first, second) => second.count - first.count).slice(0, 6)
})

const productsNeedingAttention = computed<Product[]>(() => {
  const byId = new Map<number, Product>()
  for (const product of [...outOfStockProducts.value, ...lowStockProducts.value]) {
    byId.set(product.id, product)
  }
  for (const product of products.value) {
    if (!productHasImage(product) || !productHasFilters(product) || !product.sku || !product.category_id || !product.brand_id) {
      byId.set(product.id, product)
    }
  }
  return [...byId.values()].slice(0, 8)
})

const productIssueLabels = (product: Product) => {
  const labels: string[] = []
  if (Number(product.stock_quantity || 0) <= 0) labels.push('немає на складі')
  else if (product.availability_status === 'low_stock' || Number(product.stock_quantity || 0) <= 3) labels.push('низький залишок')
  if (!productHasImage(product)) labels.push('без фото')
  if (!productHasFilters(product)) labels.push('без фільтрів')
  if (!product.sku) labels.push('без SKU')
  if (!product.category_id && !product.category) labels.push('без категорії')
  if (!product.brand_id && !product.brand) labels.push('без бренду')
  return labels.join(' · ') || 'перевірити картку'
}

const quickActions = [
  { label: 'Товари', value: 'Картки і залишки', to: '/products', icon: CubeIcon },
  { label: 'Замовлення', value: 'Продажі й статуси', to: '/orders', icon: ShoppingBagIcon },
  { label: 'Категорії', value: 'Структура каталогу', to: '/categories', icon: TagIcon },
  { label: 'Бренди', value: 'Виробники', to: '/brands', icon: BuildingStorefrontIcon },
]
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Admin dashboard</p>
        <h1 class="mt-1 text-3xl font-semibold text-slate-900">Онлайн магазин</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Стан каталогу, складські сигнали, структура товарів і останні замовлення.
        </p>
      </div>
      <BaseButton
        type="button"
        :disabled="pending"
        class="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        @click="refresh"
      >
        <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
        {{ pending ? 'Оновлення...' : 'Оновити' }}
      </BaseButton>
    </div>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ apiErrorMessage(error, 'Не вдалося завантажити dashboard онлайн магазину.') }}
    </p>

    <section class="grid gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
      <NuxtLink
        v-for="action in quickActions"
        :key="action.to"
        :to="action.to"
        class="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2.5 transition hover:border-cyan-300 hover:bg-cyan-50"
      >
        <span class="flex min-w-0 items-center gap-3">
          <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
            <component :is="action.icon" class="h-5 w-5" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="block font-medium text-slate-900">{{ action.label }}</span>
            <span class="mt-1 block truncate text-sm text-slate-500">{{ action.value }}</span>
          </span>
        </span>
        <ArrowRightIcon class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </NuxtLink>
    </section>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatisticsStatCard
        label="Товари"
        :value="data?.products.total || 0"
        :hint="`${data?.activeProducts.total || 0} активних · ${data?.inactiveProducts.total || 0} неактивних`"
        :loading="pending"
        tone="dark"
      />
      <StatisticsStatCard
        label="Склад"
        :value="totalStock"
        :hint="`${outOfStockProducts.length} без залишку · ${lowStockProducts.length} низький залишок`"
        :loading="pending"
        tone="amber"
      />
      <StatisticsStatCard
        label="Каталог"
        :value="formatMoney(catalogValue)"
        :hint="`${data?.categories.total || 0} категорій · ${data?.brands.total || 0} брендів`"
        :loading="pending"
        tone="cyan"
      />
      <StatisticsStatCard
        label="Останні замовлення"
        :value="data?.orders.total || 0"
        :hint="`У вибірці: ${formatMoney(orderRevenue)}`"
        :loading="pending"
        tone="emerald"
      />
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Товари, що потребують уваги</h2>
            <p class="mt-1 text-sm text-slate-500">Залишки, фото, SKU, категорія та бренд.</p>
          </div>
          <NuxtLink to="/products" class="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Каталог
            <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
          </NuxtLink>
        </div>

        <div v-if="pending" class="mt-4 space-y-3">
          <div v-for="index in 5" :key="index" class="h-16 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <StatisticsEmptyState
          v-else-if="!productsNeedingAttention.length"
          class="mt-4"
          title="Каталог без явних проблем"
          description="Критичні залишки і неповні картки не знайдені у поточній вибірці."
        />
        <div v-else class="mt-4 divide-y divide-slate-100">
          <article v-for="product in productsNeedingAttention" :key="product.id" class="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div class="min-w-0">
              <p class="truncate font-medium text-slate-900">{{ product.name }}</p>
              <p class="mt-1 text-sm text-slate-500">
                {{ product.category?.name || 'Без категорії' }} · {{ product.brand?.name || 'Без бренду' }}
              </p>
              <p class="mt-1 text-xs text-amber-700">{{ productIssueLabels(product) }}</p>
            </div>
            <div class="text-sm md:text-right">
              <p class="font-semibold text-slate-900">{{ formatMoney(product.price) }}</p>
              <p class="mt-1 text-slate-500">Склад: {{ product.stock_quantity }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Якість каталогу</h2>
        <p class="mt-1 text-sm text-slate-500">Поля, які впливають на публікацію і пошук.</p>
        <div class="mt-4 grid gap-3">
          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-slate-500">Без фото</p>
              <p class="text-xl font-semibold text-slate-900">{{ productsWithoutImage }}</p>
            </div>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-slate-500">Без SKU</p>
              <p class="text-xl font-semibold text-slate-900">{{ productsWithoutSku }}</p>
            </div>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-slate-500">Без фільтрів</p>
              <p class="text-xl font-semibold text-slate-900">{{ productsWithoutFilters }}</p>
            </div>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-slate-500">Без категорії</p>
              <p class="text-xl font-semibold text-slate-900">{{ productsWithoutCategory }}</p>
            </div>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-slate-500">Без бренду</p>
              <p class="text-xl font-semibold text-slate-900">{{ productsWithoutBrand }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900">Останні замовлення</h2>
          <NuxtLink to="/orders" class="text-sm font-medium text-cyan-700">Усі замовлення</NuxtLink>
        </div>
        <div v-if="pending" class="mt-4 space-y-3">
          <div v-for="index in 5" :key="index" class="h-14 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <StatisticsEmptyState
          v-else-if="!recentOrders.length"
          class="mt-4"
          title="Замовлень немає"
          description="Нові замовлення зʼявляться тут після оформлення."
        />
        <div v-else class="mt-4 divide-y divide-slate-100">
          <article v-for="order in recentOrders.slice(0, 8)" :key="order.id" class="grid gap-3 py-3 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center">
            <div>
              <p class="font-semibold text-slate-900">#{{ order.id }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatDateTime(order.created_at) }}</p>
            </div>
            <div class="min-w-0">
              <p class="truncate font-medium text-slate-900">{{ order.customer_name }}</p>
              <p class="mt-1 truncate text-sm text-slate-500">{{ order.customer_email || order.customer_phone || 'Без контактів' }}</p>
            </div>
            <div class="md:text-right">
              <p class="font-semibold text-slate-900">{{ formatMoney(order.total_amount) }}</p>
              <p class="mt-1 text-xs uppercase tracking-[0.15em] text-cyan-700">{{ order.status }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Структура продажів і каталогу</h2>
        <div class="mt-4 grid gap-4">
          <div>
            <p class="text-sm font-medium text-slate-700">Статуси замовлень у вибірці</p>
            <div v-if="!orderStatuses.length" class="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Немає даних.</div>
            <div v-else class="mt-3 space-y-3">
              <div v-for="row in orderStatuses" :key="row.status" class="rounded-2xl bg-slate-50 px-4 py-3">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-sm font-medium uppercase tracking-[0.15em] text-slate-700">{{ row.status }}</span>
                  <span class="text-sm text-slate-500">{{ row.count }} замовлень</span>
                </div>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ formatMoney(row.revenue) }}</p>
              </div>
            </div>
          </div>

          <div>
            <p class="text-sm font-medium text-slate-700">Товари за категоріями</p>
            <div v-if="!categoryCoverage.length" class="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Немає даних.</div>
            <div v-else class="mt-3 space-y-3">
              <div v-for="row in categoryCoverage" :key="row.id" class="space-y-2">
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="font-medium text-slate-900">{{ row.name }}</span>
                  <span class="text-slate-500">{{ row.count }} товарів · {{ row.stock }} шт.</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    class="h-full rounded-full bg-cyan-500"
                    :style="{ width: `${Math.round((row.count / Math.max(1, products.length)) * 100)}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
