<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  caption?: string
  loading?: boolean
  loadingLabel?: string
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  dense?: boolean
  wrapperClass?: string
  scrollClass?: string
  minWidth?: string
  tableClass?: string
}>(), {
  loadingLabel: 'Завантаження даних…',
  emptyTitle: 'Немає даних',
  minWidth: '44rem',
})

const attrs = useAttrs()
const tableId = useId()
const captionId = computed(() => `${tableId}-caption`)
const scrollHintId = computed(() => `${tableId}-scroll-hint`)
const passthroughAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
const attrsClass = computed(() => attrs.class)
const attrsStyle = computed(() => attrs.style)
</script>

<template>
  <div
    class="w-full min-w-0 max-w-full overflow-hidden rounded-[1.5rem] border border-ui bg-ui-surface"
    :class="wrapperClass"
    :aria-busy="loading || undefined"
  >
    <div v-if="loading">
      <BaseLoader :label="loadingLabel" />
    </div>
    <BaseEmptyState
      v-else-if="empty"
      :title="emptyTitle"
      :description="emptyDescription"
    >
      <template v-if="$slots.emptyIcon" #icon>
        <slot name="emptyIcon" />
      </template>
      <template v-if="$slots.emptyActions" #actions>
        <slot name="emptyActions" />
      </template>
    </BaseEmptyState>
    <div
      v-else
      class="base-table__scroll min-w-0 max-w-full overflow-x-auto"
      :class="scrollClass"
      role="region"
      :aria-label="caption ? undefined : 'Прокручувана таблиця'"
      :aria-labelledby="caption ? captionId : undefined"
      :aria-describedby="scrollHintId"
      tabindex="0"
    >
      <p :id="scrollHintId" class="sr-only">
        На вузькому екрані таблицю можна прокручувати горизонтально.
      </p>
      <table
        v-bind="passthroughAttrs"
        class="base-table text-sm"
        :class="[dense ? 'base-table--dense' : '', tableClass, attrsClass]"
        :style="[attrsStyle, { minWidth }]"
      >
        <caption v-if="caption" :id="captionId" class="sr-only">{{ caption }}</caption>
        <thead v-if="$slots.head">
          <slot name="head" />
        </thead>
        <tbody>
          <slot />
        </tbody>
      </table>
    </div>
    <p
      v-if="!loading && !empty"
      class="base-table__mobile-hint items-center justify-center gap-2 border-t border-ui px-3 py-2 text-center text-xs text-ui-muted"
      aria-hidden="true"
    >
      <span>←</span>
      Проведіть горизонтально, щоб переглянути всі колонки
      <span>→</span>
    </p>
  </div>
</template>
