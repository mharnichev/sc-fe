<script setup lang="ts">
import type { Component } from 'vue'
import { useId } from 'vue'

export type BaseTabValue = string | number
export interface BaseTabOption {
  value: BaseTabValue
  label: string
  description?: string
  icon?: Component
  disabled?: boolean
}

const props = defineProps<{
  modelValue: BaseTabValue
  tabs: BaseTabOption[]
  id?: string
  ariaLabel?: string
  listClass?: string
  tabClass?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BaseTabValue]
}>()

const listRef = ref<HTMLElement | null>(null)
const generatedId = useId()
const baseId = computed(() => props.id || `base-tabs-${generatedId.replace(/:/g, '')}`)
const activeIndex = computed(() => Math.max(0, props.tabs.findIndex(tab => tab.value === props.modelValue)))
const tabId = (index: number) => `${baseId.value}-tab-${index}`
const panelId = (index: number) => `${baseId.value}-panel-${index}`
const activeTabId = computed(() => tabId(activeIndex.value))
const activePanelId = computed(() => panelId(activeIndex.value))

const selectTab = (tab: BaseTabOption) => {
  if (!tab.disabled) emit('update:modelValue', tab.value)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const buttons = Array.from(listRef.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') || [])
  if (!buttons.length) return

  event.preventDefault()
  const currentIndex = Math.max(0, buttons.indexOf(event.target as HTMLButtonElement))
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? buttons.length - 1
      : event.key === 'ArrowRight'
        ? (currentIndex + 1) % buttons.length
        : (currentIndex - 1 + buttons.length) % buttons.length
  const nextButton = buttons[nextIndex]
  const tabIndex = Number(nextButton?.dataset.tabIndex)
  const nextTab = props.tabs[tabIndex]
  if (!nextButton || !nextTab) return

  emit('update:modelValue', nextTab.value)
  nextButton.focus()
}
</script>

<template>
  <div class="base-tabs">
    <div
      ref="listRef"
      class="base-tabs__list"
      :class="listClass"
      role="tablist"
      :aria-label="ariaLabel"
      @keydown="handleKeydown"
    >
      <BaseButton
        v-for="(tab, index) in tabs"
        :id="tabId(index)"
        :key="String(tab.value)"
        type="button"
        variant="unstyled"
        class="base-tabs__tab"
        :class="[{ 'is-active': modelValue === tab.value }, tabClass]"
        role="tab"
        :data-tab-index="index"
        :aria-selected="modelValue === tab.value"
        :aria-controls="panelId(index)"
        :tabindex="modelValue === tab.value ? 0 : -1"
        :disabled="tab.disabled"
        @click="selectTab(tab)"
      >
        <slot name="tab" :tab="tab" :active="modelValue === tab.value">
          <component :is="tab.icon" v-if="tab.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 text-left">
            <span class="block truncate">{{ tab.label }}</span>
            <span v-if="tab.description" class="base-tabs__description block truncate">{{ tab.description }}</span>
          </span>
        </slot>
      </BaseButton>
    </div>

    <slot :active-tab="modelValue" :panel-id="activePanelId" :tab-id="activeTabId" />
  </div>
</template>
