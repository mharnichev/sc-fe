<script setup lang="ts">
import { ProductCard } from '@shared-ui'

const route = useRoute()
const router = useRouter()
const domain = useCatalogDomain()

const filters = reactive({
  category_id: route.query.category_id?.toString() || '',
  brand_id: route.query.brand_id?.toString() || '',
  q: route.query.q?.toString() || '',
  sort: route.query.sort?.toString() || 'newest',
})

const [{ data: categories }, { data: brands }] = await Promise.all([
  useAsyncData('shop-categories', domain.getCategories),
  useAsyncData('shop-brands', domain.getBrands),
])

const { data: products, refresh } = await useAsyncData(
  'shop-products',
  () => domain.getProducts({
    category_id: filters.category_id || undefined,
    brand_id: filters.brand_id || undefined,
    q: filters.q || undefined,
    sort: filters.sort,
  }),
)

watch(filters, async () => {
  await router.replace({ query: { ...filters } })
  await refresh()
}, { deep: true })

useSeo('Catalog', 'Browse premium men’s cosmetics by category, brand, search and sort.')
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[280px_1fr]">
    <aside class="space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
      <h1 class="text-2xl font-semibold text-neutral-900">Filters</h1>
      <input v-model="filters.q" placeholder="Search products" class="w-full rounded-2xl border border-neutral-300 px-4 py-3">
      <select v-model="filters.category_id" class="w-full rounded-2xl border border-neutral-300 px-4 py-3">
        <option value="">All categories</option>
        <option v-for="category in categories || []" :key="category.id" :value="category.id">{{ category.name }}</option>
      </select>
      <select v-model="filters.brand_id" class="w-full rounded-2xl border border-neutral-300 px-4 py-3">
        <option value="">All brands</option>
        <option v-for="brand in brands || []" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
      </select>
      <select v-model="filters.sort" class="w-full rounded-2xl border border-neutral-300 px-4 py-3">
        <option value="newest">Newest</option>
        <option value="price_asc">Price ascending</option>
        <option value="price_desc">Price descending</option>
        <option value="name">Name</option>
      </select>
    </aside>

    <section class="space-y-6">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-emerald-700">Catalog</p>
        <h1 class="mt-2 text-4xl font-semibold text-neutral-900">Men’s cosmetics</h1>
      </div>
      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ProductCard v-for="product in products || []" :key="product.id" :product="product" :to="`/products/${product.slug}`" />
      </div>
    </section>
  </div>
</template>
