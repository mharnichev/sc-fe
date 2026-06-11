<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: 'dark' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate'
  loading?: boolean
}>()

const toneClass = (tone?: string) => ({
  dark: 'bg-white/[0.085] text-white',
  cyan: 'bg-white/[0.07] text-white',
  emerald: 'bg-emerald-400/12 text-white',
  amber: 'bg-yellow-300/12 text-white',
  rose: 'bg-red-400/12 text-white',
  slate: 'bg-white/[0.06] text-white',
}[tone || 'slate'])
</script>

<template>
  <article class="liquid-glass liquid-glass-hover min-h-24 rounded-[1.25rem] p-3 xl:min-h-32 xl:rounded-[1.75rem] xl:p-5" :class="toneClass(tone)">
    <div v-if="loading" class="animate-pulse space-y-3 xl:space-y-4">
      <div class="h-3 w-24 rounded bg-current/10 xl:h-4 xl:w-28" />
      <div class="h-7 w-32 rounded bg-current/10 xl:h-8 xl:w-36" />
      <div class="h-3 w-24 rounded bg-current/10" />
    </div>
    <template v-else>
      <p class="text-xs text-white/50 xl:text-sm">{{ label }}</p>
      <p class="mt-2 break-words text-3xl font-semibold leading-tight text-white xl:mt-3 xl:text-4xl">{{ value }}</p>
      <p v-if="hint" class="mt-2 text-xs leading-4 opacity-70 xl:mt-3 xl:text-sm xl:leading-5">{{ hint }}</p>
    </template>
  </article>
</template>
