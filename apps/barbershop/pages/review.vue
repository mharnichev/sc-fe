<script setup lang="ts">
import type { PublicReviewRequestDto } from '~/domain/barbershop'
import {
  isValidReviewRating,
  REVIEW_TEXT_MAX_LENGTH,
  reviewAnalyticsPayload,
  reviewRequestStateFromStatus,
  reviewTokenFromHash,
} from '~/utils/reviews.js'

type ReviewPageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'submitted' | 'network' | 'success'

const { locale } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const { trackEvent } = useAnalytics()

const pageState = ref<ReviewPageState>('loading')
const request = ref<PublicReviewRequestDto | null>(null)
const rating = ref<number | null>(null)
const reviewText = ref('')
const validationMessage = ref('')
const submitting = ref(false)
let reviewToken = ''

const labels = computed(() => locale.value === 'en'
  ? {
      pageTitle: 'Share your visit feedback',
      pageDescription: 'A private, one-time feedback form for a completed Soul Cuts visit.',
      eyebrow: 'Post-visit review',
      title: 'How was your visit?',
      description: 'Choose a rating and, if you want, add a short review. Every review is checked before it can appear publicly.',
      visit: 'Completed visit',
      rating: 'Rating',
      ratingRequired: 'Choose a rating from 1 to 5.',
      ratingOption: 'out of 5',
      review: 'Review (optional)',
      reviewPlaceholder: 'What stood out about your visit?',
      privacy: 'Please do not include phone numbers, email addresses, or other personal details.',
      submit: 'Send review',
      submitting: 'Sending…',
      loading: 'Checking your review link…',
      invalidTitle: 'This review link is not valid.',
      invalidDescription: 'Use the original link from your post-visit message. There is no public review form without a valid one-time link.',
      expiredTitle: 'This review link has expired.',
      expiredDescription: 'The one-time feedback window for this visit has closed.',
      submittedTitle: 'Feedback already received.',
      submittedDescription: 'This one-time link has already been used. Thank you for sharing your experience.',
      networkTitle: 'We could not load the review form.',
      networkDescription: 'Check your connection and try again. Your link has not been used.',
      retry: 'Try again',
      successTitle: 'Thank you for your review.',
      successDescription: 'We received it for moderation. Approved reviews may appear publicly after the team checks them.',
      book: 'Book another visit',
    }
  : {
      pageTitle: 'Поділіться враженням після візиту',
      pageDescription: 'Приватна одноразова форма відгуку після завершеного візиту до Soul Cuts.',
      eyebrow: 'Відгук після візиту',
      title: 'Як пройшов ваш візит?',
      description: 'Оберіть оцінку та, за бажанням, додайте короткий відгук. Кожен відгук проходить перевірку перед можливою публікацією.',
      visit: 'Завершений візит',
      rating: 'Оцінка',
      ratingRequired: 'Оберіть оцінку від 1 до 5.',
      ratingOption: 'з 5',
      review: 'Відгук (необов’язково)',
      reviewPlaceholder: 'Що вам запам’яталося під час візиту?',
      privacy: 'Будь ласка, не вказуйте номер телефону, email чи інші особисті дані.',
      submit: 'Надіслати відгук',
      submitting: 'Надсилаємо…',
      loading: 'Перевіряємо посилання на відгук…',
      invalidTitle: 'Це посилання на відгук недійсне.',
      invalidDescription: 'Скористайтеся оригінальним посиланням із повідомлення після візиту. Без чинного одноразового посилання публічної форми відгуку немає.',
      expiredTitle: 'Термін дії посилання минув.',
      expiredDescription: 'Час для одноразового відгуку про цей візит завершився.',
      submittedTitle: 'Відгук уже отримано.',
      submittedDescription: 'Це одноразове посилання вже використане. Дякуємо, що поділилися враженням.',
      networkTitle: 'Не вдалося завантажити форму.',
      networkDescription: 'Перевірте з’єднання та спробуйте ще раз. Посилання ще не використане.',
      retry: 'Спробувати ще раз',
      successTitle: 'Дякуємо за ваш відгук.',
      successDescription: 'Ми отримали його на модерацію. Після перевірки схвалений відгук може з’явитися публічно.',
      book: 'Записатися ще раз',
    })

useSeoMeta({
  title: () => labels.value.pageTitle,
  description: () => labels.value.pageDescription,
  robots: 'noindex, nofollow, noarchive, nosnippet',
  ogTitle: () => labels.value.pageTitle,
  ogDescription: () => labels.value.pageDescription,
})

useHead({
  meta: [
    { name: 'referrer', content: 'no-referrer' },
  ],
})

const apiStatus = (error: unknown) => {
  const value = error as {
    status?: number
    statusCode?: number
    response?: { status?: number }
  }

  return value.response?.status || value.statusCode || value.status || 0
}

const setStateFromApiError = (error: unknown, fallback: 'invalid' | 'network' = 'network') => {
  const state = reviewRequestStateFromStatus(apiStatus(error))
  pageState.value = state === 'validation' ? fallback : state
}

const loadRequest = async () => {
  if (!reviewToken) {
    pageState.value = 'invalid'
    return
  }

  pageState.value = 'loading'
  request.value = null

  try {
    const response = await domain.resolveReviewRequest(reviewToken)
    request.value = response
    pageState.value = response.state === 'submitted' ? 'submitted' : 'valid'
    if (response.state === 'submitted') return
    trackEvent('review_form_opened')
  }
  catch (error) {
    setStateFromApiError(error)
  }
}

const selectRating = (value: number) => {
  rating.value = value
  validationMessage.value = ''
  trackEvent('rating_selected', reviewAnalyticsPayload({ rating: value }))
}

const handleReviewInput = () => {
  reviewText.value = constrainFormInput(reviewText.value, REVIEW_TEXT_MAX_LENGTH, { multiline: true })
}

const submit = async () => {
  if (submitting.value) return

  if (!isValidReviewRating(rating.value)) {
    validationMessage.value = labels.value.ratingRequired
    trackEvent('review_submit_failed', reviewAnalyticsPayload({ reason: 'validation' }))
    return
  }

  if (!reviewToken || pageState.value !== 'valid') return

  const expiresAt = request.value?.expires_at ? new Date(request.value.expires_at).getTime() : Number.NaN
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    pageState.value = 'expired'
    trackEvent('review_submit_failed', reviewAnalyticsPayload({ reason: 'expired' }))
    return
  }

  const selectedRating = Number(rating.value)
  const safeReviewText = constrainFormInput(reviewText.value, REVIEW_TEXT_MAX_LENGTH, { multiline: true }).trim()
  validationMessage.value = ''
  submitting.value = true
  trackEvent('review_submit_started', reviewAnalyticsPayload({
    rating: selectedRating,
    hasText: Boolean(safeReviewText),
  }))

  try {
    await domain.submitReviewRequest({
      token: reviewToken,
      rating: selectedRating,
      comment: safeReviewText || null,
    })
    reviewToken = ''
    reviewText.value = ''
    pageState.value = 'success'
    trackEvent('review_submitted', reviewAnalyticsPayload({
      rating: selectedRating,
      hasText: Boolean(safeReviewText),
    }))
  }
  catch (error) {
    const state = reviewRequestStateFromStatus(apiStatus(error))

    if (state === 'validation') {
      validationMessage.value = labels.value.ratingRequired
    }
    else {
      pageState.value = state
    }

    trackEvent('review_submit_failed', reviewAnalyticsPayload({
      reason: state,
      rating: selectedRating,
      hasText: Boolean(safeReviewText),
    }))
  }
  finally {
    submitting.value = false
  }
}

const dateLocale = computed(() => locale.value === 'en' ? 'en-US' : 'uk-UA')
const visitDate = computed(() => {
  const value = request.value?.visit_date
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(dateLocale.value, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(date)
})

const masterPhoto = computed(() => assetUrl(request.value?.master_photo_url || null))
const masterInitial = computed(() => request.value?.master_name.trim().charAt(0).toUpperCase() || 'S')

onMounted(async () => {
  reviewToken = reviewTokenFromHash(window.location.hash)
  window.history.replaceState(window.history.state, '', window.location.pathname)
  await loadRequest()
})

onBeforeUnmount(() => {
  reviewToken = ''
  reviewText.value = ''
})
</script>

<template>
  <section data-header-theme="light" class="min-h-[80svh] bg-stone-100 px-4 pb-20 pt-28 text-neutral-950 md:px-8 md:pb-28 md:pt-36">
    <div class="mx-auto max-w-3xl">
      <FeedbackState
        v-if="pageState === 'loading'"
        :title="labels.loading"
        face="wide-eyed-smile"
        style="--feedback-state-surface: #f5f5f4"
      />

      <FeedbackState
        v-else-if="pageState === 'invalid'"
        kind="error"
        :title="labels.invalidTitle"
        :description="labels.invalidDescription"
        style="--feedback-state-surface: #f5f5f4"
      />

      <FeedbackState
        v-else-if="pageState === 'expired'"
        kind="empty"
        :title="labels.expiredTitle"
        :description="labels.expiredDescription"
        style="--feedback-state-surface: #f5f5f4"
      />

      <FeedbackState
        v-else-if="pageState === 'submitted'"
        kind="success"
        :title="labels.submittedTitle"
        :description="labels.submittedDescription"
        style="--feedback-state-surface: #f5f5f4"
      >
        <BaseButton to="/#booking">{{ labels.book }}</BaseButton>
      </FeedbackState>

      <FeedbackState
        v-else-if="pageState === 'network'"
        kind="error"
        :title="labels.networkTitle"
        :description="labels.networkDescription"
        style="--feedback-state-surface: #f5f5f4"
      >
        <BaseButton type="button" @click="loadRequest">{{ labels.retry }}</BaseButton>
      </FeedbackState>

      <FeedbackState
        v-else-if="pageState === 'success'"
        kind="success"
        :title="labels.successTitle"
        :description="labels.successDescription"
        style="--feedback-state-surface: #f5f5f4"
      >
        <BaseButton to="/#booking">{{ labels.book }}</BaseButton>
      </FeedbackState>

      <section v-else-if="pageState === 'valid' && request" class="overflow-hidden bg-white shadow-[0_1.5rem_4rem_rgba(10,10,10,0.1)]" aria-labelledby="review-form-title">
        <div class="grid md:grid-cols-[15rem_1fr]">
          <div class="relative min-h-64 bg-neutral-950 md:min-h-full">
            <img
              v-if="masterPhoto"
              :src="masterPhoto"
              :alt="request.master_name"
              class="absolute inset-0 h-full w-full object-cover object-top"
            >
            <div v-else class="flex h-full min-h-64 items-center justify-center text-7xl font-black text-white" aria-hidden="true">
              {{ masterInitial }}
            </div>
          </div>

          <form class="p-6 sm:p-8 md:p-10" :aria-busy="submitting" @submit.prevent="submit">
            <p class="type-eyebrow text-xs text-amber-700">{{ labels.eyebrow }}</p>
            <h1 id="review-form-title" class="type-page-title mt-3 text-3xl uppercase leading-tight sm:text-4xl">
              {{ labels.title }}
            </h1>
            <p class="mt-4 text-sm leading-7 text-neutral-600">
              {{ labels.description }}
            </p>

            <div class="mt-6 border-y border-stone-200 py-5">
              <p class="type-meta text-[0.68rem] text-neutral-500">{{ labels.visit }}</p>
              <p class="mt-2 text-lg font-semibold">{{ request.master_name }}</p>
              <p v-if="request.service_names.length || visitDate" class="mt-1 text-sm leading-6 text-neutral-600">
                {{ [request.service_names.join(', '), visitDate].filter(Boolean).join(' / ') }}
              </p>
            </div>

            <fieldset class="mt-7">
              <legend class="text-sm font-semibold">{{ labels.rating }}</legend>
              <div class="mt-3 flex w-fit gap-1" role="radiogroup">
                <label v-for="value in 5" :key="value" class="cursor-pointer">
                  <input
                    class="peer sr-only"
                    type="radio"
                    name="rating"
                    :value="value"
                    :checked="rating === value"
                    :disabled="submitting"
                    @change="selectRating(value)"
                  >
                  <span
                    class="flex size-12 items-center justify-center border border-stone-300 text-2xl text-stone-300 transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neutral-950"
                    :class="rating && value <= rating ? 'border-amber-500 bg-amber-50 text-amber-500' : 'hover:border-stone-500 hover:text-stone-500'"
                    :aria-label="`${value} ${labels.ratingOption}`"
                    aria-hidden="true"
                  >★</span>
                  <span class="sr-only">{{ value }} {{ labels.ratingOption }}</span>
                </label>
              </div>
              <p v-if="validationMessage" class="mt-2 text-sm font-semibold text-red-700" role="alert">
                {{ validationMessage }}
              </p>
            </fieldset>

            <div class="mt-7">
              <label for="review-text" class="text-sm font-semibold">{{ labels.review }}</label>
              <textarea
                id="review-text"
                v-model="reviewText"
                rows="5"
                :maxlength="REVIEW_TEXT_MAX_LENGTH"
                :placeholder="labels.reviewPlaceholder"
                :disabled="submitting"
                class="mt-3 w-full resize-y border border-stone-300 bg-stone-50 px-4 py-3 text-base leading-7 outline-none transition placeholder:text-stone-400 focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10"
                @input="handleReviewInput"
              />
              <div class="mt-2 flex items-start justify-between gap-4 text-xs leading-5 text-neutral-500">
                <p>{{ labels.privacy }}</p>
                <p class="shrink-0 tabular-nums" aria-live="polite">{{ reviewText.length }}/{{ REVIEW_TEXT_MAX_LENGTH }}</p>
              </div>
            </div>

            <BaseButton type="submit" block class="mt-7" :disabled="submitting">
              {{ submitting ? labels.submitting : labels.submit }}
            </BaseButton>
          </form>
        </div>
      </section>
    </div>
  </section>
</template>
