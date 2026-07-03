<script setup lang="ts">
import type { GoogleBusinessReviewDto } from '@shared-types'

const { terms, locale } = useTerms()
const domain = useBarbershopDomain()

const { data: reviewsResponse, pending, error } = await useAsyncData('home-google-business-reviews', domain.getReviews, {
  server: false,
  default: () => ({
    average_rating: null,
    total_review_count: 0,
    fetched_at: null,
    cache_expires_at: null,
    stale: false,
    items: [],
  }),
})

const reviews = computed(() =>
  (reviewsResponse.value?.items || [])
    .filter(review => Boolean(reviewText(review).trim()))
)

const hasReviewStats = computed(() =>
  Boolean(reviewsResponse.value?.average_rating || reviewsResponse.value?.total_review_count),
)

const activeIndex = ref(0)
const visibleSlides = ref(1)
const expandedOriginalIds = ref<string[]>([])
const expandedReviewIds = ref<string[]>([])

const maxActiveIndex = computed(() =>
  Math.max(0, reviews.value.length - visibleSlides.value),
)

const sliderTransform = computed(() =>
  `translateX(-${activeIndex.value * (100 / visibleSlides.value)}%)`,
)

const goToReview = (index: number) => {
  if (!reviews.value.length) return
  activeIndex.value = (index + maxActiveIndex.value + 1) % (maxActiveIndex.value + 1)
}

let autoplayTimer: ReturnType<typeof setInterval> | null = null

const stopAutoplay = () => {
  if (!import.meta.client) return
  if (!autoplayTimer) return
  clearInterval(autoplayTimer)
  autoplayTimer = null
}

const startAutoplay = () => {
  if (!import.meta.client) return
  stopAutoplay()
  if (maxActiveIndex.value <= 0) return

  autoplayTimer = setInterval(() => {
    goToReview(activeIndex.value + 1)
  }, 3000)
}

const dateLocale = computed(() => (locale.value === 'uk' ? 'uk-UA' : 'en-US'))

const reviewerName = (review: GoogleBusinessReviewDto) => {
  if (review.reviewer?.is_anonymous) return locale.value === 'uk' ? 'Гість Google' : 'Google guest'
  return review.reviewer?.display_name || (locale.value === 'uk' ? 'Клієнт Google' : 'Google customer')
}

const formatReviewDate = (value?: string | null) => {
  if (!value) return ''

  return new Intl.DateTimeFormat(dateLocale.value, {
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

const starIcons = (rating?: number | null) =>
  Array.from({ length: 5 }, (_, index) => index < Math.round(rating || 0))

const reviewText = (review: GoogleBusinessReviewDto) => {
  if (locale.value === 'en') {
    return review.translations?.en || review.comment || ''
  }

  return review.translations?.uk || review.translations?.ua || review.comment || ''
}

const reviewsStructuredData = computed(() => ({
  averageRating: reviewsResponse.value?.average_rating,
  reviewCount: reviewsResponse.value?.total_review_count,
  reviews: reviews.value.map(review => ({
    authorName: reviewerName(review),
    rating: review.star_rating,
    body: reviewText(review).trim(),
    datePublished: review.create_time,
  })),
}))

useReviewsStructuredData(reviewsStructuredData)

const isReviewExpanded = (review: GoogleBusinessReviewDto) =>
  expandedReviewIds.value.includes(review.review_id)

const toggleReviewText = (review: GoogleBusinessReviewDto) => {
  if (isReviewExpanded(review)) {
    expandedReviewIds.value = expandedReviewIds.value.filter(id => id !== review.review_id)
    return
  }

  expandedReviewIds.value = [...expandedReviewIds.value, review.review_id]
}

const reviewPreview = (review: GoogleBusinessReviewDto) => {
  const text = reviewText(review).trim()
  if (isReviewExpanded(review) || text.length <= 140) return text

  return `${text.slice(0, 140).trimEnd()}...`
}

const isReviewTruncated = (review: GoogleBusinessReviewDto) =>
  reviewText(review).trim().length > 140

const originalReviewText = (review: GoogleBusinessReviewDto) =>
  review.original_comment
  || review.original_text
  || review.source_comment
  || review.raw_comment
  || ''

const hasOriginalReviewText = (review: GoogleBusinessReviewDto) => {
  const original = originalReviewText(review).trim()
  return Boolean(original && original !== reviewText(review).trim())
}

const isOriginalExpanded = (review: GoogleBusinessReviewDto) =>
  expandedOriginalIds.value.includes(review.review_id)

const toggleOriginalReview = (review: GoogleBusinessReviewDto) => {
  if (isOriginalExpanded(review)) {
    expandedOriginalIds.value = expandedOriginalIds.value.filter(id => id !== review.review_id)
    return
  }

  expandedOriginalIds.value = [...expandedOriginalIds.value, review.review_id]
}

const updateVisibleSlides = () => {
  if (!import.meta.client) return

  if (window.matchMedia('(min-width: 1024px)').matches) {
    visibleSlides.value = 3
    return
  }

  if (window.matchMedia('(min-width: 768px)').matches) {
    visibleSlides.value = 2
    return
  }

  visibleSlides.value = 1
}

watch(
  () => reviews.value.length,
  (length) => {
    if (!length) {
      activeIndex.value = 0
      stopAutoplay()
      return
    }

    if (activeIndex.value >= length) activeIndex.value = 0
    if (import.meta.client) startAutoplay()
  },
  { immediate: true },
)

watch(visibleSlides, () => {
  if (activeIndex.value > maxActiveIndex.value) activeIndex.value = maxActiveIndex.value
})

onMounted(() => {
  updateVisibleSlides()
  window.addEventListener('resize', updateVisibleSlides)
  startAutoplay()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateVisibleSlides)
  stopAutoplay()
})
</script>

<template>
  <section id="reviews" data-header-theme="light" class="section-y-tight bg-stone-100">
    <div class="site-container">
      <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-6" data-reveal="soft">
        <div>
          <SectionLabel>{{ terms.home.reviews.label }}</SectionLabel>
          <p v-if="reviewsResponse?.average_rating" class="mt-4 text-3xl font-semibold leading-tight text-neutral-950">
            {{ reviewsResponse.average_rating.toFixed(1) }}/5
          </p>
        </div>
        <p v-if="reviewsResponse?.total_review_count" class="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-600">
          Google Maps / {{ reviewsResponse.total_review_count }}
        </p>
      </div>

      <div v-if="reviews.length" class="mt-8 md:mt-10">
        <div
          class="overflow-hidden"
          @mouseenter="stopAutoplay"
          @mouseleave="startAutoplay"
          @focusin="stopAutoplay"
          @focusout="startAutoplay"
        >
          <div
            class="flex transition-transform duration-700 ease-out"
            :style="{ transform: sliderTransform }"
          >
            <article
              v-for="(review, index) in reviews"
              :key="review.review_id"
              class="min-w-full border-l border-neutral-300 pl-4 pr-4 md:min-w-[50%] md:pl-5 md:pr-6 lg:min-w-[33.333333%]"
              data-reveal="soft"
              :data-reveal-delay="Math.min(index, 2) * 90"
            >
              <div class="mb-4 flex items-center gap-3">
                <img
                  v-if="review.reviewer?.profile_photo_url"
                  :src="review.reviewer.profile_photo_url"
                  :alt="reviewerName(review)"
                  class="size-10 rounded-full object-cover"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                >
                <div>
                  <p class="text-sm font-semibold text-neutral-950">{{ reviewerName(review) }}</p>
                  <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">
                    <span class="flex items-center gap-0.5 text-amber-500" role="img" :aria-label="`${review.star_rating || 0}/5`">
                      <span
                        v-for="(filled, index) in starIcons(review.star_rating)"
                        :key="index"
                        :class="filled ? 'text-amber-500' : 'text-neutral-300'"
                        aria-hidden="true"
                      >★</span>
                    </span>
                    <span v-if="formatReviewDate(review.create_time)">/ {{ formatReviewDate(review.create_time) }}</span>
                  </div>
                </div>
              </div>
              <p class="text-sm font-semibold leading-6 text-neutral-950 md:text-base md:leading-7">"{{ reviewPreview(review) }}"</p>
              <button
                v-if="isReviewTruncated(review)"
                type="button"
                class="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-600 underline underline-offset-8 transition hover:text-neutral-950"
                @click="toggleReviewText(review)"
              >
                {{ isReviewExpanded(review) ? terms.home.reviews.showLess : terms.home.reviews.seeFull }}
              </button>
              <button
                v-if="hasOriginalReviewText(review)"
                type="button"
                class="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-600 underline underline-offset-8 transition hover:text-neutral-950"
                @click="toggleOriginalReview(review)"
              >
                {{ isOriginalExpanded(review) ? terms.home.reviews.hideOriginal : terms.home.reviews.readOriginal }}
              </button>
              <p v-if="isOriginalExpanded(review)" class="mt-4 border-l border-neutral-300 pl-4 text-sm leading-6 text-neutral-600">
                {{ originalReviewText(review) }}
              </p>
            </article>
          </div>
        </div>

        <div class="mt-7 flex justify-end">
          <div class="flex gap-2">
            <BaseButton
              type="button"
              variant="outline-dark"
              shape="circle"
              size="sm"
              :aria-label="terms.home.reviews.previous"
              @click="goToReview(activeIndex - 1)"
            >
              ‹
            </BaseButton>
            <BaseButton
              type="button"
              variant="outline-dark"
              shape="circle"
              size="sm"
              :aria-label="terms.home.reviews.next"
              @click="goToReview(activeIndex + 1)"
            >
              ›
            </BaseButton>
          </div>
        </div>
      </div>

      <div v-else-if="hasReviewStats" class="mt-8 border-l border-neutral-300 pl-4 md:mt-12 md:pl-6">
        <p class="text-2xl font-semibold leading-snug text-neutral-950">
          {{ terms.home.reviews.ratingOnly }}
        </p>
        <p class="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-600">
          Google Maps
        </p>
      </div>

      <div v-else class="mt-8 border-l border-neutral-300 pl-4 md:mt-12 md:pl-6">
        <p class="text-2xl font-semibold leading-snug text-neutral-950">
          {{ pending ? terms.home.reviews.loading : terms.home.reviews.unavailable }}
        </p>
        <p v-if="error" class="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-600">
          Google Maps
        </p>
      </div>
    </div>
  </section>
</template>
