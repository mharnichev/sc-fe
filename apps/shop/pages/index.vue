<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import AppSection from '~/components/ui/AppSection.vue'

const domain = useCatalogDomain()
const { terms } = useShopLocale()
const HOME_PAGE_LIMIT = 12
const POPULAR_PRODUCTS_LIMIT = 24

const { data: popularProductsPage, pending: arePopularProductsLoading } = await useAsyncData(
  'shop-home-popular-products',
  () => domain.getProductsPage({
    limit: POPULAR_PRODUCTS_LIMIT,
    offset: 0,
    is_top: true,
    sort: 'top',
  }),
)

const { data: brands, pending: areBrandsLoading } = await useAsyncData(
  'shop-home-brands',
  () => domain.getBrands({ hasActiveProducts: true }),
)

const { data: initialProductsPage, pending: isFirstLoading } = await useAsyncData(
  'shop-home-goods',
  () => domain.getProductsPage({
    limit: HOME_PAGE_LIMIT,
    offset: 0,
  }),
)

const products = ref<ProductDto[]>([])
const pagination = reactive({ limit: HOME_PAGE_LIMIT, offset: 0, total: 0 })
const isLoading = ref(false)

const canLoadMore = computed(() => products.value.length < pagination.total || isFirstLoading.value)
const popularProducts = computed(() => (popularProductsPage.value?.items || []).slice(0, POPULAR_PRODUCTS_LIMIT))

watch(
  initialProductsPage,
  page => {
    products.value = page?.items || []
    pagination.offset = products.value.length
    pagination.total = page?.total || 0
  },
  { immediate: true },
)

const fetchGoods = async () => {
  if (isLoading.value || isFirstLoading.value) return
  isLoading.value = true
  try {
    const page = await domain.getProductsPage({
      limit: pagination.limit,
      offset: pagination.offset,
    })
    products.value = [...products.value, ...page.items]
    pagination.offset = products.value.length
    pagination.total = page.total
  }
  finally {
    isLoading.value = false
  }
}

useSeo(
  () => terms.value.seo.homeTitle,
  () => terms.value.seo.homeDescription,
)
</script>

<template>
  <div class="space-y-16 pb-16 md:pb-24">
    <section class="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <div class="space-y-6">
        <BaseSectionLabel>{{ terms.home.eyebrow }}</BaseSectionLabel>
        <h1 class="type-page-title text-5xl leading-tight text-neutral-900 md:text-[52px]">
          {{ terms.home.title }}
        </h1>
        <p class="max-w-2xl text-lg leading-8 text-neutral-600">
          {{ terms.home.text }}
        </p>
        <BaseButton to="/catalog">
          {{ terms.home.cta }}
        </BaseButton>
      </div>
      <BaseMediaPanel
        src="https://images.unsplash.com/photo-1621607512214-68297480165e?auto=format&fit=crop&w=1200&q=80"
        :alt="terms.home.imageAlt"
        class="h-[32rem]"
      />
    </section>

    <BrandSlider :brands="brands || []" :pending="areBrandsLoading" />

    <section class="main-page__popular">
      <p class="type-eyebrow type-eyebrow--wide text-xs">
        <BaseScribbleOutline>{{ terms.home.popularEyebrow }}</BaseScribbleOutline>
      </p>
      <div class="main-page__popular-heading">
        <div class="main-page__popular-copy">
          <h2 class="section-title type-title-strong">
            {{ terms.home.popularTitle }}
          </h2>
          <p>{{ terms.home.popularDescription }}</p>
        </div>
        <BaseButton class="main-page__popular-action" to="/top" variant="outline-dark">
          {{ terms.home.popularCta }}
        </BaseButton>
      </div>

      <ul class="main-page__popular-list" :aria-label="terms.home.popularTitle">
        <template v-if="arePopularProductsLoading">
          <li v-for="i in 12" :key="`popular-loading-${i}`" class="main-page__popular-card">
            <ProductCardSkeleton />
          </li>
        </template>
        <template v-else>
          <li
            v-for="(product, index) in popularProducts"
            :key="`popular-${product.id}-${index}`"
            class="main-page__popular-card"
          >
            <CatalogProductTile :product="product" />
          </li>
        </template>
      </ul>
    </section>

    <AppSection
      :eyebrow="terms.home.catalogEyebrow"
      :title="terms.home.catalogTitle"
      :description="terms.home.catalogDescription"
      scribble-title
    >
      <CatalogProductGrid
        :products="products"
        :pending="isFirstLoading"
        :tail-skeleton-count="isLoading ? 12 : 0"
      />
      <div v-if="canLoadMore" class="mt-6">
        <BaseButton type="button" variant="text" :disabled="isLoading" @click="fetchGoods">
          {{ isLoading ? terms.common.loading : terms.home.showMore }}
          <BaseIcon name="simple-arrow-right" size="xxs" />
        </BaseButton>
      </div>
    </AppSection>
  </div>
</template>

<style scoped>
.main-page__popular {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 4rem;
}

.main-page__popular-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
}

.main-page__popular-copy {
  min-width: 0;
}

.main-page__popular-copy p {
  max-width: 42rem;
  padding-top: 0.5rem;
  color: #57534e;
  font-size: 0.875rem;
  line-height: 1.75rem;
}

.main-page__popular-action {
  flex: 0 0 auto;
}

.main-page__popular-list {
  display: grid;
  overflow-x: auto;
  grid-auto-columns: minmax(16rem, 78vw);
  grid-auto-flow: column;
  grid-template-rows: minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.25rem 0 1rem;
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline mandatory;
  scrollbar-color: #a3a3a3 transparent;
  scrollbar-width: thin;
}

.main-page__popular-card {
  display: flex;
  min-width: 0;
  scroll-snap-align: start;
}

@media (max-width: 767px) {
  .main-page__popular-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 1rem;
  }
}

@media (min-width: 1024px) {
  .main-page__popular-list {
    grid-auto-columns: minmax(16.75rem, calc((100% - 2.25rem) / 4));
    grid-template-rows: repeat(2, minmax(0, 1fr));
  }
}
</style>
