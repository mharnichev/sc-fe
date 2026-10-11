<script setup lang="ts">
import type { MasterRatingSummaryDto, PublicMasterReviewDto } from '~/domain/barbershop'
import { getMasterTrustCachedData, loadMasterTrustData } from '~/utils/masterTrustCache'

const props = withDefaults(defineProps<{
  masterId: number
  rotateReviews?: boolean
  reviewsDialog?: boolean
  showReviews?: boolean
  reviewLimit?: number
  tone?: 'light' | 'dark'
  compact?: boolean
  summaryLabel?: string
  showSummaryDetails?: boolean
  showReviewCount?: boolean
  hideEmpty?: boolean
}>(), {
  rotateReviews: false,
  reviewsDialog: false,
  showReviews: false,
  reviewLimit: 2,
  tone: 'light',
  compact: false,
  summaryLabel: '',
  showSummaryDetails: true,
  showReviewCount: false,
  hideEmpty: false,
})

const { locale } = useTerms()
const domain = useBarbershopDomain()
const nuxtApp = useNuxtApp()
const instanceId = useId()

const labels = computed(() => locale.value === 'en'
  ? {
      close: 'Close',
      retry: 'Try again',
      more: 'Load more',
      loading: 'Loading verified rating',
      unavailable: 'Rating temporarily unavailable',
      reviewsUnavailable: 'Reviews temporarily unavailable',
      empty: 'No approved reviews yet',
      verified: 'Verified after a visit',
      reviews: 'approved reviews',
      reviewsShort: 'reviews',
      recent: 'Recent reviews',
      guest: 'Soul Cuts client',
    }
  : {
      close: 'Закрити',
      retry: 'Спробувати ще раз',
      more: 'Показати ще',
      loading: 'Завантажуємо підтверджений рейтинг',
      unavailable: 'Рейтинг тимчасово недоступний',
      reviewsUnavailable: 'Відгуки тимчасово недоступні',
      empty: 'Ще немає схвалених відгуків',
      verified: 'Підтверджено після візиту',
      reviews: 'схвалених відгуків',
      reviewsShort: 'відгуків',
      recent: 'Останні відгуки',
      guest: 'Клієнт Soul Cuts',
    })

const summaryKey = computed(() => `master-rating-summary-${props.masterId}`)
const reviewsKey = computed(() => props.showReviews
  ? `master-text-reviews-${props.masterId}-${Math.max(1, props.reviewLimit)}`
  : 'master-text-reviews-disabled',
)

const [summaryData, reviewsData] = await Promise.all([
  // Nuxt retains handlers for shared keys; isolate props-dependent handlers per instance.
  useAsyncData(computed(() => `${summaryKey.value}:${instanceId}`), () => {
    const masterId = props.masterId
    return loadMasterTrustData(nuxtApp, summaryKey.value, () => domain.getMasterRatingSummary(masterId))
  }, {
    lazy: true,
    deep: false,
    dedupe: 'cancel',
    getCachedData: (_key, app, context) => getMasterTrustCachedData<MasterRatingSummaryDto>(summaryKey.value, app, context),
  }),
  useAsyncData(computed(() => `${reviewsKey.value}:${instanceId}`), () => {
    const masterId = props.masterId
    const showReviews = props.showReviews
    const limit = Math.max(1, props.reviewLimit)
    return loadMasterTrustData(nuxtApp, reviewsKey.value, async () => showReviews
        ? (await domain.getMasterReviews(masterId, limit, 1, true)).items
        : [])
  }, {
    lazy: true,
    deep: false,
    dedupe: 'cancel',
    getCachedData: (_key, app, context) => getMasterTrustCachedData<PublicMasterReviewDto[]>(reviewsKey.value, app, context),
  }),
])
const { pending, error } = summaryData
const trust = computed(() => ({
  summary: summaryData.data.value?.cacheKey === summaryKey.value ? summaryData.data.value.value : undefined,
  reviews: props.showReviews && reviewsData.data.value?.cacheKey === reviewsKey.value ? reviewsData.data.value.value : [],
}))

const dialogOpen = ref(false)
const dialogReviews = ref<PublicMasterReviewDto[]>([])
const dialogPending = ref(false)
const dialogError = ref(false)
const dialogPage = ref(0)
const dialogTotal = ref(0)
let requestVersion = 0

const loadDialogReviews = async () => {
  if (dialogPending.value) return
  const version = ++requestVersion
  dialogPending.value = true
  dialogError.value = false
  try {
    const response = await domain.getMasterReviews(props.masterId, 20, dialogPage.value + 1)
    if (version !== requestVersion) return
    dialogReviews.value.push(...response.items)
    dialogPage.value = response.page
    dialogTotal.value = response.total
  }
  catch {
    if (version === requestVersion) dialogError.value = true
  }
  finally {
    if (version === requestVersion) dialogPending.value = false
  }
}

const openReviews = () => {
  dialogOpen.value = true
  if (!dialogPage.value) void loadDialogReviews()
}

watch(() => props.masterId, () => {
  requestVersion++
  dialogOpen.value = false
  dialogReviews.value = []
  dialogPending.value = false
  dialogError.value = false
  dialogPage.value = 0
  dialogTotal.value = 0
}, { flush: 'sync' })

const hasRating = computed(() => {
  const summary = trust.value?.summary
  return Boolean(
    summary
    && typeof summary.average_rating === 'number'
    && Number.isFinite(summary.average_rating)
    && summary.approved_review_count > 0,
  )
})

const recentReviews = computed(() =>
  (trust.value?.reviews || [])
    .filter(review => Boolean(review.comment?.trim()))
    .slice(0, Math.max(1, props.reviewLimit)),
)

const activeReviewIndex = ref(0)
const rotationPaused = ref(false)
const pageHidden = ref(false)
const visibleReviews = computed(() => props.rotateReviews
  ? recentReviews.value.slice(activeReviewIndex.value, activeReviewIndex.value + 1)
  : recentReviews.value,
)
let rotationTimer: ReturnType<typeof setInterval> | null = null

const stopRotation = () => {
  if (rotationTimer) clearInterval(rotationTimer)
  rotationTimer = null
}
const startRotation = () => {
  stopRotation()
  if (!import.meta.client || !props.rotateReviews || recentReviews.value.length < 2
    || rotationPaused.value || pageHidden.value) return
  rotationTimer = setInterval(() => {
    activeReviewIndex.value = (activeReviewIndex.value + 1) % recentReviews.value.length
  }, 5000)
}
watch(recentReviews, () => {
  activeReviewIndex.value = 0
  startRotation()
})
watch([rotationPaused, pageHidden, () => props.rotateReviews], startRotation)
const updateVisibility = () => { pageHidden.value = document.hidden }
onMounted(() => {
  updateVisibility()
  document.addEventListener('visibilitychange', updateVisibility)
  startRotation()
})
onBeforeUnmount(() => {
  requestVersion++
  stopRotation()
  document.removeEventListener('visibilitychange', updateVisibility)
})

const dateLocale = computed(() => locale.value === 'en' ? 'en-US' : 'uk-UA')
const formatDate = (value: string | null) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(dateLocale.value, {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const reviewPreview = (review: PublicMasterReviewDto) => {
  const text = review.comment?.trim() || ''
  return text.length > 150 ? `${text.slice(0, 150).trimEnd()}…` : text
}
</script>

<template>
  <div
    class="master-rating-block"
    :class="[
      tone === 'dark' ? 'text-white' : 'text-neutral-950',
      compact ? 'master-rating-block--compact' : '',
    ]"
  >
    <div v-if="pending || error || (!hasRating && !hideEmpty)" class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span v-if="summaryLabel" class="type-meta type-eyebrow--wide text-xs">
        {{ summaryLabel }}
      </span>
      <p v-if="pending" class="text-xs leading-5 opacity-60" role="status">
        {{ labels.loading }}
      </p>
      <p v-else-if="error" class="text-xs leading-5 opacity-60" role="status">
        {{ labels.unavailable }}
      </p>
      <p v-else class="text-xs leading-5 opacity-60">
        {{ labels.empty }}
      </p>
    </div>
    <template v-else-if="hasRating">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="flex items-center gap-1 text-amber-500" role="img" :aria-label="`${trust.summary?.average_rating?.toFixed(1)} / 5`">
          <span aria-hidden="true">★</span>
          <strong class="text-sm tabular-nums" :class="tone === 'dark' ? 'text-white' : 'text-neutral-950'">
            {{ trust.summary?.average_rating?.toFixed(1) }}
          </strong>
        </span>
        <span v-if="summaryLabel && !showReviewCount" class="type-meta type-eyebrow--wide text-xs">
          {{ summaryLabel }}
        </span>
        <component
          :is="reviewsDialog ? 'button' : 'span'"
          :type="reviewsDialog ? 'button' : undefined"
          :aria-haspopup="reviewsDialog ? 'dialog' : undefined"
          :class="reviewsDialog ? 'cursor-pointer hover:opacity-100 focus-visible:outline focus-visible:outline-offset-4' : ''"
          @click.stop="reviewsDialog && openReviews()"
          v-if="showReviewCount"
          class="flex items-center gap-2 text-xs opacity-70"
          :aria-label="`${trust.summary?.approved_review_count} ${labels.reviewsShort}`"
        >
          <span class="h-3 w-px bg-current opacity-40" aria-hidden="true" />
          <span>
            <strong class="font-semibold tabular-nums">{{ trust.summary?.approved_review_count }}</strong>
            {{ labels.reviewsShort }}
          </span>
        </component>
        <span v-if="showSummaryDetails" class="text-xs opacity-65">
          {{ trust.summary?.approved_review_count }} {{ labels.reviews }}
        </span>
        <span v-if="showSummaryDetails" class="type-meta text-[0.62rem] opacity-50">/ {{ labels.verified }}</span>
      </div>

      <p v-if="summaryLabel && showReviewCount" class="type-meta type-eyebrow--wide mt-2 text-xs">
        {{ summaryLabel }}
      </p>

      <div v-if="showReviews && reviewsData.error.value" class="mt-4 text-xs" role="status">
        <p>{{ labels.reviewsUnavailable }}</p>
        <button type="button" class="mt-2 underline" @click="reviewsData.refresh()">{{ labels.retry }}</button>
      </div>

      <div v-if="showReviews && recentReviews.length" class="mt-4 space-y-3" :class="{ 'master-review-rotation': rotateReviews }" :aria-label="labels.recent" @mouseenter="rotationPaused = true" @mouseleave="rotationPaused = false">
        <Transition name="master-review-fade" mode="out-in">
        <div :key="rotateReviews ? visibleReviews[0]?.id : 'reviews'" class="space-y-3">
        <blockquote
          v-for="review in visibleReviews"
          :key="review.id"
          class="border-l pl-3"
          :class="tone === 'dark' ? 'border-white/25' : 'border-neutral-300'"
        >
          <p class="text-xs font-semibold leading-5">“{{ reviewPreview(review) }}”</p>
          <footer class="mt-1 flex flex-wrap gap-x-2 text-[0.68rem] opacity-60">
            <span>{{ review.author_name || labels.guest }}</span>
            <span aria-hidden="true">/</span>
            <span>{{ review.rating }}/5</span>
            <span v-if="formatDate(review.published_at)" aria-hidden="true">/</span>
            <time v-if="formatDate(review.published_at)" :datetime="review.published_at || undefined">
              {{ formatDate(review.published_at) }}
            </time>
          </footer>
        </blockquote>
        </div>
        </Transition>
      </div>
    </template>
    <BaseModal v-if="reviewsDialog" v-model="dialogOpen" type="right" :dialog-label="labels.reviews" :close-label="labels.close">
      <template #header><h2 class="pr-10 text-xl font-semibold">{{ labels.reviews }}</h2></template>
      <div class="space-y-5 p-5 text-neutral-950 sm:p-8">
        <article v-for="review in dialogReviews" :key="review.id" class="border-b border-neutral-200 pb-5">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <strong>{{ review.author_name || labels.guest }}</strong>
            <span class="text-amber-600">★ {{ review.rating }}/5</span>
            <time :datetime="review.published_at" class="text-neutral-500">{{ formatDate(review.published_at) }}</time>
          </div>
          <p v-if="review.comment?.trim()" class="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{{ review.comment }}</p>
        </article>
        <p v-if="dialogPending" role="status" class="text-sm">{{ labels.loading }}</p>
        <div v-else-if="dialogError" role="status">
          <p>{{ labels.unavailable }}</p>
          <button type="button" class="mt-3 underline" @click="loadDialogReviews">{{ labels.retry }}</button>
        </div>
        <p v-else-if="!dialogReviews.length" class="text-sm">{{ labels.empty }}</p>
        <button v-else-if="dialogReviews.length < dialogTotal" type="button" class="underline" @click="loadDialogReviews">{{ labels.more }}</button>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.master-rating-block--compact :deep(blockquote) {
  display: none;
}
.master-review-rotation {
  min-height: 7rem;
}
.master-review-fade-enter-active,
.master-review-fade-leave-active {
  transition: opacity 450ms ease;
}
.master-review-fade-enter-from,
.master-review-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .master-review-fade-enter-active,
  .master-review-fade-leave-active {
    transition: none;
  }
}
</style>
