<script setup lang="ts">
const props = defineProps<{
  text: string
}>()

const letters = computed(() => Array.from(props.text.toUpperCase()).map(letter => letter === ' ' ? '\u00A0' : letter))
</script>

<template>
  <span class="relative block overflow-hidden whitespace-nowrap leading-[1.05]">
    <span class="flex justify-start">
      <span
        v-for="(letter, index) in letters"
        :key="`base-${index}-${letter}`"
        class="inline-block transition-transform duration-300 ease-in-out group-hover:-translate-y-[125%]"
        :style="{ transitionDelay: `${index * 18}ms` }"
      >
        {{ letter }}
      </span>
    </span>
    <span class="pointer-events-none absolute inset-0 flex justify-start" aria-hidden="true">
      <span
        v-for="(letter, index) in letters"
        :key="`hover-${index}-${letter}`"
        class="inline-block translate-y-[125%] transition-transform duration-300 ease-in-out group-hover:translate-y-0"
        :style="{ transitionDelay: `${index * 18}ms` }"
      >
        {{ letter }}
      </span>
    </span>
  </span>
</template>
