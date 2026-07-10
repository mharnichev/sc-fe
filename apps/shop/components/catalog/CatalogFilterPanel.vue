<script setup lang="ts">
import type { CategoryFilterGroupDto, CategoryFiltersDto } from '@shared-types'

interface SelectOption {
  label: string
  value: string | number
}

const props = withDefaults(defineProps<{
  groups: CategoryFilterGroupDto[]
  price?: CategoryFiltersDto['price'] | null
  selectedFilters: Record<string, string[]>
  priceMin: string
  priceMax: string
  pending?: boolean
  disabled?: boolean
  showCatalogControls?: boolean
  showPrice?: boolean
  query?: string
  category?: string
  brand?: string
  categoryOptions?: SelectOption[]
  brandOptions?: SelectOption[]
}>(), {
  price: null,
  pending: false,
  disabled: false,
  showCatalogControls: false,
  showPrice: true,
  query: '',
  category: '',
  brand: '',
  categoryOptions: () => [],
  brandOptions: () => [],
})

const emit = defineEmits<{
  'update:priceMin': [value: string]
  'update:priceMax': [value: string]
  'update:query': [value: string]
  'update:category': [value: string]
  'update:brand': [value: string]
  'price-change': []
  'toggle-filter': [group: string, value: string, checked: boolean]
  'remove-filter': [group: string, value: string]
  clear: []
}>()

const { terms } = useShopLocale()
const expandedGroups = ref<Record<string, boolean>>({})
const DEFAULT_VISIBLE_VALUES = 5

const selectedEntries = computed(() =>
  Object.entries(props.selectedFilters)
    .flatMap(([groupSlug, values]) => values.map(valueSlug => ({ groupSlug, valueSlug }))),
)

const selectedCount = computed(() => selectedEntries.value.length)
const hasCatalogFilters = computed(() => Boolean(props.query || props.category || props.brand))

const selectedLabel = (groupSlug: string, valueSlug: string) => {
  const group = props.groups.find(item => item.slug === groupSlug)
  const value = group?.values.find(item => item.slug === valueSlug)
  return {
    group: group?.name || groupSlug,
    value: value?.name || valueSlug,
  }
}

const isSelected = (groupSlug: string, valueSlug: string) =>
  Boolean(props.selectedFilters[groupSlug]?.includes(valueSlug))

const isDisabled = (groupSlug: string, valueSlug: string) => {
  if (props.disabled || props.pending) return true
  const selected = props.selectedFilters[groupSlug] || []
  return selected.length > 0 && !selected.includes(valueSlug)
}

const visibleValues = (group: CategoryFilterGroupDto) =>
  expandedGroups.value[group.slug] ? group.values : group.values.slice(0, DEFAULT_VISIBLE_VALUES)

const toggleGroupExpansion = (groupSlug: string) => {
  expandedGroups.value = {
    ...expandedGroups.value,
    [groupSlug]: !expandedGroups.value[groupSlug],
  }
}
</script>

<template>
  <aside class="catalog-filter-panel" :aria-busy="pending">
    <div class="catalog-filter-panel__head">
      <h2 class="catalog-filter-panel__title">{{ terms.catalog.filters }}</h2>
      <button
        class="catalog-filter-panel__clear"
        type="button"
        :disabled="disabled || pending || (!selectedCount && !priceMin && !priceMax && !hasCatalogFilters)"
        @click="emit('clear')"
      >
        <BaseHoverUnderlineText>{{ terms.common.clear }}</BaseHoverUnderlineText>
      </button>
    </div>

    <div v-if="showCatalogControls" class="catalog-filter-panel__controls">
      <BaseInput
        :model-value="query"
        type="search"
        :label="terms.common.search"
        :placeholder="terms.catalog.searchPlaceholder"
        :disabled="disabled"
        @update:model-value="emit('update:query', String($event || ''))"
      />
      <BaseSelect
        :model-value="category"
        :label="terms.catalog.category"
        :placeholder="terms.catalog.allCategories"
        :options="categoryOptions"
        :disabled="disabled"
        @update:model-value="emit('update:category', String($event || ''))"
      />
      <BaseSelect
        v-if="!category"
        :model-value="brand"
        :label="terms.catalog.brand"
        :placeholder="terms.catalog.allBrands"
        :options="brandOptions"
        :disabled="disabled"
        @update:model-value="emit('update:brand', String($event || ''))"
      />
    </div>

    <div v-if="pending" class="catalog-filter-panel__skeleton" aria-hidden="true">
      <span class="catalog-filter-panel__skeleton-title" />
      <span class="catalog-filter-panel__skeleton-range" />
      <span v-for="index in 18" :key="index" class="catalog-filter-panel__skeleton-line" />
    </div>

    <template v-else>
      <div v-if="selectedEntries.length" class="catalog-filter-panel__chosen">
        <p class="catalog-filter-panel__chosen-title">{{ terms.catalog.chosen }}</p>
        <ul class="catalog-filter-panel__chip-list">
          <li v-for="entry in selectedEntries" :key="`${entry.groupSlug}-${entry.valueSlug}`">
            <button
              class="catalog-filter-panel__chip"
              type="button"
              @click="emit('remove-filter', entry.groupSlug, entry.valueSlug)"
            >
              <span>{{ selectedLabel(entry.groupSlug, entry.valueSlug).group }}:</span>
              <strong>{{ selectedLabel(entry.groupSlug, entry.valueSlug).value }}</strong>
              <BaseIcon name="close" size="xxs" />
            </button>
          </li>
        </ul>
      </div>

      <section v-if="showPrice" class="catalog-filter-panel__section">
        <h3 class="catalog-filter-panel__section-title">{{ terms.catalog.price }}</h3>
        <CatalogPriceFilter
          :min-limit="price?.min || 0"
          :max-limit="price?.max || 0"
          :min-value="priceMin"
          :max-value="priceMax"
          :disabled="disabled"
          @update:min-value="emit('update:priceMin', $event)"
          @update:max-value="emit('update:priceMax', $event)"
          @change="emit('price-change')"
        />
      </section>

      <section
        v-for="group in groups"
        :key="group.slug"
        class="catalog-filter-panel__group"
      >
        <details class="catalog-filter-panel__details" open>
          <summary class="catalog-filter-panel__summary">
            <span>{{ group.name }}</span>
            <BaseIcon name="chevron-down" size="xxs" />
          </summary>

          <ul class="catalog-filter-panel__values">
            <li v-for="value in visibleValues(group)" :key="value.slug">
              <BaseCheckbox
                :model-value="isSelected(group.slug, value.slug)"
                :label="value.name"
                :description="terms.catalog.filterProductCount(value.count)"
                :disabled="isDisabled(group.slug, value.slug)"
                @update:model-value="emit('toggle-filter', group.slug, value.slug, $event)"
              />
            </li>
          </ul>

          <button
            v-if="group.values.length > DEFAULT_VISIBLE_VALUES"
            class="catalog-filter-panel__show-all"
            type="button"
            @click="toggleGroupExpansion(group.slug)"
          >
            <BaseHoverUnderlineText>{{ expandedGroups[group.slug] ? terms.catalog.collapse : terms.catalog.showAll }}</BaseHoverUnderlineText>
          </button>
        </details>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.catalog-filter-panel {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 0.5rem;
}

.catalog-filter-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0.25rem 0.5rem;
}

.catalog-filter-panel__title {
  color: #0a0a0a;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.2;
}

.catalog-filter-panel__clear,
.catalog-filter-panel__show-all {
  border: 0;
  background: transparent;
  color: #0a0a0a;
  font-size: 0.8125rem;
  font-weight: 700;
}

.catalog-filter-panel__clear:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.catalog-filter-panel__chosen {
  border-radius: 0.75rem;
  background: #f5f5f4;
  padding: 0.75rem;
}

.catalog-filter-panel__controls {
  display: grid;
  gap: 0.75rem;
  padding: 0.25rem 0.5rem 0.75rem;
  border-bottom: 1px solid rgb(10 10 10 / 0.08);
}

.catalog-filter-panel__chosen-title {
  color: #0a0a0a;
  font-size: 0.8125rem;
  font-weight: 800;
}

.catalog-filter-panel__chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding-top: 0.625rem;
}

.catalog-filter-panel__chip {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid rgb(10 10 10 / 0.18);
  border-radius: 9999px;
  background: #ffffff;
  padding: 0.35rem 0.5rem 0.35rem 0.65rem;
  color: #737373;
  font-size: 0.75rem;
  line-height: 1.2;
}

.catalog-filter-panel__chip strong {
  min-width: 0;
  overflow: hidden;
  color: #0a0a0a;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-filter-panel__section {
  display: grid;
  gap: 0.75rem;
  padding: 0.625rem;
  border-bottom: 1px solid rgb(10 10 10 / 0.08);
}

.catalog-filter-panel__section-title {
  color: #0a0a0a;
  font-size: 0.875rem;
  font-weight: 800;
}

.catalog-filter-panel__group {
  border-bottom: 1px solid rgb(10 10 10 / 0.08);
}

.catalog-filter-panel__details {
  padding: 0.125rem 0;
}

.catalog-filter-panel__summary {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 0.5rem;
  color: #262626;
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
  list-style: none;
}

.catalog-filter-panel__summary::-webkit-details-marker {
  display: none;
}

.catalog-filter-panel__details[open] .catalog-filter-panel__summary :deep(.base-icon) {
  transform: rotate(180deg);
}

.catalog-filter-panel__values {
  display: grid;
  gap: 0.375rem;
  padding: 0 0.25rem 0.5rem;
}

.catalog-filter-panel__values :deep(.base-choice) {
  height: 2.75rem;
  align-items: center;
  gap: 0.625rem;
  border: 0;
  padding: 0 0.625rem;
}

.catalog-filter-panel__values :deep(.base-choice__mark) {
  margin-top: 0;
}

.catalog-filter-panel__values :deep(.base-choice__body) {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.catalog-filter-panel__values :deep(.base-choice__label) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-filter-panel__values :deep(.base-choice__description) {
  flex: 0 0 auto;
  color: #737373;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.25rem;
}

.catalog-filter-panel__show-all {
  margin: 0 0 0.75rem 0.5rem;
}

.catalog-filter-panel__skeleton {
  display: grid;
  gap: 0.625rem;
  padding: 0.5rem;
}

.catalog-filter-panel__skeleton-title,
.catalog-filter-panel__skeleton-range,
.catalog-filter-panel__skeleton-line {
  display: block;
  overflow: hidden;
  border-radius: 9999px;
  background: linear-gradient(90deg, #eeeeee, #f8f8f8, #eeeeee);
  background-size: 220% 100%;
  animation: catalog-filter-pulse 1.2s linear infinite;
}

.catalog-filter-panel__skeleton-title {
  width: 42%;
  height: 1.25rem;
}

.catalog-filter-panel__skeleton-range {
  height: 2.75rem;
  border-radius: 0.5rem;
}

.catalog-filter-panel__skeleton-line {
  height: 1.25rem;
}

@keyframes catalog-filter-pulse {
  to {
    background-position: -220% 0;
  }
}
</style>
