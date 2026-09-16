<script setup lang="ts">
import type { PublicBookingPromotion } from '~/utils/bookingPromotions'

const props = withDefaults(defineProps<{
  offer: PublicBookingPromotion
  compact?: boolean
  theme?: 'dark' | 'light'
}>(), {
  compact: false,
  theme: 'dark',
})

const { locale } = useTerms()
const description = computed(() => locale.value === 'en'
  ? props.offer.description_en || props.offer.description_uk
  : props.offer.description_uk || props.offer.description_en)
const titleSuffix = computed(() => locale.value === 'en'
  ? 'off your first visit'
  : 'на перший візит')
const automaticTerms = computed(() => locale.value === 'en'
  ? 'For new barbershop guests. The discount is applied automatically when you book, subject to offer terms.'
  : 'Для нових гостей барбершопу. Знижка застосовується автоматично під час запису за умовами спеціальної пропозиції.')
const compactTerms = computed(() => locale.value === 'en'
  ? 'For new guests · offer terms apply'
  : 'Для нових гостей · умови спеціальної пропозиції')
const scope = computed(() => {
  if (props.offer.applies_to_all_masters && props.offer.applies_to_all_services) return ''

  if (locale.value === 'en') {
    if (!props.offer.applies_to_all_masters && !props.offer.applies_to_all_services) return 'Selected barbers and services only.'
    return props.offer.applies_to_all_masters ? 'Selected services only.' : 'Selected barbers only.'
  }

  if (!props.offer.applies_to_all_masters && !props.offer.applies_to_all_services) return 'Лише для вибраних барберів та послуг.'
  return props.offer.applies_to_all_masters ? 'Лише для вибраних послуг.' : 'Лише для вибраних барберів.'
})
</script>

<template>
  <aside
    class="booking-promotion-notice"
    :class="[
      compact ? 'booking-promotion-notice--compact' : '',
      `booking-promotion-notice--${theme}`,
    ]"
    aria-live="polite"
  >
    <span class="min-w-0">
      <strong class="block text-sm font-semibold leading-5">
        <span class="booking-promotion-notice__discount">−{{ offer.discount_percent }}%</span>
        {{ titleSuffix }}
      </strong>
      <span v-if="!compact && description" class="mt-0.5 block text-sm leading-5 text-current/75">{{ description }}</span>
      <span class="booking-promotion-notice__terms block text-xs leading-5 text-current/70">{{ compact ? compactTerms : automaticTerms }}</span>
      <span v-if="scope" class="block text-xs font-medium leading-5 text-current/70">{{ scope }}</span>
    </span>
  </aside>
</template>

<style scoped>
.booking-promotion-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.8rem 1rem 0.65rem;
  color: white;
  background: linear-gradient(
    120deg,
    rgb(62 24 30 / 0.78),
    rgb(25 52 45 / 0.82),
    rgb(45 28 59 / 0.8),
    rgb(62 24 30 / 0.78)
  );
  background-size: 300% 300%;
  animation: booking-offer-background 12s ease-in-out infinite;
  clip-path: polygon(0 8%, 7% 2%, 15% 7%, 25% 1%, 36% 5%, 48% 0, 61% 6%, 72% 2%, 83% 7%, 93% 1%, 100% 6%, 99% 26%, 100% 48%, 99% 72%, 100% 94%, 92% 98%, 82% 93%, 70% 100%, 58% 95%, 46% 99%, 34% 94%, 23% 100%, 12% 95%, 0 100%, 1% 75%, 0 52%, 1% 29%);
}

.booking-promotion-notice--light {
  background: linear-gradient(
    120deg,
    rgb(136 19 55 / 0.94),
    rgb(91 33 182 / 0.92),
    rgb(8 112 133 / 0.92),
    rgb(136 19 55 / 0.94)
  );
  background-size: 300% 300%;
  box-shadow: 0 14px 34px rgb(47 20 67 / 0.2);
}

.booking-promotion-notice--compact {
  gap: 0.45rem;
  padding: 0.7rem 1rem 0.55rem;
}

.booking-promotion-notice__discount {
  display: inline-flex;
  margin-right: 0.2rem;
  padding: 0.08rem 0.38rem;
  color: white;
  background: linear-gradient(110deg, rgb(127 29 29), rgb(239 68 68), rgb(153 27 27));
  background-size: 220% 100%;
  box-shadow: 0 4px 14px rgb(127 29 29 / 0.22);
  animation: booking-discount-glow 5s ease-in-out infinite;
}

@media (max-width: 570px) {
  .booking-promotion-notice__terms {
    font-size: 10px;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }
}

@keyframes booking-discount-glow {
  0%,
  100% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }
}

@keyframes booking-offer-background {
  0%,
  100% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .booking-promotion-notice,
  .booking-promotion-notice__discount {
    animation: none;
  }
}
</style>
