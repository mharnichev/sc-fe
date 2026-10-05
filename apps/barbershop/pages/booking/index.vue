<script setup lang="ts">
import type { CampaignOfferContextDto } from '~/domain/barbershop'
import { clearCampaignOffer, isCampaignOfferToken, newCampaignOfferEventId, readCampaignOffer, saveCampaignOffer } from '~/utils/campaignOffer'

const domain = useBarbershopDomain()
const { locale, terms } = useTerms()
const capturedToken = useState<string | null>('campaign-offer-captured-token', () => null)
const capturedEventId = useState<string>('campaign-offer-event-id', () => '')
const token = ref('')
const eventId = ref('')
const context = ref<CampaignOfferContextDto | null>(null)
const state = ref<'loading' | 'ready' | 'unavailable' | 'error' | 'normal'>('loading')
let openAttempted = false
let resolveGeneration = 0
let pageMounted = false

const copy = computed(() => locale.value === 'en' ? {
  loading: 'Opening your personal offer…',
  unavailable: 'This offer is no longer available. You can still book at the regular price.',
  error: 'We could not check this offer. Check your connection and try again.',
  normal: 'Continue with a regular booking',
  retry: 'Try again',
} : {
  loading: 'Відкриваємо вашу персональну пропозицію…',
  unavailable: 'Ця пропозиція вже недоступна. Ви можете записатися за звичайною ціною.',
  error: 'Не вдалося перевірити пропозицію. Перевірте з’єднання і спробуйте ще раз.',
  normal: 'Продовжити звичайний запис',
  retry: 'Спробувати ще раз',
})

const clearOffer = () => {
  resolveGeneration += 1
  try { clearCampaignOffer(window.sessionStorage) }
  catch { /* Storage may be disabled. */ }
  capturedToken.value = null
  capturedEventId.value = ''
  token.value = ''
  context.value = null
  state.value = 'normal'
}

const confirmVisibleOpen = async () => {
  if (openAttempted || state.value !== 'ready' || !token.value || !eventId.value || document.visibilityState !== 'visible') return
  const generation = resolveGeneration
  await nextTick()
  if (!pageMounted || generation !== resolveGeneration || state.value !== 'ready' || document.visibilityState !== 'visible') return
  openAttempted = true
  try { await domain.confirmCampaignOfferOpen(token.value, eventId.value) }
  catch { /* Analytics is best effort and never gates booking. */ }
}

const resolveOffer = async () => {
  if (!isCampaignOfferToken(token.value)) {
    state.value = 'unavailable'
    return
  }
  const requestedToken = token.value
  const generation = ++resolveGeneration
  state.value = 'loading'
  try {
    const resolved = await domain.resolveCampaignOffer(requestedToken)
    if (generation !== resolveGeneration) return
    context.value = resolved
    state.value = resolved.entitlement === 'available' ? 'ready' : 'unavailable'
    if (state.value === 'ready') void confirmVisibleOpen()
  }
  catch (error) {
    if (generation !== resolveGeneration) return
    const status = (error as { response?: { status?: number }, status?: number })?.response?.status
      || (error as { status?: number })?.status
    state.value = [403, 404, 410, 422].includes(status || 0) ? 'unavailable' : 'error'
  }
}

const selectOffer = () => {
  resolveGeneration += 1
  openAttempted = false
  context.value = null
  token.value = ''
  eventId.value = ''
  const fromStorage = (() => {
    try { return readCampaignOffer(window.sessionStorage) }
    catch { return null }
  })()
  const selectedToken = capturedToken.value === '' ? '' : capturedToken.value || fromStorage?.token || ''
  if (!selectedToken) {
    state.value = capturedToken.value === '' ? 'unavailable' : 'normal'
    return
  }
  token.value = selectedToken
  try {
    const saved = saveCampaignOffer(window.sessionStorage, selectedToken)
    eventId.value = saved.eventId
  }
  catch { eventId.value = capturedEventId.value || newCampaignOfferEventId() }
  capturedEventId.value = eventId.value
  void resolveOffer()
}

watch(capturedToken, value => {
  // Clearing attribution after booking must leave the successful wizard mounted.
  if (pageMounted && value !== null) selectOffer()
})

onMounted(() => {
  pageMounted = true
  document.addEventListener('visibilitychange', confirmVisibleOpen)
  selectOffer()
})

onBeforeUnmount(() => {
  pageMounted = false
  resolveGeneration += 1
  document.removeEventListener('visibilitychange', confirmVisibleOpen)
})

useSeoMeta({ robots: 'noindex, nofollow, noarchive' })
useHead({
  title: 'Запис — Soul Cuts',
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
        analytics-source="campaign_offer_booking"
        id-prefix="campaign-offer-booking"
        :listen-for-external-select="false"
        mode="drawer"
        :campaign-offer-token="token"
        :campaign-offer-context="context"
        @continue-regular-booking="clearOffer"
      />
    </div>
    <div v-else-if="state === 'normal'" class="flex min-h-0 flex-1 flex-col">
      <BookingSection analytics-source="regular_booking" id-prefix="regular-booking" :listen-for-external-select="false" mode="drawer" />
    </div>
    <div v-else class="grid min-h-[32rem] flex-1 place-items-center px-6 py-16 text-center">
      <div class="max-w-lg">
        <p v-if="state === 'loading'" role="status">{{ copy.loading }}</p>
        <template v-else>
          <h1 class="text-3xl font-semibold">{{ state === 'unavailable' ? copy.unavailable : copy.error }}</h1>
          <div class="mt-7 flex flex-wrap justify-center gap-4">
            <BaseButton v-if="state === 'error'" type="button" variant="light" @click="resolveOffer">{{ copy.retry }}</BaseButton>
            <BaseButton type="button" variant="light" @click="clearOffer">{{ copy.normal }}</BaseButton>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
