<script setup lang="ts">
import type { CategoryTreeNodeDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'
import {
  categoryDestination,
  categoryGoodsPath,
  categoryLandingPath,
  categoryPathBySegments,
  type CategoryRouteCrumb,
} from '~/utils/category-routing'

const props = defineProps<{
  segments: string[]
}>()

const domain = useCatalogDomain()
const { terms } = useShopLocale()

const slugSegments = computed(() => props.segments.map(item => String(item || '')).filter(Boolean))

const { data: categoryTree } = await useAsyncData('shop-category-tree-catalog-routes', domain.getCategoryTree)
const categoryPath = computed(() => categoryPathBySegments(categoryTree.value || [], slugSegments.value))
const currentCategory = computed(() => categoryPath.value[categoryPath.value.length - 1] || null)

if (!slugSegments.value.length || !categoryPath.value.length || !currentCategory.value) {
  throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}

const breadcrumbs = computed<CategoryRouteCrumb[]>(() =>
  categoryPath.value.map((category, index, path) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    to: index < path.length - 1 ? categoryLandingPath(path.slice(0, index + 1)) : undefined,
  })),
)

const goodsPath = computed(() => categoryGoodsPath(categoryPath.value))
const childLink = (child: CategoryTreeNodeDto) =>
  categoryDestination(categoryTree.value || [], child)

useSeo(
  () => currentCategory.value?.name || terms.value.seo.catalogTitle,
  () => currentCategory.value?.description || terms.value.seo.catalogDescription,
)
</script>

<template>
  <section class="category-landing">
    <CatalogBreadcrumbs :items="breadcrumbs" />

    <div class="category-landing__head">
      <div>
        <p class="type-eyebrow type-eyebrow--wide text-xs">{{ terms.common.catalog }}</p>
        <h1 class="category-landing__title">
          <BaseScribbleOutline>{{ currentCategory?.name }}</BaseScribbleOutline>
        </h1>
        <p v-if="currentCategory?.description" class="category-landing__description">
          {{ currentCategory.description }}
        </p>
      </div>

      <BaseButton :to="goodsPath" variant="dark">
        {{ terms.catalog.allProducts }}
      </BaseButton>
    </div>

    <ul v-if="currentCategory?.children.length" class="category-landing__grid">
      <li v-for="child in currentCategory.children" :key="child.id">
        <NuxtLink class="category-landing__card" :to="childLink(child)">
          <span class="category-landing__card-icon">
            <BaseIcon name="catalog" size="xs" />
          </span>
          <span class="category-landing__card-body">
            <strong><BaseHoverUnderlineText>{{ child.name }}</BaseHoverUnderlineText></strong>
            <span v-if="child.description">{{ child.description }}</span>
            <span v-else>{{ child.children.length ? terms.catalog.sidebarFallbackTitle : terms.catalog.productsSuffix }}</span>
          </span>
          <BaseIcon name="chevron-right" size="xxs" />
        </NuxtLink>
      </li>
    </ul>

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
  border-bottom: 1px solid rgb(10 10 10 / 0.1);
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

.category-landing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: 0.75rem;
}

.category-landing__card {
  display: grid;
  min-height: 7rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.875rem;
  border: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  padding: 1rem;
  color: #0a0a0a;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.category-landing__card:hover,
.category-landing__card:focus-visible {
  border-color: rgb(10 10 10 / 0.22);
  box-shadow: 0 1rem 1.5rem rgb(10 10 10 / 0.08);
  transform: translateY(-0.125rem);
}

.category-landing__card-icon {
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  background: #f3f4f7;
  color: #0a0a0a;
}

.category-landing__card-body {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.category-landing__card-body strong {
  overflow: hidden;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-landing__card-body span {
  display: -webkit-box;
  overflow: hidden;
  color: #737373;
  font-size: 0.8125rem;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.category-landing__empty {
  border: 1px solid rgb(10 10 10 / 0.1);
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
