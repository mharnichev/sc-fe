<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{ to?: RouteLocationRaw }>()
const { localePath } = useTerms()
const localizedTo = computed(() => {
  if (typeof props.to === 'string') return localePath(props.to)
  if (props.to && 'path' in props.to && props.to.path) return { ...props.to, path: localePath(props.to.path) }
  return props.to
})
</script>

<template>
  <NuxtLink :to="localizedTo"><slot /></NuxtLink>
</template>
