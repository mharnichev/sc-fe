<script setup lang="ts">
const { terms } = useTerms()
</script>

<template>
  <section class="h-[55vh] min-h-[28rem] overflow-hidden bg-neutral-950" data-reveal="image">
    <img
      src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1800&q=80"
      :alt="terms.home.imageBreakAlt"
      class="h-full w-full object-cover opacity-85"
      loading="lazy"
    >
  </section>
</template>
