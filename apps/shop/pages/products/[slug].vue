<script setup lang="ts">
import type { ProductDto, ProductReviewListDto } from '@shared-types'
import { localBrandLogoUrl, resolveApiAssetUrl } from '@shared-utils'
import type { CategoryRouteCrumb } from '~/utils/category-routing'
import { categoryGoodsPath, categoryLandingPath } from '~/utils/category-routing'
import { getProductDiscount } from '~/utils/product-status'
import { productPageCopy } from '~/utils/product-page-localization'
import { isProductUnavailable } from '~/utils/product-visibility'
import { catalogCharacteristicKind, localizedMetadataLabel, localizedMetadataValue, localizedPackageSize, localizedVolumeLabel } from '~/utils/catalog-metadata-localization'
const { runtimeMessage } = useShopRuntimeDisplay()

const { categoryDisplayName } = useCategoryDisplay()

const { productDisplayName, productDisplayType, productDisplayContent } = useProductDisplay()

const route = useRoute()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const domain = useCatalogDomain()
const cart = useCartStore()
const favorites = useFavoritesStore()
const auth = useCustomerAuthStore()
const recentlyViewed = useRecentlyViewedStore()
const { terms, dateLocale, locale } = useShopLocale()
const productText = computed(() => productPageCopy[locale.value === 'en' ? 'en' : 'uk'])
const { formatPrice } = useShopPriceFormatter()

const emptyReviews: ProductReviewListDto = { total: 0, average_rating: null, items: [] }
const productDataKey = computed(() => `product-${String(route.params.slug)}`)
const productReviewsDataKey = computed(() => `product-reviews-${String(route.params.slug)}`)
const {
  data: product,
  pending: productPending,
  error: productError,
  refresh: refreshProduct,
} = await useLazyAsyncData(
  productDataKey,
  () => domain.getProduct(String(route.params.slug)),
)
const { data: reviewsPage, pending: reviewsPending, refresh: refreshReviews } = await useAsyncData<ProductReviewListDto>(
  productReviewsDataKey,
  async () => product.value ? await domain.getProductReviews(product.value.id) : emptyReviews,
  { watch: [() => product.value?.id] },
)

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { statusCode?: unknown, status?: unknown, data?: { statusCode?: unknown } }
  return [candidate.statusCode, candidate.status, candidate.data?.statusCode].some(value => Number(value) === 404)
}

const selectedImage = ref('')
const isGalleryModalOpen = ref(false)
const isGalleryImageZoomed = ref(false)
const galleryModalTouchStartX = ref<number | null>(null)
const mobileGallery = ref<HTMLElement | null>(null)
const activeGallerySlideIndex = ref(0)
const reviewForm = reactive({ text: '', rating: 5 })
const reviewState = reactive({ loading: false, error: '', done: false })
const recordedProductIds = new Set<number>()
const ratingOptions = [5, 4, 3, 2, 1]
/*
 * Temporarily hidden together with the product delivery block in the template.
const fulfillmentOptions = [
  'Відділення Нової пошти',
  'Курʼєр',
  'Оплата при отриманні',
  'Карткою при отриманні',
]
*/

const decodeHtmlEntities = (value: string) => value
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&mdash;/g, '-')
  .replace(/&ndash;/g, '-')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')

const htmlToText = (value: string | null | undefined) =>
  decodeHtmlEntities(String(value ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()

const removeCompositionFromDescription = (value: string) => {
  const compositionLabel = /(?:склад|ingredients?)\s*:/i.exec(value)
  if (!compositionLabel) return value.trim()

  const beforeComposition = value.slice(0, compositionLabel.index)
  const paragraphStart = beforeComposition.lastIndexOf('<p')
  const lastParagraphEnd = beforeComposition.lastIndexOf('</p>')

  return (paragraphStart > lastParagraphEnd ? value.slice(0, paragraphStart) : beforeComposition).trim()
}

const galleryImages = computed(() => product.value?.images || [])
const productComposition = computed(() => htmlToText(product.value ? productDisplayContent(product.value, 'ingredients') : ''))
const hasComposition = computed(() => Boolean(productComposition.value))
const galleryItems = computed(() => {
  const items: Array<{
    type: 'image'
    image: typeof galleryImages.value[number]
    imageIndex: number
  } | { type: 'composition' }> = []

  galleryImages.value.forEach((image, index) => {
    items.push({ type: 'image', image, imageIndex: index })
    if (hasComposition.value && (index === 1 || (galleryImages.value.length === 1 && index === 0))) {
      items.push({ type: 'composition' })
    }
  })

  return items
})
const selectedModalImage = computed(() => selectedImage.value || galleryImages.value[0]?.image || 'https://placehold.co/1000x1000?text=Product')
const selectedModalImageIndex = computed(() => Math.max(
  galleryImages.value.findIndex(image => image.image === selectedModalImage.value),
  0,
))
const productType = computed(() => product.value ? productDisplayType(product.value) : '')
const breadcrumbs = computed(() => {
  if (!product.value) return []
  return product.value.category_tree.length ? product.value.category_tree : [product.value.category]
})
const categoryBreadcrumbLink = (index: number) => {
  const segments = breadcrumbs.value.slice(0, index + 1).map(category => category.slug)
  return index < breadcrumbs.value.length - 1 ? categoryLandingPath(segments) : categoryGoodsPath(segments)
}
const productBreadcrumbItems = computed<CategoryRouteCrumb[]>(() => {
  if (!product.value) return []

  return [
    { id: 0, name: terms.value.common.catalog, slug: 'catalog', to: '/catalog' },
    ...breadcrumbs.value.map((category, index) => ({
      id: category.id,
      name: categoryDisplayName(category),
      slug: category.slug,
      to: categoryBreadcrumbLink(index),
    })),
    { id: product.value.id, name: productDisplayName(product.value), slug: product.value.slug },
  ]
})
const averageRating = computed(() => reviewsPage.value?.average_rating || product.value?.average_rating || null)
const reviewsCount = computed(() => reviewsPage.value?.total ?? product.value?.reviews_count ?? 0)
const productDescriptionHtml = computed(() => {
  const description = (product.value ? productDisplayContent(product.value, 'description') : '').trim()
  return productComposition.value ? removeCompositionFromDescription(description) : description
})
const plainProductDescription = computed(() =>
  htmlToText(productDescriptionHtml.value || (product.value ? productDisplayContent(product.value, 'short_description') : '')),
)
const isFavorite = computed(() => product.value ? favorites.has(product.value.id) : false)
const isInCart = computed(() => product.value ? cart.items.some(item => item.product.id === product.value?.id) : false)
const discount = computed(() => product.value ? getProductDiscount(product.value) : null)
const productCode = computed(() => product.value?.sku || String(product.value?.id || ''))
const availableVolumeVariants = computed(() =>
  (product.value?.volume_variants ?? []).filter(variant => variant.is_available),
)
const hasVolumeVariants = computed(() =>
  availableVolumeVariants.value.length > 1,
)
const volumeTabs = computed(() =>
  availableVolumeVariants.value.map(variant => ({
    label: localizedVolumeLabel(variant, locale.value),
    value: String(variant.id),
    to: variant.id === product.value?.id ? undefined : `/products/${variant.slug}`,
  })),
)
const shopAsset = useShopAsset()
const brandLogoUrl = computed(() => {
  const brand = product.value?.brand
  if (!brand) return ''

  return resolveApiAssetUrl(brand.logo_url, String(config.public.apiBase), requestUrl.origin)
    || shopAsset(localBrandLogoUrl(brand.slug))
})
const brandCatalogRoute = computed(() => ({
  path: '/catalog',
  query: { brand: product.value?.brand.slug || undefined },
}))
const isBrandCharacteristic = (name: string) => catalogCharacteristicKind(name) === 'brand'
const isCategoryCharacteristic = (name: string) => catalogCharacteristicKind(name) === 'category'
const isProductCodeCharacteristic = (name: string) => catalogCharacteristicKind(name) === 'code'
const parameterEntries = computed(() =>
  Object.entries(product.value?.parameters || {})
    .filter(([name]) => !isCategoryCharacteristic(name) && !isProductCodeCharacteristic(name))
    .map(([name, value]) => [
      localizedMetadataLabel(name, name, locale.value),
      localizedMetadataValue(name, value, locale.value),
    ]),
)
const volumeLabel = computed(() => localizedMetadataLabel('volume', 'Об’єм', locale.value))
const fallbackCharacteristicEntries = computed(() => {
  if (!product.value) return []

  return [
    [terms.value.catalog.brand, product.value.brand.name],
    [volumeLabel.value, localizedPackageSize(product.value.package_size || '', locale.value)],
  ].filter(([, value]) => value)
})
const characteristicEntries = computed(() =>
  (parameterEntries.value.length ? parameterEntries.value : fallbackCharacteristicEntries.value).slice(0, 8),
)

const toggleFavorite = async () => {
  if (!product.value) return
  await favorites.toggle(product.value.id, product.value)
}

const toggleCart = async () => {
  if (!product.value) return
  await cart.toggle(product.value)
}

const recordProductView = (viewedProduct: ProductDto) => {
  recentlyViewed.add(viewedProduct)
  if (recordedProductIds.has(viewedProduct.id)) return
  recordedProductIds.add(viewedProduct.id)

  void domain.recordProductView(viewedProduct.id).catch(error => {
    recordedProductIds.delete(viewedProduct.id)
    console.error('Failed to record product view', error)
  })
}

onMounted(() => {
  if (product.value) recordProductView(product.value)
  window.addEventListener('keydown', onGalleryModalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGalleryModalKeydown)
})

watch(
  () => product.value,
  (viewedProduct, previousProduct) => {
    if (import.meta.client && viewedProduct && viewedProduct.id !== previousProduct?.id) {
      recordProductView(viewedProduct)
    }
  },
)

watch(productError, error => {
  if (import.meta.client && isNotFoundError(error)) {
    recentlyViewed.removeBySlug(String(route.params.slug))
  }
}, { immediate: true })

watch(galleryImages, images => {
  selectedImage.value = images[0]?.image || ''
  activeGallerySlideIndex.value = 0
  if (import.meta.client) {
    void nextTick(() => mobileGallery.value?.scrollTo({ left: 0 }))
  }
}, { immediate: true })

const selectImage = (image: string) => {
  selectedImage.value = image
  isGalleryImageZoomed.value = false
}

const openGalleryImage = (image: string) => {
  selectImage(image)
  isGalleryModalOpen.value = true
}

const closeGalleryModal = () => {
  isGalleryModalOpen.value = false
  isGalleryImageZoomed.value = false
}

const moveGalleryModalImage = (direction: 1 | -1) => {
  const imageCount = galleryImages.value.length
  if (imageCount < 2) return

  const nextIndex = (selectedModalImageIndex.value + direction + imageCount) % imageCount
  selectImage(galleryImages.value[nextIndex].image)
}

const toggleGalleryImageZoom = () => {
  isGalleryImageZoomed.value = !isGalleryImageZoomed.value
}

const onGalleryModalTouchStart = (event: TouchEvent) => {
  galleryModalTouchStartX.value = event.changedTouches[0]?.clientX ?? null
}

const onGalleryModalTouchEnd = (event: TouchEvent) => {
  const touchStartX = galleryModalTouchStartX.value
  const touchEndX = event.changedTouches[0]?.clientX
  galleryModalTouchStartX.value = null
  if (touchStartX === null || touchEndX === undefined || Math.abs(touchEndX - touchStartX) < 48) return

  moveGalleryModalImage(touchEndX < touchStartX ? 1 : -1)
}

const onGalleryModalKeydown = (event: KeyboardEvent) => {
  if (!isGalleryModalOpen.value) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    moveGalleryModalImage(-1)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    moveGalleryModalImage(1)
  }
}

const updateActiveGallerySlide = () => {
  const gallery = mobileGallery.value
  if (!gallery || !gallery.clientWidth) return
  activeGallerySlideIndex.value = Math.min(
    Math.max(Math.round(gallery.scrollLeft / gallery.clientWidth), 0),
    galleryItems.value.length - 1,
  )
}

const scrollGalleryTo = (index: number) => {
  const gallery = mobileGallery.value
  if (!gallery) return
  gallery.scrollTo({ left: index * gallery.clientWidth, behavior: 'smooth' })
}

const formatDate = (value: string) => new Intl.DateTimeFormat(dateLocale.value, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(value))

const submitReview = async () => {
  if (reviewState.loading || !product.value || !auth.isAuthenticated || !reviewForm.text.trim()) return

  reviewState.loading = true
  reviewState.error = ''
  reviewState.done = false
  try {
    await domain.createProductReview(product.value.id, {
      rating: reviewForm.rating,
      comment: reviewForm.text.trim(),
    })
    reviewForm.text = ''
    reviewForm.rating = 5
    reviewState.done = true
    await Promise.all([refreshReviews(), refreshProduct()])
  }
  catch (error) {
    reviewState.error = terms.value.product.saveReviewError
    console.error(error)
  }
  finally {
    reviewState.loading = false
  }
}

const deleteReview = async (reviewId: number) => {
  if (!product.value) return

  reviewState.loading = true
  reviewState.error = ''
  try {
    await domain.deleteProductReview(product.value.id, reviewId)
    await Promise.all([refreshReviews(), refreshProduct()])
  }
  catch (error) {
    reviewState.error = terms.value.product.deleteReviewError
    console.error(error)
  }
  finally {
    reviewState.loading = false
  }
}

useSeo(
  () => (locale.value === 'en' ? '' : product.value?.seo_title) || (product.value ? productDisplayName(product.value) : '') || terms.value.seo.productFallbackTitle,
  () => (locale.value === 'en' ? plainProductDescription.value : product.value?.seo_description) || (product.value ? productDisplayContent(product.value, 'short_description') : '') || plainProductDescription.value || terms.value.seo.productFallbackDescription,
)

useHead(() => ({
  script: product.value ? [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: productDisplayName(product.value),
        description: plainProductDescription.value,
        sku: product.value.sku,
        image: product.value.images.map(image => image.image),
        brand: { '@type': 'Brand', name: product.value.brand.name },
        aggregateRating: averageRating.value ? {
          '@type': 'AggregateRating',
          ratingValue: averageRating.value,
          reviewCount: reviewsCount.value,
        } : undefined,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'UAH',
          price: product.value.price,
          availability: product.value.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
      }),
    },
  ] : [],
}))
</script>

<template>
  <section v-if="product" class="product-page">
    <div class="product-page__container">
      <CatalogBreadcrumbs :items="productBreadcrumbItems" :pending="productPending" />

      <div class="product-page__body">
        <div class="product-page__preview">
          <div class="product-page__preview-wrapper">
            <section
              class="product-gallery"
              itemscope
              itemtype="https://schema.org/Product"
            >
              <meta v-if="galleryImages[0]?.image" itemprop="image" :content="galleryImages[0].image">
              <div
                ref="mobileGallery"
                class="product-gallery__track"
                :class="{ 'product-gallery__track--single-image': galleryImages.length === 1 }"
                :aria-label="productText.gallery"
                @scroll.passive="updateActiveGallerySlide"
              >
                <template v-for="(item, index) in galleryItems" :key="item.type === 'image' ? item.image.image : 'composition'">
                  <BaseButton
                    v-if="item.type === 'image'"
                    class="product-gallery__image-button"
                    type="button"
                    variant="borderless"
                    :aria-label="productText.openImage(item.imageIndex + 1, productDisplayName(product))"
                    @click="openGalleryImage(item.image.image)"
                  >
                    <img
                      :src="item.image.image"
                      :alt="item.image.alt || productDisplayName(product)"
                      class="product-gallery__image"
                      draggable="false"
                      itemprop="image"
                    >
                  </BaseButton>
                  <article
                    v-else
                    class="product-gallery__composition-card"
                    :aria-label="productText.compositionTitle"
                  >
                    <BaseBadge class="product-gallery__composition-label" tone="neutral">{{ productText.composition }}</BaseBadge>
                    <div class="product-gallery__composition-content">
                      <p>{{ productComposition }}</p>
                    </div>
                  </article>
                </template>
              </div>

              <div v-if="galleryItems.length > 1" class="product-gallery__indicator" :aria-label="productText.galleryNavigation">
                <BaseButton
                  v-for="(_, index) in galleryItems"
                  :key="index"
                  class="product-gallery__indicator-button"
                  type="button"
                  variant="borderless"
                  shape="circle"
                  :class="{ 'product-gallery__indicator-button--active': activeGallerySlideIndex === index }"
                  :aria-label="productText.goToSlide(index + 1, galleryItems.length)"
                  :aria-current="activeGallerySlideIndex === index ? 'true' : undefined"
                  @click="scrollGalleryTo(index)"
                />
              </div>
            </section>
          </div>
        </div>

        <div class="product-page__info">
          <section class="product-buy" itemscope itemtype="https://schema.org/Product">
            <meta itemprop="sku" :content="product.sku">
            <meta itemprop="brand" :content="product.brand.name">
            <meta itemprop="productID" :content="String(product.id)">
            <meta itemprop="name" :content="productDisplayName(product)">

            <div class="product-buy__header">
              <div>
                <div class="product-buy__title-row">
                  <h1 class="product-buy__name">{{ productDisplayName(product) }}</h1>
                </div>
                <div class="product-buy__meta-row">
                  <p v-if="productType" class="product-buy__type">{{ productType }}</p>
                  <span v-if="productType" aria-hidden="true">/</span>
                  <span class="product-buy__code">{{ terms.catalog.productCode }}: {{ productCode }}</span>
                </div>
              </div>
              <BaseButton
                class="product-buy__favorite"
                :class="{ 'product-buy__favorite--active': isFavorite }"
                type="button"
                variant="text"
                size="sm"
                shape="circle"
                :aria-label="isFavorite ? terms.product.removeFavorite : terms.product.saveFavorite"
                @click="toggleFavorite"
              >
                <BaseIcon name="heart" size="xxs" effect="heart" />
              </BaseButton>
            </div>

            <div class="product-buy__badges">
              <ProductStatusBadges class="product-buy__header-badges" :product="product" />
              <BaseBadge v-if="averageRating" tone="dark">{{ averageRating }}/5</BaseBadge>
              <BaseBadge v-if="reviewsCount > 0" class="product-buy__badge--borderless" tone="neutral">
                {{ reviewsCount }} {{ terms.product.reviews }}
              </BaseBadge>
            </div>

            <section v-if="characteristicEntries.length" class="product-characteristics">
              <h2 class="product-section-title">{{ productText.characteristics }}</h2>
              <dl class="product-characteristics__list">
                <div
                  v-for="[name, value] in characteristicEntries"
                  :key="name"
                  class="product-characteristics__item"
                  itemprop="additionalProperty"
                  itemscope
                  itemtype="https://schema.org/PropertyValue"
                >
                  <dt itemprop="name">{{ name }}</dt>
                  <dd
                    itemprop="value"
                    :class="{ 'product-characteristics__brand': isBrandCharacteristic(name) }"
                  >
                    <NuxtLink
                      v-if="isBrandCharacteristic(name) && product.brand.slug"
                      class="product-characteristics__brand-link"
                      :to="brandCatalogRoute"
                    >
                      <img
                        v-if="brandLogoUrl"
                        class="product-characteristics__brand-logo"
                        :src="brandLogoUrl"
                        alt=""
                        width="40"
                        height="24"
                        loading="lazy"
                      >
                      <BaseHoverUnderlineText>{{ value }}</BaseHoverUnderlineText>
                    </NuxtLink>
                    <template v-else>
                      <img
                        v-if="isBrandCharacteristic(name) && brandLogoUrl"
                        class="product-characteristics__brand-logo"
                        :src="brandLogoUrl"
                        alt=""
                        width="40"
                        height="24"
                        loading="lazy"
                      >
                      <span>{{ value }}</span>
                    </template>
                  </dd>
                </div>
              </dl>
            </section>

            <div v-if="hasVolumeVariants" class="product-buy__variants">
              <span class="product-buy__variants-label">{{ volumeLabel }}</span>
              <CatalogSortTabs
                class="product-buy__variants-tabs"
                :model-value="String(product.id)"
                :tabs="volumeTabs"
                :aria-label="productText.chooseVolume"
              />
            </div>

            <div class="product-buy__cost" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <meta itemprop="priceCurrency" content="UAH">
              <meta itemprop="price" :content="product.price">
              <div class="product-buy__price-with-badge">
                <ProductStatusBadges class="product-buy__cost-badges" :product="product" />
                <div class="product-buy__price-wrapper" :class="{ 'product-buy__price-wrapper--discount': discount }">
                  <p v-if="discount" class="product-buy__old-price">
                    {{ formatPrice(discount.compareAtPrice) }}
                  </p>
                  <p class="product-buy__price" :class="{ 'product-buy__price--discount': discount }" itemprop="price">
                    {{ formatPrice(product.price) }}
                  </p>
                </div>
              </div>
              <BaseButton
                class="product-buy__button"
                type="button"
                :variant="isInCart ? 'outline-dark' : 'dark'"
                :disabled="cart.syncing || (isProductUnavailable(product) && !isInCart)"
                block
                @click="toggleCart"
              >
                <BaseIcon :name="isInCart ? 'check' : 'shopping-cart'" size="xxs" />
                {{ isInCart ? terms.product.removeFromCart : terms.product.addToCart }}
              </BaseButton>
            </div>
            <p v-if="cart.error" class="product-page__error">{{ runtimeMessage(cart.error) }}</p>
            <p v-if="favorites.error" class="product-page__error">{{ runtimeMessage(favorites.error) }}</p>
          </section>

          <!-- Temporarily hidden product delivery block.
          <section class="product-delivery">
            <div class="product-delivery__location">
              <span>Відправка з:</span>
              <strong>м. Київ</strong>
            </div>
            <ul class="product-delivery__list">
              <li v-for="item in fulfillmentOptions" :key="item" class="product-delivery__item">
                {{ item }}
              </li>
            </ul>
          </section>
          -->

          <section v-if="productDescriptionHtml" class="product-description" itemprop="description">
            <h2 class="product-section-title">{{ productText.description }}</h2>
            <div class="product-description__html" v-html="productDescriptionHtml" />
          </section>
        </div>
      </div>

      <section class="product-reviews">
        <div class="product-reviews__list">
          <div class="product-reviews__header">
            <h2>{{ terms.product.reviewsTitle }}</h2>
            <span>{{ reviewsCount }} {{ terms.product.total }}</span>
          </div>

          <div v-if="reviewsPending" class="product-reviews__muted">{{ terms.product.loadingReviews }}</div>
          <article v-for="review in reviewsPage?.items || []" :key="review.id" class="product-review">
            <div class="product-review__header">
              <div>
                <p>{{ review.customer_name || terms.product.customer }}</p>
                <span>{{ formatDate(review.created_at) }}</span>
              </div>
              <BaseBadge tone="dark">{{ review.rating }}/5</BaseBadge>
            </div>
            <p class="product-review__comment">{{ review.comment }}</p>
            <BaseButton
              v-if="review.customer_id === auth.customer?.id"
              class="product-review__delete"
              type="button"
              variant="outline-dark"
              size="xs"
              :disabled="reviewState.loading"
              @click="deleteReview(review.id)"
            >
              {{ terms.product.delete }}
            </BaseButton>
          </article>
          <p v-if="!reviewsPending && !(reviewsPage?.items || []).length" class="product-reviews__muted">
            {{ terms.product.noReviews }}
          </p>
        </div>

        <form class="product-reviews__form" @submit.prevent="submitReview">
          <h2>{{ terms.product.leaveReview }}</h2>
          <div class="product-reviews__rating">
            <p>{{ terms.product.rating }}</p>
            <div>
              <BaseRadio
                v-for="rating in ratingOptions"
                :key="rating"
                :model-value="reviewForm.rating"
                :value="rating"
                name="review-rating"
                :label="`${rating}`"
                :disabled="!auth.isAuthenticated"
                @update:model-value="reviewForm.rating = Number($event)"
              />
            </div>
          </div>
          <BaseTextarea
            v-model="reviewForm.text" rule="review"
            :label="terms.product.review"
            :rows="5"
            :disabled="!auth.isAuthenticated"
            :placeholder="terms.product.reviewPlaceholder"
          />
          <div v-if="auth.isAuthenticated" class="product-reviews__actions">
            <BaseButton type="submit" :disabled="reviewState.loading || !reviewForm.text.trim()">
              {{ reviewState.loading ? terms.product.saving : terms.product.submit }}
            </BaseButton>
            <p v-if="reviewState.done" class="product-reviews__success">{{ terms.product.reviewSaved }}</p>
          </div>
          <div v-else class="product-reviews__actions">
            <p class="product-reviews__muted">{{ terms.product.signInToReview }}</p>
            <CustomerAuthDialog />
          </div>
          <p v-if="reviewState.error" class="product-page__error">{{ runtimeMessage(reviewState.error) }}</p>
        </form>
      </section>

      <RecentlyViewedProducts :exclude-product-id="product.id" />
    </div>

    <BaseModal
      v-model="isGalleryModalOpen"
      type="fullscreen"
      root-class="product-gallery-modal"
      content-type="primary"
      @close="closeGalleryModal"
    >
      <template #header-title>
        {{ selectedModalImageIndex + 1 }} / {{ galleryImages.length }}
      </template>

      <div
        class="product-gallery-modal__body"
        @touchstart.passive="onGalleryModalTouchStart"
        @touchend.passive="onGalleryModalTouchEnd"
      >
        <BaseButton
          v-if="galleryImages.length > 1"
          class="product-gallery-modal__control product-gallery-modal__previous"
          type="button"
          variant="outline-dark"
          shape="circle"
          :aria-label="productText.previousImage"
          @click="moveGalleryModalImage(-1)"
        >
          <BaseIcon name="chevron-left" size="xxs" />
        </BaseButton>

        <button
          class="product-gallery-modal__stage"
          type="button"
          :aria-label="isGalleryImageZoomed ? productText.zoomOut : productText.zoomIn"
          @click="toggleGalleryImageZoom"
        >
          <Transition name="product-gallery-modal-image" mode="out-in">
            <img
              :key="selectedModalImage"
              :src="selectedModalImage"
              :alt="productDisplayName(product)"
              class="product-gallery-modal__image"
              :class="{ 'product-gallery-modal__image--zoomed': isGalleryImageZoomed }"
            >
          </Transition>
        </button>

        <div
          v-if="galleryImages.length > 1"
          class="product-gallery-modal__thumbnails"
          :aria-label="productText.otherImages"
        >
          <BaseButton
            v-for="(image, index) in galleryImages"
            :key="image.image"
            class="product-gallery-modal__thumbnail"
            :class="{ 'product-gallery-modal__thumbnail--active': image.image === selectedModalImage }"
            type="button"
            variant="borderless"
            :aria-label="productText.showImage(index + 1)"
            :aria-current="image.image === selectedModalImage ? 'true' : undefined"
            @click="selectImage(image.image)"
          >
            <img :src="image.image" :alt="image.alt || productDisplayName(product)">
          </BaseButton>
        </div>

        <BaseButton
          v-if="galleryImages.length > 1"
          class="product-gallery-modal__control product-gallery-modal__next"
          type="button"
          variant="outline-dark"
          shape="circle"
          :aria-label="productText.nextImage"
          @click="moveGalleryModalImage(1)"
        >
          <BaseIcon name="chevron-right" size="xxs" />
        </BaseButton>
      </div>
    </BaseModal>
  </section>

  <section
    v-else-if="!productError"
    class="product-page product-page--loading"
    :aria-label="productText.loadingProduct"
    aria-busy="true"
  >
    <div class="product-page__container">
      <BaseSkeleton class="product-page-skeleton__breadcrumb" width="18rem" height="0.875rem" radius="9999px" />

      <div class="product-page__body">
        <div class="product-page__preview">
          <section class="product-gallery">
            <BaseSkeleton class="product-page-skeleton__gallery" height="25rem" radius="0.375rem" />
            <div class="product-page-skeleton__thumbs">
              <BaseSkeleton
                v-for="index in 4"
                :key="index"
                width="3.75rem"
                height="3.75rem"
                radius="0.375rem"
              />
            </div>
          </section>
        </div>

        <div class="product-page__info">
          <section class="product-buy product-page-skeleton__stack">
            <BaseSkeleton width="78%" height="1.35rem" radius="9999px" />
            <BaseSkeleton width="9rem" height="0.75rem" radius="9999px" />
            <BaseSkeleton width="6rem" height="0.75rem" radius="9999px" />
            <div class="product-page-skeleton__badges">
              <BaseSkeleton
                v-for="index in 3"
                :key="index"
                width="5.5rem"
                height="1.5rem"
                radius="9999px"
              />
            </div>
            <div class="product-buy__cost product-page-skeleton__cost">
              <BaseSkeleton width="8rem" height="2rem" radius="0.375rem" />
              <BaseSkeleton width="13rem" height="2.75rem" radius="0.375rem" />
            </div>
          </section>

          <section class="product-delivery product-page-skeleton__stack">
            <BaseSkeleton width="10rem" height="0.875rem" radius="9999px" />
            <BaseSkeleton
              v-for="index in 3"
              :key="index"
              width="100%"
              height="1.25rem"
              radius="9999px"
            />
          </section>

          <section class="product-description product-page-skeleton__stack">
            <BaseSkeleton width="8rem" height="1rem" radius="9999px" />
            <BaseSkeleton width="100%" height="0.875rem" radius="9999px" />
            <BaseSkeleton width="94%" height="0.875rem" radius="9999px" />
            <BaseSkeleton width="68%" height="0.875rem" radius="9999px" />
          </section>
        </div>
      </div>

      <section class="product-reviews">
        <div
          v-for="index in 2"
          :key="index"
          class="product-reviews__list product-page-skeleton__stack"
        >
          <BaseSkeleton width="10rem" height="1.25rem" radius="9999px" />
          <BaseSkeleton width="100%" height="0.875rem" radius="9999px" />
          <BaseSkeleton width="82%" height="0.875rem" radius="9999px" />
        </div>
      </section>
    </div>
  </section>

  <section v-else class="product-page product-page--error">
    <FeedbackState
      kind="error"
      :title="isNotFoundError(productError) ? productText.notFoundTitle : productText.loadErrorTitle"
      :description="isNotFoundError(productError) ? productText.notFoundDescription : productText.loadErrorDescription"
      :seed="String(route.params.slug)"
    >
      <BaseButton v-if="!isNotFoundError(productError)" type="button" @click="refreshProduct">
        {{ productText.retry }}
      </BaseButton>
      <BaseButton to="/catalog" variant="outline-dark">
        {{ productText.backToCatalog }}
      </BaseButton>
    </FeedbackState>
  </section>
</template>

<style scoped>
.product-page {
  padding: 0 0 3rem;
}

.product-page__container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.product-page__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.product-page__preview {
  position: relative;
  width: 100%;
  min-width: 0;
}

.product-page__preview-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-x: hidden;
}

.product-page__info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.product-page--loading {
  min-height: 70vh;
}

.product-page-skeleton__breadcrumb {
  margin: 0.75rem;
}

.product-page-skeleton__gallery {
  min-height: 15rem;
}

.product-page-skeleton__thumbs,
.product-page-skeleton__badges {
  display: flex;
  gap: 0.5rem;
}

.product-page-skeleton__thumbs {
  margin-top: 0.75rem;
  overflow: hidden;
}

.product-page-skeleton__stack {
  gap: 0.75rem;
}

.product-page-skeleton__cost {
  margin-top: 0.25rem;
}

.product-page--error {
  display: grid;
  min-height: 70vh;
  place-items: center;
  background: #ffffff;
}

.product-gallery,
.product-buy,
.product-delivery,
.product-description,
.product-characteristics,
.product-reviews__list,
.product-reviews__form {
  width: 100%;
  background: #ffffff;
  padding: 0.75rem;
}

.product-gallery {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.product-gallery__track {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  grid-auto-columns: 100%;
  grid-auto-flow: column;
  align-items: stretch;
  justify-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.product-gallery__track::-webkit-scrollbar {
  display: none;
}

.product-gallery__image-button,
.product-gallery__composition-card {
  width: 100%;
  height: auto;
  max-height: 60vh;
  min-height: 0;
  aspect-ratio: 1;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

.product-gallery__image-button {
  --sc-button-fill: transparent;
  --sc-button-hover-text: #0a0a0a;

  display: grid;
  width: 100%;
  min-width: 0;
  max-height: 60vh;
  max-height: 60dvh;
  overflow: hidden;
  justify-self: center;
  align-self: center;
  margin: auto;
  padding: 0;
  cursor: zoom-in;
}

.product-gallery__image-button :deep(.sc-button__text) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  max-height: inherit;
  overflow: hidden;
}

.product-gallery__track--single-image .product-gallery__image-button {
  width: 100%;
  max-height: 60vh;
  max-height: 60dvh;
}

.product-gallery__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  -webkit-user-drag: none;
  user-select: none;
}

.product-gallery__composition-card {
  position: relative;
  order: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffc846;
  color: #0a0a0a;
}

.product-gallery__composition-label {
  flex: 0 0 auto;
  align-self: flex-end;
  margin: 0.75rem 0.75rem 0;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
}

.product-gallery__composition-content {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: stretch;
  overflow-y: auto;
  padding: 1rem 1.25rem 1.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgb(10 10 10 / 35%) transparent;
  text-align: right;
}

.product-gallery__composition-content::-webkit-scrollbar {
  width: 4px;
}

.product-gallery__composition-content::-webkit-scrollbar-thumb {
  background: rgb(10 10 10 / 35%);
  border-radius: 2px;
}

.product-gallery__composition-content p {
  flex: 0 0 auto;
  margin: auto 0 0;
  overflow-wrap: anywhere;
  text-align: right;
  font-size: clamp(0.6875rem, 2.5vw, 0.875rem);
  font-weight: 600;
  line-height: 1.45;
}

.product-gallery__indicator {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
}

.product-gallery__indicator-button {
  --sc-button-bg: transparent;
  --sc-button-fill: transparent;
  --sc-button-hover-text: transparent;

  width: 1.5rem;
  min-width: 1.5rem;
  height: 1.5rem;
  min-height: 1.5rem;
  padding: 0;
}

.product-gallery__indicator-button::after {
  width: 0.375rem;
  height: 0.375rem;
  border: 1px solid #262626;
  border-radius: 50%;
  background: #262626;
  content: "";
  transition: background-color 180ms ease, transform 180ms ease;
}

.product-gallery__indicator-button--active::after {
  background: #ffffff;
  transform: scale(1.35);
}

.product-buy {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.product-buy > .product-characteristics {
  margin: 0.5rem 0;
  padding: 0;
}

.product-buy__header {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  justify-content: space-between;
}

.product-buy__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.35;
  letter-spacing: 1px;
  color: #0a0a0a;
  text-transform: uppercase;
}

.product-buy__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.375rem;
  margin-bottom: 0.25rem;
}

.product-buy__type {
  margin: 0;
  color: #737373;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.5;
}

.product-buy__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.375rem;
  color: #737373;
}

.product-buy__code {
  color: #737373;
  font-size: 0.875rem;
  line-height: 1.5;
}

.product-buy__favorite {
  --sc-button-text: #525252;
  --sc-button-hover-text: #0a0a0a;

  flex: 0 0 auto;
}

.product-buy__favorite--active {
  --sc-button-text: #0a0a0a;
}

.product-buy__favorite--active :deep(svg) {
  fill: currentColor;
}

.product-buy__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.product-buy__header-badges :deep(.product-discount-sticker) {
  display: none;
}

.product-buy__badge--borderless {
  border: 0;
}

.product-buy__variants {
  display: grid;
  gap: 0.5rem;
}

.product-buy__variants-label {
  color: #0a0a0a;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.product-buy__variants-tabs {
  width: min(100%, 17.5rem);
}

.product-buy__cost {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: stretch;
  padding: 0.75rem;
  background: #f5f5f5;
}

.product-buy__price-with-badge {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.product-buy__cost-badges {
  flex: 0 0 auto;
}

.product-buy__cost-badges :deep(.product-status-badges__item) {
  display: none;
}

.product-buy__price-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.product-buy__old-price {
  position: relative;
  width: max-content;
  margin: 0;
  color: #a3a3a3;
  font-size: 0.875rem;
}

.product-buy__old-price::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  content: "";
  background: currentColor;
}

.product-buy__price {
  margin: 0;
  color: #0a0a0a;
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
}

.product-buy__price--discount {
  color: #c2410c;
}

.product-buy__button :deep(.sc-button__text) {
  width: 100%;
}

.product-page__error {
  margin: 0;
  color: #be123c;
  font-size: 0.875rem;
}

.product-delivery {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.product-delivery__location {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.product-delivery__location strong {
  color: #0a0a0a;
  font-weight: 700;
}

.product-delivery__list {
  display: grid;
  grid-auto-columns: minmax(max-content, 1fr);
  grid-auto-flow: column;
  margin: 0;
  overflow-x: auto;
  padding: 0;
  scrollbar-width: none;
  list-style: none;
  -webkit-overflow-scrolling: touch;
}

.product-delivery__list::-webkit-scrollbar {
  display: none;
}

.product-delivery__item {
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid rgb(10 10 10 / 0.12);
  padding: 0.625rem 0.75rem;
  color: #262626;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
}

.product-delivery__item:first-child {
  border-left: 0;
}

.product-section-title {
  margin: 0 0 0.75rem;
  color: #0a0a0a;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
}

.product-characteristics .product-section-title {
  text-transform: uppercase;
}

.product-description__html {
  color: #404040;
  font-size: 14px;
  line-height: 1.7;
}

.product-description__html :deep(p) {
  margin: 0 0 0.75rem;
}

.product-description__html :deep(p:last-child) {
  margin-bottom: 0;
}

.product-description__html :deep(strong) {
  color: #0a0a0a;
  font-weight: 800;
}

.product-description__html :deep(ul),
.product-description__html :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.375rem;
}

.product-description__html :deep(ul) {
  list-style: disc outside;
}

.product-description__html :deep(ol) {
  list-style: decimal outside;
}

.product-description__html :deep(li) {
  padding-left: 0.25rem;
}

.product-description__html :deep(li + li) {
  margin-top: 0.375rem;
}

.product-description__html :deep(li::marker) {
  color: #0a0a0a;
}

.product-characteristics__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  font-size: 14px;
}

.product-characteristics__item {
  display: flex;
  gap: 1.5rem;
  justify-content: space-between;
}

.product-characteristics__item dt {
  color: #737373;
}

.product-characteristics__item dd {
  margin: 0;
  color: #262626;
  font-weight: 700;
  text-align: right;
}

.product-characteristics__brand {
  display: inline-flex;
  gap: 0.625rem;
  align-items: center;
  justify-content: flex-end;
}

.product-characteristics__brand-link {
  display: inline-flex;
  gap: 0.625rem;
  align-items: center;
  justify-content: flex-end;
  color: inherit;
  text-decoration: none;
}

.product-characteristics__brand-logo {
  width: 2.5rem;
  height: 1.5rem;
  object-fit: contain;
}

.product-reviews {
  display: grid;
  gap: 0.75rem;
}

.product-reviews__list,
.product-reviews__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.product-reviews__header {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.product-reviews h2,
.product-reviews__header h2 {
  margin: 0;
  color: #0a0a0a;
  font-size: 1.25rem;
  font-weight: 800;
}

.product-reviews__header span,
.product-reviews__muted {
  color: #737373;
  font-size: 0.875rem;
}

.product-review {
  background: #f5f5f5;
  padding: 1rem;
}

.product-review__header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.product-review__header p,
.product-review__comment {
  margin: 0;
}

.product-review__header p {
  color: #0a0a0a;
  font-weight: 700;
}

.product-review__header span {
  color: #737373;
  font-size: 0.75rem;
}

.product-review__comment {
  margin-top: 0.5rem;
  color: #525252;
  font-size: 0.875rem;
  line-height: 1.65;
}

.product-review__delete {
  margin-top: 0.75rem;
}

.product-reviews__rating {
  display: grid;
  gap: 0.5rem;
}

.product-reviews__rating p {
  margin: 0;
  color: #737373;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.product-reviews__rating div {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.product-reviews__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
}

.product-reviews__success {
  margin: 0;
  color: #188711;
  font-size: 0.875rem;
}

.product-gallery-modal__body {
  --product-gallery-thumbnail-height: 0px;

  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  grid-template-rows: minmax(0, 1fr) auto;
  background: #ffffff;
}

.product-gallery-modal__control {
  position: absolute;
  top: calc((100% - var(--product-gallery-thumbnail-height)) / 2);
  z-index: 2;
  transform: translateY(-50%);
}

.product-gallery-modal__previous {
  left: 1rem;
}

.product-gallery-modal__next {
  right: 1rem;
}

.product-gallery-modal__stage {
  display: grid;
  width: 100%;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  place-items: center;
  overflow: hidden;
  border: 0;
  background: #ffffff;
  cursor: zoom-in;
}

.product-gallery-modal__stage:focus,
.product-gallery-modal__stage:focus-visible {
  outline: 0;
}

.product-gallery-modal__stage:has(.product-gallery-modal__image--zoomed) {
  cursor: zoom-out;
}

.product-gallery-modal__image {
  box-sizing: border-box;
  display: block;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  padding: 2rem 5rem;
  object-fit: contain;
  transition: transform 220ms ease;
  user-select: none;
  -webkit-user-drag: none;
}

.product-gallery-modal__thumbnails {
  display: none;
  min-height: 5.75rem;
  max-width: min(100%, 42rem);
  justify-self: center;
  overflow-x: auto;
  padding: 0 1rem 1.25rem;
  scrollbar-width: thin;
}

.product-gallery-modal__thumbnail {
  width: 4.5rem;
  height: 4.5rem;
  flex: 0 0 auto;
  overflow: hidden;
  background: #f5f5f5;
  opacity: 0.58;
  transition: opacity 180ms ease, box-shadow 180ms ease;
}

.product-gallery-modal__thumbnail + .product-gallery-modal__thumbnail {
  margin-left: 0.5rem;
}

.product-gallery-modal__thumbnail:hover,
.product-gallery-modal__thumbnail:focus-visible,
.product-gallery-modal__thumbnail--active {
  opacity: 1;
  box-shadow: inset 0 0 0 2px #0a0a0a;
}

.product-gallery-modal__thumbnail img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-gallery-modal__image--zoomed {
  transform: scale(2);
}

.product-gallery-modal-image-enter-active,
.product-gallery-modal-image-leave-active {
  transition: opacity 220ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.product-gallery-modal-image-enter-from,
.product-gallery-modal-image-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .product-gallery-modal-image-enter-active,
  .product-gallery-modal-image-leave-active {
    transition: none;
  }
}

:global(.product-gallery-modal .base-modal__overlay) {
  background: rgb(255 255 255 / 0.72);
}

:global(.product-gallery-modal .base-modal__content) {
  display: flex;
  height: 0;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

:global(.product-gallery-modal.base-modal-enter-from .base-modal__container),
:global(.product-gallery-modal.base-modal-leave-to .base-modal__container) {
  opacity: 0;
  transform: scale(0.985);
}

:global(.product-gallery-modal.base-modal-enter-active .base-modal__container),
:global(.product-gallery-modal.base-modal-leave-active .base-modal__container) {
  transition:
    opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (max-width: 575px) {
  .product-gallery-modal__previous {
    left: 0.5rem;
  }

  .product-gallery-modal__next {
    right: 0.5rem;
  }

  .product-gallery-modal__image {
    padding: 1rem 3.5rem;
  }
}

@media (min-width: 640px) {
  .product-gallery-modal__body {
    --product-gallery-thumbnail-height: 5.75rem;
  }

  .product-gallery-modal__thumbnails {
    display: flex;
  }

  .product-buy__cost {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .product-buy__price-wrapper {
    padding-left: 1.25rem;
  }

  .product-buy__price-wrapper--discount {
    padding-left: 0;
  }

  .product-buy__button {
    max-width: 13rem;
  }
}

@media (min-width: 521px) and (max-width: 1023px) {
  .product-gallery__image {
    object-fit: contain;
  }
}

@media (prefers-reduced-motion: reduce) {
  .product-gallery-modal__thumbnail {
    transition: none;
  }
}

@media (min-width: 1024px) {
  .product-page__body {
    flex-direction: row;
    align-items: stretch;
  }

  .product-page__preview {
    max-width: 37.5rem;
    flex: 0 0 min(48%, 37.5rem);
  }

  .product-page__preview-wrapper {
    position: sticky;
    top: 9.5rem;
    align-self: flex-start;
    min-height: 0;
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
  }

  .product-page__info {
    position: sticky;
    top: 9.5rem;
    align-self: flex-start;
  }

  .product-gallery__track {
    grid-auto-columns: auto;
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: auto;
    column-gap: 1rem;
    row-gap: 1rem;
    align-content: start;
    overflow: visible;
    scroll-snap-type: none;
  }

  .product-gallery__track--single-image {
    grid-template-columns: minmax(0, 1fr);
  }

  .product-gallery__image-button {
    width: 100%;
    height: auto;
    max-height: none;
    aspect-ratio: 1;
  }

  .product-gallery__image-button:first-child {
    grid-column: 1 / -1;
    aspect-ratio: 1.06;
  }

  .product-gallery__composition-card {
    order: 0;
    min-height: 14rem;
    max-height: none;
    aspect-ratio: 1;
    align-self: stretch;
  }

  .product-gallery__indicator {
    display: none;
  }

  .product-reviews {
    grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.8fr);
  }
}

@media (max-width: 520px) {
  .product-gallery,
  .product-buy,
  .product-delivery,
  .product-description,
  .product-characteristics,
  .product-reviews__list,
  .product-reviews__form {
    padding: 0.625rem;
  }

  .product-characteristics__item {
    flex-direction: column;
    gap: 0.125rem;
  }

  .product-characteristics__item dd {
    text-align: left;
  }

  .product-characteristics__brand {
    justify-content: flex-start;
  }

  .product-characteristics__brand-link {
    justify-content: flex-start;
  }

  .product-buy__price--discount {
    font-size: 24px;
  }
}
</style>
