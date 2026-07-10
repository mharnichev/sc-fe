<script setup lang="ts">
const route = useRoute()

const routeSegments = computed(() => {
  const raw = route.params.slug
  return (Array.isArray(raw) ? raw : [raw]).map(item => String(item || '')).filter(Boolean)
})

const isGoodsRoute = computed(() => routeSegments.value[routeSegments.value.length - 1] === 'goods')
const categorySegments = computed(() =>
  isGoodsRoute.value ? routeSegments.value.slice(0, -1) : routeSegments.value,
)
</script>

<template>
  <CatalogCategoryGoodsRoute v-if="isGoodsRoute" :segments="categorySegments" />
  <CatalogCategoryLandingRoute v-else :segments="categorySegments" />
</template>
