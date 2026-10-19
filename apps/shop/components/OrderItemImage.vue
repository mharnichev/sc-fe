<script setup lang="ts">
const props = defineProps<{ src?: string | null, name?: string | null }>()
const failed = ref(false)
const config = useRuntimeConfig()
const source = computed(() => {
  const value = props.src?.trim() || ''
  if (value.startsWith('/media/')) {
    try { return new URL(value, config.public.apiBase).href } catch { return value }
  }
  return /^(https?:\/\/|\/(?!\/))/i.test(value) ? value : ''
})
watch(() => props.src, () => { failed.value = false })
</script>
<template>
  <span class="order-item-image">
    <img v-if="source && !failed" :src="source" :alt="name || ''" loading="lazy" decoding="async" width="64" height="64" @error="failed = true">
    <svg v-else aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>
  </span>
</template>
<style scoped>
.order-item-image { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; flex: 0 0 64px; background: transparent; border: 0; border-radius: 0; color: #737373; overflow: hidden; }
.order-item-image img { width: 100%; height: 100%; object-fit: cover; }
</style>
