<script setup lang="ts">
import type { AvailableSlotDto, MasterDto, ServiceCatalogItemDto, ServiceDto } from '@shared-types'

type AssetModule = { default: string }

const props = withDefaults(defineProps<{
  analyticsSource?: string
  idPrefix?: string
  listenForExternalSelect?: boolean
  mode?: 'section' | 'drawer'
}>(), {
  analyticsSource: 'home_booking',
  idPrefix: 'booking',
  listenForExternalSelect: true,
  mode: 'section',
})

const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const localizedService = useLocalizedService()
const { trackEvent } = useAnalytics()

type SelectableService = ServiceDto | ServiceCatalogItemDto
type BarberServiceOption = {
  id: number
  master: MasterDto
}

const serviceCatalogKey = props.idPrefix === 'booking' ? 'home-services-catalog' : `${props.idPrefix}-service-catalog`
const mastersKey = props.idPrefix === 'booking' ? 'home-team-masters' : `${props.idPrefix}-masters`

const [{ data: serviceCatalog, pending: servicesPending }, { data: masters, pending: mastersPending }] = await Promise.all([
  useAsyncData(serviceCatalogKey, domain.getServiceCatalog, {
    server: false,
    default: () => [],
  }),
  useAsyncData(mastersKey, domain.getMasters, {
    server: false,
    default: () => [],
  }),
])

const maxSelectedServices = 3
const selectedCatalogIds = ref<string[]>([])
const selectedServiceIds = ref<number[]>([])
const selectedMasterId = ref<number | null>(null)
const selectedDate = ref('')
const selectedSlotStart = ref('')
const serviceSearchQuery = ref('')
const debouncedServiceSearchQuery = ref('')
const activeStepIndex = ref(0)
const submitAttempted = ref(false)
const actionAttemptedStepIndex = ref<number | null>(null)
const isResettingAfterSubmit = ref(false)
const bookingStarted = ref(false)
const promotionConfirmed = ref(false)
const bookingForm = ref<HTMLFormElement | null>(null)
const bookingStepKeys = ['service', 'master', 'time', 'contact']
const bookingStepIds = computed(() => bookingStepKeys.map(step => `${props.idPrefix}-${step}`))
const activeStepKey = computed(() => bookingStepKeys[activeStepIndex.value] || bookingStepKeys[0])
const bookingSectionId = computed(() => props.mode === 'section' ? 'booking' : undefined)
const bookingStepperId = computed(() => props.idPrefix === 'booking' ? 'booking-stepper' : `${props.idPrefix}-stepper`)
const isDrawerMode = computed(() => props.mode === 'drawer')
const closedWeekdays = [1]
let serviceSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const form = reactive({
  customer_name: '',
  customer_phone: '',
  customer_comment: '',
  promotion_code: '',
})

const state = reactive({
  loading: false,
  success: '',
  error: '',
  successMasterName: '',
  successStartAt: '',
})
const bookingSectionPhotos = ref('')
const bookingSectionRoot = ref<HTMLElement | null>(null)
let bookingPhotoObserver: IntersectionObserver | null = null

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
const defaultBookableDate = (() => {
  const date = new Date()

  for (let dayOffset = 0; dayOffset <= 90; dayOffset += 1) {
    const candidate = new Date(date)
    candidate.setDate(date.getDate() + dayOffset)
    const value = formatDateInput(candidate)

    if (!isMondayDateInput(value)) return value
  }

  return today
})()

if (!selectedDate.value) {
  selectedDate.value = defaultBookableDate
}

const activeServiceCatalog = computed(() => activeBaseCatalogItems(serviceCatalog.value))
const publicMasters = computed(() =>
  (masters.value || []).filter(master => master.is_active ?? master.status !== 'inactive'),
)
const mastersById = computed(() =>
  new Map(publicMasters.value.map(master => [master.id, master])),
)

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

const isCatalogService = (service?: SelectableService | null): service is ServiceCatalogItemDto =>
  Boolean(service && 'catalog_id' in service)

const serviceName = (service?: SelectableService | null) => localizedService.serviceName(service)
const serviceDescription = (service?: SelectableService | null) => localizedService.serviceDescription(service)
const serviceHasMultiplePrices = (service?: SelectableService | null) =>
  isCatalogService(service)
  && new Set(service.barber_services.map(item => String(item.price))).size > 1
const servicePromotion = (service?: SelectableService | null) => service?.active_promotion || null
const servicePromotionApplied = (service?: SelectableService | null) =>
  Boolean(servicePromotion(service) && promotionConfirmed.value)
const serviceRegularPrice = (service?: SelectableService | null) =>
  localizedService.servicePrice(service?.price, { from: serviceHasMultiplePrices(service) })
const servicePrice = (service?: SelectableService | null) => {
  const promotion = servicePromotion(service)
  if (!servicePromotionApplied(service) || !promotion) return serviceRegularPrice(service)

  return localizedService.servicePrice(promotion.promotional_price, { from: serviceHasMultiplePrices(service) })
}
const serviceDuration = (service?: SelectableService | null) =>
  localizedService.serviceDuration(service?.duration_minutes)

const serviceKey = (service: SelectableService) =>
  'catalog_id' in service ? service.catalog_id : String(service.id)

const serviceSearchLabels = computed(() => locale.value === 'en'
  ? {
      placeholder: 'Search services',
      noResults: 'No services found.',
    }
  : {
      placeholder: 'Пошук послуг',
      noResults: 'Послуги не знайдено.',
    },
)
const serviceBarbersLabel = computed(() => locale.value === 'en' ? 'Barbers and prices' : 'Барбери та ціни')
const promotionDiscountLabels = computed(() => locale.value === 'en'
  ? {
      title: 'I am a defender of Ukraine',
      description: 'Apply the active discount to eligible services. Confirmation may be requested during the visit.',
      badge: 'Gratitude discount',
      bookingNote: 'Confirmed defender discount in booking form.',
    }
  : {
      title: 'Я захисник України',
      description: 'Застосувати активну знижку до доступних послуг. Підтвердження може знадобитися під час візиту.',
      badge: 'Активувати знижку',
      bookingNote: 'Підтверджено знижку для захисників у формі запису.',
    },
)

const normalizeServiceSearch = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase(locale.value === 'en' ? 'en-US' : 'uk-UA')

const filteredActiveServices = computed(() => {
  const query = normalizeServiceSearch(debouncedServiceSearchQuery.value)
  if (query.length < 2) return activeServices.value

  return activeServices.value.filter((service) => {
    const searchable = [
      serviceName(service),
      serviceDescription(service),
      servicePrice(service),
      serviceDuration(service),
    ].join(' ')

    return normalizeServiceSearch(searchable).includes(query)
  })
})

const serviceResultsKey = computed(() =>
  filteredActiveServices.value.length
    ? filteredActiveServices.value.map(serviceKey).join('|')
    : 'empty',
)

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
const selectedPromotionCodes = computed(() =>
  Array.from(new Set(selectedServices.value.flatMap((service) => {
    const promotion = servicePromotion(service)
    return promotion?.code ? [promotion.code] : []
  }))),
)
const selectedPromotionCode = computed(() => selectedPromotionCodes.value[0] || '')
const selectedServicesHavePromotion = computed(() => Boolean(selectedPromotionCode.value))
const promotionActiveForBooking = computed(() =>
  promotionConfirmed.value && selectedServicesHavePromotion.value,
)
const effectivePromotionCode = computed(() =>
  sanitizeFormText(form.promotion_code, 50) || (promotionActiveForBooking.value ? selectedPromotionCode.value : ''),
)

const serviceSelected = (service: SelectableService) =>
  'catalog_id' in service
    ? selectedCatalogIds.value.includes(service.catalog_id)
    : selectedServiceIds.value.includes(service.id)

const serviceSelectionLimitReached = computed(() => selectedServiceCount.value >= maxSelectedServices)
const { masterName } = useMasterDisplay()

const serviceBarberOptions = (service: SelectableService): BarberServiceOption[] => {
  if (!isCatalogService(service)) return []

  return service.barber_services.flatMap((barberService) => {
    const master = mastersById.value.get(barberService.barber_id)
    if (!master) return []

    return [{
      id: barberService.id,
      master,
    }]
  })
}

const masterPosition = (master?: MasterDto | null) => {
  if (!master) return terms.value.home.team.defaultRole

  return locale.value === 'en'
    ? master.position_en || master.title_en || master.title || master.position_uk || terms.value.home.team.defaultRole
    : master.position_uk || master.title_uk || master.title || master.position_en || terms.value.home.team.defaultRole
}

const masterPhoto = (master?: MasterDto | null) =>
  assetUrl(master?.photo || master?.photo_url) || 'https://placehold.co/640x480'

const masterAvatar = (master?: MasterDto | null) =>
  assetUrl(master?.avatar || master?.avatar_url || master?.photo || master?.photo_url) || 'https://placehold.co/96x96'

const availableMasters = computed(() => {
  const list = publicMasters.value
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

watch(serviceSearchQuery, (query) => {
  if (serviceSearchDebounceTimer) {
    clearTimeout(serviceSearchDebounceTimer)
  }

  serviceSearchDebounceTimer = setTimeout(() => {
    debouncedServiceSearchQuery.value = query
    serviceSearchDebounceTimer = null
  }, 320)
})

const clearServiceSearch = () => {
  if (serviceSearchDebounceTimer) {
    clearTimeout(serviceSearchDebounceTimer)
    serviceSearchDebounceTimer = null
  }

  serviceSearchQuery.value = ''
  debouncedServiceSearchQuery.value = ''
}

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
        source: props.analyticsSource,
      })
    }

    trackEvent('select_service', {
      source: props.analyticsSource,
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
    source: props.analyticsSource,
    master_id: masterId,
    master_name: masterName(selectedMaster.value),
    service_count: selectedServiceCount.value,
  })
  goToStep(selectedServiceIds.value.length || selectedCatalogIds.value.length ? 2 : 0)
}

const selectSlot = (slotStart: string) => {
  selectedSlotStart.value = slotStart
  trackEvent('select_time', {
    source: props.analyticsSource,
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
  if (!props.listenForExternalSelect) return

  window.addEventListener('barbershop:select-service', handleExternalServiceSelect)
})

onBeforeUnmount(() => {
  if (serviceSearchDebounceTimer) {
    clearTimeout(serviceSearchDebounceTimer)
  }

  if (!props.listenForExternalSelect) return

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

watch(selectedPromotionCodes, (codes) => {
  if (!codes.length) {
    promotionConfirmed.value = false
  }
})

const isSelectedDateClosed = computed(() => isMondayDateInput(selectedDate.value))
const canLoadSlots = computed(() => Boolean(selectedMasterId.value && selectedServiceIds.value.length && selectedDate.value))

const slotsKey = computed(() =>
  canLoadSlots.value && !isSelectedDateClosed.value
    ? `${props.idPrefix}-slots-${selectedMasterId.value}-${selectedServiceIds.value.join('-')}-${selectedDate.value}`
    : `${props.idPrefix}-slots-empty`,
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

const dateLocale = computed(() => locale.value === 'en' ? 'en-US' : 'uk-UA')

const bookingTimeLabels = computed(() => locale.value === 'en'
  ? {
      chooseMaster: 'Choose barber',
      chooseTime: 'Choose time',
      contact: 'Contact details',
      date: 'Date',
      next: 'Next',
      slots: 'Time',
      slotsError: 'Unable to load times.',
      slotsPending: 'Searching available times...',
    }
  : {
      chooseMaster: 'Обрати майстра',
      chooseTime: 'Обрати час',
      contact: 'До контактів',
      date: 'Дата',
      next: 'Далі',
      slots: 'Час',
      slotsError: 'Не вдалося завантажити слоти.',
      slotsPending: 'Шукаємо вільні слоти...',
    },
)

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(dateLocale.value, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value))

const formatBookingDateTime = (value: string) =>
  new Intl.DateTimeFormat(dateLocale.value, {
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
  if (bookingActionKind.value === 'master') return bookingTimeLabels.value.chooseMaster
  if (bookingActionKind.value === 'time') return bookingTimeLabels.value.chooseTime
  if (bookingActionKind.value === 'contact') return bookingTimeLabels.value.contact
  return bookingTimeLabels.value.next
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
    key: bookingStepKeys[index],
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

const handlePhonePasteEvent = (event: ClipboardEvent) => {
  handlePhonePaste(event, value => {
    form.customer_phone = value
  })
}

const handleTextInput = (
  field: 'customer_name' | 'customer_comment' | 'promotion_code',
  maxLength: number,
  options: { multiline?: boolean } = {},
) => {
  const value = constrainFormInput(form[field], maxLength, options)
  form[field] = field === 'promotion_code' ? value.toUpperCase().replace(/\s+/g, '') : value
}

const resetBookingFlow = async () => {
  isResettingAfterSubmit.value = true
  selectedCatalogIds.value = []
  selectedServiceIds.value = []
  selectedMasterId.value = null
  selectedDate.value = defaultBookableDate
  selectedSlotStart.value = ''
  form.customer_name = ''
  form.customer_phone = ''
  form.customer_comment = ''
  form.promotion_code = ''
  promotionConfirmed.value = false
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
    source: props.analyticsSource,
    master_id: selectedMasterId.value,
    appointment_date: selectedDate.value,
    appointment_hour: formatTime(selectedSlotStart.value),
    service_count: selectedServiceIds.value.length,
    duration_minutes: selectedDurationMinutes.value,
  })

  try {
    const bookedMasterName = masterName(selectedMaster.value)
    const bookedStartAt = selectedSlotStart.value
    const customerComment = sanitizeFormText(form.customer_comment, FORM_FIELD_LIMITS.comment, { multiline: true })
    const bookingComment = [
      customerComment,
      promotionActiveForBooking.value ? promotionDiscountLabels.value.bookingNote : '',
    ].filter(Boolean).join('\n') || null
    const bookingEventParams = {
      source: props.analyticsSource,
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
      customer_comment: bookingComment,
      promotion_code: effectivePromotionCode.value || null,
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
      source: props.analyticsSource,
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

const loadBookingSectionPhoto = async () => {
  if (bookingSectionPhotos.value) return

  const image = await import('~/assets/images/main/sc-open-img.webp') as AssetModule
  bookingSectionPhotos.value = image.default
}

const observeBookingSectionPhoto = () => {
  if (isDrawerMode.value) return

  const target = bookingSectionRoot.value

  if (!target || typeof window.IntersectionObserver !== 'function') {
    window.setTimeout(loadBookingSectionPhoto, 2800)
    return
  }

  bookingPhotoObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    bookingPhotoObserver?.disconnect()
    bookingPhotoObserver = null
    loadBookingSectionPhoto()
  }, {
    rootMargin: '240px 0px',
  })

  bookingPhotoObserver.observe(target)
}

onMounted(observeBookingSectionPhoto)

onBeforeUnmount(() => {
  bookingPhotoObserver?.disconnect()
})
</script>

<template>
  <component
    ref="bookingSectionRoot"
    :is="isDrawerMode ? 'div' : 'section'"
    :id="bookingSectionId"
    :data-header-theme="isDrawerMode ? undefined : 'dark'"
    class="booking-section text-white"
    :class="isDrawerMode ? 'booking-section--drawer flex min-h-0 flex-1 flex-col' : 'bg-neutral-950 py-12 sm:py-14 md:py-24 lg:flex lg:min-h-screen lg:items-center lg:py-20 xl:py-24'"
  >
    <div :class="isDrawerMode ? 'flex min-h-0 flex-1 flex-col' : 'site-container'">
      <div :class="isDrawerMode ? 'flex min-h-0 flex-1 flex-col' : 'grid gap-8 lg:grid-cols-[0.36fr_0.64fr] lg:gap-12'">
        <div v-if="!isDrawerMode" class="lg:sticky lg:top-28 lg:self-start" data-reveal="soft">
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
              v-if="bookingSectionPhotos"
              :src="bookingSectionPhotos"
              alt="photo booking"
              class="hidden w-full object-contain min-[560px]:mx-0 min-[560px]:block min-[560px]:max-w-[18rem] min-[560px]:justify-self-end lg:mt-8 lg:max-w-md"
              width="790"
              height="992"
              loading="lazy"
            >
          </div>
        </div>

        <form
          :id="bookingStepperId"
          ref="bookingForm"
          class="booking-form relative scroll-mt-24 overflow-hidden bg-white/[0.03] lg:scroll-mt-28"
          :class="isDrawerMode ? 'booking-form--drawer flex-1' : 'booking-form--section self-start p-2'"
          :data-reveal="isDrawerMode ? undefined : 'soft'"
          :data-reveal-delay="isDrawerMode ? undefined : '140'"
          @submit.prevent="submit"
        >
          <div class="booking-stepper flex gap-1.5 p-2 sm:grid sm:grid-cols-4 sm:gap-2 sm:p-3">
            <button
              v-for="(step, index) in bookingStepState"
              :key="step.label"
              type="button"
              class="booking-step-tab group inline-flex h-9 min-w-0 items-center justify-center gap-1 overflow-hidden px-1.5 text-center text-[0.58rem] font-semibold uppercase tracking-[0.04em] transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 min-[380px]:gap-1.5 min-[380px]:px-2 min-[380px]:text-[0.64rem] sm:h-10 sm:px-3 sm:text-xs sm:tracking-[0.12em]"
              :class="[
                step.active
                  ? step.invalid
                    ? 'bg-rose-500 text-white shadow-[inset_0_-3px_0_rgb(255_255_255_/_0.28),0_0_0.9rem_rgb(244_63_94_/_0.22)]'
                    : step.complete
                      ? 'bg-emerald-300 text-neutral-950 shadow-[inset_0_-3px_0_rgb(255_255_255_/_0.42),0_0_0.9rem_rgb(110_231_183_/_0.2)]'
                      : 'bg-white text-neutral-950 shadow-sm'
                  : step.invalid
                    ? 'bg-rose-500/35 text-rose-50 shadow-[inset_0_-3px_0_rgb(244_63_94_/_0.8)] hover:bg-rose-500/45'
                    : step.complete
                      ? 'bg-emerald-400/30 text-emerald-50 shadow-[inset_0_-3px_0_rgb(52_211_153_/_0.82)] hover:bg-emerald-400/40 hover:text-white'
                      : 'bg-white/[0.035] text-white/55 hover:bg-white/[0.07] hover:text-white',
                step.active ? 'booking-step-tab--active' : 'booking-step-tab--inactive',
              ]"
              :aria-current="step.active ? 'step' : undefined"
              :aria-invalid="step.invalid ? 'true' : undefined"
              :aria-label="step.label"
              @click="goToStep(index)"
            >
              <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center transition-colors duration-300 ease-out sm:h-[1.05rem] sm:w-[1.05rem]" aria-hidden="true">
                <svg v-if="step.key === 'service'" viewBox="0 0 20 20" fill="none" class="h-full w-full">
                  <path d="M7.1 8.4 15.7 3M7.1 11.6l8.6 5.4" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" />
                  <path d="M5 8.7a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM5 15.7a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" stroke-width="1.55" />
                </svg>
                <svg v-else-if="step.key === 'master'" viewBox="0 0 20 20" fill="none" class="h-full w-full">
                  <path d="M10 10.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Z" stroke="currentColor" stroke-width="1.55" />
                  <path d="M4.5 16.5c.82-2.55 2.82-4 5.5-4s4.68 1.45 5.5 4" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" />
                </svg>
                <svg v-else-if="step.key === 'time'" viewBox="0 0 20 20" fill="none" class="h-full w-full">
                  <path d="M10 5.3V10l3 1.75" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" stroke-width="1.55" />
                </svg>
                <svg v-else viewBox="0 0 20 20" fill="none" class="h-full w-full">
                  <path d="M5.4 4.4h9.2v11.2H5.4V4.4Z" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round" />
                  <path d="M7.7 7.3h4.6M7.7 10h4.6M7.7 12.7h2.7" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" />
                </svg>
              </span>
              <span class="min-w-0 truncate transition-colors duration-300 ease-out" :class="step.active ? 'inline' : 'hidden min-[481px]:inline'">{{ step.label }}</span>
            </button>
          </div>

          <div
            :id="bookingStepIds[activeStepIndex]"
            class="booking-step-panel scroll-mt-28 px-3 pb-3"
            :class="`booking-step-panel--${activeStepKey}`"
          >
            <div>
              <div class="booking-step-content">
                <AppTransition>
                  <section v-if="activeStepIndex === 0" key="booking-service" class="booking-service-step">
                    <h3 class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                      {{ terms.home.booking.steps[0] }}
                    </h3>
                    <label class="booking-service-search-field glass-control glass-control--dark mt-3 flex items-center gap-2 px-3 py-2.5 text-white/70 focus-within:text-white sm:mt-4">
                      <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="m14.2 14.2 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                        <path d="M8.8 15.1a6.3 6.3 0 1 0 0-12.6 6.3 6.3 0 0 0 0 12.6Z" stroke="currentColor" stroke-width="1.6" />
                      </svg>
                      <input
                        v-model="serviceSearchQuery"
                        type="search"
                        :placeholder="serviceSearchLabels.placeholder"
                        class="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                        autocomplete="off"
                      >
                      <button
                        v-if="serviceSearchQuery"
                        type="button"
                        class="booking-service-search-clear"
                        :aria-label="locale === 'en' ? 'Clear service search' : 'Очистити пошук послуг'"
                        @click.prevent="clearServiceSearch"
                      >
                        <span class="booking-service-search-clear__surface" aria-hidden="true">
                          <span class="booking-service-search-clear__fill" />
                        </span>
                        <span class="booking-service-search-clear__icon" aria-hidden="true" />
                      </button>
                    </label>
                    <div class="booking-service-results-scroll">
                      <Transition name="booking-service-results" mode="out-in">
                        <div
                          :key="serviceResultsKey"
                          class="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-2"
                        >
                          <button
                            v-for="service in filteredActiveServices"
                            :key="serviceKey(service)"
                            type="button"
                            class="booking-service__item relative isolate flex min-h-24 w-full flex-col justify-between overflow-visible bg-white/[0.045] p-2 text-left transition hover:bg-white/[0.075] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700/60 sm:min-h-32 sm:p-2.5"
                            :class="[
                              servicePromotion(service) ? 'is-army-service' : '',
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
                              <span class="flex items-center gap-2 text-sm font-semibold leading-snug sm:text-base">
                                <span class="min-w-0">{{ serviceName(service) }}</span>
                              </span>
                              <span class="sr-only">{{ serviceSelected(service) ? terms.home.booking.selected : terms.home.booking.continue }}</span>
                              <span
                                class="mt-1 block line-clamp-2 text-xs leading-5 sm:leading-5"
                                :class="serviceSelected(service) ? 'text-white/70' : 'text-white/55'"
                              >
                                {{ serviceDescription(service) }}
                              </span>
                            </span>
                            <span
                              class="relative z-10 mt-2 flex items-end justify-between gap-3 text-xs sm:mt-3 sm:gap-4"
                              :class="serviceSelected(service) ? 'text-white/80' : 'text-white/75'"
                            >
                              <span
                                v-if="serviceBarberOptions(service).length"
                                class="booking-service-barbers flex min-w-0 flex-wrap gap-1"
                                :aria-label="serviceBarbersLabel"
                              >
                                <span
                                  v-for="option in serviceBarberOptions(service)"
                                  :key="option.id"
                                  class="inline-flex"
                                  :title="masterName(option.master)"
                                >
                                  <img
                                    :src="masterAvatar(option.master)"
                                    alt=""
                                    class="h-6 w-6 shrink-0 rounded-full object-cover object-top sm:h-7 sm:w-7"
                                    aria-hidden="true"
                                  >
                                  <span class="sr-only">{{ masterName(option.master) }}</span>
                                </span>
                              </span>
                              <span v-else aria-hidden="true" />
                              <span class="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold text-white">
                                <span v-if="servicePromotionApplied(service)" class="text-white/45 line-through">{{ serviceRegularPrice(service) }}</span>
                                <span>{{ servicePrice(service) }}</span>
                                <span class="text-white/45">/</span>
                                <span class="inline-flex items-center gap-1 text-white/75">
                                  <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                    <path d="M10 5.5V10l3 1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                                    <path d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" stroke-width="1.6" />
                                  </svg>
                                  <span>{{ serviceDuration(service) }}</span>
                                </span>
                              </span>
                            </span>
                            <span
                              v-if="servicePromotion(service)"
                              class="booking-service-army-strip z-10 flex items-center justify-between gap-2 overflow-hidden px-2 py-1.5 text-white"
                            >
                              <span class="flex min-w-0 items-center gap-1.5">
                                <img
                                  src="~/assets/images/services/army-logo.webp"
                                  alt=""
                                  class="h-5 w-5 shrink-0 object-contain"
                                  aria-hidden="true"
                                >
                                <span class="truncate text-[0.62rem] font-semibold uppercase tracking-[0.08em]">{{ servicePromotion(service)?.name_uk }}</span>
                              </span>
                              <span class="booking-service-army-discount shrink-0 text-xs font-bold leading-none">-{{ servicePromotion(service)?.discount_percent }}%</span>
                            </span>
                          </button>
                          <p v-if="servicesPending" class="text-sm text-white/55 sm:col-span-2 xl:col-span-3">{{ terms.home.services.loading }}</p>
                          <p v-else-if="!activeServices.length" class="text-sm text-white/55 sm:col-span-2 xl:col-span-3">{{ terms.home.services.empty }}</p>
                          <p v-else-if="!filteredActiveServices.length" class="text-sm text-white/55 sm:col-span-2 xl:col-span-3">{{ serviceSearchLabels.noResults }}</p>
                        </div>
                      </Transition>
                    </div>
                  </section>

                  <section v-else-if="activeStepIndex === 1" key="booking-master">
                  <h3 class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                    {{ terms.home.booking.steps[1] }}
                  </h3>
                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      v-for="master in availableMasters"
                      :key="master.id"
                      type="button"
                      class="grid grid-cols-[3.5rem_1fr] gap-4 border p-2.5 text-left transition sm:p-3"
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

                <section v-else-if="activeStepIndex === 2" key="booking-time" class="booking-time-step grid gap-4 md:grid-cols-[18rem_1fr] md:gap-5">
                  <div class="booking-date-control">
                    <p class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                      {{ bookingTimeLabels.date }}
                    </p>
                    <BookingDatePicker
                      v-model="selectedDate"
                      :min="today"
                      :max="maxBookableDate"
                      :locale="locale"
                      :disabled-weekdays="closedWeekdays"
                    />
                  </div>

                  <div class="booking-slots-column">
                    <p class="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">{{ bookingTimeLabels.slots }}</p>
                    <div v-if="visibleSlots.length" class="booking-slots-grid mt-4 grid grid-cols-3 gap-2">
                      <button
                        v-for="slot in visibleSlots"
                        :key="slot.start_at"
                        type="button"
                        class="border p-2.5 text-sm font-semibold transition"
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
                    <p v-else-if="slotsPending" class="mt-4 text-sm text-white/55">{{ bookingTimeLabels.slotsPending }}</p>
                    <p v-else-if="slotsError" class="mt-4 text-sm text-rose-200">{{ bookingTimeLabels.slotsError }}</p>
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
                        class="glass-control glass-control--dark px-3 py-2.5 text-white outline-none placeholder:text-white/35"
                        :class="shouldShowStepIssue(3) && !form.customer_name.trim() ? 'glass-control--invalid' : ''"
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
                      class="glass-control glass-control--dark px-3 py-2.5 text-white outline-none placeholder:text-white/35"
                      :class="shouldShowStepIssue(3) && !isValidPhoneNumber(form.customer_phone) ? 'glass-control--invalid' : ''"
                      @input="handlePhoneInput"
                      @paste="handlePhonePasteEvent"
                    >
                  </div>
                  <textarea
                    v-model="form.customer_comment"
                    rows="3"
                    placeholder="Коментар"
                    :maxlength="FORM_FIELD_LIMITS.comment"
                    class="glass-control glass-control--dark mt-3 w-full px-3 py-2.5 text-white outline-none placeholder:text-white/35"
                    @input="handleTextInput('customer_comment', FORM_FIELD_LIMITS.comment, { multiline: true })"
                  />
                  <input
                    v-model="form.promotion_code"
                    autocomplete="off"
                    inputmode="text"
                    placeholder="Промокод"
                    maxlength="50"
                    class="glass-control glass-control--dark mt-3 w-full px-3 py-2.5 text-white uppercase outline-none placeholder:normal-case placeholder:text-white/35"
                    @input="handleTextInput('promotion_code', 50)"
                  >
                  <label
                    v-if="selectedServicesHavePromotion"
                    class="glass-control glass-control--dark booking-army-toggle mt-3 flex cursor-pointer flex-col items-start justify-between gap-3 overflow-hidden px-3 py-2.5 text-white sm:flex-row sm:items-center"
                    :class="promotionConfirmed ? 'is-confirmed' : ''"
                  >
                    <span class="flex min-w-0 items-center gap-2.5">
                      <img
                        src="~/assets/images/services/army-logo.webp"
                        alt=""
                        class="h-7 w-7 shrink-0 object-contain"
                        aria-hidden="true"
                      >
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-semibold leading-tight">{{ promotionDiscountLabels.title }}</span>
                        <span class="mt-0.5 block line-clamp-2 text-[0.68rem] leading-4 text-white/68">{{ promotionDiscountLabels.description }}</span>
                      </span>
                    </span>
                    <span class="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-start">
                      <span class="hidden text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-white/70 min-[380px]:inline">{{ promotionDiscountLabels.badge }}</span>
                      <input
                        v-model="promotionConfirmed"
                        type="checkbox"
                        class="sr-only"
                      >
                      <span
                        class="glass-toggle relative h-6 w-11 shrink-0 transition"
                        :class="promotionConfirmed ? 'glass-toggle--active' : ''"
                      >
                        <span
                          class="absolute left-1 top-1 h-4 w-4 bg-white transition-transform"
                          :class="promotionConfirmed ? 'translate-x-5' : ''"
                        />
                      </span>
                    </span>
                  </label>
                  </section>
                </AppTransition>
              </div>

              <div class="booking-step-actions mt-8 flex flex-row gap-3 sm:items-center">
                <BaseButton
                  v-if="activeStepIndex > 0"
                  type="button"
                  variant="light"
                  size="sm"
                  class="h-11 flex-1 sm:h-12 sm:flex-none"
                  @click="goToStep(activeStepIndex - 1)"
                >
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  {{ terms.home.booking.back }}
                </BaseButton>

                <BaseButton
                  type="button"
                  :disabled="state.loading || (activeStepIndex === lastStepIndex && !canSubmit)"
                  variant="light"
                  size="sm"
                  class="h-11 flex-[1.35] sm:h-12 sm:flex-none"
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
                </BaseButton>
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
                <p class="type-eyebrow text-xs text-white/45">
                  {{ terms.home.booking.steps[1] }}
                </p>
                <p class="mt-2 text-2xl font-semibold leading-tight text-white">
                  {{ state.successMasterName }}
                </p>
              </div>
              <div class="border border-white/15 bg-white/[0.04] p-4">
                <p class="type-eyebrow text-xs text-white/45">
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
  </component>
</template>

<style scoped>
.booking-step-tab {
  transition-property:
    background-color,
    box-shadow,
    color,
    flex-basis,
    flex-grow,
    max-width,
    opacity,
    padding,
    transform;
  transition-duration: 340ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

.booking-form {
  display: flex;
  min-height: min(30rem, calc(100svh - 2rem));
  height: clamp(30rem, calc(100svh - 2rem), 38rem);
  max-height: calc(100svh - 2rem);
  min-width: 0;
  flex-direction: column;
}

.booking-form--drawer {
  min-height: 0;
  height: 100%;
  max-height: none;
}

.booking-stepper {
  flex-shrink: 0;
}

@media (min-width: 320px) and (max-width: 480px) {
  .booking-step-tab--active {
    flex: 1 1 auto;
    max-width: none;
  }

  .booking-step-tab--inactive {
    flex: 0 0 2.1rem;
    max-width: 2.1rem;
    padding-inline: 0.5rem;
  }
}

@media (max-width: 319.98px) {
  .booking-step-tab {
    flex: 1 1 0;
  }
}

@media (min-width: 480.01px) and (max-width: 639.98px) {
  .booking-step-tab {
    flex: 1 1 0;
  }
}

.booking-form .booking-step-panel {
  display: flex;
  min-height: 0;
  max-height: none;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.booking-form .booking-step-panel > div {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.booking-form .booking-step-content {
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0.25rem;
}

.booking-form .booking-step-actions {
  flex-shrink: 0;
  margin-top: 1rem;
  padding-top: 1rem;
}

@media (min-width: 640px) {
  .booking-form--section {
    min-height: min(32rem, calc(100svh - 3rem));
    height: clamp(32rem, calc(100svh - 4rem), 42rem);
    max-height: calc(100svh - 3rem);
  }
}

@media (min-width: 1024px) {
  .booking-form--section {
    min-height: min(34rem, calc(100svh - 7rem));
    height: clamp(34rem, calc(100svh - 9rem), 44rem);
    max-height: calc(100svh - 7rem);
  }
}

@media (max-width: 767px) {
  .booking-step-panel--service.booking-step-panel,
  .booking-step-panel--time.booking-step-panel {
    display: flex;
    max-height: calc(100svh - 16rem);
    min-height: 0;
    flex-direction: column;
  }

  .booking-step-panel--service.booking-step-panel > div,
  .booking-step-panel--time.booking-step-panel > div {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .booking-step-panel--service .booking-step-content {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
  }

  .booking-step-panel--time .booking-step-content {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
  }

  .booking-step-panel--time .booking-step-content > * {
    min-height: 0;
  }

  .booking-step-panel--time .booking-time-step {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .booking-step-panel--time .booking-date-control {
    flex-shrink: 0;
  }

  .booking-step-panel--time .booking-slots-column {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .booking-step-panel--time .booking-slots-grid {
    min-height: 0;
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.25rem;
  }

  .booking-step-panel--service .booking-step-actions,
  .booking-step-panel--time .booking-step-actions {
    flex-shrink: 0;
    margin-top: 1rem;
    padding-top: 1rem;
  }

  .booking-step-panel--service .booking-service__item {
    overflow: hidden;
  }

  .booking-step-panel--service .booking-service__selected-scribble {
    inset: -6px;
    width: calc(100% + 12px);
    height: calc(100% + 12px);
  }
}

@media (min-width: 1024px) {
  .booking-section:not(.booking-section--drawer) .booking-step-panel {
    display: flex;
    height: clamp(31rem, calc(100vh - 15rem), 42rem);
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .booking-section:not(.booking-section--drawer) .booking-step-panel > div {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .booking-section:not(.booking-section--drawer) .booking-step-content {
    min-height: 0;
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.25rem;
  }

  .booking-section:not(.booking-section--drawer) .booking-step-actions {
    flex-shrink: 0;
    margin-top: 1rem;
    padding-top: 1rem;
  }
}

.booking-section:not(.booking-section--drawer) .booking-form .booking-step-panel {
  height: auto;
  max-height: none;
  flex: 1;
}

.booking-service-step {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.booking-step-panel--service .booking-step-content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding-right: 0;
}

.booking-service-results-scroll {
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-top: 0.5rem;
  padding-right: 0.25rem;
}

@media (min-width: 640px) {
  .booking-service-results-scroll {
    margin-top: 0.75rem;
  }
}

.booking-section--drawer,
.booking-section--drawer > div,
.booking-section--drawer > div > div {
  min-height: 0;
  height: 100%;
}

.booking-form--drawer {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
}

.booking-form--drawer > :first-child {
  flex-shrink: 0;
}

.booking-section--drawer .booking-step-panel {
  display: flex;
  min-height: 0;
  max-height: none;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.booking-section--drawer .booking-step-panel > div {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.booking-section--drawer .booking-step-content {
  min-height: 0;
  flex: 1;
}

.booking-section--drawer .booking-step-panel:not(.booking-step-panel--time) .booking-step-content {
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0.25rem;
}

.booking-section--drawer .booking-step-panel--service .booking-step-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-right: 0;
}

.booking-section--drawer .booking-step-actions {
  flex-shrink: 0;
  margin-top: 1rem;
  padding-top: 1rem;
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

.booking-service-results-enter-active,
.booking-service-results-leave-active {
  transition:
    opacity 100ms ease,
    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}

.booking-service-results-enter-from,
.booking-service-results-leave-to {
  opacity: 0;
  transform: translateY(0.25rem);
}

.booking-service-step input[type="search"]::-webkit-search-cancel-button {
  display: none;
}

.booking-service-search-field {
  position: relative;
  padding-inline-end: 2.45rem;
}

.booking-service-search-clear {
  --booking-search-clear-fill-y: -76%;

  position: absolute;
  top: 50%;
  right: 0.625rem;
  isolation: isolate;
  display: inline-flex;
  width: 1.45rem;
  min-width: 1.45rem;
  height: 1.45rem;
  min-height: 1.45rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0;
  background: rgb(255 255 255 / 0.92);
  color: rgb(10 10 10);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    color 420ms cubic-bezier(0.3, 1, 0.3, 1),
    background-color 420ms cubic-bezier(0.3, 1, 0.3, 1),
    transform 180ms ease;
}

.booking-service-search-clear:hover,
.booking-service-search-clear:focus-visible {
  --booking-search-clear-fill-y: 0%;

  color: rgb(255 255 255);
}

.booking-service-search-clear:active {
  transform: translateY(-50%) scale(0.94);
}

.booking-service-search-clear:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.75);
  outline-offset: 2px;
}

.booking-service-search-clear__surface {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.booking-service-search-clear__fill {
  position: absolute;
  top: -50%;
  left: -25%;
  display: block;
  width: 150%;
  height: 200%;
  border-radius: 50%;
  background: rgb(10 10 10);
  transform: translate3d(0, var(--booking-search-clear-fill-y), 0);
  transition: transform 540ms cubic-bezier(0.3, 1, 0.3, 1);
  will-change: transform;
}

.booking-service-search-clear__icon {
  position: relative;
  z-index: 1;
  display: block;
  width: 0.65rem;
  height: 0.65rem;
  pointer-events: none;
}

.booking-service-search-clear__icon::before,
.booking-service-search-clear__icon::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.68rem;
  height: 0.1rem;
  background: currentColor;
  transform-origin: center;
}

.booking-service-search-clear__icon::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.booking-service-search-clear__icon::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.booking-army-toggle {
  background-image:
    linear-gradient(90deg, rgb(0 69 169 / 0.18), rgb(242 191 11 / 0.14)),
    url('~/assets/images/services/dark-bg-army.webp');
  background-position: center;
  background-size: cover;
  transition:
    background-color 180ms ease,
    transform 180ms ease;
}

.booking-army-toggle:hover,
.booking-army-toggle.is-confirmed {
  background-color: rgb(255 255 255 / 0.04);
}

.booking-service__item.is-army-service {
  padding-bottom: 2.5rem;
}

.booking-service-army-strip {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  background-image:
    linear-gradient(90deg, rgb(255 255 255 / 0.09), rgb(255 255 255 / 0.01)),
    url('~/assets/images/services/dark-bg-army.webp');
  background-position: center;
  background-size: cover;
}

.booking-service-army-discount {
  position: relative;
  isolation: isolate;
  padding: 0.2rem 0.35rem;
  padding-right: 22px;
  font-weight: 800;
}

.booking-service-army-discount::before {
  content: "";
  position: absolute;
  inset: -0.8rem -1.65rem;
  z-index: -1;
  background:
    linear-gradient(90deg, rgb(255 255 255 / 0.08), rgb(0 0 0 / 0.1)),
    repeating-linear-gradient(179deg, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(-40deg, rgb(0 0 0 / 0.08) 0 1px, transparent 1px 5px),
    #0045a9;
  border-top: 2px solid #f2bf0b;
  border-bottom: 2px solid #f2bf0b;
  transform: rotate(-45deg) translateY(-6px);
  transform-origin: center;
}

.booking-service-army-discount::after {
  content: "";
  position: absolute;
  inset: -0.45rem;
  z-index: -2;
  border-radius: 30px;
  background: rgb(255 255 255 / 0.14);
  top: 50%;
  left: 50%;
  transform: translate(-74%, -50%);
  width: 30px;
  height: 30px;
  z-index: 100;
}

.booking-service__selected-scribble {
  pointer-events: none;
  position: absolute;
  inset: -8px -12px;
  z-index: 12;
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
