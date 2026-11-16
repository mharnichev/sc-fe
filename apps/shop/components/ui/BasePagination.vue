<script setup lang="ts">
import { NuxtLink } from '#components'
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(defineProps<{
  total: number
  limit: number
  offset: number
  disabled?: boolean
  ariaLabel?: string
  pageRoute?: (page: number) => RouteLocationRaw
}>(), {
  disabled: false,
  ariaLabel: '',
})

const { locale, terms } = useShopLocale()

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / Math.max(props.limit, 1))))
const currentPage = computed(() => Math.floor(props.offset / Math.max(props.limit, 1)) + 1)
const visiblePages = computed(() => {
  const pages = new Set<number>([1, pageCount.value, currentPage.value])
  for (let page = currentPage.value - 1; page <= currentPage.value + 1; page += 1) {
    if (page > 0 && page <= pageCount.value) pages.add(page)
  }

  return [...pages].sort((first, second) => first - second)
})

const isDisabled = (page: number) =>
  props.disabled || page < 1 || page > pageCount.value || page === currentPage.value

const pageLink = (page: number) => isDisabled(page) ? undefined : props.pageRoute?.(page)

const pageControl = (page: number) => {
  const to = pageLink(page)
  return to ? { to, prefetch: false }
    : { type: 'button', disabled: isDisabled(page), onClick: () => emit('update:page', page) }
}
</script>

<template>
  <nav v-if="pageCount > 1" class="base-pagination" :aria-label="ariaLabel || (locale === 'en' ? 'Pagination' : 'Пагінація')">
    <component
      class="base-pagination__button"
      :is="pageLink(currentPage - 1) ? NuxtLink : 'button'"
      v-bind="pageControl(currentPage - 1)"
      :aria-label="terms.cabinet.previousPageLabel"
    >
      <BaseIcon name="chevron-left" size="xxs" />
    </component>

    <template v-for="(page, index) in visiblePages" :key="page">
      <span v-if="index > 0 && page - visiblePages[index - 1] > 1" class="base-pagination__ellipsis">...</span>
      <component
        class="base-pagination__page"
        :class="{ 'base-pagination__page--active': page === currentPage }"
        :is="pageLink(page) ? NuxtLink : 'button'"
        v-bind="pageControl(page)"
        :aria-label="`${terms.cabinet.pageLabel} ${page}`"
        :aria-current="page === currentPage ? 'page' : undefined"
      >
        {{ page }}
      </component>
    </template>

    <component
      class="base-pagination__button"
      :is="pageLink(currentPage + 1) ? NuxtLink : 'button'"
      v-bind="pageControl(currentPage + 1)"
      :aria-label="terms.cabinet.nextPageLabel"
    >
      <BaseIcon name="chevron-right" size="xxs" />
    </component>
  </nav>
</template>

<style scoped>
.base-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding-top: 1rem;
}

.base-pagination__button,
.base-pagination__page {
  display: inline-flex;
  min-width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border: 0;
  background: #ffffff;
  color: #0a0a0a;
  font-size: 0.875rem;
  font-weight: 800;
  text-decoration: none;
  transition:
    background-color 180ms ease,
    color 180ms ease;
}

.base-pagination__button:disabled,
.base-pagination__page:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.base-pagination__page--active,
.base-pagination__page--active:disabled {
  background: #0a0a0a;
  color: #ffffff;
  opacity: 1;
}

.base-pagination__ellipsis {
  min-width: 1.5rem;
  color: #737373;
  text-align: center;
}
</style>
