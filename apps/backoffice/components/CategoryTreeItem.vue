<script setup lang="ts">
import { FolderOpenIcon, TagIcon } from '@heroicons/vue/24/outline'
import type { Category, CategoryTreeNode } from '~/composables/useBackofficeApi'

const props = withDefaults(defineProps<{
  node: CategoryTreeNode
  pendingIds?: Set<number>
  depth?: number
}>(), {
  pendingIds: () => new Set<number>(),
  depth: 0,
})

const emit = defineEmits<{
  toggle: [category: Category]
}>()

const visibilityLabel = computed(() => {
  if (props.node.is_effectively_visible) return 'Показана'
  if (props.node.hidden_reason === 'parent_category') return 'Прихована батьківською категорією'
  return 'Прихована вручну'
})

const visibilityTone = computed(() => props.node.is_effectively_visible ? 'success' : 'neutral')
const childCountLabel = computed(() => {
  const count = props.node.children.length
  if (!count) return 'Без підкатегорій'
  if (count === 1) return '1 підкатегорія'
  if (count < 5) return `${count} підкатегорії`
  return `${count} підкатегорій`
})

const handleVisibilityChange = (event: Event) => {
  // The refreshed API tree remains authoritative while the parent handles confirmation.
  (event.target as HTMLInputElement).checked = props.node.is_active
  emit('toggle', props.node)
}
</script>

<template>
  <article class="category-tree-node" :class="{ 'is-root': depth === 0, 'is-muted': !node.is_effectively_visible }">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <span class="category-tree-node__icon">
          <FolderOpenIcon v-if="node.children.length" class="h-5 w-5" aria-hidden="true" />
          <TagIcon v-else class="h-4 w-4" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-semibold text-ui-primary">{{ node.name }}</p>
            <span class="category-tree-node__level">Рівень {{ depth + 1 }}</span>
          </div>
          <p class="mt-0.5 text-xs text-ui-muted">{{ node.slug }}</p>
          <p class="mt-1 text-xs text-ui-secondary">{{ childCountLabel }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <BaseBadge :tone="visibilityTone">{{ visibilityLabel }}</BaseBadge>
            <BaseBadge :tone="node.is_active ? 'success' : 'neutral'">
              {{ node.is_active ? 'активна' : 'неактивна' }}
            </BaseBadge>
          </div>
        </div>
      </div>
      <BaseToggle
        :checked="node.is_active"
        :loading="pendingIds.has(node.id)"
        :aria-label="`${node.is_active ? 'Приховати' : 'Показати'} категорію ${node.name}`"
        @change="handleVisibilityChange"
      />
    </div>
    <div v-if="node.children.length" class="category-tree-children">
      <p class="category-tree-children__label">Вкладені в «{{ node.name }}»</p>
      <CategoryTreeItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :pending-ids="pendingIds"
        :depth="depth + 1"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </article>
</template>
