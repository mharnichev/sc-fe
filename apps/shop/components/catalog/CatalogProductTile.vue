<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import { NuxtLink } from '#components'
import { getProductDiscount } from '~/utils/product-status'
import { isProductHidden, isProductUnavailable } from '~/utils/product-visibility'

const { productDisplayName, productDisplayType } = useProductDisplay()

const props = defineProps<{
  product: ProductDto
}>()

const cart = useCartStore()
const favorites = useFavoritesStore()
const { terms } = useShopLocale()
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
const productType = computed(() => productDisplayType(props.product))
const isFavorite = computed(() => favorites.has(props.product.id))
const isInCart = computed(() => cart.items.some(item => item.product.id === props.product.id))
const discount = computed(() => getProductDiscount(props.product))
const isHidden = computed(() => isProductHidden(props.product))
const isUnavailable = computed(() => isProductUnavailable(props.product))
const productName = ref<HTMLElement | null>(null)
const nameNeedsScroll = ref(false)
const nameScrollDistance = ref(0)
let nameResizeObserver: ResizeObserver | undefined

const measureNameOverflow = () => {
  if (!productName.value) return
  const element = productName.value
  const visibleHeight = element.clientHeight
  const originalClamp = element.style.getPropertyValue('-webkit-line-clamp')
  const originalMaxHeight = element.style.getPropertyValue('max-height')
  const originalOverflow = element.style.getPropertyValue('overflow')

  element.style.setProperty('-webkit-line-clamp', 'unset')
  element.style.setProperty('max-height', 'none')
  element.style.setProperty('overflow', 'visible')
  const contentHeight = element.scrollHeight

  if (originalClamp) element.style.setProperty('-webkit-line-clamp', originalClamp)
  else element.style.removeProperty('-webkit-line-clamp')
  if (originalMaxHeight) element.style.setProperty('max-height', originalMaxHeight)
  else element.style.removeProperty('max-height')
  if (originalOverflow) element.style.setProperty('overflow', originalOverflow)
  else element.style.removeProperty('overflow')

  nameScrollDistance.value = Math.max(0, contentHeight - visibleHeight)
  nameNeedsScroll.value = nameScrollDistance.value > 0
}

onMounted(() => {
  measureNameOverflow()
  const text = productName.value?.querySelector<HTMLElement>('.catalog-product-tile__name-text')
  if (typeof ResizeObserver !== 'undefined' && productName.value && text) {
    nameResizeObserver = new ResizeObserver(measureNameOverflow)
    nameResizeObserver.observe(productName.value)
    nameResizeObserver.observe(text)
  }
  window.addEventListener('resize', measureNameOverflow)
})

onBeforeUnmount(() => {
  nameResizeObserver?.disconnect()
  window.removeEventListener('resize', measureNameOverflow)
})

const toggleFavorite = async () => {
  await favorites.toggle(props.product.id, props.product)
}

const toggleCart = async () => {
  await cart.toggle(props.product)
}
</script>

<template>
  <article class="catalog-product-tile" itemscope itemtype="https://schema.org/Product">
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
                :class="{ 'catalog-product-tile__image--single': !hasPreview }"
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
              ref="productName"
              class="catalog-product-tile__name type-title-title"
              :class="{ 'catalog-product-tile__name--overflow': nameNeedsScroll }"
              :style="{ '--catalog-name-scroll-distance': `${nameScrollDistance}px` }"
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
          <div class="catalog-product-tile__details-row">
            <p v-if="productType" class="catalog-product-tile__type">{{ productType }}</p>
            <div class="catalog-product-tile__bottom" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <meta itemprop="priceCurrency" content="UAH">
              <meta itemprop="price" :content="product.price">
              <BaseButton
                class="catalog-product-tile__cart"
                :class="{ 'catalog-product-tile__cart--active': isInCart }"
                type="button"
                size="xs"
                :disabled="cart.syncing || (isUnavailable && !isInCart)"
                :aria-label="isUnavailable ? terms.favorites.unavailable : (isInCart ? terms.product.removeFromCart : terms.product.addToCart)"
                @click="toggleCart"
              >
                <BaseIcon :name="isInCart ? 'check' : 'shopping-cart'" size="xxs" />
              </BaseButton>
            </div>
          </div>
          <div
            v-if="Number(product.average_rating) > 0 || product.reviews_count > 0"
            class="catalog-product-tile__rating"
          >
            <span v-if="Number(product.average_rating) > 0" class="catalog-product-tile__rating-item">
              <BaseIcon name="star" size="xxs" />
              {{ product.average_rating }}
            </span>
            <span v-if="product.reviews_count > 0" class="catalog-product-tile__rating-item">
              <BaseIcon name="dialog" size="xxs" />
              {{ product.reviews_count }}
            </span>
          </div>
          <p v-if="isUnavailable" class="catalog-product-tile__unavailable">{{ terms.favorites.unavailable }}</p>
        </div>
      </div>

      <div class="catalog-product-tile__mobile-layout">
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
        <p v-if="productType" class="catalog-product-tile__mobile-type">{{ productType }}</p>
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
            :class="{ 'catalog-product-tile__cart--active': isInCart }"
            type="button"
            size="xs"
            :disabled="cart.syncing || (isUnavailable && !isInCart)"
            :aria-label="isUnavailable ? terms.favorites.unavailable : (isInCart ? terms.product.removeFromCart : terms.product.addToCart)"
            @click="toggleCart"
          >
            <BaseIcon :name="isInCart ? 'check' : 'shopping-cart'" size="xxs" />
          </BaseButton>
        </div>
        <p v-if="isUnavailable" class="catalog-product-tile__mobile-unavailable">{{ terms.favorites.unavailable }}</p>
      </div>
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

.catalog-product-tile:has(.catalog-product-tile__unavailable) {
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

.catalog-product-tile__body {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  min-width: 0;
  border: 1px solid rgb(255 255 255 / 0.58);
  border-radius: 0.75rem;
  background: rgb(255 253 249 / 0.9);
  padding: 0.7rem 0.75rem 0.7rem 0.75rem;
  color: #26231f;
  box-shadow: 0 0.25rem 1.25rem rgb(36 28 19 / 0.08);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  pointer-events: none;
}

.catalog-product-tile__primary {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
}

.catalog-product-tile__desktop-layout {
  display: block;
}

.catalog-product-tile__mobile-layout {
  display: none;
}

.catalog-product-tile__name {
  display: -webkit-box;
  position: relative;
  max-height: 3.9em;
  min-width: 0;
  overflow: hidden;
  color: #262626;
  flex: 1 1 auto;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
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
  font-size: 14px;
  font-weight: 600;
}

.catalog-product-tile__name--overflow .catalog-product-tile__name-text {
  transform: translateY(0);
}

.catalog-product-tile:hover .catalog-product-tile__name--overflow,
.catalog-product-tile:focus-within .catalog-product-tile__name--overflow {
  -webkit-line-clamp: unset;
}

.catalog-product-tile:hover .catalog-product-tile__name--overflow .catalog-product-tile__name-text,
.catalog-product-tile:focus-within .catalog-product-tile__name--overflow .catalog-product-tile__name-text {
  animation: catalog-product-name-scroll 3.2s ease-in-out infinite alternate;
}

@keyframes catalog-product-name-scroll {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(calc(-1 * var(--catalog-name-scroll-distance)));
  }
}

.catalog-product-tile__type {
  margin: 0;
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
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 220ms var(--catalog-product-tile-motion-easing), opacity 180ms var(--catalog-product-tile-motion-easing);
}

.catalog-product-tile:hover .catalog-product-tile__details,
.catalog-product-tile:focus-within .catalog-product-tile__details {
  max-height: 8rem;
  opacity: 1;
}

.catalog-product-tile__unavailable {
  padding-top: 0.375rem;
  color: #a16207;
  font-size: 0.7rem;
  font-weight: 600;
}

.catalog-product-tile__details-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.375rem;
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
  opacity: 0;
  pointer-events: none;
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

  width: 2.5rem;
  min-width: 2.5rem;
  height: 2.25rem;
  min-height: 2.25rem;
  flex: 0 0 auto;
  border-radius: 4px;
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
  }

  .catalog-product-tile__name {
    font-size: 1rem;
  }

}

@media (max-width: 519px) {
  .catalog-product-tile__desktop-layout {
    display: none;
  }

  .catalog-product-tile__mobile-layout {
    display: block;
  }

  .catalog-product-tile__body {
    right: 0.5rem;
    bottom: 0.5rem;
    left: 0.5rem;
    padding: 6px 8px;
  }

  .catalog-product-tile__mobile-name-link {
    display: block;
    color: inherit;
    text-decoration: none;
    pointer-events: auto;
  }

  .catalog-product-tile__mobile-name {
    display: -webkit-box;
    max-height: 3.9em;
    overflow: hidden;
    color: #262626;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }

  .catalog-product-tile__mobile-name-text :deep(.base-hover-underline-text__content) {
    font-size: 12px;
  }

  .catalog-product-tile__mobile-type {
    margin-top: 0.15rem;
    color: #737373;
    font-size: 10px;
    line-height: 1.35;
  }

  .catalog-product-tile__mobile-purchase-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .catalog-product-tile__mobile-purchase-row .catalog-product-tile__prices {
    text-align: left;
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

  .catalog-product-tile__mobile-layout .catalog-product-tile__price span {
    font-size: 1.125rem;
  }

  .catalog-product-tile__favorite,
  .catalog-product-tile__bottom {
    opacity: 1;
    pointer-events: auto;
  }

}

@media (hover: none) {
  .catalog-product-tile__details {
    max-height: 8rem;
    opacity: 1;
  }

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
