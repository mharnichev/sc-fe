<script setup lang="ts">
const props = defineProps<{ count: number }>()
const direction = ref<'up' | 'down'>('up')
const digits = computed(() => Array.from(String(props.count)).map((digit, index, values) => ({ digit, place: values.length - index })))
watch(() => props.count, (value, previous) => {
  direction.value = value >= previous ? 'up' : 'down'
}, { flush: 'sync' })
</script>

<template>
  <span class="nav-cart-counter">
    <span class="sr-only">{{ count }}</span>
    <span v-for="part in digits" :key="part.place" class="nav-cart-counter__digit" aria-hidden="true">
      <Transition :name="`nav-cart-${direction}`">
        <span :key="part.digit" class="nav-cart-counter__value">{{ part.digit }}</span>
      </Transition>
    </span>
  </span>
</template>

<style scoped>
.nav-cart-counter {
  display: inline-flex;
  font-variant-numeric: tabular-nums;
}

.nav-cart-counter__digit {
  display: inline-grid;
  overflow: hidden;
  width: 1ch;
  line-height: 1.2;
  text-align: center;
}

.nav-cart-counter__value { grid-area: 1 / 1; }

.nav-cart-up-enter-active,
.nav-cart-up-leave-active,
.nav-cart-down-enter-active,
.nav-cart-down-leave-active {
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 420ms ease;
}

.nav-cart-up-enter-from,
.nav-cart-down-leave-to { transform: translateY(100%); opacity: 0; }

.nav-cart-up-leave-to,
.nav-cart-down-enter-from { transform: translateY(-100%); opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .nav-cart-counter__value { transition: none; }
}
</style>
