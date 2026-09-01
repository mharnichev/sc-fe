<script setup lang="ts">
import type { Category, CategoryTreeNode } from '~/composables/useBackofficeApi'

const props = withDefaults(defineProps<{
  node: CategoryTreeNode
  pendingIds?: Set<number>
}>(), {
  pendingIds: () => new Set<number>(),
})

const emit = defineEmits<{
  toggle: [category: Category]
}>()

const visibilityLabel = computed(() => {
  if (props.node.is_effectively_visible) return 'Показана'
  if (props.node.hidden_reason === 'parent_category') return 'Прихована батьківською категорією'
  return 'Прихована вручну'
})

const toggleLabel = computed(() => props.node.is_active ? 'Приховати' : 'Показати')
const visibilityTone = computed(() => props.node.is_effectively_visible ? 'success' : 'neutral')
</script>

<template>
  <article class="rounded-2xl bg-slate-50 px-4 py-3" :class="{ 'opacity-65': !node.is_effectively_visible }">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-medium text-slate-900">{{ node.name }}</p>
        <p class="text-xs text-slate-500">{{ node.slug }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <BaseBadge :tone="visibilityTone">{{ visibilityLabel }}</BaseBadge>
          <BaseBadge :tone="node.is_active ? 'success' : 'neutral'">
            {{ node.is_active ? 'активна' : 'неактивна' }}
          </BaseBadge>
        </div>
      </div>
      <BaseButton
        type="button"
        variant="neutral"
        size="sm"
        :loading="pendingIds.has(node.id)"
        :loading-label="node.is_active ? 'Приховуємо…' : 'Показуємо…'"
        :aria-label="`${toggleLabel} категорію ${node.name}`"
        @click="emit('toggle', node)"
      >
        {{ toggleLabel }}
      </BaseButton>
    </div>
    <div v-if="node.children.length" class="mt-3 space-y-2 border-l border-slate-200 pl-4">
      <CategoryTreeItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :pending-ids="pendingIds"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </article>
</template>
