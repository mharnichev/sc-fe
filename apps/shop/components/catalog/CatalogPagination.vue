<script setup lang="ts">
const props = defineProps<{ total: number, limit: number, offset: number, disabled?: boolean }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
</script>
<template>
  <BasePagination v-bind="props" class="catalog-pagination" @update:page="emit('update:page', $event)" />
</template>
