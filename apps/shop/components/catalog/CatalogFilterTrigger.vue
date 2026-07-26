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
    variant="outline-dark"
    size="sm"
    :disabled="disabled"
    :aria-label="terms.catalog.filters"
  >
    <BaseIcon name="filter" size="xs" />
    <span v-if="count" class="catalog-filter-trigger__count">{{ count }}</span>
  </BaseButton>
</template>

<style scoped>
.catalog-filter-trigger {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  border-color: rgb(10 10 10 / 0.12);
  border-radius: 0;
  box-shadow: none;
}

.catalog-filter-trigger :deep(.sc-button__text) {
  width: 100%;
  height: 100%;
}

.catalog-filter-trigger__count {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: inline-flex;
  min-width: 1rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 900;
  line-height: 1;
}

@media (min-width: 1024px) {
  .catalog-filter-trigger {
    display: none;
  }
}
</style>
