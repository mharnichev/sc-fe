<script setup lang="ts">
withDefaults(defineProps<{
  name?: string
  mode?: 'out-in' | 'in-out' | 'default'
  appear?: boolean
}>(), {
  name: 'app-fade-slide',
  mode: 'out-in',
  appear: false,
})
</script>

<template>
  <Transition :name="name" :mode="mode === 'default' ? undefined : mode" :appear="appear">
    <slot />
  </Transition>
</template>

<style>
.app-fade-slide-enter-active,
.app-fade-slide-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.app-fade-slide-enter-from {
  opacity: 0;
  transform: translateY(0.75rem);
}

.app-fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}
</style>
