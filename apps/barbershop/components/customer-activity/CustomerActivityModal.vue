<script setup lang="ts">
import FeedbackFace from '~/components/ui/FeedbackFace.vue'
import type { CustomerActivityBookingDto, CustomerActivityResponseDto, CustomerActivityWaitlistDto } from '~/domain/barbershop'
import { customerActivityStateFromStatus } from '~/utils/customerActivity'

type ActivityState = 'loading' | 'ready' | 'expired' | 'error'
type CancellationTarget =
  | { kind: 'booking', item: CustomerActivityBookingDto }
  | { kind: 'waitlist', item: CustomerActivityWaitlistDto }

const props = withDefaults(defineProps<{ token?: string, cancelMode?: boolean }>(), {
  token: '',
  cancelMode: false,
})
const emit = defineEmits<{ closed: [] }>()
const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const isOpen = ref(true)
const state = ref<ActivityState>('loading')
const activity = ref<CustomerActivityResponseDto | null>(null)
const cancellationTarget = ref<CancellationTarget | null>(null)
const cancelling = ref(false)
const forgettingDevice = ref(false)
const successMessage = ref('')
const forgetDeviceError = ref('')

const usesBrowserSession = computed(() => !props.token)
const deviceAccessCopy = {
  emptyTitle: 'Мої записи',
  emptyDescription: 'На цьому пристрої немає збережених записів. Відкрийте останнє SMS від Soul Cuts, щоб керувати записом.',
  forget: 'Це не мій пристрій',
  forgetting: 'Видаляємо доступ…',
  forgetError: 'Не вдалося видалити доступ із цього пристрою. Спробуйте ще раз.',
}

const labels = computed(() => locale.value === 'en'
  ? { dialog: 'My appointments', eyebrow: 'My appointments', loading: 'Loading your appointments…', bookings: 'Confirmed bookings', waitlist: 'Waitlist', noBookings: 'You have no upcoming confirmed bookings.', noWaitlist: 'You have no active waitlist requests.', date: 'Date and time', services: 'Services', desiredDate: 'Preferred date', active: 'Active', offered: 'Time offered', expires: 'Offer expires', cancel: 'Cancel', confirmTitle: 'Cancel this appointment?', confirmWaitlistTitle: 'Leave this waitlist?', confirmDescription: 'This action cannot be undone.', confirm: 'Yes, cancel', back: 'Keep it', cancelling: 'Cancelling…', bookingCancelled: 'Your appointment was cancelled.', waitlistCancelled: 'You were removed from the waitlist.', expiredTitle: 'This link is no longer available', expiredDescription: 'Open the latest SMS from Soul Cuts to view your current bookings.', errorTitle: 'We could not load your appointments', errorDescription: 'Check your connection and try again. Your bookings were not changed.', missingTitle: 'Open your personal link', missingDescription: 'Use the secure link from an SMS by Soul Cuts to view or cancel your bookings.', retry: 'Try again', book: 'Book an appointment' }
  : { dialog: 'Мої записи', eyebrow: 'Мої записи', loading: 'Завантажуємо ваші записи…', bookings: 'Підтверджені записи', waitlist: 'Лист очікування', noBookings: 'У вас немає майбутніх підтверджених записів.', noWaitlist: 'У вас немає активних заявок у листі очікування.', date: 'Дата й час', services: 'Послуги', desiredDate: 'Бажана дата', active: 'Активна заявка', offered: 'Запропоновано час', expires: 'Пропозиція діє до', cancel: 'Скасувати', confirmTitle: 'Скасувати цей запис?', confirmWaitlistTitle: 'Вийти з листа очікування?', confirmDescription: 'Цю дію не можна скасувати.', confirm: 'Так, скасувати', back: 'Залишити', cancelling: 'Скасовуємо…', bookingCancelled: 'Ваш запис скасовано.', waitlistCancelled: 'Вас виключено з листа очікування.', expiredTitle: 'Це посилання вже недоступне', expiredDescription: 'Відкрийте останнє SMS від Soul Cuts, щоб переглянути актуальні записи.', errorTitle: 'Не вдалося завантажити ваші записи', errorDescription: 'Перевірте з’єднання та спробуйте ще раз. Ваші записи не змінено.', missingTitle: 'Відкрийте персональне посилання', missingDescription: 'Щоб переглянути або скасувати запис, відкрийте захищене посилання з SMS від Soul Cuts.', retry: 'Спробувати ще раз', book: 'Записатися' })

const dateLocale = computed(() => locale.value === 'en' ? 'en-US' : 'uk-UA')
const formatDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(dateLocale.value, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(date)
}
const formatDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00+03:00`)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(dateLocale.value, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' }).format(date)
}
const apiStatus = (error: unknown) => {
  const value = error as { status?: number, statusCode?: number, response?: { status?: number } }
  return value.response?.status || value.statusCode || value.status || 0
}
const loadActivity = async () => {
  cancellationTarget.value = null
  activity.value = null
  state.value = 'loading'
  try { activity.value = await domain.resolveCustomerActivity(props.token || undefined); state.value = 'ready' }
  catch (error) { state.value = customerActivityStateFromStatus(apiStatus(error)) }
}
const requestCancellation = async (target: CancellationTarget) => {
  successMessage.value = ''
  cancellationTarget.value = target
  await nextTick()
  document.querySelector<HTMLElement>('[data-customer-activity-confirmation]')?.focus()
}
const isCancellationTarget = (kind: CancellationTarget['kind'], publicId: string) =>
  cancellationTarget.value?.kind === kind && cancellationTarget.value.item.public_id === publicId
const cancelTarget = async () => {
  const target = cancellationTarget.value
  if (!target || cancelling.value) return
  cancelling.value = true
  try {
    if (target.kind === 'booking') await domain.cancelCustomerActivityBooking(target.item.public_id, props.token || undefined)
    else await domain.cancelCustomerActivityWaitlist(target.item.public_id, props.token || undefined)
    cancellationTarget.value = null
    await loadActivity()
    successMessage.value = target.kind === 'booking' ? labels.value.bookingCancelled : labels.value.waitlistCancelled
  }
  catch (error) {
    cancellationTarget.value = null
    if (customerActivityStateFromStatus(apiStatus(error)) === 'expired') state.value = 'expired'
    else successMessage.value = labels.value.errorDescription
  }
  finally { cancelling.value = false }
}
const forgetDevice = async () => {
  if (!usesBrowserSession.value || forgettingDevice.value) return
  forgettingDevice.value = true
  forgetDeviceError.value = ''
  try {
    await domain.forgetCustomerActivityDevice()
    isOpen.value = false
    emit('closed')
  }
  catch {
    forgetDeviceError.value = deviceAccessCopy.forgetError
  }
  finally {
    forgettingDevice.value = false
  }
}
const close = () => {
  if (!cancelling.value && !forgettingDevice.value) {
    isOpen.value = false
    emit('closed')
  }
}
const cancelIntent = computed(() => props.cancelMode
  ? (locale.value === 'en' ? 'Choose an appointment or waitlist request to cancel.' : 'Оберіть запис або заявку в листі очікування для скасування.')
  : '')
onMounted(loadActivity)
</script>

<template>
  <BaseModal :model-value="isOpen" :dialog-label="labels.dialog" :close-label="terms.common.close" :block-close="cancelling || forgettingDevice" type="right" @update:model-value="close">
    <div data-hj-suppress class="customer-activity-modal min-h-full bg-white px-6 pb-10 pt-14 sm:px-8 sm:pb-12 sm:pt-16">
      <div v-if="state === 'loading'" class="grid min-h-[18rem] place-items-center text-center" aria-busy="true"><p class="text-sm text-neutral-600" role="status">{{ labels.loading }}</p></div>
      <div v-else-if="state === 'expired'" class="grid min-h-[18rem] place-items-center text-center"><div class="max-w-sm"><div v-if="!token" class="mx-auto mb-5 w-20 text-neutral-950"><FeedbackFace name="joyful-heart-grin" style="--feedback-face-cutout: #fff" /></div><h1 class="type-page-title text-2xl uppercase leading-tight">{{ token ? labels.expiredTitle : deviceAccessCopy.emptyTitle }}</h1><p class="mt-4 text-sm leading-6 text-neutral-600">{{ token ? labels.expiredDescription : deviceAccessCopy.emptyDescription }}</p><BaseButton to="/#booking" class="mt-7">{{ labels.book }}</BaseButton></div></div>
      <div v-else-if="state === 'error'" class="grid min-h-[18rem] place-items-center text-center"><div class="max-w-sm"><h1 class="type-page-title text-2xl uppercase leading-tight">{{ labels.errorTitle }}</h1><p class="mt-4 text-sm leading-6 text-neutral-600">{{ labels.errorDescription }}</p><BaseButton type="button" class="mt-7" @click="loadActivity">{{ labels.retry }}</BaseButton></div></div>
      <template v-else-if="activity">
        <h1 class="type-eyebrow text-xs text-neutral-500">{{ labels.eyebrow }}</h1>
        <p v-if="cancelIntent" class="mt-4 text-sm leading-6 text-neutral-700">{{ cancelIntent }}</p>
        <p v-if="successMessage" class="mt-5 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{{ successMessage }}</p>
        <section class="mt-8" :aria-label="labels.bookings">
          <h2 class="text-lg font-semibold">{{ labels.bookings }}</h2>
          <p v-if="!activity.bookings.length" class="mt-3 text-sm leading-6 text-neutral-600">{{ labels.noBookings }}</p>
          <ul v-else class="mt-3 grid gap-3" role="list">
            <li v-for="booking in activity.bookings" :key="booking.public_id" class="bg-stone-50 p-4">
              <p class="font-semibold">{{ booking.master_name }}</p>
              <p class="mt-3 text-sm text-neutral-500">{{ labels.date }}</p>
              <p class="mt-1 text-sm font-semibold">{{ formatDateTime(booking.start_at) }}</p>
              <p class="mt-3 text-sm text-neutral-500">{{ labels.services }}</p>
              <p class="mt-1 text-sm leading-6">{{ booking.service_names.join(', ') }}</p>
              <BaseButton type="button" variant="outline-dark" size="sm" class="mt-4" @click="requestCancellation({ kind: 'booking', item: booking })">{{ labels.cancel }}</BaseButton>
              <div v-if="isCancellationTarget('booking', booking.public_id)" data-customer-activity-confirmation class="mt-4 bg-rose-50 p-4" role="group" aria-live="polite" tabindex="-1">
                <h3 class="font-semibold">{{ labels.confirmTitle }}</h3><p class="mt-2 text-sm text-neutral-700">{{ labels.confirmDescription }}</p>
                <div class="mt-4 flex flex-wrap gap-3"><BaseButton type="button" size="sm" :disabled="cancelling" @click="cancelTarget">{{ cancelling ? labels.cancelling : labels.confirm }}</BaseButton><BaseButton type="button" variant="outline-dark" size="sm" :disabled="cancelling" @click="cancellationTarget = null">{{ labels.back }}</BaseButton></div>
              </div>
            </li>
          </ul>
        </section>
        <section v-if="activity.waitlist.length" class="mt-10" :aria-label="labels.waitlist">
          <h2 class="text-lg font-semibold">{{ labels.waitlist }}</h2>
          <ul class="mt-3 grid gap-3" role="list">
            <li v-for="request in activity.waitlist" :key="request.public_id" class="bg-stone-50 p-4">
              <p class="text-sm font-semibold">{{ request.status === 'offered' ? labels.offered : labels.active }}</p><p v-if="request.master_name" class="mt-2 text-sm">{{ request.master_name }}</p><p class="mt-3 text-sm text-neutral-500">{{ labels.desiredDate }}</p><p class="mt-1 text-sm font-semibold">{{ formatDate(request.desired_date) }}</p><p v-if="request.preferred_time_from || request.preferred_time_to" class="mt-1 text-sm">{{ [request.preferred_time_from, request.preferred_time_to].filter(Boolean).join('–') }}</p><p v-if="request.status === 'offered' && request.offered_start_at" class="mt-3 text-sm font-semibold">{{ formatDateTime(request.offered_start_at) }}</p><p class="mt-3 text-sm text-neutral-500">{{ labels.services }}</p><p class="mt-1 text-sm leading-6">{{ request.service_names.join(', ') }}</p><p v-if="request.status === 'offered' && request.offer_expires_at" class="mt-3 text-sm text-amber-800">{{ labels.expires }}: {{ formatDateTime(request.offer_expires_at) }}</p>
              <BaseButton type="button" variant="outline-dark" size="sm" class="mt-4" @click="requestCancellation({ kind: 'waitlist', item: request })">{{ labels.cancel }}</BaseButton>
              <div v-if="isCancellationTarget('waitlist', request.public_id)" data-customer-activity-confirmation class="mt-4 bg-rose-50 p-4" role="group" aria-live="polite" tabindex="-1">
                <h3 class="font-semibold">{{ labels.confirmWaitlistTitle }}</h3><p class="mt-2 text-sm text-neutral-700">{{ labels.confirmDescription }}</p>
                <div class="mt-4 flex flex-wrap gap-3"><BaseButton type="button" size="sm" :disabled="cancelling" @click="cancelTarget">{{ cancelling ? labels.cancelling : labels.confirm }}</BaseButton><BaseButton type="button" variant="outline-dark" size="sm" :disabled="cancelling" @click="cancellationTarget = null">{{ labels.back }}</BaseButton></div>
              </div>
            </li>
          </ul>
        </section>
        <div v-if="usesBrowserSession" class="mt-10">
          <p v-if="forgetDeviceError" class="mb-3 text-sm leading-6 text-rose-700" role="alert">{{ forgetDeviceError }}</p>
          <BaseButton type="button" variant="outline-dark" size="sm" :disabled="forgettingDevice" @click="forgetDevice">
            {{ forgettingDevice ? deviceAccessCopy.forgetting : deviceAccessCopy.forget }}
          </BaseButton>
        </div>
      </template>
    </div>
  </BaseModal>
</template>

<style scoped>
.customer-activity-modal :deep(.sc-button) {
  border: 0;
}
</style>
