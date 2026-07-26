<script setup lang="ts">
import type { CategoryRouteCrumb } from '~/utils/category-routing'

withDefaults(defineProps<{
  items: CategoryRouteCrumb[]
  pending?: boolean
}>(), {
  pending: false,
})

const { terms } = useShopLocale()
const skeletonWidths = ['4.5rem', '7rem', '5.5rem']
</script>

<template>
  <nav class="catalog-breadcrumbs" aria-label="Breadcrumbs" :aria-busy="pending || undefined">
    <ol v-if="pending" class="catalog-breadcrumbs__list" aria-hidden="true">
      <li class="catalog-breadcrumbs__home">
        <BaseSkeleton width="1.25rem" height="1.25rem" radius="0.125rem" />
        <BaseIcon class="catalog-breadcrumbs__separator" name="chevron-right" size="xxs" />
      </li>

      <li
        v-for="(width, index) in skeletonWidths"
        :key="width"
        class="catalog-breadcrumbs__item"
      >
        <BaseSkeleton :width="width" height="0.875rem" radius="0.125rem" />
        <BaseIcon
          v-if="index < skeletonWidths.length - 1"
          class="catalog-breadcrumbs__separator"
          name="chevron-right"
          size="xxs"
        />
      </li>
    </ol>

    <ol v-else class="catalog-breadcrumbs__list">
      <li class="catalog-breadcrumbs__home">
        <NuxtLink class="catalog-breadcrumbs__home-link" to="/" :aria-label="terms.common.main">
          <BaseIcon name="home" size="xxs" />
        </NuxtLink>
        <BaseIcon class="catalog-breadcrumbs__separator" name="chevron-right" size="xxs" />
      </li>

      <li v-for="(item, index) in items" :key="item.id || item.slug" class="catalog-breadcrumbs__item">
        <NuxtLink v-if="item.to" class="catalog-breadcrumbs__link" :to="item.to">
          <BaseHoverUnderlineText>{{ item.name }}</BaseHoverUnderlineText>
        </NuxtLink>
        <span v-else class="catalog-breadcrumbs__current">{{ item.name }}</span>
        <BaseIcon
          v-if="index < items.length - 1"
          class="catalog-breadcrumbs__separator"
          name="chevron-right"
          size="xxs"
        />
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.catalog-breadcrumbs {
  padding: 0.5rem 0;
}

.catalog-breadcrumbs__list {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.catalog-breadcrumbs__list::-webkit-scrollbar {
  display: none;
}

.catalog-breadcrumbs__home,
.catalog-breadcrumbs__item {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.125rem;
  min-width: 0;
}

.catalog-breadcrumbs__home-link,
.catalog-breadcrumbs__link {
  display: inline-flex;
  align-items: center;
  color: #0a0a0a;
}

.catalog-breadcrumbs__link,
.catalog-breadcrumbs__current {
  max-width: min(52vw, 18rem);
  overflow: hidden;
  font-size: 0.875rem;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-breadcrumbs__current {
  color: #737373;
}

.catalog-breadcrumbs__separator {
  color: #a3a3a3;
}
</style>
