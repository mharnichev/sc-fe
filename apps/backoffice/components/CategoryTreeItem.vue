<script setup lang="ts">
import type { CategoryTreeNode } from '~/composables/useBackofficeApi'

defineProps<{
  node: CategoryTreeNode
}>()
</script>

<template>
  <article class="rounded-2xl bg-slate-50 px-4 py-3">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="font-medium text-slate-900">{{ node.name }}</p>
        <p class="text-xs text-slate-500">{{ node.slug }}</p>
      </div>
      <span class="rounded-full px-3 py-1 text-xs font-medium" :class="node.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
        {{ node.is_active ? 'активний' : 'неактивний' }}
      </span>
    </div>
    <div v-if="node.children.length" class="mt-3 space-y-2 border-l border-slate-200 pl-4">
      <CategoryTreeItem v-for="child in node.children" :key="child.id" :node="child" />
    </div>
  </article>
</template>
