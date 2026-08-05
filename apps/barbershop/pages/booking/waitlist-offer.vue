<script setup lang="ts">
import { waitlistOfferTokenFromHash } from '~/utils/bookingRecovery'

const route = useRoute()
const domain = useBarbershopDomain()
const { locale } = useTerms()

const token = ref('')
const state = ref<'checking' | 'ready' | 'claiming' | 'success' | 'unavailable' | 'error'>('checking')
const bookedStartAt = ref('')

onMounted(() => {
  token.value = waitlistOfferTokenFromHash(window.location.hash || route.hash)
  state.value = token.value ? 'ready' : 'unavailable'
})

const copy = computed(() => locale.value === 'en'
  ? {
      eyebrow: 'Waitlist offer',
      title: 'A time is being held for you',
      description: 'This is not a confirmed booking yet. Confirm the offer to reserve the appointment before the hold expires.',
      checking: 'Checking the secure offer...',
      confirm: 'Confirm booking',
      claiming: 'Confirming...',
      successTitle: 'Your booking is confirmed',
      successDescription: 'We have reserved your appointment and will send a confirmation by SMS.',
      unavailableTitle: 'This offer is no longer available',
      unavailableDescription: 'The hold has expired or was already used. Please return to booking to choose another time.',
      errorTitle: 'We could not confirm the booking',
      errorDescription: 'Please try again. If the time is no longer available, return to booking to choose another option.',
      booking: 'Open booking',
    }
  : {
      eyebrow: 'Пропозиція з листа очікування',
      title: 'Для вас утримується вільний час',
      description: 'Це ще не підтверджений запис. Підтвердьте пропозицію, щоб забронювати час до завершення утримання.',
      checking: 'Перевіряємо захищену пропозицію...',
      confirm: 'Підтвердити запис',
      claiming: 'Підтверджуємо...',
      successTitle: 'Запис підтверджено',
      successDescription: 'Ми забронювали ваш візит і надішлемо підтвердження SMS.',
      unavailableTitle: 'Ця пропозиція вже недоступна',
      unavailableDescription: 'Час утримання завершився або пропозицію вже використано. Поверніться до запису, щоб обрати інший час.',
      errorTitle: 'Не вдалося підтвердити запис',
      errorDescription: 'Спробуйте ще раз. Якщо час уже недоступний, поверніться до запису та оберіть інший варіант.',
      booking: 'Відкрити запис',
    },
)

const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'uk-UA', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
}).format(new Date(value))

const confirm = async () => {
  if (!token.value || state.value === 'claiming') return
  state.value = 'claiming'

  try {
    const response = await domain.claimWaitlistOffer(token.value)
    bookedStartAt.value = response.start_at
    state.value = 'success'
  }
  catch (error) {
    const status = (error as { response?: { status?: number }, status?: number })?.response?.status
      || (error as { status?: number })?.status
    state.value = status === 409 || status === 410 ? 'unavailable' : 'error'
  }
}

useSeo(
  () => copy.value.title,
  () => copy.value.description,
)
useSeoMeta({ robots: 'noindex, nofollow, noarchive' })
useHead({
  meta: [{ name: 'referrer', content: 'no-referrer' }],
})
</script>

<template>
  <section data-header-theme="light" class="min-h-screen bg-stone-100 pb-16 pt-28 text-neutral-950 sm:pb-24 sm:pt-36">
    <div class="site-container max-w-2xl">
      <div class="border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
        <p class="type-eyebrow text-xs text-neutral-500">{{ copy.eyebrow }}</p>

        <template v-if="state === 'checking'">
          <h1 class="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{{ copy.title }}</h1>
          <p class="mt-4 max-w-xl text-base leading-7 text-neutral-600" role="status">{{ copy.checking }}</p>
        </template>

        <template v-else-if="state === 'ready' || state === 'claiming'">
          <h1 class="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{{ copy.title }}</h1>
          <p class="mt-4 max-w-xl text-base leading-7 text-neutral-600">{{ copy.description }}</p>
          <BaseButton type="button" variant="dark" class="mt-8" :disabled="state === 'claiming'" @click="confirm">
            {{ state === 'claiming' ? copy.claiming : copy.confirm }}
          </BaseButton>
        </template>

        <template v-else-if="state === 'success'">
          <h1 class="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{{ copy.successTitle }}</h1>
          <p class="mt-4 text-base leading-7 text-neutral-600">{{ copy.successDescription }}</p>
          <p v-if="bookedStartAt" class="mt-5 border border-neutral-200 bg-neutral-50 p-4 text-lg font-semibold">
            {{ formatDateTime(bookedStartAt) }}
          </p>
        </template>

        <template v-else>
          <h1 class="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
            {{ state === 'unavailable' ? copy.unavailableTitle : copy.errorTitle }}
          </h1>
          <p class="mt-4 text-base leading-7 text-neutral-600">
            {{ state === 'unavailable' ? copy.unavailableDescription : copy.errorDescription }}
          </p>
          <BaseButton to="/#booking" variant="dark" class="mt-8">{{ copy.booking }}</BaseButton>
        </template>
      </div>
    </div>
  </section>
</template>
