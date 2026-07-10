<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import { formatProductDiscountPercent, getProductDiscount, getProductStatusFlags } from '~/utils/product-status'

const props = defineProps<{
  product: ProductDto
}>()

const { terms } = useShopLocale()

const badges = computed(() => {
  const items: Array<{
    code: 'discount' | 'top' | 'new'
    icon: string
    label: string
  }> = []
  const discount = getProductDiscount(props.product)
  const flags = getProductStatusFlags(props.product)

  if (discount) {
    const roundedPercent = formatProductDiscountPercent(discount.percent)
    items.push({
      code: 'discount',
      icon: 'sale-fire',
      label: `${roundedPercent === '0' ? '' : '-'}${roundedPercent}%`,
    })
  }
  if (flags.isTop) {
    items.push({ code: 'top', icon: 'star', label: terms.value.catalog.badges.top })
  }
  if (flags.isNew) {
    items.push({ code: 'new', icon: 'new-product', label: terms.value.catalog.badges.new })
  }

  return items
})
</script>

<template>
  <div v-if="badges.length" class="product-status-badges" :aria-label="terms.catalog.badges.label">
    <span
      v-for="badge in badges"
      :key="badge.code"
      class="product-status-badges__item"
      :class="`product-status-badges__item--${badge.code}`"
      :title="badge.label"
    >
      <BaseIcon :name="badge.icon" size="xxs" />
      <span>{{ badge.label }}</span>
    </span>
  </div>
</template>

<style scoped>
.product-status-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: flex-start;
}

.product-status-badges__item {
  display: inline-flex;
  min-height: 1.65rem;
  align-items: center;
  gap: 0.2rem;
  border-radius: 0.375rem;
  padding: 0.15rem 0.4rem 0.15rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.product-status-badges__item :deep(.base-icon) {
  width: 1rem;
  height: 1rem;
}

.product-status-badges__item--discount {
  background: #fff0e6;
  color: #c2410c;
}

.product-status-badges__item--top {
  background: #fff8d6;
  color: #a16207;
}

.product-status-badges__item--new {
  background: #e8f7ee;
  color: #18794e;
}
</style>
