<script setup lang="ts">
// Resolve a current catalog URL only on navigation, not once per history item.
definePageMeta({
  middleware: async (to) => {
    const id = Number(to.params.id)
    if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 404, statusMessage: 'Product unavailable' })
    const api = useApi()
    let product: { slug?: string }
    try { product = await api<{ slug?: string }>(`/public/products/${id}`, { retry: 0 }) }
    catch (error: unknown) {
      const code = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0
      throw createError({ statusCode: code === 404 || code === 403 ? 404 : 503, statusMessage: 'Product unavailable' })
    }
    if (!product.slug?.trim()) throw createError({ statusCode: 404, statusMessage: 'Product unavailable' })
    return navigateTo(`/products/${encodeURIComponent(product.slug)}`, { redirectCode: 302 })
  },
})
</script>
<template><span /></template>
