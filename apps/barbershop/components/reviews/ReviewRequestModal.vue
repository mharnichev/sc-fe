<script setup lang="ts">
import type { PublicReviewRequestDto } from '~/domain/barbershop'
import {
  isValidReviewRating,
  REVIEW_TEXT_MAX_LENGTH,
  reviewAnalyticsPayload,
  reviewRequestStateFromStatus,
} from '~/utils/reviews.js'

type ReviewModalState = 'loading' | 'valid' | 'invalid' | 'expired' | 'submitted' | 'network' | 'success'

const props = defineProps<{
  token: string
}>()

const emit = defineEmits<{
  closed: []
}>()

const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const { trackEvent } = useAnalytics()

const isOpen = ref(false)
const pageState = ref<ReviewModalState>('loading')
const request = ref<PublicReviewRequestDto | null>(null)
const rating = ref<number | null>(null)
const reviewText = ref('')
const validationMessage = ref('')
const submitting = ref(false)
let hasTrackedAnalyticsOpen = false

const labels = computed(() => locale.value === 'en'
  ? {
      dialog: 'Post-visit review',
      eyebrow: 'Post-visit review',
      title: 'How was your visit?',
      description: 'Tell us honestly how it went. We want to keep getting better and welcome criticism that helps both your barber and Soul Cuts improve. Choose a rating and add a few words if you feel like it.',
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
      invalidDescription: 'Use the original link from your post-visit message.',
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
      dialog: 'Відгук після візиту',
      eyebrow: 'Відгук після візиту',
      title: 'Як пройшов ваш візит?',
      description: 'Розкажіть чесно, як усе пройшло. Ми хочемо ставати кращими й відкриті до критики, яка допоможе рости і вашому майстру, і Soul Cuts. Оберіть оцінку та, якщо хочеться, додайте кілька слів.',
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
      invalidDescription: 'Скористайтеся оригінальним посиланням із повідомлення після візиту.',
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
  pageState.value = 'loading'
  request.value = null

  try {
    const response = await domain.resolveReviewRequest(props.token)
    request.value = response
    pageState.value = response.state === 'submitted' ? 'submitted' : 'valid'

    if (response.state !== 'submitted') {
      if (!hasTrackedAnalyticsOpen) {
        hasTrackedAnalyticsOpen = true
        trackEvent('review_form_opened', reviewAnalyticsPayload({
          masterId: response.master_id,
        }))
      }
      // Re-attempt this idempotent milestone after every successful reload.
      // The backend's unique request key prevents retries from inflating it.
      void domain.recordReviewFormOpen(props.token).catch(() => undefined)
    }
  }
  catch (error) {
    const state = reviewRequestStateFromStatus(apiStatus(error))
    setStateFromApiError(error)
    trackEvent('review_form_load_failed', reviewAnalyticsPayload({
      reason: state,
    }))
  }
  finally {
    await nextTick()
    isOpen.value = true
  }
}

const closeModal = () => {
  if (submitting.value) return
  isOpen.value = false
  reviewText.value = ''
  emit('closed')
}

const handleOpenUpdate = (value: boolean) => {
  if (value) {
    isOpen.value = true
    return
  }

  closeModal()
}

const selectRating = (value: number) => {
  rating.value = value
  validationMessage.value = ''
  trackEvent('rating_selected', reviewAnalyticsPayload({
    rating: value,
    masterId: request.value?.master_id,
  }))
}

const handleReviewInput = () => {
  reviewText.value = constrainFormInput(reviewText.value, REVIEW_TEXT_MAX_LENGTH, { multiline: true })
}

const submit = async () => {
  if (submitting.value) return

  if (!isValidReviewRating(rating.value)) {
    validationMessage.value = labels.value.ratingRequired
    trackEvent('review_submit_failed', reviewAnalyticsPayload({
      reason: 'validation',
      masterId: request.value?.master_id,
    }))
    return
  }

  if (pageState.value !== 'valid') return

  const expiresAt = request.value?.expires_at ? new Date(request.value.expires_at).getTime() : Number.NaN
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    pageState.value = 'expired'
    trackEvent('review_submit_failed', reviewAnalyticsPayload({
      reason: 'expired',
      masterId: request.value?.master_id,
    }))
    return
  }

  const selectedRating = Number(rating.value)
  const safeReviewText = constrainFormInput(reviewText.value, REVIEW_TEXT_MAX_LENGTH, { multiline: true }).trim()
  validationMessage.value = ''
  submitting.value = true
  trackEvent('review_submit_started', reviewAnalyticsPayload({
    rating: selectedRating,
    hasText: Boolean(safeReviewText),
    masterId: request.value?.master_id,
  }))

  try {
    await domain.submitReviewRequest({
      token: props.token,
      rating: selectedRating,
      comment: safeReviewText || null,
    })
    reviewText.value = ''
    pageState.value = 'success'
    trackEvent('review_submitted', reviewAnalyticsPayload({
      rating: selectedRating,
      hasText: Boolean(safeReviewText),
      masterId: request.value?.master_id,
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
      masterId: request.value?.master_id,
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

onMounted(loadRequest)

onBeforeUnmount(() => {
  reviewText.value = ''
})
</script>

<template>
  <BaseModal
    :model-value="isOpen"
    :dialog-label="labels.dialog"
    :close-label="terms.common.close"
    :block-close="submitting"
    type="right"
    @update:model-value="handleOpenUpdate"
  >
    <div data-hj-suppress class="min-h-full">
    <FeedbackState
      v-if="pageState === 'loading'"
      :title="labels.loading"
      face="wide-eyed-smile"
      style="--feedback-state-surface: #fff"
    />

    <FeedbackState
      v-else-if="pageState === 'invalid'"
      kind="error"
      :title="labels.invalidTitle"
      :description="labels.invalidDescription"
      style="--feedback-state-surface: #fff"
    />

    <FeedbackState
      v-else-if="pageState === 'expired'"
      kind="empty"
      :title="labels.expiredTitle"
      :description="labels.expiredDescription"
      style="--feedback-state-surface: #fff"
    />

    <div v-else-if="pageState === 'submitted'" class="review-request-state-shell">
      <FeedbackState
        kind="success"
        :title="labels.submittedTitle"
        :description="labels.submittedDescription"
        style="--feedback-state-surface: #fff"
      >
        <BaseButton to="/#booking">{{ labels.book }}</BaseButton>
      </FeedbackState>
    </div>

    <FeedbackState
      v-else-if="pageState === 'network'"
      kind="error"
      :title="labels.networkTitle"
      :description="labels.networkDescription"
      style="--feedback-state-surface: #fff"
    >
      <BaseButton type="button" @click="loadRequest">{{ labels.retry }}</BaseButton>
    </FeedbackState>

    <div v-else-if="pageState === 'success'" class="review-request-state-shell">
      <FeedbackState
        kind="success"
        :title="labels.successTitle"
        :description="labels.successDescription"
        style="--feedback-state-surface: #fff"
      >
        <BaseButton to="/#booking">{{ labels.book }}</BaseButton>
      </FeedbackState>
    </div>

    <div v-else-if="pageState === 'valid' && request" class="min-w-0 max-w-full overflow-hidden">
      <div class="review-master-hero relative h-72 min-w-0 overflow-hidden bg-neutral-950 sm:h-80 md:h-96">
        <img
          v-if="masterPhoto"
          :src="masterPhoto"
          :alt="request.master_name"
          class="absolute inset-0 h-full w-full object-cover object-top"
        >
        <div v-else class="flex h-full items-center justify-center text-7xl font-black text-white" aria-hidden="true">
          {{ masterInitial }}
        </div>
        <div class="review-master-hero__tear absolute inset-x-0 bottom-0" aria-hidden="true" />
      </div>

      <form class="min-w-0 max-w-full overflow-hidden px-6 pb-8 pt-3 sm:px-8 sm:pb-10 md:px-10 md:pb-12" :aria-busy="submitting" @submit.prevent="submit">
        <p class="type-eyebrow text-xs">{{ labels.eyebrow }}</p>
        <h1 class="type-page-title mt-3 break-words text-2xl uppercase leading-tight sm:text-4xl">
          {{ labels.title }}
        </h1>
        <p class="mt-4 text-sm leading-7 text-neutral-600">
          {{ labels.description }}
        </p>

        <div class="mt-6 bg-stone-100 px-5 py-5">
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
                class="flex size-11 items-center justify-center text-3xl transition hover:text-amber-400 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neutral-950"
                :class="rating !== null && value <= rating ? 'text-amber-500' : 'text-neutral-300'"
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
          <BaseTextarea
            id="review-text"
            v-model="reviewText"
            :rows="5"
            :maxlength="REVIEW_TEXT_MAX_LENGTH"
            :placeholder="labels.reviewPlaceholder"
            :disabled="submitting"
            class="mt-3"
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
    </div>
  </BaseModal>
</template>

<style scoped>
.review-request-state-shell {
  display: grid;
  min-height: 100%;
  place-items: center;
}

.review-master-hero__shade {
  background:
    linear-gradient(180deg, rgb(0 0 0 / 0.08) 45%, rgb(255 255 255 / 0.12) 72%, rgb(255 255 255 / 0.9) 100%);
}

.review-master-hero__blur {
  height: 42%;
  background: linear-gradient(180deg, transparent 0%, rgb(255 255 255 / 0.16) 34%, rgb(255 255 255 / 0.92) 100%);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 38%, #000 100%);
  mask-image: linear-gradient(180deg, transparent 0%, #000 38%, #000 100%);
}

.review-master-hero__tear {
  height: 3.75rem;
  background: #ffffff;
  clip-path: polygon(
    0 72%,
    4% 55%,
    8% 68%,
    12% 48%,
    17% 66%,
    22% 52%,
    27% 70%,
    32% 47%,
    38% 64%,
    43% 51%,
    49% 69%,
    55% 45%,
    61% 65%,
    67% 50%,
    73% 71%,
    79% 46%,
    85% 64%,
    91% 52%,
    96% 68%,
    100% 55%,
    100% 100%,
    0 100%
  );
}

@media (prefers-reduced-transparency: reduce) {
  .review-master-hero__blur {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
</style>
