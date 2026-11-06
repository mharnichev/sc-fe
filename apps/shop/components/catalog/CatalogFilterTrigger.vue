<script setup lang="ts">
withDefaults(defineProps<{
  count?: number
  disabled?: boolean
}>(), {
  count: 0,
  disabled: false,
})

const { terms } = useShopLocale()
</script>

<template>
  <BaseButton
    class="catalog-filter-trigger"
    type="button"
    variant="dark"
    size="sm"
    :disabled="disabled"
    :aria-label="terms.catalog.filters"
  >
    <BaseIcon name="filter" size="xxs" />
    <span>{{ terms.catalog.filters }}</span>
    <span v-if="count" class="catalog-filter-trigger__count">{{ count }}</span>
  </BaseButton>
</template>

<style scoped>
.catalog-filter-trigger {
  min-height: 2.5rem;
  padding-inline: 0.65rem;
}

.catalog-filter-trigger__count {
  font-size: 0.7em;
  opacity: 0.8;
}
</style>
