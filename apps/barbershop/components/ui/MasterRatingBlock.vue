<script setup lang="ts">
import type { PublicMasterReviewDto } from '~/domain/barbershop'

const props = withDefaults(defineProps<{
  masterId: number
  showReviews?: boolean
  reviewLimit?: number
  tone?: 'light' | 'dark'
  compact?: boolean
  summaryLabel?: string
  showSummaryDetails?: boolean
}>(), {
  showReviews: false,
  reviewLimit: 2,
  tone: 'light',
  compact: false,
  summaryLabel: '',
  showSummaryDetails: true,
})

const { locale } = useTerms()
const domain = useBarbershopDomain()

const labels = computed(() => locale.value === 'en'
  ? {
      loading: 'Loading verified rating',
      unavailable: 'Rating temporarily unavailable',
      empty: 'No approved reviews yet',
      verified: 'Verified after a visit',
      reviews: 'approved reviews',
      recent: 'Recent reviews',
      guest: 'Soul Cuts client',
    }
  : {
      loading: 'Завантажуємо підтверджений рейтинг',
      unavailable: 'Рейтинг тимчасово недоступний',
      empty: 'Ще немає схвалених відгуків',
      verified: 'Підтверджено після візиту',
      reviews: 'схвалених відгуків',
      recent: 'Останні відгуки',
      guest: 'Клієнт Soul Cuts',
    })

const trustKey = computed(() =>
  `master-trust-${props.masterId}-${props.showReviews ? Math.max(1, props.reviewLimit) : 0}`,
)

const { data: trust, pending, error } = await useAsyncData(
  trustKey,
  async () => {
    const summary = await domain.getMasterRatingSummary(props.masterId)
    let reviews: PublicMasterReviewDto[] | null = null

    if (props.showReviews) {
      try {
        const response = await domain.getMasterReviews(props.masterId, Math.max(1, props.reviewLimit))
        reviews = response.items
      }
      catch {
        reviews = null
      }
    }

    return { summary, reviews }
  },
  {
    watch: [() => props.masterId, () => props.showReviews, () => props.reviewLimit],
  },
)

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
    <div v-if="pending || error || !hasRating" class="flex flex-wrap items-center gap-x-2 gap-y-1">
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
    <template v-else>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="flex items-center gap-1 text-amber-500" role="img" :aria-label="`${trust?.summary.average_rating?.toFixed(1)} / 5`">
          <span aria-hidden="true">★</span>
          <strong class="text-sm tabular-nums" :class="tone === 'dark' ? 'text-white' : 'text-neutral-950'">
            {{ trust?.summary.average_rating?.toFixed(1) }}
          </strong>
        </span>
        <span v-if="summaryLabel" class="type-meta type-eyebrow--wide text-xs">
          {{ summaryLabel }}
        </span>
        <span v-if="showSummaryDetails" class="text-xs opacity-65">
          {{ trust?.summary.approved_review_count }} {{ labels.reviews }}
        </span>
        <span v-if="showSummaryDetails" class="type-meta text-[0.62rem] opacity-50">/ {{ labels.verified }}</span>
      </div>

      <div v-if="showReviews && recentReviews.length" class="mt-4 space-y-3" :aria-label="labels.recent">
        <blockquote
          v-for="review in recentReviews"
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
    </template>
  </div>
</template>

<style scoped>
.master-rating-block--compact :deep(blockquote) {
  display: none;
}
</style>
