<script setup lang="ts">
interface ScheduleMatrixDay {
  date: string
  isToday: boolean
}

const props = withDefaults(defineProps<{
  caption: string
  days: ScheduleMatrixDay[]
  leadingSize?: 'default' | 'compact'
}>(), {
  leadingSize: 'default',
})

const leadingHeaderClass = computed(() => props.leadingSize === 'compact'
  ? 'schedule-matrix__header schedule-matrix__edge schedule-matrix__edge--leading sticky left-0 top-0 z-[80] w-16 min-w-16 max-w-16 border-b border-r border-ui !px-1 !py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-ui-muted md:w-auto md:min-w-32 md:max-w-none md:!px-2 md:text-left'
  : 'schedule-matrix__header schedule-matrix__edge schedule-matrix__edge--leading sticky left-0 top-0 z-[80] w-16 min-w-16 max-w-16 border-b border-r border-ui !px-1 !py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-ui-muted md:w-auto md:min-w-56 md:max-w-none md:!px-4 md:text-left')
const dayHeaderClass = 'schedule-matrix__header sticky top-0 z-[60] min-w-36 border-b border-r border-ui !px-2 !py-2 !text-center'
const trailingHeaderClass = 'schedule-matrix__header schedule-matrix__edge schedule-matrix__edge--trailing sticky right-0 top-0 z-[80] w-16 min-w-16 max-w-16 border-b border-ui !px-1 !py-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-ui-muted md:w-auto md:min-w-44 md:max-w-none md:!px-3 md:text-left'
const leadingCellClass = computed(() => props.leadingSize === 'compact'
  ? 'schedule-matrix__edge schedule-matrix__edge--leading sticky left-0 z-50 w-16 min-w-16 max-w-16 border-b border-r border-ui px-1 py-2 text-left md:w-auto md:min-w-32 md:max-w-none md:px-2'
  : 'schedule-matrix__edge schedule-matrix__edge--leading sticky left-0 z-50 w-16 min-w-16 max-w-16 border-b border-r border-ui px-1 py-2 text-left md:w-auto md:min-w-56 md:max-w-none md:px-4')
const dayCellClass = 'min-w-36 border-b border-r border-ui bg-ui-surface !p-1.5 !align-top'
const trailingCellClass = 'schedule-matrix__edge schedule-matrix__edge--trailing sticky right-0 z-50 w-16 min-w-16 max-w-16 border-b border-ui px-1 py-2 md:w-auto md:min-w-44 md:max-w-none md:px-3'
const todayCellClass = 'schedule-matrix__today'
</script>

<template>
  <BaseTable
    :caption="caption"
    wrapper-class="rounded-none border-0"
    scroll-class="max-h-[72dvh] overflow-auto"
    min-width="max-content"
    table-class="!border-separate border-spacing-0 text-left"
  >
    <template #head>
      <tr>
        <th :class="leadingHeaderClass">
          <slot name="leading-header" />
        </th>
        <th
          v-for="day in days"
          :key="day.date"
          :class="[dayHeaderClass, day.isToday ? todayCellClass : '']"
        >
          <slot name="day-header" :day="day" />
        </th>
        <th :class="trailingHeaderClass">
          <slot name="trailing-header" />
        </th>
      </tr>
    </template>

    <slot
      :leading-cell-class="leadingCellClass"
      :day-cell-class="dayCellClass"
      :trailing-cell-class="trailingCellClass"
      :today-cell-class="todayCellClass"
    />
  </BaseTable>
</template>

<style>
.schedule-matrix__header {
  background: var(--bo-surface);
  background: color-mix(in srgb, var(--bo-surface) 93%, var(--bo-text-primary) 7%);
}

.schedule-matrix__edge {
  background: var(--bo-surface);
}

.schedule-matrix__edge--leading {
  box-shadow: 8px 0 12px -12px color-mix(in srgb, var(--bo-text-primary) 45%, transparent);
}

.schedule-matrix__edge--trailing {
  box-shadow: -8px 0 12px -12px color-mix(in srgb, var(--bo-text-primary) 45%, transparent);
}

.schedule-matrix__today {
  background: color-mix(in srgb, var(--bo-surface) 88%, var(--bo-accent) 12%) !important;
}
</style>
