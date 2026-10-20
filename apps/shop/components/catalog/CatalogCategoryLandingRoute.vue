<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'
import {
  categoryGoodsPath,
  categoryLandingPath,
  categoryPathBySegments,
  type CategoryRouteCrumb,
} from '~/utils/category-routing'

const { categoryDisplayName, categoryDisplayDescription } = useCategoryDisplay()

const props = defineProps<{
  segments: string[]
}>()

const domain = useCatalogDomain()
const { terms } = useShopLocale()

const slugSegments = computed(() => props.segments.map(item => String(item || '')).filter(Boolean))

const { data: categoryTree, pending: categoryTreePending } = await useAsyncData(
  'shop-category-tree-catalog-routes',
  domain.getCategoryTree,
)
const categoryPath = computed(() => categoryPathBySegments(categoryTree.value || [], slugSegments.value))
const currentCategory = computed(() => categoryPath.value[categoryPath.value.length - 1] || null)

if (!slugSegments.value.length || !categoryPath.value.length || !currentCategory.value) {
  throw createError({ statusCode: 404, statusMessage: 'Category not found', fatal: true })
}

const breadcrumbs = computed<CategoryRouteCrumb[]>(() =>
  categoryPath.value.map((category, index, path) => ({
    id: category.id,
    name: categoryDisplayName(category),
    slug: category.slug,
    to: index < path.length - 1 ? categoryLandingPath(path.slice(0, index + 1)) : undefined,
  })),
)

const goodsPath = computed(() => categoryGoodsPath(categoryPath.value))

useSeo(
  () => (currentCategory.value ? categoryDisplayName(currentCategory.value) : '') || terms.value.seo.catalogTitle,
  () => (currentCategory.value ? categoryDisplayDescription(currentCategory.value) : '') || terms.value.seo.catalogDescription,
)
</script>

<template>
  <section class="category-landing">
    <CatalogBreadcrumbs :items="breadcrumbs" :pending="categoryTreePending" />

    <div class="category-landing__head">
      <div>
        <p class="type-eyebrow type-eyebrow--wide text-xs">{{ terms.common.catalog }}</p>
        <h1 class="category-landing__title">
          <BaseScribbleOutline>{{ (currentCategory ? categoryDisplayName(currentCategory) : '') }}</BaseScribbleOutline>
        </h1>
        <p v-if="currentCategory && categoryDisplayDescription(currentCategory)" class="category-landing__description">
          {{ categoryDisplayDescription(currentCategory) }}
        </p>
      </div>

      <BaseButton :to="goodsPath" variant="dark">
        {{ terms.catalog.allProducts }}
      </BaseButton>
    </div>

    <CatalogCategoryCards
      v-if="currentCategory?.children.length"
      :categories="currentCategory.children"
      :tree="categoryTree || []"
    />

    <FeedbackState v-else class="category-landing__empty" kind="empty" :seed="currentCategory?.slug" :title="terms.catalog.empty">
      <BaseButton :to="goodsPath" variant="outline-dark">
        {{ terms.catalog.toProducts }}
      </BaseButton>
    </FeedbackState>
  </section>
</template>

<style scoped>
.category-landing {
  display: grid;
  gap: 1.25rem;
}

.category-landing__head {
  display: grid;
  align-items: end;
  gap: 1rem;
  padding-bottom: 1.5rem;
}

.category-landing__title {
  margin-top: 0.375rem;
  color: #0a0a0a;
  font-size: clamp(2rem, 1.45rem + 2vw, 3.5rem);
  font-weight: 900;
  line-height: 0.95;
}

.category-landing__description {
  max-width: 42rem;
  margin-top: 0.75rem;
  color: #737373;
  font-size: 0.95rem;
  line-height: 1.7;
}

.category-landing__empty {
  border: 0;
  background: #ffffff;
  --feedback-state-surface: #ffffff;
  color: #0a0a0a;
}

@media (min-width: 768px) {
  .category-landing__head {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
</style>
