<script setup lang="ts">
import type { AvailableSlotDto, MasterDto, ServiceCatalogItemDto, ServiceDto } from '@shared-types'
import bookingSectionPhotos from '~/assets/images/main/sc-open-img.webp'

const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const localizedService = useLocalizedService()
const { trackEvent } = useAnalytics()

type SelectableService = ServiceDto | ServiceCatalogItemDto

const [{ data: serviceCatalog, pending: servicesPending }, { data: masters, pending: mastersPending }] = await Promise.all([
  useAsyncData('home-booking-service-catalog', domain.getServiceCatalog),
  useAsyncData('home-booking-masters', domain.getMasters),
])

const maxSelectedServices = 3
const selectedCatalogIds = ref<string[]>([])
const selectedServiceIds = ref<number[]>([])
const selectedMasterId = ref<number | null>(null)
const selectedDate = ref('')
const selectedSlotStart = ref('')
const activeStepIndex = ref(0)
const submitAttempted = ref(false)
const actionAttemptedStepIndex = ref<number | null>(null)
const isResettingAfterSubmit = ref(false)
const bookingStarted = ref(false)
const bookingForm = ref<HTMLFormElement | null>(null)
const bookingStepIds = ['booking-service', 'booking-master', 'booking-time', 'booking-contact']

const form = reactive({
  customer_name: '',
  customer_phone: '',
  customer_comment: '',
})

const state = reactive({
  loading: false,
  success: '',
  error: '',
  successMasterName: '',
  successStartAt: '',
})

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isMondayDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return false

  return new Date(year, month - 1, day).getDay() === 1
}

const today = formatDateInput(new Date())
const maxBookableDate = formatDateInput(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))

if (!selectedDate.value) {
  selectedDate.value = today
}

const activeServiceCatalog = computed(() => activeBaseCatalogItems(serviceCatalog.value))

const selectedMasterServices = computed(() => {
  if (!selectedMasterId.value) return []
  const master = (masters.value || []).find(master => master.id === selectedMasterId.value)
  return activeMasterServices(master?.services)
})

const activeServices = computed<SelectableService[]>(() =>
  selectedMasterId.value
    ? selectedMasterServices.value
    : activeServiceCatalog.value,
)

const serviceName = (service?: SelectableService | null) => localizedService.serviceName(service)
const serviceDescription = (service?: SelectableService | null) => localizedService.serviceDescription(service)
const servicePrice = (service?: SelectableService | null) => localizedService.servicePrice(service?.price)
const serviceDuration = (service?: SelectableService | null) =>
  localizedService.serviceDuration(service?.duration_minutes)

const serviceKey = (service: SelectableService) =>
  'catalog_id' in service ? service.catalog_id : String(service.id)

const selectedCatalogItems = computed(() =>
  activeServiceCatalog.value.filter(service => selectedCatalogIds.value.includes(service.catalog_id)),
)

const selectedMasterServiceItems = computed(() =>
  selectedMasterServices.value.filter(service => selectedServiceIds.value.includes(service.id)),
)

const selectedServices = computed<SelectableService[]>(() =>
  selectedMasterServiceItems.value.length ? selectedMasterServiceItems.value : selectedCatalogItems.value,
)

const selectedServiceCount = computed(() =>
  selectedMasterServiceItems.value.length || selectedCatalogIds.value.length,
)

const selectedDurationMinutes = computed(() =>
  selectedServices.value.reduce((total, service) => total + Number(service.duration_minutes || 0), 0),
)

const serviceSelected = (service: SelectableService) =>
  'catalog_id' in service
    ? selectedCatalogIds.value.includes(service.catalog_id)
    : selectedServiceIds.value.includes(service.id)

const serviceSelectionLimitReached = computed(() => selectedServiceCount.value >= maxSelectedServices)
const { masterName } = useMasterDisplay()

const masterPosition = (master?: MasterDto | null) => {
  if (!master) return terms.value.home.team.defaultRole

  return locale.value === 'en'
    ? master.position_en || master.title_en || master.title || master.position_uk || terms.value.home.team.defaultRole
    : master.position_uk || master.title_uk || master.title || master.position_en || terms.value.home.team.defaultRole
}

const masterPhoto = (master?: MasterDto | null) =>
  assetUrl(master?.photo || master?.photo_url) || 'https://placehold.co/640x480'

const availableMasters = computed(() => {
  const list = (masters.value || []).filter(master => master.is_active ?? master.status !== 'inactive')
  if (!selectedCatalogItems.value.length) return list

  return list.filter((master) => {
    if (!Array.isArray(master.services)) return false
    return selectedCatalogItems.value.every(catalogItem =>
      catalogItem.barber_services.some(service => service.barber_id === master.id),
    )
  })
})

const selectedMaster = computed(() =>
  availableMasters.value.find(master => master.id === selectedMasterId.value) || null,
)

watch(selectedCatalogIds, () => {
  if (
    selectedMasterId.value
    && !availableMasters.value.some(master => master.id === selectedMasterId.value)
  ) {
    selectedMasterId.value = null
  }
})

const resolveSelectedServiceForMaster = () => {
  if (!selectedMasterId.value) return

  if (selectedCatalogIds.value.length) {
    selectedServiceIds.value = selectedCatalogItems.value
      .map(service => service.barber_services.find(item => item.barber_id === selectedMasterId.value)?.id)
      .filter((id): id is number => Boolean(id))
    return
  }

  selectedServiceIds.value = selectedServiceIds.value.filter(serviceId =>
    selectedMasterServices.value.some(service => service.id === serviceId),
  )
}

const selectCatalogService = (catalogId: string) => {
  if (!activeServiceCatalog.value.some(service => service.catalog_id === catalogId)) return

  if (selectedCatalogIds.value.includes(catalogId)) {
    selectedCatalogIds.value = selectedCatalogIds.value.filter(id => id !== catalogId)
  }
  else if (!serviceSelectionLimitReached.value) {
    selectedCatalogIds.value = [...selectedCatalogIds.value, catalogId]
  }
  selectedServiceIds.value = []

  if (
    selectedMasterId.value
    && !availableMasters.value.some(master => master.id === selectedMasterId.value)
  ) {
    selectedMasterId.value = null
  }

  resolveSelectedServiceForMaster()
}

const selectService = (service: SelectableService) => {
  const wasSelected = serviceSelected(service)

  if ('catalog_id' in service) {
    selectCatalogService(service.catalog_id)
  }
  else {
    selectedCatalogIds.value = []
    if (selectedServiceIds.value.includes(service.id)) {
      selectedServiceIds.value = selectedServiceIds.value.filter(id => id !== service.id)
    }
    else if (!serviceSelectionLimitReached.value) {
      selectedServiceIds.value = [...selectedServiceIds.value, service.id]
    }
  }

  if (!wasSelected && serviceSelected(service)) {
    if (!bookingStarted.value) {
      bookingStarted.value = true
      trackEvent('booking_start', {
        source: 'home_booking',
      })
    }

    trackEvent('select_service', {
      source: 'home_booking',
      service_id: serviceKey(service),
      service_name: serviceName(service),
      service_count: selectedServiceCount.value,
      value: Number(service.price || 0),
      currency: 'UAH',
    })
  }
}

const selectMaster = (masterId: number) => {
  selectedMasterId.value = masterId
  resolveSelectedServiceForMaster()
  trackEvent('select_master', {
    source: 'home_booking',
    master_id: masterId,
    master_name: masterName(selectedMaster.value),
    service_count: selectedServiceCount.value,
  })
  goToStep(selectedServiceIds.value.length || selectedCatalogIds.value.length ? 2 : 0)
}

const selectSlot = (slotStart: string) => {
  selectedSlotStart.value = slotStart
  trackEvent('select_time', {
    source: 'home_booking',
    master_id: selectedMasterId.value,
    appointment_date: selectedDate.value,
    appointment_hour: formatTime(slotStart),
    service_count: selectedServiceCount.value,
    duration_minutes: selectedDurationMinutes.value,
  })
  goToStep(3)
}

const handleExternalServiceSelect = (event: Event) => {
  const catalogId = (event as CustomEvent<{ catalogId?: string }>).detail?.catalogId
  if (!catalogId) return

  selectCatalogService(catalogId)
}

onMounted(() => {
  window.addEventListener('barbershop:select-service', handleExternalServiceSelect)
})

onBeforeUnmount(() => {
  window.removeEventListener('barbershop:select-service', handleExternalServiceSelect)
})

watch(selectedMasterId, resolveSelectedServiceForMaster)

watch([selectedServiceIds, selectedCatalogIds, selectedMasterId, selectedDate], () => {
  selectedSlotStart.value = ''
  if (!isResettingAfterSubmit.value) {
    state.success = ''
    state.error = ''
  }
})

const isSelectedDateClosed = computed(() => isMondayDateInput(selectedDate.value))
const canLoadSlots = computed(() => Boolean(selectedMasterId.value && selectedServiceIds.value.length && selectedDate.value))

const slotsKey = computed(() =>
  canLoadSlots.value && !isSelectedDateClosed.value
    ? `home-booking-slots-${selectedMasterId.value}-${selectedServiceIds.value.join('-')}-${selectedDate.value}`
    : 'home-booking-slots-empty',
)

const {
  data: slots,
  pending: slotsPending,
  error: slotsError,
  refresh: refreshSlots,
} = await useAsyncData(
  slotsKey,
  () => {
    const masterId = selectedMasterId.value
    const serviceIds = selectedServiceIds.value
    const date = selectedDate.value

    if (!masterId || !serviceIds.length || !date || isSelectedDateClosed.value) {
      return Promise.resolve([])
    }

    return domain.getAvailableSlots(masterId, serviceIds, date, selectedDurationMinutes.value)
  },
  {
    watch: [selectedServiceIds, selectedMasterId, selectedDate],
    default: () => [],
  },
)

const visibleSlots = computed<AvailableSlotDto[]>(() =>
  isSelectedDateClosed.value ? [] : slots.value || [],
)

const emptySlotsMessage = computed(() =>
  selectedDate.value === today
    ? terms.value.home.booking.noSlotsToday
    : terms.value.home.booking.noSlotsDate,
)

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value))

const formatBookingDateTime = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value))

const selectedSlot = computed(() =>
  visibleSlots.value.find(slot => slot.start_at === selectedSlotStart.value) || null,
)

const isServiceComplete = computed(() => selectedServiceCount.value > 0)
const isMasterComplete = computed(() => Boolean(selectedMaster.value))
const isTimeComplete = computed(() => Boolean(selectedDate.value && !isSelectedDateClosed.value && selectedSlot.value))
const isContactComplete = computed(() =>
  Boolean(form.customer_name.trim() && isValidPhoneNumber(form.customer_phone)),
)
const stepCompletion = computed(() => [
  isServiceComplete.value,
  isMasterComplete.value,
  isTimeComplete.value,
  isContactComplete.value,
])

const firstIncompleteStepIndex = computed(() => {
  const index = stepCompletion.value.findIndex(complete => !complete)
  return index === -1 ? 0 : index
})

const lastStepIndex = computed(() => terms.value.home.booking.steps.length - 1)
const canSubmit = computed(() => stepCompletion.value.every(Boolean))
const bookingDetailsComplete = computed(() =>
  stepCompletion.value.slice(0, lastStepIndex.value).every(Boolean),
)
const bookingTargetStepIndex = computed(() =>
  canSubmit.value ? lastStepIndex.value : firstIncompleteStepIndex.value,
)
const showChooseMasterAction = computed(() =>
  activeStepIndex.value !== 1 && bookingTargetStepIndex.value === 1 && isServiceComplete.value,
)
const showChooseTimeAction = computed(() =>
  activeStepIndex.value !== 2 && bookingTargetStepIndex.value === 2 && isServiceComplete.value && isMasterComplete.value,
)
const showContactAction = computed(() =>
  activeStepIndex.value !== lastStepIndex.value
  && bookingTargetStepIndex.value === lastStepIndex.value
  && bookingDetailsComplete.value
  && !canSubmit.value,
)
const showGuidedBookingAction = computed(() =>
  showChooseMasterAction.value || showChooseTimeAction.value || showContactAction.value,
)
const showBookAction = computed(() => canSubmit.value && !state.loading)
const showProminentBookingAction = computed(() =>
  showGuidedBookingAction.value || showBookAction.value,
)
const bookingActionKind = computed(() => {
  if (state.loading) return 'loading'
  if (canSubmit.value || activeStepIndex.value === lastStepIndex.value) return 'book'
  if (showContactAction.value) return 'contact'
  if (showChooseMasterAction.value) return 'master'
  if (showChooseTimeAction.value) return 'time'
  return 'next'
})
const bookingActionMobileLabel = computed(() => {
  if (bookingActionKind.value === 'loading') return terms.value.pages.contacts.sending
  if (bookingActionKind.value === 'book') return terms.value.home.booking.book
  if (bookingActionKind.value === 'master') return 'Обрати майстра'
  if (bookingActionKind.value === 'time') return 'Обрати час'
  if (bookingActionKind.value === 'contact') return 'До контактів'
  return 'Далі'
})
const bookingActionDesktopLabel = computed(() => {
  if (bookingActionKind.value === 'next') return terms.value.home.booking.next
  return bookingActionMobileLabel.value
})
const activeStepComplete = computed(() => Boolean(stepCompletion.value[activeStepIndex.value]))

const shouldShowStepIssue = (index: number) =>
  !stepCompletion.value[index] && (submitAttempted.value || activeStepIndex.value > index || actionAttemptedStepIndex.value === index)

const bookingStepState = computed(() =>
  terms.value.home.booking.steps.map((label, index) => ({
    label,
    complete: stepCompletion.value[index],
    invalid: shouldShowStepIssue(index),
    active: activeStepIndex.value === index,
  })),
)

const goToStep = (index: number) => {
  if (index < 0 || index > lastStepIndex.value) return

  activeStepIndex.value = index
}

const handlePhoneInput = (event: Event) => {
  form.customer_phone = formatPhoneInput((event.target as HTMLInputElement).value)
}

const handleTextInput = (
  field: 'customer_name' | 'customer_comment',
  maxLength: number,
  options: { multiline?: boolean } = {},
) => {
  form[field] = constrainFormInput(form[field], maxLength, options)
}

const resetBookingFlow = async () => {
  isResettingAfterSubmit.value = true
  selectedCatalogIds.value = []
  selectedServiceIds.value = []
  selectedMasterId.value = null
  selectedDate.value = today
  selectedSlotStart.value = ''
  form.customer_name = ''
  form.customer_phone = ''
  form.customer_comment = ''
  activeStepIndex.value = 0
  submitAttempted.value = false
  actionAttemptedStepIndex.value = null
  bookingStarted.value = false
  await nextTick()
  isResettingAfterSubmit.value = false
}

const errorMessage = (error: unknown) => {
  const status = (error as { response?: { status?: number }, status?: number })?.response?.status
    || (error as { status?: number })?.status

  if (status === 409) return 'Цей час вже зайнятий. Оновіть доступні слоти та оберіть інший час.'
  if (status === 400) return 'Перевірте дані запису: час має бути майбутнім і в межах робочих годин.'
  return terms.value.pages.contacts.error
}

const submit = async () => {
  submitAttempted.value = true

  if (!canSubmit.value || !selectedMasterId.value || !selectedServiceIds.value.length || !selectedSlotStart.value) {
    goToStep(firstIncompleteStepIndex.value)
    return
  }

  state.loading = true
  state.success = ''
  state.error = ''
  trackEvent('booking_submit', {
    source: 'home_booking',
    master_id: selectedMasterId.value,
    appointment_date: selectedDate.value,
    appointment_hour: formatTime(selectedSlotStart.value),
    service_count: selectedServiceIds.value.length,
    duration_minutes: selectedDurationMinutes.value,
  })

  try {
    const bookedMasterName = masterName(selectedMaster.value)
    const bookedStartAt = selectedSlotStart.value
    const bookingEventParams = {
      source: 'home_booking',
      master_id: selectedMasterId.value,
      appointment_date: bookedStartAt.slice(0, 10),
      appointment_hour: formatTime(bookedStartAt),
      service_count: selectedServiceIds.value.length,
      duration_minutes: selectedDurationMinutes.value,
    }

    await domain.createBooking({
      master_id: selectedMasterId.value,
      service_id: selectedServiceIds.value[0],
      service_ids: selectedServiceIds.value,
      duration_minutes: selectedDurationMinutes.value,
      customer_name: sanitizeFormText(form.customer_name, FORM_FIELD_LIMITS.fullName),
      customer_phone: formatPhoneForSubmit(form.customer_phone),
      customer_comment: sanitizeFormText(form.customer_comment, FORM_FIELD_LIMITS.comment, { multiline: true }) || null,
      start_at: selectedSlotStart.value,
    })

    await resetBookingFlow()
    await refreshSlots()
    state.successMasterName = bookedMasterName
    state.successStartAt = bookedStartAt
    state.success = terms.value.home.booking.successLabel
    trackEvent('booking_success', bookingEventParams)
  }
  catch (error) {
    state.error = errorMessage(error)
    trackEvent('booking_error', {
      source: 'home_booking',
      master_id: selectedMasterId.value,
      appointment_date: selectedDate.value,
      error_message: state.error,
    })
    console.error(error)
  }
  finally {
    state.loading = false
  }
}

const handleBookingAction = async () => {
  if (canSubmit.value) {
    await submit()
    return
  }

  if (activeStepIndex.value < lastStepIndex.value) {
    if (!activeStepComplete.value) {
      actionAttemptedStepIndex.value = activeStepIndex.value
      return
    }
    actionAttemptedStepIndex.value = null
    goToStep(bookingTargetStepIndex.value)
    return
  }

  await submit()
}

const closeSuccess = () => {
  state.success = ''
  state.successMasterName = ''
  state.successStartAt = ''
}
</script>

<template>
  <section id="booking" data-header-theme="dark" class="bg-neutral-950 py-12 text-white sm:py-14 md:py-24 lg:flex lg:min-h-screen lg:items-center lg:py-20 xl:py-24">
    <div class="site-container">
      <div class="grid gap-8 lg:grid-cols-[0.36fr_0.64fr] lg:gap-12">
        <div class="lg:sticky lg:top-28 lg:self-start" data-reveal="soft">
          <div class="grid gap-6 min-[560px]:grid-cols-[minmax(0,1fr)_minmax(10rem,18rem)] min-[560px]:items-start lg:block">
            <div>
              <SectionLabel>{{ terms.home.booking.label }}</SectionLabel>
              <h2 class="section-title-inverse mt-4">
                {{ terms.home.booking.title }}
              </h2>
              <p class="mt-4 text-base leading-7 text-white/65 md:mt-6 md:leading-8">
                {{ terms.home.booking.description }}
              </p>
            </div>

            <img
              :src="bookingSectionPhotos"
              alt="photo booking"
              class="hidden w-full object-contain min-[560px]:mx-0 min-[560px]:block min-[560px]:max-w-[18rem] min-[560px]:justify-self-end lg:mt-8 lg:max-w-md"
            >
          </div>
        </div>

        <form id="booking-stepper" ref="bookingForm" class="relative scroll-mt-24 overflow-hidden border border-white/15 bg-white/[0.03] lg:scroll-mt-28" data-reveal="soft" data-reveal-delay="140" @submit.prevent="submit">
          <div class="grid grid-cols-2 border-b border-white/15 sm:grid-cols-4">
            <button
              v-for="(step, index) in bookingStepState"
              :key="step.label"
              type="button"
              class="group border-b border-r p-3 text-left transition last:border-r-0 sm:border-b-0 sm:p-4"
              :class="[
                step.complete
                  ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-50'
                  : step.invalid
                    ? 'border-rose-300/45 bg-rose-500/10 text-rose-50'
                    : 'border-white/15 text-white/75 hover:bg-white/[0.05] hover:text-white',
                step.active ? 'ring-1 ring-inset ring-white/60' : '',
              ]"
              :aria-current="step.active ? 'step' : undefined"
              :aria-invalid="step.invalid ? 'true' : undefined"
              @click="goToStep(index)"
            >
              <span class="flex items-center justify-between gap-3">
                <span class="text-xs" :class="step.complete ? 'text-emerald-200' : step.invalid ? 'text-rose-200' : 'text-white/45'">{{ index + 1 }}</span>
                <span
                  class="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[0.65rem] font-semibold"
                  :class="step.complete ? 'border-emerald-200 bg-emerald-300 text-neutral-950' : step.invalid ? 'border-rose-200 text-rose-100' : 'border-white/25 text-white/45 group-hover:border-white/50 group-hover:text-white'"
                  aria-hidden="true"
                >
                  {{ step.complete ? '✓' : step.invalid ? '!' : '' }}
                </span>
              </span>
              <span class="mt-1 block text-xs font-semibold uppercase tracking-[0.14em] sm:text-sm sm:tracking-[0.16em]">{{ step.label }}</span>
            </button>
          </div>

          <div :id="bookingStepIds[activeStepIndex]" class="booking-step-panel scroll-mt-28 p-4 md:p-8">
            <div>
              <div class="booking-step-content">
                <AppTransition>
                  <section v-if="activeStepIndex === 0" key="booking-service">
                    <h3 class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                      {{ terms.home.booking.steps[0] }}
                    </h3>
                    <div class="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3 xl:grid-cols-2">
                      <button
                        v-for="service in activeServices"
                        :key="serviceKey(service)"
                        type="button"
                        class="booking-service__item relative isolate flex min-h-28 w-full flex-col justify-between overflow-visible bg-white/[0.045] p-3 text-left transition hover:bg-white/[0.075] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700/60 sm:min-h-40 sm:p-4"
                        :class="[
                          service.is_army_client ? 'is-army-service dark-bg-army' : '',
                          serviceSelected(service) ? 'bg-white/[0.09] text-white' : 'text-white/72',
                          serviceSelectionLimitReached && !serviceSelected(service) ? 'cursor-not-allowed opacity-45' : '',
                        ]"
                        :disabled="serviceSelectionLimitReached && !serviceSelected(service)"
                        :aria-pressed="serviceSelected(service)"
                        @click="selectService(service)"
                      >
                        <Transition name="booking-service-scribble" :duration="{ enter: 560, leave: 410 }">
                          <svg
                            v-if="serviceSelected(service)"
                            class="booking-service__selected-scribble"
                            viewBox="0 0 420 170"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            <path
                              class="booking-service__selected-scribble-path"
                              d="M20 88 C14 24 94 10 205 13 C330 16 404 35 410 83 C416 133 316 157 198 153 C79 149 12 128 20 88 Z"
                            />
                            <path
                              class="booking-service__selected-scribble-path booking-service__selected-scribble-path--second"
                              d="M25 93 C8 39 89 18 196 17 C318 15 397 30 407 78 C420 132 321 162 202 157 C80 152 15 132 25 93 Z"
                            />
                          </svg>
                        </Transition>
                        <span class="relative z-10">
                          <span class="flex items-center gap-[10px] text-base font-semibold leading-snug sm:text-lg">
                            <img
                              v-if="service.is_army_client"
                              src="~/assets/images/services/army-logo.webp"
                              alt=""
                              class="h-7 w-7 shrink-0 object-contain"
                              aria-hidden="true"
                            >
                            <span class="min-w-0">{{ serviceName(service) }}</span>
                          </span>
                          <span class="sr-only">{{ serviceSelected(service) ? terms.home.booking.selected : terms.home.booking.continue }}</span>
                          <span
                            class="mt-1 block line-clamp-2 text-xs leading-5 sm:mt-1.5 sm:text-sm sm:leading-6 md:mt-2"
                            :class="serviceSelected(service) ? 'text-white/70' : 'text-white/55'"
                          >
                            {{ serviceDescription(service) }}
                          </span>
                        </span>
                        <span
                          class="relative z-10 mt-3 flex items-center justify-between gap-3 text-xs sm:mt-5 sm:gap-4 sm:text-sm"
                          :class="serviceSelected(service) ? 'text-white/80' : 'text-white/75'"
                        >
                          <span class="block font-semibold text-white">{{ servicePrice(service) }}</span>
                          <span class="block">{{ serviceDuration(service) }}</span>
                        </span>
                      </button>
                      <p v-if="servicesPending" class="text-sm text-white/55 sm:col-span-2 xl:col-span-3">{{ terms.home.services.loading }}</p>
                      <p v-else-if="!activeServices.length" class="text-sm text-white/55 sm:col-span-2 xl:col-span-3">{{ terms.home.services.empty }}</p>
                    </div>
                  </section>

                  <section v-else-if="activeStepIndex === 1" key="booking-master">
                  <h3 class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                    {{ terms.home.booking.steps[1] }}
                  </h3>
                  <div class="mt-4 grid gap-3 2xl:grid-cols-2">
                    <button
                      v-for="master in availableMasters"
                      :key="master.id"
                      type="button"
                      class="grid grid-cols-[3.5rem_1fr] gap-4 border p-3 text-left transition"
                      :class="selectedMasterId === master.id ? 'border-white bg-white text-neutral-950' : 'border-white/15 text-white/75 hover:border-white/50'"
                      @click="selectMaster(master.id)"
                    >
                      <img :src="masterPhoto(master)" :alt="masterName(master)" class="h-14 w-14 object-cover object-top">
                      <span class="self-center">
                        <span class="block text-sm font-semibold">{{ masterName(master) }}</span>
                        <span class="mt-1 block text-xs leading-5 opacity-70">{{ masterPosition(master) }}</span>
                      </span>
                    </button>
                    <p v-if="mastersPending" class="text-sm text-white/55">Завантажуємо майстрів...</p>
                    <p v-else-if="!availableMasters.length" class="text-sm text-white/55">Для цієї послуги немає доступних майстрів.</p>
                  </div>
                </section>

                <section v-else-if="activeStepIndex === 2" key="booking-time" class="booking-time-step grid gap-4 md:grid-cols-[12rem_1fr] md:gap-5">
                  <div class="booking-date-control">
                    <label for="booking-date" class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                      {{ terms.home.booking.steps[2] }}
                    </label>
                    <input
                      id="booking-date"
                      v-model="selectedDate"
                      type="date"
                      required
                      :min="today"
                      :max="maxBookableDate"
                      class="mt-4 w-full border border-white/15 bg-transparent px-4 py-3 text-white outline-none [color-scheme:dark]"
                    >
                  </div>

                  <div class="booking-slots-column">
                    <p class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">Слот</p>
                    <div v-if="visibleSlots.length" class="booking-slots-grid mt-4 grid grid-cols-3 gap-2">
                      <button
                        v-for="slot in visibleSlots"
                        :key="slot.start_at"
                        type="button"
                        class="border px-3 py-2 text-sm font-semibold transition"
                        :class="selectedSlotStart === slot.start_at ? 'border-white bg-white text-neutral-950' : 'border-white/15 text-white/75 hover:border-white/50'"
                        @click="selectSlot(slot.start_at)"
                      >
                        {{ formatTime(slot.start_at) }}
                      </button>
                    </div>
                    <p v-if="!canLoadSlots" class="mt-4 text-sm text-white/55">
                      {{ terms.home.booking.selectServiceAndMaster }}
                    </p>
                    <p v-else-if="isSelectedDateClosed" class="mt-4 text-sm text-white/65">
                      {{ terms.home.booking.closedOnMonday }}
                    </p>
                    <p v-else-if="slotsPending" class="mt-4 text-sm text-white/55">Шукаємо вільні слоти...</p>
                    <p v-else-if="slotsError" class="mt-4 text-sm text-rose-200">Не вдалося завантажити слоти.</p>
                    <p v-else-if="!visibleSlots.length" class="mt-4 text-sm text-white/55">
                      {{ emptySlotsMessage }}
                    </p>
                  </div>
                </section>

                <section v-else key="booking-contact">
                  <h3 class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                    {{ terms.home.booking.steps[3] }}
                  </h3>
                  <div class="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      v-model="form.customer_name"
                      required
                      autocomplete="name"
                      placeholder="Ім'я"
                      minlength="2"
                      :maxlength="FORM_FIELD_LIMITS.fullName"
                      class="border bg-transparent px-4 py-3 text-white outline-none placeholder:text-white/35"
                      :class="shouldShowStepIssue(3) && !form.customer_name.trim() ? 'border-rose-300/70' : 'border-white/15'"
                      @input="handleTextInput('customer_name', FORM_FIELD_LIMITS.fullName)"
                    >
                    <input
                      v-model="form.customer_phone"
                      required
                      type="tel"
                      inputmode="tel"
                      autocomplete="tel"
                      placeholder="Телефон"
                      maxlength="17"
                      pattern="\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}"
                      class="border bg-transparent px-4 py-3 text-white outline-none placeholder:text-white/35"
                      :class="shouldShowStepIssue(3) && !isValidPhoneNumber(form.customer_phone) ? 'border-rose-300/70' : 'border-white/15'"
                      @input="handlePhoneInput"
                    >
                  </div>
                  <textarea
                    v-model="form.customer_comment"
                    rows="3"
                    placeholder="Коментар"
                    :maxlength="FORM_FIELD_LIMITS.comment"
                    class="mt-3 w-full border border-white/15 bg-transparent px-4 py-3 text-white outline-none placeholder:text-white/35"
                    @input="handleTextInput('customer_comment', FORM_FIELD_LIMITS.comment, { multiline: true })"
                  />
                  </section>
                </AppTransition>
              </div>

              <div class="booking-step-actions mt-8 flex flex-row gap-3 sm:items-center">
                <button
                  v-if="activeStepIndex > 0"
                  type="button"
                  class="inline-flex flex-1 items-center justify-center gap-2 border border-white/15 px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-white/45 hover:text-white sm:flex-none sm:px-5"
                  @click="goToStep(activeStepIndex - 1)"
                >
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  {{ terms.home.booking.back }}
                </button>

                <button
                  type="button"
                  :disabled="state.loading || (activeStepIndex === lastStepIndex && !canSubmit)"
                  class="inline-flex h-11 flex-[1.35] items-center justify-center gap-2 bg-white px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45 sm:h-12 sm:flex-none sm:px-6 sm:text-sm sm:tracking-[0.16em]"
                  :class="showProminentBookingAction ? 'booking-guided-action' : ''"
                  @click="handleBookingAction"
                >
                  <Transition name="booking-action-content" mode="out-in">
                    <span :key="bookingActionKind" class="inline-flex items-center justify-center gap-2">
                      <svg v-if="bookingActionKind === 'master'" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M10 10.4a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Z" stroke="currentColor" stroke-width="1.6" />
                        <path d="M4.5 16.5c.8-2.6 2.8-4.1 5.5-4.1s4.7 1.5 5.5 4.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                      </svg>
                      <svg v-else-if="bookingActionKind === 'time'" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M10 5.2V10l3.1 1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" stroke-width="1.6" />
                      </svg>
                      <svg v-else-if="bookingActionKind === 'contact'" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M5.2 4.2h9.6v11.6H5.2V4.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                        <path d="M7.8 7.2h4.4M7.8 10h4.4M7.8 12.8h2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                      </svg>
                      <svg v-else-if="bookingActionKind === 'book'" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M5 4.5h10a1.5 1.5 0 0 1 1.5 1.5v8.7a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5Z" stroke="currentColor" stroke-width="1.6" />
                        <path d="M6.5 3.8v2.4M13.5 3.8v2.4M3.8 8.1h12.4M7.2 12.1l1.8 1.8 3.8-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      <span class="sm:hidden">{{ bookingActionMobileLabel }}</span>
                      <span class="hidden sm:inline">{{ bookingActionDesktopLabel }}</span>
                      <svg v-if="bookingActionKind !== 'book'" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                  </Transition>
                </button>
              </div>
              <p v-if="state.error" class="mt-4 text-sm leading-6 text-rose-200">{{ state.error }}</p>
            </div>
          </div>
          <FormStatusOverlay
            :show="Boolean(state.success)"
            :label="terms.home.booking.successLabel"
            :title="terms.home.booking.successTitle"
            :action-label="terms.home.booking.successAction"
            tone="dark"
            @action="closeSuccess"
          >
            <div class="mt-6 grid gap-3 text-left sm:grid-cols-2">
              <div class="border border-white/15 bg-white/[0.04] p-4">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                  {{ terms.home.booking.steps[1] }}
                </p>
                <p class="mt-2 text-2xl font-semibold leading-tight text-white">
                  {{ state.successMasterName }}
                </p>
              </div>
              <div class="border border-white/15 bg-white/[0.04] p-4">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                  {{ terms.home.booking.steps[2] }}
                </p>
                <p class="mt-2 text-2xl font-semibold leading-tight text-white">
                  {{ formatBookingDateTime(state.successStartAt) }}
                </p>
              </div>
            </div>
          </FormStatusOverlay>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
@media (max-width: 767px) {
  #booking-service.booking-step-panel,
  #booking-time.booking-step-panel {
    display: flex;
    max-height: calc(100svh - 16rem);
    min-height: 0;
    flex-direction: column;
  }

  #booking-service.booking-step-panel > div,
  #booking-time.booking-step-panel > div {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  #booking-service .booking-step-content {
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.25rem;
  }

  #booking-time .booking-step-content {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
  }

  #booking-time .booking-step-content > * {
    min-height: 0;
  }

  #booking-time .booking-time-step {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  #booking-time .booking-date-control {
    flex-shrink: 0;
  }

  #booking-time .booking-slots-column {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  #booking-time .booking-slots-grid {
    min-height: 0;
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.25rem;
  }

  #booking-service .booking-step-actions,
  #booking-time .booking-step-actions {
    flex-shrink: 0;
    margin-top: 1rem;
    border-top: 1px solid rgb(255 255 255 / 0.12);
    padding-top: 1rem;
  }

  #booking-service .booking-service__item {
    overflow: hidden;
  }

  #booking-service .booking-service__selected-scribble {
    inset: -6px;
    width: calc(100% + 12px);
    height: calc(100% + 12px);
  }
}

.booking-guided-action {
  border: 1px solid rgb(115 115 115 / 0.7);
  animation: booking-guided-border 2.1s ease-in-out infinite;
}

.booking-action-content-enter-active,
.booking-action-content-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.booking-action-content-enter-from {
  opacity: 0;
  transform: translateY(0.35rem);
}

.booking-action-content-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

.booking-service__item.dark-bg-army {
  background-image:
    linear-gradient(rgb(10 10 10 / 0.28), rgb(10 10 10 / 0.42)),
    url('~/assets/images/services/dark-bg-army.webp');
  background-position: center;
  background-size: cover;
  border-color: rgb(255 255 255 / 0.24);
}

.booking-service__selected-scribble {
  pointer-events: none;
  position: absolute;
  inset: -8px -12px;
  z-index: 2;
  width: calc(100% + 24px);
  height: calc(100% + 16px);
  overflow: visible;
}

.booking-service__selected-scribble-path {
  --path-length: 980;
  fill: none;
  stroke: #c01818;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: 0;
  opacity: 0.95;
  filter: drop-shadow(0 0 2px rgb(192 24 24 / 0.35));
}

.booking-service__selected-scribble-path--second {
  stroke-width: 2;
  opacity: 0.75;
}

.booking-service-scribble-enter-from .booking-service__selected-scribble-path {
  stroke-dashoffset: var(--path-length);
}

.booking-service-scribble-enter-active .booking-service__selected-scribble-path {
  animation: booking-service-scribble-draw 420ms cubic-bezier(0.58, 0.02, 0.26, 1) both;
}

.booking-service-scribble-enter-active .booking-service__selected-scribble-path--second {
  animation-delay: 90ms;
}

.booking-service-scribble-leave-active .booking-service__selected-scribble-path {
  animation: booking-service-scribble-erase 320ms cubic-bezier(0.6, 0, 0.4, 1) both;
}

.booking-service-scribble-leave-active .booking-service__selected-scribble-path--second {
  animation-delay: 45ms;
}

@keyframes booking-service-scribble-draw {
  from {
    stroke-dashoffset: var(--path-length);
  }

  to {
    stroke-dashoffset: 0;
  }
}

@keyframes booking-service-scribble-erase {
  from {
    stroke-dashoffset: 0;
  }

  to {
    stroke-dashoffset: var(--path-length);
  }
}

@keyframes booking-guided-border {
  0%,
  100% {
    border-color: rgb(115 115 115 / 0.55);
    box-shadow:
      0 0 0 0 rgb(255 255 255 / 0),
      0 0.45rem 1.25rem rgb(0 0 0 / 0.12);
  }

  50% {
    border-color: rgb(64 64 64 / 0.85);
    box-shadow:
      0 0 0 0.42rem rgb(255 255 255 / 0.24),
      0 0 0 0.72rem rgb(255 255 255 / 0.1),
      0 0.65rem 1.75rem rgb(0 0 0 / 0.2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .booking-service__selected-scribble-path {
    animation: none;
    stroke-dashoffset: 0;
  }

  .booking-guided-action {
    animation: none;
    transition: none;
  }

  .booking-action-content-enter-active,
  .booking-action-content-leave-active {
    transition: none;
  }
}
</style>
