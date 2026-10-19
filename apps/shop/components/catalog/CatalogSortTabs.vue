<script setup lang="ts">
import { NuxtLink } from '#components'

interface CatalogTab {
  label: string
  value: string
  icon?: string
  iconClass?: string
  to?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  tabs?: CatalogTab[]
  ariaLabel?: string
}>(), {
  disabled: false,
  tabs: undefined,
  ariaLabel: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { terms } = useShopLocale()
const defaultTabs = computed<CatalogTab[]>(() => [
  { label: terms.value.catalog.cheaper, value: 'price', icon: 'simple-arrow-down', iconClass: 'catalog-sort-tabs__icon--down' },
  { label: terms.value.catalog.moreExpensive, value: '-price', icon: 'simple-arrow-down', iconClass: 'catalog-sort-tabs__icon--up' },
  { label: terms.value.catalog.popular, value: '-is_top', icon: 'star', iconClass: 'catalog-sort-tabs__icon--popular' },
])
const tabs = computed(() => props.tabs || defaultTabs.value)

const activeIndex = computed(() => tabs.value.findIndex(tab => tab.value === props.modelValue))
const hasActiveTab = computed(() => activeIndex.value >= 0)

const switchTab = (value: string) => {
  if (props.disabled) return
  emit('update:modelValue', props.modelValue === value ? '' : value)
}
</script>

<template>
  <div
    class="catalog-sort-tabs"
    :class="{
      'catalog-sort-tabs--disabled': disabled,
      'catalog-sort-tabs--empty': !hasActiveTab,
    }"
    :style="{ '--catalog-tab-index': activeIndex, '--catalog-tab-count': tabs.length }"
    role="tablist"
    :aria-label="ariaLabel || 'Сортування'"
  >
    <component
      v-for="tab in tabs"
      :key="tab.value"
      :is="tab.to ? NuxtLink : 'button'"
      class="catalog-sort-tabs__button"
      :class="{ 'catalog-sort-tabs__button--active': modelValue === tab.value }"
      :to="tab.to"
      :type="tab.to ? undefined : 'button'"
      role="tab"
      :aria-selected="modelValue === tab.value"
      :aria-current="modelValue === tab.value ? 'page' : undefined"
      :disabled="disabled"
      @click="switchTab(tab.value)"
    >
      <BaseIcon
        v-if="tab.icon"
        :name="tab.icon"
        size="xxs"
        class="catalog-sort-tabs__icon"
        :class="tab.iconClass"
      />
      <span class="catalog-sort-tabs__label">{{ tab.label }}</span>
    </component>
  </div>
</template>

<style scoped>
.catalog-sort-tabs {
  position: relative;
  display: grid;
  width: min(100%, 17.5rem);
  min-height: 2.25rem;
  grid-template-columns: repeat(var(--catalog-tab-count), minmax(0, 1fr));
  align-items: center;
  border: 0;
  border-radius: 0;
  background: #ffffff;
}

.catalog-sort-tabs::before {
  position: absolute;
  inset-block: 0;
  left: 0;
  z-index: 0;
  width: calc(100% / var(--catalog-tab-count));
  background: #0a0a0a;
  content: "";
  transform: translateX(calc(var(--catalog-tab-index) * 100%));
  transition:
    opacity 180ms ease,
    transform 300ms cubic-bezier(0.3, 1, 0.3, 1);
}

.catalog-sort-tabs--empty::before {
  opacity: 0;
}

.catalog-sort-tabs__button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  min-width: 0;
  min-height: 2.125rem;
  align-items: center;
  justify-content: center;
  gap: 0.1875rem;
  overflow: hidden;
  padding: 0.375rem 0.3rem;
  border: 0;
  background: transparent;
  color: #5d626c;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1.05;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 220ms ease,
    opacity 180ms ease;
}

.catalog-sort-tabs__button--active {
  color: #ffffff;
}

.catalog-sort-tabs__button:not(.catalog-sort-tabs__button--active):hover {
  color: #0a0a0a;
}

.catalog-sort-tabs__icon {
  flex: 0 0 auto;
  transition:
    filter 220ms ease,
    transform 220ms ease;
}

.catalog-sort-tabs :deep(.catalog-sort-tabs__icon.base-icon.base-icon--xxs) {
  width: 0.875rem;
  height: 0.875rem;
}

.catalog-sort-tabs__icon--up {
  transform: rotate(180deg);
}

.catalog-sort-tabs__button--active .catalog-sort-tabs__icon {
  filter: brightness(0) invert(1);
}

.catalog-sort-tabs__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-sort-tabs--disabled {
  opacity: 0.56;
}

.catalog-sort-tabs__button:focus-visible {
  outline: 2px solid #0a0a0a;
  outline-offset: 0.125rem;
}

@media (max-width: 575px) {
  .catalog-sort-tabs {
    width: min(100%, 16.75rem);
    min-height: 2.125rem;
  }

  .catalog-sort-tabs__button {
    min-height: 2rem;
    gap: 0.125rem;
    padding-inline: 0.25rem;
    font-size: 0.59375rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .catalog-sort-tabs::before,
  .catalog-sort-tabs__button,
  .catalog-sort-tabs__icon {
    transition: none;
  }
}
</style>
