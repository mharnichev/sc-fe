<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{ total: number, limit: number, offset: number, disabled?: boolean, pageRoute?: (page: number) => RouteLocationRaw }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
</script>
<template>
  <BasePagination v-bind="props" class="catalog-pagination" @update:page="emit('update:page', $event)" />
</template>
