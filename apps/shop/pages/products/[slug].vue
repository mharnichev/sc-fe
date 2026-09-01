<script setup lang="ts">
import type { ProductDto, ProductReviewListDto } from '@shared-types'
import { localBrandLogoUrl, resolveApiAssetUrl } from '@shared-utils'
import type { CategoryRouteCrumb } from '~/utils/category-routing'
import { categoryGoodsPath, categoryLandingPath } from '~/utils/category-routing'
import { getProductDiscount } from '~/utils/product-status'
import { isProductUnavailable } from '~/utils/product-visibility'

const route = useRoute()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
const domain = useCatalogDomain()
const cart = useCartStore()
const favorites = useFavoritesStore()
const auth = useCustomerAuthStore()
const recentlyViewed = useRecentlyViewedStore()
const { terms, dateLocale } = useShopLocale()
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

const stockTone = computed(() => product.value && product.value.stock > 0 ? 'success' : 'danger')
const stockLabel = computed(() => product.value && product.value.stock > 0 ? terms.value.product.inStock : terms.value.product.outOfStock)
const galleryImages = computed(() => product.value?.images || [])
const selectedImageIndex = computed(() => galleryImages.value.findIndex(image => image.image === selectedImage.value))
const selectedModalImage = computed(() => selectedImage.value || galleryImages.value[0]?.image || 'https://placehold.co/1000x1000?text=Product')
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
      name: category.name,
      slug: category.slug,
      to: categoryBreadcrumbLink(index),
    })),
    { id: product.value.id, name: product.value.name, slug: product.value.slug },
  ]
})
const averageRating = computed(() => reviewsPage.value?.average_rating || product.value?.average_rating || null)
const reviewsCount = computed(() => reviewsPage.value?.total ?? product.value?.reviews_count ?? 0)
const productDescriptionHtml = computed(() => product.value?.description?.trim() || '')
const plainProductDescription = computed(() =>
  htmlToText(product.value?.description || product.value?.short_description || ''),
)
const isFavorite = computed(() => product.value ? favorites.has(product.value.id) : false)
const isInCart = computed(() => product.value ? cart.items.some(item => item.product.id === product.value?.id) : false)
const discount = computed(() => product.value ? getProductDiscount(product.value) : null)
const productCode = computed(() => product.value?.sku || String(product.value?.id || ''))
const availableVolumeVariants = computed(() =>
  (product.value?.volume_variants ?? []).filter(variant => variant.is_available),
)
const hasVolumeVariants = computed(() =>
  (product.value?.volume_variants?.length ?? 0) > 1 && availableVolumeVariants.value.length > 0,
)
const parameterEntries = computed(() => Object.entries(product.value?.parameters || {}))
const brandLogoUrl = computed(() => {
  const brand = product.value?.brand
  if (!brand) return ''

  return resolveApiAssetUrl(brand.logo_url, String(config.public.apiBase), requestUrl.origin)
    || localBrandLogoUrl(brand.slug)
})
const isBrandCharacteristic = (name: string) =>
  name.trim().toLocaleLowerCase() === terms.value.catalog.brand.trim().toLocaleLowerCase()
const fallbackCharacteristicEntries = computed(() => {
  if (!product.value) return []

  return [
    [terms.value.catalog.productCode, productCode.value],
    [terms.value.catalog.brand, product.value.brand.name],
    [terms.value.catalog.category, product.value.category.name],
    ['Залишок', String(product.value.stock)],
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
}, { immediate: true })

const selectImage = (image: string) => {
  selectedImage.value = image
}

const nextImage = () => {
  if (galleryImages.value.length < 2) return
  const nextIndex = selectedImageIndex.value >= 0
    ? (selectedImageIndex.value + 1) % galleryImages.value.length
    : 0
  selectedImage.value = galleryImages.value[nextIndex]?.image || ''
}

const prevImage = () => {
  if (galleryImages.value.length < 2) return
  const nextIndex = selectedImageIndex.value > 0
    ? selectedImageIndex.value - 1
    : galleryImages.value.length - 1
  selectedImage.value = galleryImages.value[nextIndex]?.image || ''
}

const formatDate = (value: string) => new Intl.DateTimeFormat(dateLocale.value, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(value))

const submitReview = async () => {
  if (!product.value || !auth.isAuthenticated || !reviewForm.text.trim()) return

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
  () => product.value?.seo_title || product.value?.name || terms.value.seo.productFallbackTitle,
  () => product.value?.seo_description || product.value?.short_description || plainProductDescription.value || terms.value.seo.productFallbackDescription,
)

useHead(() => ({
  script: product.value ? [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.value.name,
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
              :class="{ 'product-gallery--with-thumbs': galleryImages.length > 1 }"
              itemscope
              itemtype="https://schema.org/Product"
            >
              <meta v-if="galleryImages[0]?.image" itemprop="image" :content="galleryImages[0].image">
              <div class="product-gallery__main">
                <BaseButton
                  v-if="galleryImages.length > 1"
                  class="product-gallery__nav product-gallery__nav--prev"
                  type="button"
                  variant="light"
                  size="sm"
                  shape="circle"
                  aria-label="Попереднє зображення"
                  @click="prevImage"
                >
                  <BaseIcon name="chevron-right" size="xxs" />
                </BaseButton>
                <button class="product-gallery__image-button" type="button" @click="isGalleryModalOpen = true">
                  <Transition name="product-gallery-image">
                    <img
                      :key="selectedModalImage"
                      :src="selectedModalImage"
                      :alt="product.name"
                      class="product-gallery__image"
                      itemprop="image"
                    >
                  </Transition>
                </button>
                <BaseButton
                  v-if="galleryImages.length > 1"
                  class="product-gallery__nav product-gallery__nav--next"
                  type="button"
                  variant="light"
                  size="sm"
                  shape="circle"
                  aria-label="Наступне зображення"
                  @click="nextImage"
                >
                  <BaseIcon name="chevron-right" size="xxs" />
                </BaseButton>
              </div>

              <div v-if="galleryImages.length > 1" class="product-gallery__thumbs" aria-label="Галерея товару">
                <button
                  v-for="image in galleryImages"
                  :key="image.image"
                  type="button"
                  class="product-gallery__thumb"
                  :class="{ 'product-gallery__thumb--active': selectedImage === image.image }"
                  @click="selectImage(image.image)"
                >
                  <img :src="image.image" :alt="image.alt || product.name">
                </button>
              </div>
            </section>
          </div>
        </div>

        <div class="product-page__info">
          <section class="product-buy" itemscope itemtype="https://schema.org/Product">
            <meta itemprop="sku" :content="product.sku">
            <meta itemprop="brand" :content="product.brand.name">
            <meta itemprop="productID" :content="String(product.id)">
            <meta itemprop="name" :content="product.name">

            <div class="product-buy__header">
              <div>
                <h1 class="product-buy__name">{{ product.name }}</h1>
                <span class="product-buy__code">{{ terms.catalog.productCode }}: {{ productCode }}</span>
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
              <ProductStatusBadges :product="product" />
              <BaseBadge class="product-buy__badge--borderless" :tone="stockTone">{{ stockLabel }}</BaseBadge>
              <BaseBadge v-if="averageRating" tone="dark">{{ averageRating }}/5</BaseBadge>
              <BaseBadge v-if="reviewsCount > 0" class="product-buy__badge--borderless" tone="neutral">
                {{ reviewsCount }} {{ terms.product.reviews }}
              </BaseBadge>
            </div>

            <section v-if="characteristicEntries.length" class="product-characteristics">
              <h2 class="product-section-title">Характеристики</h2>
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
                  </dd>
                </div>
              </dl>
            </section>

            <div v-if="hasVolumeVariants" class="product-buy__variants">
              <span class="product-buy__variants-label">Об’єм</span>
              <div class="product-buy__variants-list" aria-label="Оберіть об’єм товару">
                <BaseButton
                  v-for="variant in availableVolumeVariants"
                  :key="variant.id"
                  class="product-buy__variant"
                  :class="{ 'product-buy__variant--active': variant.id === product.id }"
                  :to="`/products/${variant.slug}`"
                  variant="borderless"
                  size="sm"
                  :aria-current="variant.id === product.id ? 'page' : undefined"
                >
                  {{ variant.volume_label }}
                </BaseButton>
              </div>
            </div>

            <div class="product-buy__cost" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <meta itemprop="priceCurrency" content="UAH">
              <meta itemprop="price" :content="product.price">
              <div class="product-buy__price-wrapper">
                <p v-if="discount" class="product-buy__old-price">
                  {{ formatPrice(discount.compareAtPrice) }}
                </p>
                <p class="product-buy__price" :class="{ 'product-buy__price--discount': discount }" itemprop="price">
                  {{ formatPrice(product.price) }}
                </p>
              </div>
              <BaseButton
                class="product-buy__button"
                type="button"
                :variant="isInCart ? 'outline-dark' : 'dark'"
                :disabled="isProductUnavailable(product) && !isInCart"
                block
                @click="toggleCart"
              >
                <BaseIcon :name="isInCart ? 'check' : 'shopping-cart'" size="xxs" />
                {{ isInCart ? terms.product.removeFromCart : terms.product.addToCart }}
              </BaseButton>
            </div>
            <p v-if="cart.error" class="product-page__error">{{ cart.error }}</p>
            <p v-if="favorites.error" class="product-page__error">{{ favorites.error }}</p>
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
            <h2 class="product-section-title">Опис</h2>
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
            v-model="reviewForm.text"
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
          <p v-if="reviewState.error" class="product-page__error">{{ reviewState.error }}</p>
        </form>
      </section>

      <RecentlyViewedProducts :exclude-product-id="product.id" />
    </div>

    <BaseModal
      v-model="isGalleryModalOpen"
      type="default"
      mobile-type="bottom"
      root-class="product-gallery-modal"
      content-type="secondary"
    >
      <template #header-title>
        {{ product.name }}
      </template>
      <div class="product-gallery-modal__body">
        <img :src="selectedModalImage" :alt="product.name" class="product-gallery-modal__image">
        <div v-if="galleryImages.length > 1" class="product-gallery-modal__thumbs">
          <button
            v-for="image in galleryImages"
            :key="image.image"
            type="button"
            class="product-gallery__thumb"
            :class="{ 'product-gallery__thumb--active': selectedImage === image.image }"
            @click="selectImage(image.image)"
          >
            <img :src="image.image" :alt="image.alt || product.name">
          </button>
        </div>
      </div>
    </BaseModal>
  </section>

  <section
    v-else-if="!productError"
    class="product-page product-page--loading"
    aria-label="Завантаження товару"
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
      title="Не вдалося завантажити товар"
      description="Спробуйте оновити дані або поверніться до каталогу."
      :seed="String(route.params.slug)"
    >
      <BaseButton type="button" @click="refreshProduct">
        Спробувати ще раз
      </BaseButton>
      <BaseButton to="/catalog" variant="outline-dark">
        До каталогу
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

.product-gallery__main {
  position: relative;
  display: flex;
  min-height: 15rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.product-gallery__image-button {
  display: grid;
  width: 100%;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.product-gallery__image {
  grid-area: 1 / 1;
  width: 100%;
  max-width: 25rem;
  max-height: 25rem;
  object-fit: contain;
}

.product-gallery-image-enter-active,
.product-gallery-image-leave-active {
  transition: opacity 260ms ease;
}

.product-gallery-image-enter-from,
.product-gallery-image-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .product-gallery-image-enter-active,
  .product-gallery-image-leave-active {
    transition: none;
  }
}

.product-gallery__nav {
  --sc-button-bg: #ffffff;
  --sc-button-text: #0a0a0a;
  --sc-button-fill: #0a0a0a;
  --sc-button-hover-text: #ffffff;
  --sc-button-border: transparent;
  --sc-button-shadow: none;

  position: absolute;
  top: 50%;
  z-index: 2;
  transform: translateY(-50%);
}

.product-gallery__nav--prev {
  left: 0.5rem;
  transform: translateY(-50%) scaleX(-1);
}

.product-gallery__nav--next {
  right: 0.5rem;
}

.product-gallery__thumbs,
.product-gallery-modal__thumbs {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.product-gallery__thumbs::-webkit-scrollbar,
.product-gallery-modal__thumbs::-webkit-scrollbar {
  display: none;
}

.product-gallery__thumb {
  width: 3.75rem;
  height: 3.75rem;
  flex: 0 0 auto;
  overflow: hidden;
  border: 0;
  border-radius: 0.375rem;
  background: #ffffff;
  padding: 0;
  opacity: 0.72;
  transition: opacity 160ms ease, transform 160ms ease;
}

.product-gallery__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-gallery__thumb--active,
.product-gallery__thumb:hover,
.product-gallery__thumb:focus-visible {
  opacity: 1;
  transform: translateY(-1px);
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
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.35;
  letter-spacing: 1px;
  color: #0a0a0a;
  text-transform: uppercase;
}

.product-buy__code {
  display: block;
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

.product-buy__variants-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.product-buy__variant {
  min-width: 3.5rem;
  text-transform: none;
}

.product-buy__variant--active {
  --sc-button-bg: #0a0a0a;
  --sc-button-text: #ffffff;
  --sc-button-fill: #0a0a0a;
  --sc-button-hover-text: #ffffff;

  pointer-events: none;
}

.product-buy__cost {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: stretch;
  padding: 0.75rem;
  background: #f5f5f5;
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
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.product-gallery-modal__image {
  width: 100%;
  max-height: 65vh;
  object-fit: contain;
}

:global(.product-gallery-modal .base-modal__container) {
  width: min(72rem, calc(100vw - 2rem));
}

@media (min-width: 640px) {
  .product-buy__cost {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .product-buy__price-wrapper {
    padding-left: 1.25rem;
  }

  .product-buy__button {
    max-width: 13rem;
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
    top: 4.375rem;
  }

  .product-gallery {
    display: flex;
    height: calc(100vh - 4.375rem);
    height: calc(100dvh - 4.375rem);
    flex-direction: column;
  }

  .product-gallery__main {
    min-height: 0;
    flex: 1 1 auto;
  }

  .product-gallery__image-button {
    height: 100%;
  }

  .product-gallery__image {
    max-height: 100%;
  }

  .product-gallery--with-thumbs {
    justify-content: center;
  }

  .product-gallery--with-thumbs .product-gallery__main {
    height: min(55vh, 32rem);
    height: min(55dvh, 32rem);
    flex: 0 1 auto;
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
}
</style>
