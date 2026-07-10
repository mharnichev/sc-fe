<script setup lang="ts">
const props = withDefaults(defineProps<{
  total: number
  limit: number
  offset: number
  disabled?: boolean
}>(), {
  disabled: false,
})

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

const goToPage = (page: number) => {
  if (props.disabled || page < 1 || page > pageCount.value || page === currentPage.value) return
  emit('update:page', page)
}
</script>

<template>
  <nav v-if="pageCount > 1" class="catalog-pagination" aria-label="Pagination">
    <button
      class="catalog-pagination__button"
      type="button"
      :disabled="disabled || currentPage <= 1"
      @click="goToPage(currentPage - 1)"
    >
      <BaseIcon name="chevron-left" size="xxs" />
    </button>

    <template v-for="(page, index) in visiblePages" :key="page">
      <span v-if="index > 0 && page - visiblePages[index - 1] > 1" class="catalog-pagination__ellipsis">...</span>
      <button
        class="catalog-pagination__page"
        :class="{ 'catalog-pagination__page--active': page === currentPage }"
        type="button"
        :aria-current="page === currentPage ? 'page' : undefined"
        :disabled="disabled || page === currentPage"
        @click="goToPage(page)"
      >
        {{ page }}
      </button>
    </template>

    <button
      class="catalog-pagination__button"
      type="button"
      :disabled="disabled || currentPage >= pageCount"
      @click="goToPage(currentPage + 1)"
    >
      <BaseIcon name="chevron-right" size="xxs" />
    </button>
  </nav>
</template>

<style scoped>
.catalog-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding-top: 1rem;
}

.catalog-pagination__button,
.catalog-pagination__page {
  display: inline-flex;
  min-width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(10 10 10 / 0.12);
  background: #ffffff;
  color: #0a0a0a;
  font-size: 0.875rem;
  font-weight: 800;
  transition:
    background-color 180ms ease,
    color 180ms ease,
    border-color 180ms ease;
}

.catalog-pagination__button:disabled,
.catalog-pagination__page:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.catalog-pagination__page--active {
  border-color: #0a0a0a;
  background: #0a0a0a;
  color: #ffffff;
  opacity: 1;
}

.catalog-pagination__ellipsis {
  min-width: 1.5rem;
  color: #737373;
  text-align: center;
}
</style>
