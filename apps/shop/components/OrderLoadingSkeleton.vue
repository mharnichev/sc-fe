<script setup lang="ts">
defineProps<{ label: string, detail?: boolean }>()
</script>
<template>
  <div class="order-loading" role="status" :aria-label="label">
    <span class="sr-only">{{ label }}</span>
    <BaseSkeleton v-if="detail" height="5rem" radius=".5rem" />
    <div v-for="index in (detail ? 2 : 3)" :key="index" class="order-loading__card" aria-hidden="true">
      <div class="order-loading__head"><BaseSkeleton width="38%" height="1.75rem" radius=".35rem" /><BaseSkeleton width="25%" height="1.75rem" radius=".35rem" /></div>
      <div class="order-loading__product"><BaseSkeleton width="48px" height="48px" radius=".35rem" /><div class="order-loading__copy"><BaseSkeleton width="90%" height=".85rem" radius="999px" /><BaseSkeleton width="60%" height=".85rem" radius="999px" /></div></div>
      <BaseSkeleton width="68%" height=".85rem" radius="999px" />
      <BaseSkeleton v-if="detail" height="5rem" radius=".35rem" />
    </div>
  </div>
</template>
<style scoped>
.order-loading { display: grid; gap: .75rem; min-width: 0; }
.order-loading__card { display: grid; gap: 1rem; padding: .875rem; background: #f7f7f6; min-width: 0; }
.order-loading__head { display: flex; justify-content: space-between; gap: .75rem; }
.order-loading__product { display: flex; align-items: center; gap: .65rem; min-width: 0; }
.order-loading__copy { display: grid; gap: .6rem; flex: 1; min-width: 0; }
</style>
