<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import { getProductDiscount } from '~/utils/product-status'

const props = defineProps<{
  product: ProductDto
}>()

const cart = useCartStore()
const favorites = useFavoritesStore()
const { terms } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()

const imageUrl = computed(() =>
  props.product.images[0]?.image || props.product.images[0]?.image_url || 'https://placehold.co/640x640?text=Product',
)
const imageAlt = computed(() => props.product.images[0]?.alt || props.product.name)
const productCode = computed(() => props.product.sku || String(props.product.id))
const isFavorite = computed(() => favorites.has(props.product.id))
const isInCart = computed(() => cart.items.some(item => item.product.id === props.product.id))
const discount = computed(() => getProductDiscount(props.product))

const toggleFavorite = async () => {
  await favorites.toggle(props.product.id, props.product)
}

const toggleCart = async () => {
  await cart.toggle(props.product)
}
</script>

<template>
  <article class="catalog-product-tile" itemscope itemtype="https://schema.org/Product">
    <NuxtLink class="catalog-product-tile__link" :to="`/products/${product.slug}`" itemprop="url">
      <picture class="catalog-product-tile__media">
        <img
          class="catalog-product-tile__image"
          :src="imageUrl"
          :alt="imageAlt"
          width="240"
          height="240"
          loading="lazy"
          itemprop="image"
        >
      </picture>

      <ProductStatusBadges class="catalog-product-tile__badges" :product="product" />

      <div class="catalog-product-tile__body">
        <h3 class="catalog-product-tile__name type-title-title" itemprop="name">
          <BaseHoverUnderlineText>{{ product.name }}</BaseHoverUnderlineText>
        </h3>
        <p class="catalog-product-tile__code">
          {{ terms.catalog.productCode }}:
          <span itemprop="sku">{{ productCode }}</span>
        </p>
        <div class="catalog-product-tile__rating">
          <span class="catalog-product-tile__rating-item">
            <BaseIcon name="star" size="xxs" />
            {{ product.average_rating || '0' }}
          </span>
          <span class="catalog-product-tile__rating-item">
            <BaseIcon name="dialog" size="xxs" />
            {{ product.reviews_count || 0 }}
          </span>
        </div>
      </div>
    </NuxtLink>

    <BaseButton
      class="catalog-product-tile__favorite"
      :class="{ 'catalog-product-tile__favorite--active': isFavorite }"
      type="button"
      variant="light"
      size="xs"
      shape="circle"
      :aria-label="isFavorite ? terms.product.removeFavorite : terms.product.saveFavorite"
      @click="toggleFavorite"
    >
      <BaseIcon name="heart" size="xxs" effect="heart" />
    </BaseButton>

    <div class="catalog-product-tile__bottom" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
      <div class="catalog-product-tile__prices">
        <meta itemprop="priceCurrency" content="UAH">
        <p v-if="discount" class="catalog-product-tile__old-price">
          {{ formatPrice(discount.compareAtPrice, { currency: false, minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}
        </p>
        <p
          class="catalog-product-tile__price"
          :class="{ 'catalog-product-tile__price--discount': discount }"
          itemprop="price"
        >
          <span>{{ formatPrice(product.price, { currency: false, minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</span>
          <small>{{ terms.catalog.currencyShort }}</small>
        </p>
      </div>

      <BaseButton
        class="catalog-product-tile__cart"
        :class="{ 'catalog-product-tile__cart--active': isInCart }"
        type="button"
        size="xs"
        :aria-label="isInCart ? terms.product.removeFromCart : terms.product.addToCart"
        @click="toggleCart"
      >
        <BaseIcon :name="isInCart ? 'check' : 'shopping-cart'" size="xxs" />
      </BaseButton>
    </div>
  </article>
</template>

<style scoped>
.catalog-product-tile {
  position: relative;
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 22rem;
  flex: 1 1 auto;
  flex-direction: column;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 0.75rem;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}

.catalog-product-tile:hover,
.catalog-product-tile:focus-within {
  box-shadow: 0 1rem 1.5rem rgb(108 116 167 / 0.16);
  transform: translateY(-0.125rem);
}

.catalog-product-tile__link {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  color: inherit;
}

.catalog-product-tile__media {
  display: flex;
  height: 11rem;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
}

.catalog-product-tile__image {
  width: 100%;
  max-width: 11rem;
  height: 100%;
  object-fit: contain;
}

.catalog-product-tile__body {
  min-width: 0;
  flex: 1 1 auto;
  padding-top: 0.5rem;
}

.catalog-product-tile__name {
  display: -webkit-box;
  min-height: 2.6rem;
  overflow: hidden;
  color: #262626;
  font-size: 0.875rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.catalog-product-tile__code {
  padding-top: 0.375rem;
  color: #737373;
  font-size: 0.75rem;
  line-height: 1.45;
}

.catalog-product-tile__rating {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  color: #737373;
  font-size: 0.75rem;
}

.catalog-product-tile__rating-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.catalog-product-tile__rating-item:first-child :deep(svg) {
  color: #f8d736;
}

.catalog-product-tile__favorite {
  --sc-button-bg: #ffffff;
  --sc-button-text: #737373;
  --sc-button-fill: #fff1f2;
  --sc-button-hover-text: #c01818;
  --sc-button-border: rgb(10 10 10 / 0.1);
  --sc-button-shadow: none;

  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  min-height: 2rem;
}

.catalog-product-tile__badges {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 1;
  max-width: calc(100% - 4rem);
}

.catalog-product-tile__favorite--active {
  --sc-button-text: #c01818;
  --sc-button-border: rgb(192 24 24 / 0.22);
}

.catalog-product-tile__favorite--active :deep(svg) {
  fill: currentColor;
}

.catalog-product-tile__bottom {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.75rem;
}

.catalog-product-tile__prices {
  min-width: 0;
}

.catalog-product-tile__old-price {
  display: inline-block;
  color: #a3a3a3;
  font-size: 0.75rem;
  line-height: 1.2;
  text-decoration: line-through;
}

.catalog-product-tile__price {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.25rem;
  color: #0a0a0a;
  font-weight: 800;
  line-height: 1;
}

.catalog-product-tile__price--discount {
  color: #c2410c;
}

.catalog-product-tile__price span {
  font-size: 1.25rem;
}

.catalog-product-tile__price small {
  font-size: 0.8125rem;
  font-weight: 600;
}

.catalog-product-tile__cart {
  --sc-button-border: transparent;

  width: 2.5rem;
  min-width: 2.5rem;
  height: 2.25rem;
  min-height: 2.25rem;
  flex: 0 0 auto;
  border-radius: 0.5rem;
  padding: 0;
}

.catalog-product-tile__cart--active {
  --sc-button-bg: #f5f5f4;
  --sc-button-text: #0a0a0a;
  --sc-button-fill: #0a0a0a;
  --sc-button-hover-text: #ffffff;
}

@media (min-width: 576px) {
  .catalog-product-tile {
    min-height: 25rem;
    padding: 1.25rem;
  }

  .catalog-product-tile__media {
    height: 12rem;
  }

  .catalog-product-tile__name {
    font-size: 1rem;
  }

  .catalog-product-tile__favorite {
    top: 1.25rem;
    right: 1.25rem;
  }

  .catalog-product-tile__badges {
    top: 1.25rem;
    left: 1.25rem;
  }
}
</style>
