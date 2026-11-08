<script setup lang="ts">
const props = defineProps<{
  id: string
  label: string
  tabs: Array<{ value: string; label: string }>
}>()
const model = defineModel<string>({ required: true })
const tabList = ref<HTMLElement | null>(null)

const navigate = (event: KeyboardEvent, index: number) => {
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % props.tabs.length
  else if (event.key === 'ArrowLeft') next = (index - 1 + props.tabs.length) % props.tabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = props.tabs.length - 1
  else return
  event.preventDefault()
  model.value = props.tabs[next]!.value
  void nextTick(() => tabList.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus())
}
</script>

<template>
  <div ref="tabList" class="base-tabs" role="tablist" :aria-label="label">
    <BaseButton
      v-for="(tab, index) in tabs"
      :id="`${id}-tab-${tab.value}`"
      :key="tab.value"
      type="button"
      variant="text"
      role="tab"
      :aria-selected="model === tab.value"
      :aria-controls="`${id}-panel-${tab.value}`"
      :tabindex="model === tab.value ? 0 : -1"
      @click="model = tab.value"
      @keydown="navigate($event, index)"
    >{{ tab.label }}</BaseButton>
  </div>
</template>

<style scoped>
.base-tabs {
  display: flex;
  min-width: 0;
  gap: 0.25rem;
  border-bottom: 1px solid #e5e5e5;
}
.base-tabs .sc-button {
  min-width: 0;
  text-decoration: none;
  flex: 1;
  padding-inline: 0.4rem;
  padding-bottom: 8px;
  border-radius: 0;
  border-bottom: 2px solid transparent;
}
.base-tabs .sc-button[aria-selected="true"] {
  border-bottom-color: currentColor;
}
</style>
