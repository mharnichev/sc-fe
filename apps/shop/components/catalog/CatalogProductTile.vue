<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import { NuxtLink } from '#components'
import { localizedPackageSize } from '~/utils/catalog-metadata-localization'
import { getProductDiscount, getProductStatusFlags } from '~/utils/product-status'
import { isProductHidden, isProductUnavailable } from '~/utils/product-visibility'

const { productDisplayName, productDisplayType } = useProductDisplay()

const props = defineProps<{
  product: ProductDto
}>()

const cart = useCartStore()
const favorites = useFavoritesStore()
const { terms, locale } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()
const sku = computed(() => typeof props.product.sku === 'string' ? props.product.sku.trim() : '')
const nameViewport = ref<HTMLElement | null>(null)
const nameMeasure = ref<HTMLElement | null>(null)
const isNameTruncated = ref(false)
const nameScrollDistance = ref(0)
let nameObserver: ResizeObserver | undefined
let nameMedia: MediaQueryList | undefined
let nameFonts: FontFaceSet | undefined
let nameFrame: number | undefined
let nameDisposed = false

const measureNameOverflow = () => {
  const viewport = nameViewport.value
  const measure = nameMeasure.value
  const style = viewport ? getComputedStyle(viewport) : undefined
  const lineHeight = Number.parseFloat(style?.lineHeight || '')
  if (viewport && measure && style) {
    measure.style.width = `${viewport.getBoundingClientRect().width}px`
    measure.style.font = style.font
    measure.style.letterSpacing = style.letterSpacing
  }
  const height = measure?.getBoundingClientRect().height || 0
  const visible = nameMedia?.matches && viewport && viewport.getBoundingClientRect().width > 0
  isNameTruncated.value = Boolean(visible && Number.isFinite(lineHeight) && lineHeight > 0 && height > lineHeight * 2 + 1)
  nameScrollDistance.value = isNameTruncated.value ? Math.max(0, height - lineHeight * 3) : 0
}

const scheduleNameMeasurement = () => {
  if (nameDisposed || !import.meta.client) return
  if (nameFrame !== undefined) window.cancelAnimationFrame(nameFrame)
  nameFrame = window.requestAnimationFrame(() => {
    nameFrame = undefined
    measureNameOverflow()
  })
}

watch([() => productDisplayName(props.product), () => props.product.id, locale], () => nextTick(scheduleNameMeasurement))

onMounted(() => {
  nameMedia = window.matchMedia('(min-width: 520px) and (hover: hover) and (pointer: fine)')
  nameMedia.addEventListener('change', scheduleNameMeasurement)
  if (typeof ResizeObserver !== 'undefined') {
    nameObserver = new ResizeObserver(scheduleNameMeasurement)
    if (nameViewport.value) nameObserver.observe(nameViewport.value)
    if (nameMeasure.value) nameObserver.observe(nameMeasure.value)
  }
  window.addEventListener('resize', scheduleNameMeasurement, { passive: true })
  nameFonts = document.fonts
  void nameFonts?.ready.then(scheduleNameMeasurement)
  nameFonts?.addEventListener('loadingdone', scheduleNameMeasurement)
  scheduleNameMeasurement()
})

onBeforeUnmount(() => {
  nameDisposed = true
  if (nameFrame !== undefined) window.cancelAnimationFrame(nameFrame)
  nameObserver?.disconnect()
  nameMedia?.removeEventListener('change', scheduleNameMeasurement)
  nameFonts?.removeEventListener('loadingdone', scheduleNameMeasurement)
  window.removeEventListener('resize', scheduleNameMeasurement)
})

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
const selectPreview = (index: number) => {
  previewReady.value = true
  activeImage.value = index
}
const resetOnFocusOut = (event: FocusEvent) => {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) resetPreview()
}
const failedImages = ref<string[]>([])
const previewSource = (src: string) => failedImages.value.includes(src)
  ? images.value.find(image => !failedImages.value.includes(image.src))?.src || 'https://placehold.co/640x640?text=Product'
  : src
const imageFailed = (event: Event) => {
  const src = (event.target as HTMLImageElement).getAttribute('src')
  if (src && !failedImages.value.includes(src)) failedImages.value.push(src)
}

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
  failedImages.value = []
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
const isTop = computed(() => getProductStatusFlags(props.product).isTop)
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
  <article
    class="catalog-product-tile"
    :class="{
      'catalog-product-tile--unavailable': isUnavailable,
      'catalog-product-tile--long-name': isNameTruncated,
      'catalog-product-tile--scroll-name': nameScrollDistance > 1,
    }"
    :style="{ '--name-scroll-distance': `${nameScrollDistance}px`, '--name-scroll-duration': `${Math.max(4, nameScrollDistance / 12)}s` }"
    itemscope
    itemtype="https://schema.org/Product"
    @pointerleave="($event.pointerType === 'mouse') && resetPreview()"
    @focusout="resetOnFocusOut"
  >
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
                :src="previewSource(image.src)"
                @error="imageFailed"
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

      <ProductStatusBadges class="catalog-product-tile__badges" :product="product" :show-top="false" />

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

    <div class="catalog-product-tile__body">
      <span v-if="isTop" class="catalog-product-tile__top" role="img" :aria-label="terms.catalog.badges.top" :title="terms.catalog.badges.top">
        <BaseIcon name="star" size="xxs" />
      </span>
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

      <div
        v-if="hasPreview"
        class="catalog-product-tile__dots"
        role="group"
        :aria-label="locale === 'uk' ? 'Фото товару' : 'Product images'"
        @keydown.esc="resetPreview"
      >
        <div class="catalog-product-tile__dot-options">
          <BaseButton
            v-for="(_, index) in images"
            :key="index"
            class="catalog-product-tile__dot-target"
            variant="borderless"
            size="xs"
            :aria-label="`${locale === 'uk' ? 'Фото' : 'Image'} ${index + 1} / ${images.length}`"
            :aria-pressed="index === activeImage"
            @click="selectPreview(index)"
          >
            <span
              class="catalog-product-tile__dot"
              :class="{ 'catalog-product-tile__dot--active': index === activeImage }"
              aria-hidden="true"
            />
          </BaseButton>
        </div>
      </div>
      <div class="catalog-product-tile__desktop-layout">
        <div class="catalog-product-tile__primary">
          <component
            :is="isHidden ? 'div' : NuxtLink"
            class="catalog-product-tile__name-link"
            :to="isHidden ? undefined : `/products/${product.slug}`"
          >
            <h3
              ref="nameViewport"
              class="catalog-product-tile__name type-title-title"
              itemprop="name"
            >
              <BaseHoverUnderlineText class="catalog-product-tile__name-text">
                {{ productDisplayName(product) }}
              </BaseHoverUnderlineText>
            </h3>
            <span ref="nameMeasure" class="catalog-product-tile__name-measure" aria-hidden="true">{{ productDisplayName(product) }}</span>
          </component>

        </div>
        <div class="catalog-product-tile__details">
          <div class="catalog-product-tile__type-row">
            <p class="catalog-product-tile__type">{{ productType }}</p>
            <p v-if="sku" class="catalog-product-tile__sku"><span class="catalog-product-tile__sku-text">{{ locale === 'uk' ? 'Код товару' : 'Product code' }}: {{ sku }}</span></p>
          </div>
          <div class="catalog-product-tile__details-row">
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
  top: -3.25rem;
  bottom: auto;
  left: 50%;
  z-index: 4;
  display: flex;
  /* Reserve the two 2rem controls and a 0.5rem gap on either side. */
  max-width: calc(100% - 5rem);
  flex-wrap: nowrap;
  gap: 0;
  border-radius: 1rem;
  background: transparent;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 0.375rem);
  transition: opacity 500ms var(--catalog-product-tile-motion-easing), transform 500ms var(--catalog-product-tile-motion-easing);
}

.catalog-product-tile__dots::before {
  position: absolute;
  inset: 11px 0;
  border-radius: 1rem;
  background: #ffffff;
  content: '';
  pointer-events: none;
}

.catalog-product-tile__dot-options {
  display: flex;
  height: 44px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.catalog-product-tile__dot-options::-webkit-scrollbar {
  display: none;
}

.catalog-product-tile:focus-within .catalog-product-tile__dots {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

@media (hover: hover) and (pointer: fine) {
  .catalog-product-tile:hover .catalog-product-tile__image--single {
    transform: scale(1.1);
  }

  .catalog-product-tile:hover .catalog-product-tile__dots {
    opacity: 1;
    pointer-events: auto;
    transform: translate(-50%, 0);
  }
}

.catalog-product-tile__dot-target.sc-button {
  --sc-button-bg: transparent;
  --sc-button-border: transparent;
  --sc-button-fill: transparent;
  position: relative;
  width: 24px;
  min-width: 24px;
  height: 44px;
  min-height: 44px;
  flex: 0 0 24px;
  padding: 0;
  border-radius: 0;
  pointer-events: inherit;
}

.catalog-product-tile__dot-target:focus-visible {
  outline: 2px solid #262626;
  outline-offset: -3px;
}

@media (hover: none), (pointer: coarse) {
  .catalog-product-tile__dots {
    opacity: 1;
    pointer-events: auto;
    transform: translate(-50%, 0);
  }
}

.catalog-product-tile__dot {
  display: block;
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
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  pointer-events: none;
  transition: padding 280ms ease;
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
  transition: max-height 280ms ease;
}

.catalog-product-tile__name-measure {
  position: absolute;
  inset: 0 auto auto 0;
  display: block;
  visibility: hidden;
  pointer-events: none;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.catalog-product-tile__name-link {
  position: relative;
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
  text-align: left;
  white-space: nowrap;
}

.catalog-product-tile__details {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.catalog-product-tile__type-row {
  position: relative;
  display: grid;
}

.catalog-product-tile__sku {
  display: none;
}

@media (min-width: 520px) and (hover: hover) and (pointer: fine) {
  .catalog-product-tile--long-name:hover .catalog-product-tile__body,
  .catalog-product-tile--long-name:focus-within .catalog-product-tile__body {
    padding-block: 0.95rem;
  }

  .catalog-product-tile--long-name:hover .catalog-product-tile__name,
  .catalog-product-tile--long-name:focus-within .catalog-product-tile__name {
    max-height: 3.9em;
    -webkit-line-clamp: unset;
  }

  .catalog-product-tile--scroll-name:hover .catalog-product-tile__name-text,
  .catalog-product-tile--scroll-name:focus-within .catalog-product-tile__name-text {
    animation: catalog-product-name-scroll var(--name-scroll-duration) ease-in-out 900ms infinite alternate;
  }

  .catalog-product-tile__sku {
    display: block;
    min-height: 0;
    max-height: 0;
    max-width: 100%;
    overflow: hidden;
    color: #737373;
    font-size: 10px;
    line-height: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
    visibility: hidden;
    opacity: 0;
    transition: opacity 240ms ease, visibility 0s linear 240ms, max-height 240ms ease;
  }

  .catalog-product-tile__sku-text {
    display: block;
    padding-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    transform: translateY(3px);
    transition: transform 240ms ease;
  }

  .catalog-product-tile:hover .catalog-product-tile__sku {
    max-height: 20px;
    visibility: visible;
    opacity: 1;
    transition-delay: 80ms, 0s, 0s;
  }

  .catalog-product-tile:hover .catalog-product-tile__sku-text {
    transform: translateY(0);
    transition-delay: 80ms;
  }
}

@keyframes catalog-product-name-scroll {
  0%, 15% { transform: translateY(0); }
  85%, 100% { transform: translateY(calc(-1 * var(--name-scroll-distance))); }
}

.catalog-product-tile__details-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: auto;
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
  top: -2.75rem;
  right: 0;
  z-index: 3;
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  min-height: 2rem;
}

.catalog-product-tile__top {
  position: absolute;
  top: -2.75rem;
  left: 0;
  z-index: 2;
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(145deg, rgb(255 246 196 / 0.4), rgb(255 239 153 / 0.16));
  color: #9a7016;
  -webkit-backdrop-filter: blur(16px) saturate(135%);
  backdrop-filter: blur(16px) saturate(135%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.45), inset 0 -1px 0 rgb(0 0 0 / 0.04), 0 2px 8px rgb(0 0 0 / 0.1);
  pointer-events: none;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .catalog-product-tile__top {
    background: #fff8d6;
  }
}

@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .catalog-product-tile__top {
    background: #fff8d6;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

@media (forced-colors: active) {
  .catalog-product-tile__top {
    background: Canvas;
    color: CanvasText;
    box-shadow: none;
  }
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
    gap: 0.25rem;
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
  justify-content: flex-start;
  min-width: 0;
  align-items: baseline;
  gap: 0.25rem;
  color: #0a0a0a;
  font-weight: 600;
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

.catalog-product-tile__cart--buy .catalog-product-tile__cart-label {
  flex-shrink: 0;
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: normal;
}

.catalog-product-tile__cart--buy .catalog-product-tile__cart-arrow.base-icon {
  min-width: 16px;
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
    font-size: 14px;
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
    padding: 8px 12px;
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
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .catalog-product-tile__mobile-name-text :deep(.base-hover-underline-text__content) {
    font-size: 14px;
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

  .catalog-product-tile__mobile-purchase-row .catalog-product-tile__cart--buy {
    width: 72px;
    min-width: 72px;
    height: 24px;
    min-height: 24px;
    padding: 0 8px;
    font-size: 10px;
    line-height: 16px;
    white-space: nowrap;
  }

  .catalog-product-tile__cart--buy .catalog-product-tile__cart-arrow.base-icon {
    width: 12px;
    height: 12px;
    min-width: 12px;
  }

  .catalog-product-tile__cart--buy .catalog-product-tile__cart-label {
    padding-left: 0;
  }

  .catalog-product-tile__cart--buy :deep(.sc-button__text) {
    gap: 3px;
  }

  .catalog-product-tile__volume.base-badge {
    flex-shrink: 0;
    white-space: normal;
    min-width: 0;
    max-width: 50%;
    min-height: 24px;
    height: 24px;
    padding: 0 8px;
    overflow: hidden;
    font-size: 10px;
    line-height: 16px;
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
    padding-inline: 12px;
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
  .catalog-product-tile__sku,
  .catalog-product-tile__sku-text {
    transform: none;
    transition: none;
  }

  .catalog-product-tile,
  .catalog-product-tile__body,
  .catalog-product-tile__details,
  .catalog-product-tile__details-row,
  .catalog-product-tile__bottom,
  .catalog-product-tile__name,
  .catalog-product-tile__name-text {
    transition: none;
    animation: none !important;
  }
}
</style>
