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

const legacyCategoryPrefix = [
  'roboche-mistse',
  'roboche-mistse-profesiini-grebeni-ta-shchitki',
]
const standaloneCategorySlug = 'profesiini-grebeni-ta-shchitki'

if (legacyCategoryPrefix.every((segment, index) => routeSegments.value[index] === segment)) {
  const suffix = routeSegments.value.slice(legacyCategoryPrefix.length)
  const destination = `/${standaloneCategorySlug}/${suffix.length ? suffix.join('/') : 'goods'}/`
  await navigateTo(
    { path: destination, query: route.query, hash: route.hash },
    { redirectCode: 301, replace: true },
  )
}
</script>

<template>
  <CatalogCategoryGoodsRoute v-if="isGoodsRoute" :segments="categorySegments" />
  <CatalogCategoryLandingRoute v-else :segments="categorySegments" />
</template>
