<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import { NuxtLink } from '#components'
import { localizedPackageSize } from '~/utils/catalog-metadata-localization'
import { getProductDiscount } from '~/utils/product-status'
import { isProductHidden, isProductUnavailable } from '~/utils/product-visibility'

const { productDisplayName, productDisplayType } = useProductDisplay()

const props = defineProps<{
  product: ProductDto
}>()

const cart = useCartStore()
const favorites = useFavoritesStore()
const { terms, locale } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()

const images = computed(() => {
  const available = props.product.images.flatMap(image => {
    const src = image.image || image.image_url
    return src ? [{ src, alt: image.alt || productDisplayName(props.product) }] : []
  })
  return available.length ? available : [{ src: 'https://placehold.co/640x640?text=Product', alt: productDisplayName(props.product) }]
})
const activeImage = ref(0)
const previewReady = ref(false)
const hasPreview = computed(() => images.value.length > 1)

const previewAtPointer = (event: PointerEvent) => {
  if (!hasPreview.value || event.pointerType !== 'mouse') return
  const { left, width } = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (!width) return
  previewReady.value = true
  activeImage.value = Math.max(0, Math.min(images.value.length - 1,
    Math.floor((event.clientX - left) / width * images.value.length)))
}

const resetPreview = () => { activeImage.value = 0 }

const stepPreview = (direction: number) => {
  previewReady.value = true
  activeImage.value = Math.max(0, Math.min(images.value.length - 1, activeImage.value + direction))
}

const previewOnWheel = (event: WheelEvent) => {
  // Only consume horizontal gestures; normal page scrolling stays available.
  if (!hasPreview.value || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
  event.preventDefault()
  if (Math.abs(event.deltaX) < 4 || event.timeStamp - lastWheelTime < 180) return
  lastWheelTime = event.timeStamp
  stepPreview(Math.sign(event.deltaX))
}
let lastWheelTime = -Infinity

const previewOnKey = (event: KeyboardEvent) => {
  if (!hasPreview.value || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  stepPreview(event.key === 'ArrowRight' ? 1 : -1)
}

watch(images, () => {
  resetPreview()
  previewReady.value = false
  lastWheelTime = -Infinity
})
const packageSize = computed(() => localizedPackageSize(typeof props.product.package_size === 'string' ? props.product.package_size.trim() : '', locale.value))
const buyLabel = computed(() => locale.value === 'uk' ? 'Купити' : 'Buy')
const unavailableLabel = computed(() => locale.value === 'uk' ? 'Немає в наявності' : 'Out of stock')
const inCartLabel = computed(() => locale.value === 'uk' ? 'У кошику' : 'In cart')
const productType = computed(() => productDisplayType(props.product))
const isFavorite = computed(() => favorites.has(props.product.id))
const isInCart = computed(() => cart.items.some(item => item.product.id === props.product.id))
const discount = computed(() => getProductDiscount(props.product))
const isHidden = computed(() => isProductHidden(props.product))
const isUnavailable = computed(() => isProductUnavailable(props.product))
const toggleFavorite = async () => {
  await favorites.toggle(props.product.id, props.product)
}

const cartPending = ref(false)
const toggleCart = async () => {
  if (cartPending.value) return
  cartPending.value = true
  try {
    await cart.toggle(props.product)
  }
  finally {
    cartPending.value = false
  }
}
</script>

<template>
  <article class="catalog-product-tile" :class="{ 'catalog-product-tile--unavailable': isUnavailable }" itemscope itemtype="https://schema.org/Product">
    <component
      :is="isHidden ? 'div' : NuxtLink"
      class="catalog-product-tile__link"
      :to="isHidden ? undefined : `/products/${product.slug}`"
      :aria-disabled="isHidden || undefined"
      itemprop="url"
      @keydown="previewOnKey"
      @blur="resetPreview"
    >
      <div
        class="catalog-product-tile__media"
        @pointerenter="previewAtPointer"
        @pointermove="previewAtPointer"
        @pointerleave="resetPreview"
        @wheel="previewOnWheel"
      >
        <div class="catalog-product-tile__viewport">
          <div class="catalog-product-tile__slides" :style="{ transform: `translateX(-${activeImage * 100}%)` }">
            <div
              v-for="(image, index) in images"
              :key="`${index}-${image.src}`"
              class="catalog-product-tile__slide"
              :aria-hidden="index !== activeImage || undefined"
            >
              <img
                v-if="index === 0 || previewReady"
                class="catalog-product-tile__image"
                :class="{
                  'catalog-product-tile__image--single': !hasPreview,
                  'catalog-product-tile__image--unavailable': isUnavailable,
                }"
                :src="image.src"
                :alt="image.alt"
                width="240"
                height="240"
                :loading="index === 0 ? 'lazy' : 'eager'"
                draggable="false"
                itemprop="image"
              >
            </div>
          </div>
        </div>
      </div>

      <ProductStatusBadges class="catalog-product-tile__badges" :product="product" />

    </component>

    <div
      v-if="Number(product.average_rating) > 0 || product.reviews_count > 0"
      class="catalog-product-tile__rating"
    >
      <span v-if="Number(product.average_rating) > 0" class="catalog-product-tile__rating-item">
        <BaseIcon name="product-rating" size="xxs" class="catalog-product-tile__rating-star" />
        {{ product.average_rating }}
      </span>
      <span v-if="product.reviews_count > 0" class="catalog-product-tile__rating-item">
        <BaseIcon name="product-review" size="xxs" class="catalog-product-tile__rating-star" />
        {{ product.reviews_count }}
      </span>
    </div>

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

    <div class="catalog-product-tile__body">
      <div v-if="hasPreview" class="catalog-product-tile__dots" aria-hidden="true">
        <span
          v-for="(_, index) in images"
          :key="index"
          class="catalog-product-tile__dot"
          :class="{ 'catalog-product-tile__dot--active': index === activeImage }"
        />
      </div>
      <div class="catalog-product-tile__desktop-layout">
        <div class="catalog-product-tile__primary">
          <component
            :is="isHidden ? 'div' : NuxtLink"
            class="catalog-product-tile__name-link"
            :to="isHidden ? undefined : `/products/${product.slug}`"
          >
            <h3
              class="catalog-product-tile__name type-title-title"
              itemprop="name"
            >
              <BaseHoverUnderlineText class="catalog-product-tile__name-text">
                {{ productDisplayName(product) }}
              </BaseHoverUnderlineText>
            </h3>
          </component>
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
        </div>
        <div class="catalog-product-tile__details">
          <p class="catalog-product-tile__type">{{ productType }}</p>
          <div class="catalog-product-tile__details-row">
            <BaseBadge v-if="packageSize" class="catalog-product-tile__volume">{{ packageSize }}</BaseBadge>
            <div class="catalog-product-tile__bottom" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <meta itemprop="priceCurrency" content="UAH">
              <meta itemprop="price" :content="product.price">
              <BaseButton
                class="catalog-product-tile__cart"
                :class="{ 'catalog-product-tile__cart--unavailable': isUnavailable, 'catalog-product-tile__cart--active': isInCart, 'catalog-product-tile__cart--buy': !isInCart && !isUnavailable }"
                type="button"
                size="xs"
                :aria-busy="cartPending"
                :disabled="cartPending || (isUnavailable && !isInCart)"
                :aria-label="isInCart ? terms.product.removeFromCart : (isUnavailable ? unavailableLabel : terms.product.addToCart)"
                @click="toggleCart"
              >
                <span class="catalog-product-tile__cart-label">{{ isInCart ? inCartLabel : (isUnavailable ? unavailableLabel : buyLabel) }}</span>
                <BaseIcon v-if="cartPending" name="clock" size="xxs" />
                <BaseIcon v-else-if="isInCart" name="check" size="xxs" />
                <BaseIcon v-else-if="!isUnavailable" name="product-buy-arrow" size="xxs" class="catalog-product-tile__cart-arrow" />
              </BaseButton>
            </div>
          </div>
        </div>
      </div>

      <div class="catalog-product-tile__mobile-layout">
        <div class="catalog-product-tile__primary">
          <component
            :is="isHidden ? 'div' : NuxtLink"
            class="catalog-product-tile__mobile-name-link"
            :to="isHidden ? undefined : `/products/${product.slug}`"
          >
            <h3 class="catalog-product-tile__mobile-name">
              <BaseHoverUnderlineText class="catalog-product-tile__mobile-name-text">
                {{ productDisplayName(product) }}
              </BaseHoverUnderlineText>
            </h3>
          </component>
        </div>
        <div class="catalog-product-tile__mobile-meta">
          <p class="catalog-product-tile__mobile-type">{{ productType }}</p>
          <BaseBadge v-if="packageSize" class="catalog-product-tile__volume">{{ packageSize }}</BaseBadge>
        </div>
        <div class="catalog-product-tile__mobile-purchase-row">
          <div class="catalog-product-tile__prices">
            <p v-if="discount" class="catalog-product-tile__old-price">
              {{ formatPrice(discount.compareAtPrice, { currency: false, minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}
            </p>
            <p class="catalog-product-tile__price" :class="{ 'catalog-product-tile__price--discount': discount }">
              <span>{{ formatPrice(product.price, { currency: false, minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</span>
              <small>{{ terms.catalog.currencyShort }}</small>
            </p>
          </div>
          <BaseButton
            class="catalog-product-tile__cart"
            :class="{ 'catalog-product-tile__cart--unavailable': isUnavailable, 'catalog-product-tile__cart--active': isInCart, 'catalog-product-tile__cart--buy': !isInCart && !isUnavailable }"
            type="button"
            size="xs"
            :aria-busy="cartPending"
            :disabled="cartPending || (isUnavailable && !isInCart)"
            :aria-label="isInCart ? terms.product.removeFromCart : (isUnavailable ? unavailableLabel : terms.product.addToCart)"
            @click="toggleCart"
          >
            <span class="catalog-product-tile__cart-label">{{ isInCart ? inCartLabel : (isUnavailable ? unavailableLabel : buyLabel) }}</span>
            <BaseIcon v-if="cartPending" name="clock" size="xxs" />
            <BaseIcon v-else-if="isInCart" name="check" size="xxs" />
            <BaseIcon v-else-if="!isUnavailable" name="product-buy-arrow" size="xxs" class="catalog-product-tile__cart-arrow" />
          </BaseButton>
        </div>
      </div>
    </div>


  </article>
</template>

<style scoped>
.catalog-product-tile {
  --catalog-product-tile-motion-easing: cubic-bezier(0.55, 0.05, 0.75, 1);

  position: relative;
  display: block;
  height: 100%;
  min-width: 0;
  min-height: 22rem;
  flex: 1 1 auto;
  overflow: hidden;
  aspect-ratio: 0.78;
  background: #eee9df;
  box-shadow: 0 0.5rem 1.5rem rgb(46 35 23 / 0.08);
  transition: box-shadow 390ms var(--catalog-product-tile-motion-easing);
}

.catalog-product-tile:hover,
.catalog-product-tile:focus-within {
  box-shadow: 0 0.375rem 1rem rgb(46 35 23 / 0.05);
}

.catalog-product-tile--unavailable {
  opacity: 0.68;
}

.catalog-product-tile__link {
  position: absolute;
  inset: 0;
  display: block;
  min-width: 0;
  color: inherit;
}

.catalog-product-tile__media {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(145deg, #f6f3ed 0%, #e8e1d5 100%);
}

.catalog-product-tile__viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.catalog-product-tile__slides {
  display: flex;
  height: 100%;
  transition: transform 390ms var(--catalog-product-tile-motion-easing);
}

.catalog-product-tile__slide {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 0 0 100%;
  align-items: center;
  justify-content: center;
}

.catalog-product-tile__dots {
  position: absolute;
  top: -2.5rem;
  bottom: auto;
  left: 50%;
  z-index: 4;
  display: flex;
  max-width: 100%;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  border-radius: 1rem;
  background: #ffffff;
  padding: 0.5rem 0.75rem;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 0.375rem);
  transition: opacity 500ms var(--catalog-product-tile-motion-easing), transform 500ms var(--catalog-product-tile-motion-easing);
}

.catalog-product-tile__link:focus-visible ~ .catalog-product-tile__body .catalog-product-tile__dots {
  opacity: 1;
  transform: translate(-50%, 0);
}

@media (hover: hover) and (pointer: fine) {
  .catalog-product-tile:hover .catalog-product-tile__image--single {
    transform: scale(1.1);
  }

  .catalog-product-tile:hover .catalog-product-tile__dots {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.catalog-product-tile__dot {
  width: 0.375rem;
  height: 0.375rem;
  flex: 0 0 auto;
  border: 1px solid #262626;
  border-radius: 50%;
  background: #262626;
  transition: background-color 180ms var(--catalog-product-tile-motion-easing), transform 180ms var(--catalog-product-tile-motion-easing);
}

.catalog-product-tile__dot--active {
  background: #ffffff;
  transform: scale(1.35);
}

.catalog-product-tile__image--single {
  transform: scale(1);
  transition: transform 306ms var(--catalog-product-tile-motion-easing);
}

@media (prefers-reduced-motion: reduce) {
  .catalog-product-tile__image--single,
  .catalog-product-tile__slides,
  .catalog-product-tile__dots,
  .catalog-product-tile__dot {
    transition: none;
  }
}

.catalog-product-tile__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  mix-blend-mode: multiply;
}

.catalog-product-tile__image--unavailable {
  filter: grayscale(0.8);
}

.catalog-product-tile__body {
  position: absolute;
  height: auto;
  right: 0.75rem;
  bottom: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  min-width: 0;
  border: 1px solid rgb(255 255 255 / 0.58);
  border-radius: 1.25rem;
  background: rgb(249 248 243 / 0.96);
  padding: 0.7rem 0.75rem 0.7rem 0.75rem;
  color: #26231f;
  box-shadow: 0 0.25rem 1.25rem rgb(36 28 19 / 0.08);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  pointer-events: none;
}

.catalog-product-tile__primary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.catalog-product-tile__desktop-layout {
  display: flex;
  flex-direction: column;
}

.catalog-product-tile__mobile-layout {
  display: none;
}

.catalog-product-tile__name {
  display: -webkit-box;
  position: relative;
  max-height: 2.6em;
  min-width: 0;
  overflow: hidden;
  color: #262626;
  flex: 1 1 auto;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.catalog-product-tile__name-link {
  min-width: 0;
  flex: 1 1 auto;
  color: inherit;
  text-decoration: none;
  pointer-events: auto;
}

.catalog-product-tile__name-text {
  display: block;
  font-size: inherit;
  font-weight: 600;
}

.catalog-product-tile__type {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin: 0.1875rem 0 0;
  color: #737373;
  font-size: 0.75rem;
  line-height: 1.45;
}

.catalog-product-tile__prices {
  flex: 0 0 auto;
  text-align: right;
  white-space: nowrap;
}

.catalog-product-tile__details {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.catalog-product-tile__details-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 0.5rem;
}

.catalog-product-tile__volume.base-badge {
  max-width: 100%;
  flex-shrink: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  max-width: 50%;
  border: 1px solid #d9d8d3;
  border-radius: 9999px;
  padding: 0.5rem 0.75rem;
  background: transparent;
  color: #737373;
  font-size: 0.8125rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: normal;
  text-transform: none;
  overflow-wrap: anywhere;
}

.catalog-product-tile__rating {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  color: #635f55;
  font-size: 0.75rem;
  pointer-events: none;
}

.catalog-product-tile__rating-item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.catalog-product-tile__rating-star.base-icon {
  width: 1rem;
  height: 1.25rem;
}

.catalog-product-tile__favorite {
  --sc-button-bg: linear-gradient(145deg, rgb(255 255 255 / 0.32), rgb(255 255 255 / 0.1));
  --sc-button-text: #45413c;
  --sc-button-fill: rgb(255 241 242 / 0.3);
  --sc-button-hover-text: #c01818;
  --sc-button-border: transparent;
  --sc-button-backdrop-filter: blur(16px) saturate(135%);

  border: 0;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.45), inset 0 -1px 0 rgb(0 0 0 / 0.04), 0 2px 8px rgb(0 0 0 / 0.1);

  position: absolute;
  top: 3rem;
  right: 0.75rem;
  z-index: 3;
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  min-height: 2rem;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .catalog-product-tile__favorite {
    --sc-button-bg: rgb(249 248 243 / 0.94);
  }
}

@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .catalog-product-tile__favorite {
    --sc-button-bg: #f9f8f3;
    --sc-button-border: #737373;
    --sc-button-backdrop-filter: none;
  }
}

@media (forced-colors: active) {
  .catalog-product-tile__favorite {
    --sc-button-bg: ButtonFace;
    --sc-button-text: ButtonText;
    --sc-button-border: ButtonText;
    --sc-button-backdrop-filter: none;
    box-shadow: none;
  }
}

.catalog-product-tile__badges {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  max-width: calc(100% - 4rem);
}

.catalog-product-tile__badges :deep(.product-status-badges__item:not(.product-status-badges__item--discount)) {
  display: none;
}

.catalog-product-tile:hover .catalog-product-tile__badges :deep(.product-status-badges__item),
.catalog-product-tile:focus-within .catalog-product-tile__badges :deep(.product-status-badges__item) {
  display: inline-flex;
}

.catalog-product-tile__favorite {
  opacity: 0;
  pointer-events: none;
}

.catalog-product-tile:hover .catalog-product-tile__favorite,
.catalog-product-tile:focus-within .catalog-product-tile__favorite,
.catalog-product-tile:hover .catalog-product-tile__bottom,
.catalog-product-tile:focus-within .catalog-product-tile__bottom {
  opacity: 1;
  pointer-events: auto;
}

.catalog-product-tile__favorite--active {
  --sc-button-text: #c01818;
  --sc-button-border: rgb(192 24 24 / 0.22);
}

.catalog-product-tile__favorite--active :deep(svg) {
  fill: currentColor;
}

@media (min-width: 1024px) {
  .catalog-product-tile__primary {
    gap: 1rem;
  }
}

@media (min-width: 1024px) and (hover: hover) and (pointer: fine) {
  .catalog-product-tile__favorite {
    transform: scale(1);
    transition:
      transform 420ms var(--catalog-product-tile-motion-easing),
      color 420ms var(--catalog-product-tile-motion-easing),
      border-color 420ms var(--catalog-product-tile-motion-easing),
      background-color 420ms var(--catalog-product-tile-motion-easing),
      opacity 200ms var(--catalog-product-tile-motion-easing);
  }

  .catalog-product-tile__favorite:not(.catalog-product-tile__favorite--active) {
    transform: scale(0);
  }

  .catalog-product-tile:hover .catalog-product-tile__favorite,
  .catalog-product-tile:has(:focus-visible) .catalog-product-tile__favorite {
    transform: scale(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .catalog-product-tile__favorite {
      transition: none;
    }
  }
}

.catalog-product-tile__bottom {
  position: relative;
  min-width: 0;
  max-width: 100%;
  margin-left: auto;
  opacity: 1;
  pointer-events: auto;
  transition: opacity 180ms var(--catalog-product-tile-motion-easing);
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
  justify-content: flex-end;
  min-width: 0;
  align-items: baseline;
  gap: 0.25rem;
  color: #0a0a0a;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
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
  --sc-button-bg: #1c1b18;

  width: auto;
  min-width: 0;
  height: 2rem;
  min-height: 2rem;
  flex: 0 0 auto;
  border-radius: 100px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0;
  text-transform: none;
}

.catalog-product-tile__cart--buy {
  width: 92px;
  min-width: 92px;
}

.catalog-product-tile__cart :deep(.sc-button__text) {
  gap: 4px;
}

.catalog-product-tile__cart-label {
  padding-left: 4px;
}

.catalog-product-tile__cart-arrow.base-icon {
  width: 16px;
  height: 16px;
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
  }

  .catalog-product-tile__name {
    font-size: 1rem;
  }

}

@media (max-width: 519px) {
  .catalog-product-tile__desktop-layout {
    display: none;
  }

  .catalog-product-tile {
    display: block;
    height: 0;
    min-height: 0;
    padding-top: calc(60% + 9.24rem);
    aspect-ratio: auto;
  }

  .catalog-product-tile__link {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding-top: 0;
    aspect-ratio: auto;
  }

  .catalog-product-tile__mobile-layout {
    display: grid;
    min-width: 0;
    grid-template-rows: auto auto auto;
    gap: 0.125rem;
  }

  .catalog-product-tile__body {
    position: absolute;
    height: auto;
    right: 0.25rem;
    bottom: 0.375rem;
    left: 0.25rem;
    margin: 0;
    padding: 8px 6px;
    border-radius: 0.875rem;
  }

  .catalog-product-tile__mobile-layout .catalog-product-tile__primary {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }

  .catalog-product-tile__mobile-layout .catalog-product-tile__prices {
    display: flex;
    min-width: min-content;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    text-align: left;
  }

  .catalog-product-tile__mobile-name-link {
    display: block;
    min-width: 0;
    flex: 1 1 auto;
    color: inherit;
    text-decoration: none;
    pointer-events: auto;
  }

  .catalog-product-tile__mobile-name {
    display: -webkit-box;
    max-height: 2.6em;
    overflow: hidden;
    color: #262626;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .catalog-product-tile__mobile-name-text :deep(.base-hover-underline-text__content) {
    font-size: 12px;
  }

  .catalog-product-tile__mobile-meta {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  .catalog-product-tile__mobile-type {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    margin-top: 0;
    color: #737373;
    font-size: 10px;
    line-height: 1.35;
  }

  .catalog-product-tile__mobile-purchase-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    margin-top: 0;
  }

  .catalog-product-tile__mobile-purchase-row .catalog-product-tile__cart {
    max-width: 100%;
    min-height: 2.75rem;
    height: auto;
    margin-left: auto;
    padding: 0.375rem 10px;
    font-size: 12px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .catalog-product-tile__volume.base-badge {
    flex-shrink: 0;
    white-space: normal;
    min-width: 0;
    max-width: 50%;
    padding: 0.375rem;
    overflow: hidden;
    font-size: 0.625rem;
  }

  .catalog-product-tile__mobile-layout .catalog-product-tile__price span {
    font-size: 12px;
  }

  .catalog-product-tile__mobile-purchase-row .catalog-product-tile__cart--unavailable {
    width: 92px;
    min-width: 0;
    max-width: 92px;
    padding-inline: 4px;
    line-height: 1.25;
    white-space: normal;
    letter-spacing: 0;
  }

  .catalog-product-tile__mobile-layout .catalog-product-tile__price small {
    font-size: 10px;
  }

  .catalog-product-tile__mobile-type {
    flex: 1;
  }

  .catalog-product-tile__mobile-cart {
    pointer-events: auto;
  }

  .catalog-product-tile__mobile-unavailable {
    padding-top: 0.25rem;
    color: #a16207;
    font-size: 0.65rem;
    font-weight: 600;
  }

  .catalog-product-tile__mobile-layout .catalog-product-tile__cart {
    opacity: 1;
    pointer-events: auto;
  }



  .catalog-product-tile__favorite,
  .catalog-product-tile__bottom {
    opacity: 1;
    pointer-events: auto;
  }

}

@media (max-width: 359px) {
  .catalog-product-tile__body {
    margin-inline: 0;
    padding-inline: 6px;
  }

  .catalog-product-tile__cart-label {
    padding-left: 0;
  }

  .catalog-product-tile__mobile-layout .catalog-product-tile__price span {
    font-size: 12px;
  }

  .catalog-product-tile__price small {
    font-size: 10px;
  }
}

@media (hover: none) {
  .catalog-product-tile__favorite,
  .catalog-product-tile__bottom {
    opacity: 1;
    pointer-events: auto;
  }

  .catalog-product-tile__badges :deep(.product-status-badges__item) {
    display: inline-flex;
  }
}

@media (prefers-reduced-motion: reduce) {
  .catalog-product-tile,
  .catalog-product-tile__details,
  .catalog-product-tile__bottom,
  .catalog-product-tile__name,
  .catalog-product-tile__name-text {
    transition: none;
    animation: none !important;
  }
}
</style>
