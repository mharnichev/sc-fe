<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: 'dark' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate'
  loading?: boolean
}>()

const toneClass = (tone?: string) => ({
  dark: 'bg-slate-950 text-white',
  cyan: 'bg-cyan-50 text-cyan-900',
  emerald: 'bg-emerald-50 text-emerald-900',
  amber: 'bg-amber-50 text-amber-900',
  rose: 'bg-rose-50 text-rose-900',
  slate: 'bg-white text-slate-900',
}[tone || 'slate'])
</script>

<template>
  <article class="min-h-24 rounded-[1.25rem] border border-slate-200 p-3 shadow-sm xl:min-h-32 xl:rounded-[1.75rem] xl:p-5" :class="toneClass(tone)">
    <div v-if="loading" class="animate-pulse space-y-3 xl:space-y-4">
      <div class="h-3 w-24 rounded bg-current/10 xl:h-4 xl:w-28" />
      <div class="h-7 w-32 rounded bg-current/10 xl:h-8 xl:w-36" />
      <div class="h-3 w-24 rounded bg-current/10" />
    </div>
    <template v-else>
      <p class="text-xs opacity-70 xl:text-sm">{{ label }}</p>
      <p class="mt-2 break-words text-2xl font-semibold leading-tight xl:mt-3 xl:text-3xl">{{ value }}</p>
      <p v-if="hint" class="mt-2 text-xs leading-4 opacity-70 xl:mt-3 xl:text-sm xl:leading-5">{{ hint }}</p>
    </template>
  </article>
</template>
