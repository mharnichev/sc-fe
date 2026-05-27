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
  <article class="min-h-32 rounded-[1.75rem] border border-slate-200 p-5 shadow-sm" :class="toneClass(tone)">
    <div v-if="loading" class="animate-pulse space-y-4">
      <div class="h-4 w-28 rounded bg-current/10" />
      <div class="h-8 w-36 rounded bg-current/10" />
      <div class="h-3 w-24 rounded bg-current/10" />
    </div>
    <template v-else>
      <p class="text-sm opacity-70">{{ label }}</p>
      <p class="mt-3 break-words text-3xl font-semibold leading-tight">{{ value }}</p>
      <p v-if="hint" class="mt-3 text-sm leading-5 opacity-70">{{ hint }}</p>
    </template>
  </article>
</template>
