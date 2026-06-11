<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: 'dark' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate'
  loading?: boolean
}>()

const toneClass = (tone?: string) => `statistics-stat-card--${tone || 'slate'}`
</script>

<template>
  <article class="statistics-stat-card liquid-glass liquid-glass-hover min-h-24 rounded-[1.25rem] p-3 xl:min-h-32 xl:rounded-[1.75rem] xl:p-5" :class="toneClass(tone)">
    <div v-if="loading" class="animate-pulse space-y-3 xl:space-y-4">
      <div class="h-3 w-24 rounded bg-current/10 xl:h-4 xl:w-28" />
      <div class="h-7 w-32 rounded bg-current/10 xl:h-8 xl:w-36" />
      <div class="h-3 w-24 rounded bg-current/10" />
    </div>
    <template v-else>
      <p class="statistics-stat-card__label text-xs xl:text-sm">{{ label }}</p>
      <p class="statistics-stat-card__value mt-2 break-words text-3xl font-semibold leading-tight xl:mt-3 xl:text-4xl">{{ value }}</p>
      <p v-if="hint" class="statistics-stat-card__hint mt-2 text-xs leading-4 xl:mt-3 xl:text-sm xl:leading-5">{{ hint }}</p>
    </template>
  </article>
</template>
