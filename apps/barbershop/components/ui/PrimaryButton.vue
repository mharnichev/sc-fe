<template>
  <BaseButton :to="to" v-bind="$attrs">
    <slot />
  </BaseButton>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

defineProps<{
  to: string
}>()
</script>
