<script setup lang="ts">
import type { RepeatBookingContextDto } from '~/domain/barbershop'
import { repeatBookingTokenFromHash } from '~/utils/repeatBooking'

type RepeatBookingState = 'loading' | 'ready' | 'expired' | 'error'

const domain = useBarbershopDomain()
const { locale, terms } = useTerms()
const token = ref('')
const context = ref<RepeatBookingContextDto | null>(null)
const state = ref<RepeatBookingState>('loading')

const copy = computed(() => locale.value === 'en'
  ? {
      loading: 'Preparing your repeat booking...',
      expiredTitle: 'This repeat booking link is no longer available',
      expiredDescription: 'Choose a master and services in the regular booking form.',
      errorTitle: 'We could not open the repeat booking',
      errorDescription: 'Check your connection and try opening the link again.',
      action: 'Book an appointment',
    }
  : {
      loading: 'Готуємо повторний запис...',
      expiredTitle: 'Це посилання для повторного запису вже недоступне',
      expiredDescription: 'Оберіть майстра та послуги у звичайній формі запису.',
      errorTitle: 'Не вдалося відкрити повторний запис',
      errorDescription: 'Перевірте з’єднання та спробуйте відкрити посилання ще раз.',
      action: 'Записатися',
    })

const apiStatus = (error: unknown) =>
  (error as { response?: { status?: number }, status?: number })?.response?.status
  || (error as { status?: number })?.status

onMounted(async () => {
  token.value = repeatBookingTokenFromHash(window.location.hash)
  window.history.replaceState(window.history.state, '', '/booking/repeat')

  if (!token.value) {
    state.value = 'expired'
    return
  }

  try {
    await domain.resolveRepeatBooking(token.value)
    const started = await domain.startRepeatBooking(token.value)
    context.value = started.context
    state.value = 'ready'
  }
  catch (error) {
    state.value = apiStatus(error) === 401 ? 'expired' : 'error'
  }
})

useSeoMeta({ robots: 'noindex, nofollow, noarchive' })
useHead({
  title: 'Повторний запис — Soul Cuts',
  meta: [{ name: 'referrer', content: 'no-referrer' }],
})
</script>

<template>
  <section class="flex min-h-[calc(100svh-4rem)] flex-col bg-neutral-950 pt-20 text-white md:pt-24">
    <div v-if="state === 'ready' && context" class="flex min-h-0 flex-1 flex-col">
      <div class="shrink-0 px-4 pb-3 sm:px-6">
        <p class="text-xs font-semibold uppercase text-white/50">{{ terms.home.booking.label }}</p>
        <h1 class="mt-1 text-2xl font-semibold sm:text-3xl">{{ terms.common.bookAppointment }}</h1>
      </div>
      <BookingSection
        analytics-source="repeat_booking"
        id-prefix="repeat-booking"
        :listen-for-external-select="false"
        mode="drawer"
        :repeat-booking-token="token"
        :repeat-booking-context="context"
      />
    </div>

    <div v-else class="grid min-h-[32rem] flex-1 place-items-center px-6 py-16 text-center">
      <p v-if="state === 'loading'" class="text-sm text-white/65" role="status" aria-live="polite">
        {{ copy.loading }}
      </p>
      <div v-else class="max-w-lg">
        <h1 class="text-3xl font-semibold leading-tight sm:text-4xl">
          {{ state === 'expired' ? copy.expiredTitle : copy.errorTitle }}
        </h1>
        <p class="mt-4 text-sm leading-6 text-white/65">
          {{ state === 'expired' ? copy.expiredDescription : copy.errorDescription }}
        </p>
        <BaseButton to="/#booking" variant="light" class="mt-7">
          {{ copy.action }}
        </BaseButton>
      </div>
    </div>
  </section>
</template>
