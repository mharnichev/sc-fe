<script setup lang="ts">
import type { AvailableSlotDto, MasterDto, ServiceCatalogItemDto, ServiceDto } from '@shared-types'
import type { BookingAlternativeSlotDto, CampaignOfferContextDto, RepeatBookingContextDto } from '~/domain/barbershop'
import { bookingErrorCode, createBookingQuoteReview, isCampaignOfferError, isPromotionConflict, type BookingQuote, type BookingQuoteRequest, type QuoteReviewState } from '~/utils/bookingQuote'
import type { PublicServicePromotionDto } from '~/utils/seoRoutes'
import { firstVisitOffers, offerAppliesToMaster, offerAppliesToService } from '~/utils/bookingPromotions'
import { bookingContextKey, createBookingRequest } from '~/utils/bookingRequest'
import { campaignOfferApplies, clearCampaignOffer, readCampaignOffer } from '~/utils/campaignOffer'
import FeedbackFace from '~/components/ui/FeedbackFace.vue'
import { includesBookingStart, matchingBookingSlotStart, sameBookingInstant } from '~/utils/bookingSlots'
import { bookingFunnelFailureEvent, shouldRecordNoSlotObservation } from '~/utils/bookingFunnel'
import { buildGoogleCalendarUrl } from '~/utils/googleCalendar'
import {
  BOOKING_CUSTOMER_STORAGE_KEY,
  BOOKING_CUSTOMER_UPDATED_EVENT,
  readSavedBookingCustomer,
  saveBookingCustomer,
  type SavedBookingCustomer,
} from '~/utils/bookingCustomer'
import {
  addRecoveryCalendarDays,
  addRecoveryCalendarMonths,
  bookingAlternativesPayload,
  kyivRecoveryDateInput,
  publicWaitlistPayload,
  remapRecoveryServiceIds,
} from '~/utils/bookingRecovery'

type AssetModule = { default: string }

const props = withDefaults(defineProps<{
  analyticsSource?: string
  idPrefix?: string
  listenForExternalSelect?: boolean
  mode?: 'section' | 'drawer'
  repeatBookingToken?: string
  repeatBookingContext?: RepeatBookingContextDto | null
  campaignOfferToken?: string
  campaignOfferContext?: CampaignOfferContextDto | null
}>(), {
  analyticsSource: 'home_booking',
  idPrefix: 'booking',
  listenForExternalSelect: true,
  mode: 'section',
  repeatBookingToken: '',
  repeatBookingContext: null,
  campaignOfferToken: '',
  campaignOfferContext: null,
})

const emit = defineEmits<{ 'continue-regular-booking': [] }>()

const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const quoteApi = useApi()
const { offers: bookingOffers } = useBookingPromotions()
const assetUrl = useAssetUrl()
const localizedService = useLocalizedService()
const { trackEvent } = useAnalytics()
const bookingFunnel = useBookingFunnel()

type SelectableService = ServiceDto | ServiceCatalogItemDto
type BarberServiceOption = {
  id: number
  master: MasterDto
}

type RecoverySelection = {
  masterId: number
  startAt: string
  searchContextId?: string
  offerId?: string
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
const promotionConfirmed = ref(false)
const bookingForm = ref<HTMLFormElement | null>(null)
const contactNameInput = ref<HTMLInputElement | null>(null)
const contactPhoneInput = ref<HTMLInputElement | null>(null)
const bookingStepKeys = ['service', 'master', 'time', 'contact']
const bookingStepIds = computed(() => bookingStepKeys.map(step => `${props.idPrefix}-${step}`))
const activeStepKey = computed(() => bookingStepKeys[activeStepIndex.value] || bookingStepKeys[0])
const bookingSectionId = computed(() => props.mode === 'section' ? 'booking' : undefined)
const bookingStepperId = computed(() => props.idPrefix === 'booking' ? 'booking-stepper' : `${props.idPrefix}-stepper`)
const isDrawerMode = computed(() => props.mode === 'drawer')
const closedWeekdays = [1]
let serviceSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let serviceSearchPlaceholderTimer: ReturnType<typeof setTimeout> | null = null

const form = reactive({
  customer_name: '',
  customer_phone: '',
  customer_comment: '',
  promotion_code: '',
})

const applySavedBookingCustomer = (
  customer: SavedBookingCustomer | null,
  options: { onlyEmpty?: boolean } = {},
) => {
  if (!customer) return
  if (options.onlyEmpty && (form.customer_name.trim() || form.customer_phone.trim())) return

  form.customer_name = customer.name
  form.customer_phone = formatPhoneInput(customer.phone)
}

const restoreSavedBookingCustomer = (options: { onlyEmpty?: boolean } = {}) => {
  try {
    applySavedBookingCustomer(readSavedBookingCustomer(window.localStorage), options)
  }
  catch {
    // Accessing localStorage itself may be blocked by the browser.
  }
}

const syncSavedBookingCustomer = () => {
  restoreSavedBookingCustomer({ onlyEmpty: true })
}

const persistBookingCustomer = (customer: SavedBookingCustomer) => {
  try {
    if (saveBookingCustomer(window.localStorage, customer)) {
      window.dispatchEvent(new Event(BOOKING_CUSTOMER_UPDATED_EVENT))
    }
  }
  catch {
    // Local persistence must never turn a confirmed booking into an error.
  }
}

const handleBookingCustomerStorage = (event: StorageEvent) => {
  if (event.key === BOOKING_CUSTOMER_STORAGE_KEY) syncSavedBookingCustomer()
}

const recovery = reactive({
  loading: false,
  error: '',
  stale: '',
  loadedKey: '',
  searchContextId: '',
  nextOffset: null as number | null,
  pageLoading: false,
  sameMaster: [] as BookingAlternativeSlotDto[],
  otherMasters: [] as BookingAlternativeSlotDto[],
})
const recoverySelection = ref<RecoverySelection | null>(null)
const waitlistOpen = ref(false)
const waitlistState = ref<'form' | 'submitting' | 'success' | 'duplicate' | 'error'>('form')
const waitlistError = ref('')
const waitlistNamePrefilled = ref(false)
const waitlistPhonePrefilled = ref(false)
const waitlistForm = reactive({
  customer_name: '',
  customer_phone: '',
  another_master_acceptable: false,
  nearby_dates_acceptable: false,
  notification_consent: false,
})

const state = reactive({
  loading: false,
  success: '',
  error: '',
  successMasterName: '',
  successStartAt: '',
  successServiceNames: [] as string[],
  successDurationMinutes: 0,
  browserSessionCreated: false,
  successTotal: null as number | string | null,
})
const bookingSectionPhotos = ref('')
const bookingSectionRoot = ref<HTMLElement | null>(null)
let bookingPhotoObserver: IntersectionObserver | null = null

const recoveryEventId = () => {
  if (!import.meta.client) return null
  const cryptoApi = globalThis.crypto
  const random = cryptoApi?.randomUUID?.()
  if (random) return `recovery-${random}`
  if (typeof cryptoApi?.getRandomValues !== 'function') return null

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  return `recovery-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}

const isMondayDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return false

  return new Date(year, month - 1, day).getDay() === 1
}

const today = kyivRecoveryDateInput()
const maxBookableDate = addRecoveryCalendarMonths(today, 2)
const defaultBookableDate = (() => {
  for (let dayOffset = 0; dayOffset <= 62; dayOffset += 1) {
    const value = addRecoveryCalendarDays(today, dayOffset)

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
const servicePromotion = (service?: SelectableService | null): PublicServicePromotionDto | null => service?.active_promotion || null
const serviceHasMilitaryPromotion = (service: SelectableService) => {
  const promotion = servicePromotion(service)
  return Boolean(promotion?.code && promotion.application_mode !== 'automatic'
    && (!promotion.eligibility_type || promotion.eligibility_type === 'military_customers'))
}
const serviceRegularPrice = (service?: SelectableService | null) =>
  localizedService.servicePrice(service?.price, { from: serviceHasMultiplePrices(service) })
const servicePrice = serviceRegularPrice
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
const serviceSearchSuggestions = computed(() => locale.value === 'en'
  ? [
      'Men\'s haircut',
      'Clipper haircut',
      'Kids haircut',
      'Haircut and beard',
    ]
  : [
      'Чоловіча стрижка',
      'Стрижка машинкою',
      'Дитяча стрижка',
      'Стрижка та борода',
    ],
)
const animatedServiceSearchPlaceholder = ref<string | null>(null)
const serviceSearchPlaceholder = computed(() => {
  if (!isDrawerMode.value) return serviceSearchLabels.value.placeholder

  return animatedServiceSearchPlaceholder.value ?? serviceSearchSuggestions.value[0]
})
const serviceBarbersLabel = computed(() => locale.value === 'en' ? 'Barbers and prices' : 'Барбери та ціни')
const promotionDiscountLabels = computed(() => locale.value === 'en'
  ? {
      title: 'I am a defender of Ukraine',
      description: 'Apply the active discount to eligible services. Confirmation may be requested during the visit.',
      bookingNote: 'Confirmed defender discount in booking form.',
    }
  : {
      title: 'Я захисник України',
      description: 'Застосувати активну знижку до доступних послуг. Підтвердження може знадобитися під час візиту.',
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
const googleCalendarUrl = computed(() => buildGoogleCalendarUrl({
  startAt: state.successStartAt,
  durationMinutes: state.successDurationMinutes,
  masterName: state.successMasterName,
  serviceNames: state.successServiceNames,
  locale: locale.value === 'en' ? 'en' : 'uk',
}))
const googleCalendarCopy = computed(() => locale.value === 'en'
  ? {
      action: 'Add to Google Calendar',
      hint: 'Save the appointment so the date and time stay close at hand.',
    }
  : {
      action: 'Додати в Google Calendar',
      hint: 'Збережіть запис, щоб дата й час завжди були під рукою.',
    },
)
const browserSessionHint = 'Ми зберегли ваш запис на цьому пристрої на 30 днів. Він доступний у «Мої записи».'
const selectedPromotionCodes = computed(() =>
  Array.from(new Set(selectedServices.value.flatMap((service) => {
    const promotion = servicePromotion(service)
    return promotion?.code && promotion.application_mode !== 'automatic'
      && (!promotion.eligibility_type || promotion.eligibility_type === 'military_customers')
      ? [promotion.code] : []
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

const restoredCampaignOfferContext = ref<CampaignOfferContextDto | null>(null)
const restoredCampaignOfferToken = ref('')
const capturedCampaignOfferToken = useState<string | null>('campaign-offer-captured-token', () => null)
const capturedCampaignOfferEventId = useState<string>('campaign-offer-event-id', () => '')
const campaignOfferDismissed = ref(false)
const campaignOfferBooked = ref(false)
const campaignOfferContext = computed(() => campaignOfferDismissed.value ? null : props.campaignOfferContext || restoredCampaignOfferContext.value)
const campaignOfferToken = computed(() => campaignOfferDismissed.value ? '' : props.campaignOfferToken || restoredCampaignOfferToken.value)
const continueRegularBooking = () => {
  try { clearCampaignOffer(window.sessionStorage) }
  catch { /* The offer is still removed from this form. */ }
  capturedCampaignOfferToken.value = null
  capturedCampaignOfferEventId.value = ''
  campaignOfferDismissed.value = true
  emit('continue-regular-booking')
}

onMounted(async () => {
  if (props.campaignOfferContext || props.repeatBookingContext) return
  let saved: ReturnType<typeof readCampaignOffer> = null
  try { saved = readCampaignOffer(window.sessionStorage) }
  catch { return }
  if (!saved) return
  try {
    const resolved = await domain.resolveCampaignOffer(saved.token)
    if (campaignOfferDismissed.value || resolved.entitlement !== 'available') return
    restoredCampaignOfferToken.value = saved.token
    restoredCampaignOfferContext.value = resolved
  }
  catch { /* A stale offer cannot block a regular booking. */ }
})

const campaignOfferPrefillApplied = ref(false)
const applyCampaignOfferPrefill = () => {
  const offer = campaignOfferContext.value
  if (campaignOfferPrefillApplied.value || !offer || !publicMasters.value.length) return
  const master = publicMasters.value.find(item => item.id === offer.master_id)
  const availableIds = new Set(activeMasterServices(master?.services).map(service => service.id))
  const firstService = offer.service_ids.find(id => availableIds.has(id))
  if (!master || !firstService || selectedMasterId.value || selectedServiceIds.value.length || selectedCatalogIds.value.length) return
  selectedCatalogIds.value = []
  selectedMasterId.value = master.id
  selectedServiceIds.value = [firstService]
  activeStepIndex.value = 0
  campaignOfferPrefillApplied.value = true
}

watch([masters, campaignOfferContext], applyCampaignOfferPrefill, { immediate: true })

const effectiveCampaignOfferToken = computed(() =>
  campaignOfferContext.value && !campaignOfferBooked.value && !effectivePromotionCode.value
  && campaignOfferApplies(campaignOfferContext.value, selectedMasterId.value, selectedServiceIds.value)
    ? campaignOfferToken.value : null,
)
const campaignOfferServiceNames = computed(() => {
  const offer = campaignOfferContext.value
  const master = publicMasters.value.find(item => item.id === offer?.master_id)
  return activeMasterServices(master?.services)
    .filter(service => offer?.service_ids.includes(service.id))
    .map(serviceName)
})
const campaignOfferMasterName = computed(() => masterName(publicMasters.value.find(master => master.id === campaignOfferContext.value?.master_id)))
const campaignOfferExpiry = computed(() => campaignOfferContext.value
  ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'uk-UA', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
    }).format(new Date(campaignOfferContext.value.expires_at))
  : '')

const repeatBookingPrefillApplied = ref(false)
const applyRepeatBookingPrefill = () => {
  const context = props.repeatBookingContext
  if (repeatBookingPrefillApplied.value || !context || !context.can_prefill) return

  const masterId = context.preferred_master.id
  const serviceIds = context.services.map(service => service.id)
  const master = publicMasters.value.find(item => item.id === masterId)
  const activeIds = new Set(activeMasterServices(master?.services).map(service => service.id))

  if (!master || !serviceIds.length || serviceIds.some(serviceId => !activeIds.has(serviceId))) return

  selectedCatalogIds.value = []
  selectedMasterId.value = master.id
  selectedServiceIds.value = serviceIds
  activeStepIndex.value = 2
  repeatBookingPrefillApplied.value = true
}

watch(
  [masters, () => props.repeatBookingContext],
  applyRepeatBookingPrefill,
  { immediate: true },
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

const stopServiceSearchPlaceholderAnimation = () => {
  if (!serviceSearchPlaceholderTimer) return

  clearTimeout(serviceSearchPlaceholderTimer)
  serviceSearchPlaceholderTimer = null
}

const startServiceSearchPlaceholderAnimation = () => {
  stopServiceSearchPlaceholderAnimation()

  if (!isDrawerMode.value) {
    animatedServiceSearchPlaceholder.value = null
    return
  }

  const suggestions = serviceSearchSuggestions.value
  const firstSuggestion = suggestions[0] || serviceSearchLabels.value.placeholder

  if (!import.meta.client || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    animatedServiceSearchPlaceholder.value = firstSuggestion
    return
  }

  let suggestionIndex = 0
  let characterIndex = 0
  let deleting = false
  animatedServiceSearchPlaceholder.value = ''

  const tick = () => {
    const suggestion = suggestions[suggestionIndex] || firstSuggestion

    if (!deleting) {
      characterIndex += 1
      animatedServiceSearchPlaceholder.value = suggestion.slice(0, characterIndex)

      if (characterIndex >= suggestion.length) {
        deleting = true
        serviceSearchPlaceholderTimer = setTimeout(tick, 1100)
        return
      }

      const nextCharacter = suggestion.charAt(characterIndex)
      const typingDelay = nextCharacter === ' ' ? 170 : 80 + Math.round(Math.random() * 45)
      serviceSearchPlaceholderTimer = setTimeout(tick, typingDelay)
      return
    }

    characterIndex -= 1
    animatedServiceSearchPlaceholder.value = suggestion.slice(0, Math.max(characterIndex, 0))

    if (characterIndex <= 0) {
      deleting = false
      suggestionIndex = (suggestionIndex + 1) % suggestions.length
      serviceSearchPlaceholderTimer = setTimeout(tick, 240)
      return
    }

    serviceSearchPlaceholderTimer = setTimeout(tick, 45)
  }

  serviceSearchPlaceholderTimer = setTimeout(tick, 240)
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

const recordReachedMasterStep = (masterId: number, serviceId?: number) => {
  bookingFunnel.recordInBackground('booking_start', {
    masterId,
  })
  bookingFunnel.recordInBackground('service_selected', {
    masterId,
    serviceId,
  })
  bookingFunnel.recordInBackground('master_selected', {
    masterId,
    serviceId,
  })
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
    if (bookingFunnel.claimAnalyticsStart()) {
      trackEvent('booking_start', {
        source: props.analyticsSource,
      })
      bookingFunnel.recordInBackground('booking_start')
    }

    trackEvent('select_service', {
      source: props.analyticsSource,
      service_id: serviceKey(service),
      service_name: serviceName(service),
      service_count: selectedServiceCount.value,
      value: Number(service.price || 0),
      currency: 'UAH',
    })
    bookingFunnel.recordInBackground('service_selected', {
      masterId: selectedMasterId.value,
      serviceId: 'catalog_id' in service ? null : service.id,
    })
    if (selectedMasterId.value) {
      recordReachedMasterStep(
        selectedMasterId.value,
        selectedServiceIds.value[0],
      )
    }
  }
}

const selectMaster = (masterId: number) => {
  selectedMasterId.value = masterId
  resolveSelectedServiceForMaster()
  if (bookingFunnel.claimAnalyticsStart()) {
    trackEvent('booking_start', {
      source: props.analyticsSource,
    })
  }
  trackEvent('select_master', {
    source: props.analyticsSource,
    master_id: masterId,
    master_name: masterName(selectedMaster.value),
    service_count: selectedServiceCount.value,
  })
  if (selectedServiceIds.value.length || selectedCatalogIds.value.length) {
    recordReachedMasterStep(masterId, selectedServiceIds.value[0])
  }
  else {
    bookingFunnel.recordInBackground('booking_start', {
      masterId,
    })
  }
  goToStep(selectedServiceIds.value.length || selectedCatalogIds.value.length ? 2 : 0)
}

const selectSlot = (slotStart: string) => {
  const selectedStart = matchingBookingSlotStart(visibleSlots.value, slotStart)
  if (!selectedMasterId.value || !selectedServiceIds.value.length || !selectedStart) return

  recordReachedMasterStep(selectedMasterId.value, selectedServiceIds.value[0])
  selectedSlotStart.value = selectedStart
  trackEvent('select_time', {
    source: props.analyticsSource,
    master_id: selectedMasterId.value,
    appointment_date: selectedDate.value,
    appointment_hour: formatTime(selectedStart),
    service_count: selectedServiceCount.value,
    duration_minutes: selectedDurationMinutes.value,
  })
  bookingFunnel.recordInBackground('slot_selected', {
    masterId: selectedMasterId.value,
    serviceId: selectedServiceIds.value[0],
  })
  goToStep(3)
}

const handleExternalServiceSelect = (event: Event) => {
  const catalogId = (event as CustomEvent<{ catalogId?: string }>).detail?.catalogId
  if (!catalogId) return

  const service = activeServiceCatalog.value.find(item => item.catalog_id === catalogId)
  if (!service) return
  if (!selectedCatalogIds.value.includes(catalogId)) selectService(service)
}

onMounted(() => {
  startServiceSearchPlaceholderAnimation()
  restoreSavedBookingCustomer()
  window.addEventListener(BOOKING_CUSTOMER_UPDATED_EVENT, syncSavedBookingCustomer)
  window.addEventListener('storage', handleBookingCustomerStorage)

  if (!props.listenForExternalSelect) return

  window.addEventListener('barbershop:select-service', handleExternalServiceSelect)
})

onBeforeUnmount(() => {
  stopServiceSearchPlaceholderAnimation()
  window.removeEventListener(BOOKING_CUSTOMER_UPDATED_EVENT, syncSavedBookingCustomer)
  window.removeEventListener('storage', handleBookingCustomerStorage)

  if (serviceSearchDebounceTimer) {
    clearTimeout(serviceSearchDebounceTimer)
  }

  if (!props.listenForExternalSelect) return

  window.removeEventListener('barbershop:select-service', handleExternalServiceSelect)
})

watch(locale, startServiceSearchPlaceholderAnimation)

watch(selectedMasterId, resolveSelectedServiceForMaster)

watch([selectedServiceIds, selectedCatalogIds, selectedMasterId, selectedDate], () => {
  selectedSlotStart.value = ''
  recoverySelection.value = null
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

const requestContextKey = computed(() => bookingContextKey(
  selectedMasterId.value, selectedServiceIds.value, selectedDate.value, selectedDurationMinutes.value,
))
const slotsKey = requestContextKey
const loadedSlotsKey = ref('')
const slots = ref<AvailableSlotDto[]>([])
const slotsPending = ref(false)
const slotsError = ref<unknown>(null)
const slotRequest = createBookingRequest()
const recoveryRequest = createBookingRequest()
const selectionRequest = createBookingRequest()
const selectingAlternative = ref(false)
const showAllAlternatives = ref(false)

const refreshSlots = async () => {
  const ticket = slotRequest.begin()
  const key = requestContextKey.value
  const masterId = selectedMasterId.value
  const serviceIds = [...selectedServiceIds.value]
  const day = selectedDate.value
  const duration = selectedDurationMinutes.value
  slots.value = []
  loadedSlotsKey.value = ''
  slotsError.value = null
  slotsPending.value = Boolean(key && !isSelectedDateClosed.value)
  if (!key || !masterId || isSelectedDateClosed.value) return
  try {
    const result = await domain.getAvailableSlots(masterId, serviceIds, day, duration, ticket.signal)
    if (!ticket.current()) return
    slots.value = result
    loadedSlotsKey.value = key
    if (selectedSlotStart.value && !includesBookingStart(result, selectedSlotStart.value)) selectedSlotStart.value = ''
  }
  catch (error) {
    if (ticket.current()) slotsError.value = error
  }
  finally {
    if (ticket.current()) slotsPending.value = false
  }
}
watch(requestContextKey, () => {
  slotRequest.cancel()
  recoveryRequest.cancel()
  selectionRequest.cancel()
  selectingAlternative.value = false
  slots.value = []
  loadedSlotsKey.value = ''
  selectedSlotStart.value = ''
  recoverySelection.value = null
  recovery.sameMaster = []
  recovery.otherMasters = []
  recovery.loadedKey = ''
  recovery.searchContextId = ''
  recovery.nextOffset = null
  recovery.pageLoading = false
  recovery.loading = false
  recovery.error = ''
  showAllAlternatives.value = false
}, { flush: 'sync' })
watch(requestContextKey, () => { void refreshSlots() }, { immediate: true })
onBeforeUnmount(() => { slotRequest.cancel(); recoveryRequest.cancel(); selectionRequest.cancel() })

const visibleSlots = computed<AvailableSlotDto[]>(() =>
  !slotsPending.value && !slotsError.value && loadedSlotsKey.value === requestContextKey.value
    && !isSelectedDateClosed.value ? slots.value : [],
)

type DayAvailability = 'unknown' | 'loading' | 'available' | 'unavailable' | 'error'
const dateAvailability = ref<Record<string, DayAvailability>>({})
const dateExplicitlySelected = ref(false)
const rangeRequest = createBookingRequest()
const rangeContextKey = computed(() => bookingContextKey(selectedMasterId.value, selectedServiceIds.value, today, selectedDurationMinutes.value))
const loadDateAvailability = async () => {
  const ticket = rangeRequest.begin()
  const masterId = selectedMasterId.value
  dateAvailability.value = {}
  if (!masterId || !rangeContextKey.value) return
  const days: string[] = []
  for (let day = today; day <= maxBookableDate; day = addRecoveryCalendarDays(day, 1)) days.push(day)
  dateAvailability.value = Object.fromEntries(days.map(day => [day, 'loading']))
  try {
    const response = await domain.getAvailabilityRange(masterId, [...selectedServiceIds.value], today, maxBookableDate, selectedDurationMinutes.value, ticket.signal)
    if (!ticket.current()) return
    dateAvailability.value = Object.fromEntries(response.days.map(day => [day.date, day.status]))
  }
  catch {
    if (ticket.current()) dateAvailability.value = Object.fromEntries(days.map(day => [day, 'error']))
  }
}
watch(rangeContextKey, () => { void loadDateAvailability() }, { immediate: true })
onBeforeUnmount(rangeRequest.cancel)
const nearestAvailableDate = computed(() => !dateExplicitlySelected.value
  && dateAvailability.value[selectedDate.value] === 'unavailable'
  ? Object.keys(dateAvailability.value).sort().find(day => day >= selectedDate.value && dateAvailability.value[day] === 'available')
  : undefined)
const selectBookingDate = (day: string) => { dateExplicitlySelected.value = true; selectedDate.value = day }

const alternativeServiceIds = (masterId: number) => {
  if (masterId === selectedMasterId.value) return [...selectedServiceIds.value]

  if (selectedCatalogItems.value.length) {
    const ids = selectedCatalogItems.value
      .map(service => service.barber_services.find(item => item.barber_id === masterId)?.id)
      .filter((id): id is number => Boolean(id))
    return ids.length === selectedCatalogItems.value.length && new Set(ids).size === ids.length ? ids : null
  }

  return remapRecoveryServiceIds(
    selectedServiceIds.value,
    selectedMasterServices.value,
    mastersById.value.get(masterId)?.services || [],
  )
}

const canSelectAlternative = (slot: BookingAlternativeSlotDto) =>
  Boolean(
    recovery.loadedKey === requestContextKey.value
    && !recovery.loading
    && !selectingAlternative.value
    &&
    slot.date
    && slot.start_at
    && mastersById.value.has(slot.master.id)
    && (slot.service_ids || alternativeServiceIds(slot.master.id))?.length === selectedServiceIds.value.length,
  )

const recoveryCopy = computed(() => locale.value === 'en'
  ? {
      title: 'No available slots on this date',
      description: 'We found the nearest options so you can book without searching again.',
      sameMaster: (name: string) => `Nearest time with ${name}`,
      otherMasters: 'Other barbers are available that day',
      otherDates: 'Other nearby dates',
      waitlist: 'Notify me if a slot becomes available',
      loading: 'Looking for the nearest available options...',
      unavailable: 'We could not load alternatives. Please try again.',
      stale: 'That time was just taken. We refreshed the nearest available options.',
      chooseAnother: 'Choose another date or barber',
      duration: (minutes: number) => `${minutes} min`,
      rating: (value: number) => `Rating ${value.toFixed(1)}`,
      waitlistTitle: 'Join the waitlist',
      waitlistDescription: 'This is not a confirmed booking. We will text you if a suitable time becomes available.',
      name: 'Name',
      phone: 'Phone',
      masterPreference: 'Barber preference',
      onlyThisMaster: 'Only this barber',
      anotherMaster: 'Another barber is fine',
      datePreference: 'Date preference',
      onlyThisDate: 'Only this date',
      nearbyDates: 'Nearest days',
      consent: 'Send me an SMS if a suitable time becomes available',
      submit: 'Join waitlist',
      sending: 'Sending...',
      success: 'Done. We will send an SMS if a suitable time becomes available. This is not a booking yet — you will need to confirm the time.',
      duplicate: 'You already have an active waitlist request for these preferences. We will text you if a suitable time becomes available.',
      error: 'We could not add you to the waitlist. Please try again.',
      back: 'Back to date and barber selection',
      contactSaved: 'We will use the contact details you entered for this booking.',
      close: 'Close',
    }
  : {
      title: 'На цю дату вільних вікон немає',
      description: 'Ми знайшли найближчі варіанти, щоб ви могли записатися без зайвого пошуку.',
      sameMaster: (name: string) => `Найближчий час у ${name}`,
      otherMasters: 'Цього дня доступні інші майстри',
      otherDates: 'Інші найближчі дати',
      waitlist: 'Повідомити мене, якщо звільниться вікно',
      loading: 'Шукаємо найближчі вільні варіанти...',
      unavailable: 'Не вдалося завантажити варіанти. Спробуйте ще раз.',
      stale: 'Цей час щойно зайняли. Ми оновили найближчі вільні варіанти.',
      chooseAnother: 'Обрати іншу дату або майстра',
      duration: (minutes: number) => `${minutes} хв`,
      rating: (value: number) => `Рейтинг ${value.toFixed(1)}`,
      waitlistTitle: 'Стати в лист очікування',
      waitlistDescription: 'Це не підтверджений запис. Ми надішлемо SMS, якщо з’явиться відповідний час.',
      name: 'Ім’я',
      phone: 'Телефон',
      masterPreference: 'Побажання щодо майстра',
      onlyThisMaster: 'Лише цей майстер',
      anotherMaster: 'Підійде інший майстер',
      datePreference: 'Побажання щодо дати',
      onlyThisDate: 'Лише ця дата',
      nearbyDates: 'Найближчі дні',
      consent: 'Надіслати SMS, якщо з’явиться підходяще вікно',
      submit: 'Стати в лист очікування',
      sending: 'Надсилаємо...',
      success: 'Готово. Напишемо SMS, якщо з’явиться відповідне вікно. Це ще не запис — час потрібно буде підтвердити.',
      duplicate: 'У вас уже є активний запит із такими побажаннями. Напишемо SMS, якщо з’явиться відповідне вікно.',
      error: 'Не вдалося додати вас до листа очікування. Спробуйте ще раз.',
      back: 'Повернутися до вибору дати й майстра',
      contactSaved: 'Використаємо контакти, які ви вже вказали для запису.',
      close: 'Закрити',
    },
)

const recoveryRequestKey = requestContextKey

const recordRecoveryEvent = (eventType: 'alternative_slot_selected' | 'waitlist_opened' | 'alternative_slot_viewed', masterId?: number, searchContextId?: string, offerId?: string) => {
  const anonymousSessionId = bookingFunnel.sessionId()
  const eventId = recoveryEventId()
  if (!anonymousSessionId || !eventId) return

  void domain.recordBookingRecoveryEvent({
    event_id: eventId,
    anonymous_session_id: anonymousSessionId,
    event_type: eventType,
    ...(searchContextId ? { search_context_id: searchContextId } : {}),
    ...(offerId ? { offer_id: offerId } : {}),
    ...(masterId ? { master_id: masterId } : {}),
    ...(selectedServiceIds.value[0] ? { service_id: selectedServiceIds.value[0] } : {}),
  }).catch(() => {
    // Recovery observability is best effort and never blocks booking.
  })
}

// An impression requires >=50% visibility for 250ms in the current, active time step.
const viewedOffers = new Set<string>()
const impressionCleanups = new WeakMap<HTMLElement, () => void>()
const vRecoveryImpression = {
  mounted(element: HTMLElement, binding: { value: BookingAlternativeSlotDto }) {
    const slot = binding.value
    const contextKey = recovery.loadedKey
    const searchContextId = recovery.searchContextId
    if (!slot.offer_id || !searchContextId || typeof IntersectionObserver === 'undefined') return
    const eventKey = `${bookingFunnel.sessionId()}:${searchContextId}:${slot.offer_id}`
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => { if (timer) clearTimeout(timer); timer = undefined }
    const isCurrent = () => activeStepIndex.value === 2 && document.visibilityState === 'visible'
      && recovery.loadedKey === contextKey && requestContextKey.value === contextKey
      && recovery.searchContextId === searchContextId && !recovery.loading
      && !slotsPending.value && !slotsError.value && visibleSlots.value.length === 0
    const observer = new IntersectionObserver((entries) => {
      cancel()
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5) || !isCurrent() || viewedOffers.has(eventKey)) return
      timer = setTimeout(() => {
        if (!isCurrent() || viewedOffers.has(eventKey)) return
        const rect = element.getBoundingClientRect()
        const center = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, rect.x + rect.width / 2)), Math.max(0, Math.min(innerHeight - 1, rect.y + rect.height / 2)))
        if (!center || !element.contains(center)) return
        viewedOffers.add(eventKey)
        recordRecoveryEvent('alternative_slot_viewed', slot.master.id, searchContextId, slot.offer_id)
      }, 250)
    }, { threshold: [0, 0.5, 1] })
    const visibilityChanged = () => { cancel(); observer.unobserve(element); observer.observe(element) }
    observer.observe(element)
    document.addEventListener('visibilitychange', visibilityChanged)
    impressionCleanups.set(element, () => { cancel(); observer.disconnect(); document.removeEventListener('visibilitychange', visibilityChanged) })
  },
  unmounted(element: HTMLElement) { impressionCleanups.get(element)?.(); impressionCleanups.delete(element) },
}

const loadRecoveryAlternatives = async (force = false) => {
  const requestKey = recoveryRequestKey.value
  const masterId = selectedMasterId.value
  if (!requestKey || !masterId || (!force && recovery.loadedKey === requestKey)) return
  const ticket = recoveryRequest.begin()
  recovery.loading = true
  recovery.pageLoading = false
  recovery.nextOffset = null
  recovery.error = ''
  recovery.loadedKey = ''
  recovery.sameMaster = []
  recovery.otherMasters = []
  try {
    const response = await domain.getBookingAlternatives(bookingAlternativesPayload({
      masterId, serviceIds: [...selectedServiceIds.value], desiredDate: selectedDate.value,
      durationMinutes: selectedDurationMinutes.value, funnelSessionId: bookingFunnel.sessionId(),
    }), ticket.signal)
    if (!ticket.current() || recoveryRequestKey.value !== requestKey) return
    recovery.sameMaster = response.same_master
    recovery.otherMasters = response.other_masters
    recovery.searchContextId = response.search_context_id
    recovery.nextOffset = response.next_offset ?? null
    recovery.loadedKey = requestKey
  }
  catch {
    if (ticket.current()) recovery.error = recoveryCopy.value.unavailable
  }
  finally {
    if (ticket.current()) recovery.loading = false
  }
}

const loadMoreAlternatives = async () => {
  showAllAlternatives.value = true
  const offset = recovery.nextOffset
  const key = recoveryRequestKey.value
  const masterId = selectedMasterId.value
  if (offset === null || recovery.pageLoading || recovery.loading || !masterId || recovery.loadedKey !== key) return
  const ticket = recoveryRequest.begin()
  recovery.pageLoading = true
  recovery.error = ''
  try {
    const response = await domain.getBookingAlternatives({
      ...bookingAlternativesPayload({ masterId, serviceIds: [...selectedServiceIds.value], desiredDate: selectedDate.value,
        durationMinutes: selectedDurationMinutes.value, funnelSessionId: bookingFunnel.sessionId() }),
      offset, page_size: 50,
    }, ticket.signal)
    if (!ticket.current() || recovery.loadedKey !== key) return
    if (response.search_context_id !== recovery.searchContextId) return
    const appendUnique = (existing: BookingAlternativeSlotDto[], page: BookingAlternativeSlotDto[]) => {
      const ids = new Set(existing.map(slot => slot.offer_id))
      return [...existing, ...page.filter(slot => !ids.has(slot.offer_id))]
    }
    recovery.sameMaster = appendUnique(recovery.sameMaster, response.same_master)
    recovery.otherMasters = appendUnique(recovery.otherMasters, response.other_masters)
    recovery.nextOffset = response.next_offset ?? null
  }
  catch {
    if (ticket.current()) recovery.error = recoveryCopy.value.unavailable
  }
  finally {
    if (ticket.current()) recovery.pageLoading = false
  }
}

const alternativeChanges = (slot: BookingAlternativeSlotDto) => {
  const currentPrice = selectedServices.value.reduce((total, service) => total + Number(service.price || 0), 0)
  const changes: string[] = []
  if (slot.master.id !== selectedMasterId.value) changes.push(locale.value === 'en' ? 'Different barber' : 'Інший майстер')
  if (slot.duration_minutes !== selectedDurationMinutes.value) changes.push(`${selectedDurationMinutes.value} → ${slot.duration_minutes} ${locale.value === 'en' ? 'min' : 'хв'}`)
  if (Number(slot.price) !== currentPrice) changes.push(`${currentPrice} → ${slot.price} ₴`)
  return changes.join(' · ')
}

const recommendedAlternatives = (items: BookingAlternativeSlotDto[]) =>
  items.filter(slot => canSelectAlternative(slot) && (showAllAlternatives.value || slot.recommended !== false))
const sameMasterAlternatives = computed(() => recommendedAlternatives(recovery.sameMaster))
const sameDayOtherMasterAlternatives = computed(() =>
  recommendedAlternatives(recovery.otherMasters).filter(slot => slot.date === selectedDate.value),
)
const nearbyDateAlternatives = computed(() =>
  recommendedAlternatives(recovery.otherMasters).filter(slot => slot.date !== selectedDate.value),
)
const hasMoreAlternatives = computed(() =>
  recovery.nextOffset !== null || [...recovery.sameMaster, ...recovery.otherMasters].some(slot => slot.recommended === false),
)

const openWaitlist = () => {
  waitlistForm.customer_name = waitlistForm.customer_name || form.customer_name
  waitlistForm.customer_phone = waitlistForm.customer_phone || form.customer_phone
  waitlistNamePrefilled.value = waitlistForm.customer_name.trim().length >= 2
  waitlistPhonePrefilled.value = isValidPhoneNumber(waitlistForm.customer_phone)
  waitlistForm.another_master_acceptable = false
  waitlistForm.nearby_dates_acceptable = false
  waitlistForm.notification_consent = false
  waitlistError.value = ''
  waitlistState.value = 'form'
  waitlistOpen.value = true
  recordRecoveryEvent('waitlist_opened', selectedMasterId.value || undefined)
}

const waitlistNeedsName = computed(() => !waitlistNamePrefilled.value)
const waitlistNeedsPhone = computed(() => !waitlistPhonePrefilled.value)

const submitWaitlist = async () => {
  const customerName = sanitizeFormText(waitlistForm.customer_name, FORM_FIELD_LIMITS.fullName)
  const customerPhone = formatPhoneForSubmit(waitlistForm.customer_phone)
  if (customerName.length < 2 || !customerPhone || !waitlistForm.notification_consent || !selectedDate.value || !selectedServiceIds.value.length) {
    waitlistError.value = recoveryCopy.value.error
    return
  }

  waitlistState.value = 'submitting'
  waitlistError.value = ''
  try {
    await domain.createWaitlistRequest(publicWaitlistPayload({
      customerName,
      customerPhone,
      serviceIds: selectedServiceIds.value,
      selectedMasterId: selectedMasterId.value,
      desiredDate: selectedDate.value,
      durationMinutes: selectedDurationMinutes.value,
      anotherMasterAcceptable: waitlistForm.another_master_acceptable,
      nearbyDatesAcceptable: waitlistForm.nearby_dates_acceptable,
      maxBookableDate,
    }))
    form.customer_name = customerName
    form.customer_phone = formatPhoneInput(customerPhone)
    waitlistState.value = 'success'
  }
  catch (error) {
    const status = (error as { response?: { status?: number }, status?: number })?.response?.status
      || (error as { status?: number })?.status
    waitlistState.value = status === 409 ? 'duplicate' : 'error'
    waitlistError.value = status === 409 ? recoveryCopy.value.duplicate : recoveryCopy.value.error
  }
}

const returnToSelection = () => {
  waitlistOpen.value = false
  goToStep(2)
}

const selectRecoveryAlternative = async (slot: BookingAlternativeSlotDto) => {
  if (!canSelectAlternative(slot)) return
  const serviceIds = slot.service_ids || alternativeServiceIds(slot.master.id)
  if (!serviceIds?.length) return
  const searchContextId = recovery.searchContextId
  recovery.stale = ''
  recovery.error = ''
  selectedMasterId.value = slot.master.id
  selectedServiceIds.value = [...serviceIds]
  selectedDate.value = slot.date
  await nextTick()
  const key = requestContextKey.value
  const ticket = selectionRequest.begin()
  selectingAlternative.value = true
  try {
    await refreshSlots()
    if (!ticket.current() || requestContextKey.value !== key) return
    if (slotsError.value) return
    if (!includesBookingStart(visibleSlots.value, slot.start_at)) {
      recovery.stale = recoveryCopy.value.stale
      bookingFunnel.recordInBackground('stale_schedule', { masterId: slot.master.id, serviceId: serviceIds[0] })
      await loadRecoveryAlternatives(true)
      return
    }
    selectedSlotStart.value = slot.start_at
    recoverySelection.value = { masterId: slot.master.id, startAt: slot.start_at, searchContextId, offerId: slot.offer_id }
    recordRecoveryEvent('alternative_slot_selected', slot.master.id, searchContextId, slot.offer_id)
    selectSlot(slot.start_at)
  }
  finally {
    if (ticket.current()) selectingAlternative.value = false
  }
}

watch(
  [loadedSlotsKey, slotsPending, slotsError, visibleSlots, selectedDate, activeStepIndex],
  () => {
    if (activeStepIndex.value !== 2) return
    if (!shouldRecordNoSlotObservation({
      canLoad: canLoadSlots.value,
      isClosedDate: isSelectedDateClosed.value,
      loadedKey: loadedSlotsKey.value,
      requestKey: slotsKey.value,
      pending: slotsPending.value,
      hasError: Boolean(slotsError.value),
      slotCount: visibleSlots.value.length,
    })) return

    recordReachedMasterStep(
      selectedMasterId.value!,
      selectedServiceIds.value[0],
    )
    bookingFunnel.recordInBackground('no_slot', {
      masterId: selectedMasterId.value,
      serviceId: selectedServiceIds.value[0],
      serviceIds: selectedServiceIds.value,
      targetDate: selectedDate.value,
      durationMinutes: selectedDurationMinutes.value,
    })
  },
  { immediate: true },
)

watch(
  [loadedSlotsKey, slotsPending, slotsError, visibleSlots, selectedDate],
  () => {
    if (
      !canLoadSlots.value
      || isSelectedDateClosed.value
      || loadedSlotsKey.value !== slotsKey.value
      || slotsPending.value
      || slotsError.value
      || visibleSlots.value.length
    ) return

    void loadRecoveryAlternatives()
  },
  { immediate: true },
)

const dateLocale = computed(() => locale.value === 'en' ? 'en-US' : 'uk-UA')

const bookingTimeLabels = computed(() => locale.value === 'en'
  ? {
      chooseMaster: 'Choose barber',
      chooseTime: 'Choose time',
      contact: 'Contact details',
      date: 'Date',
      next: 'Next',
      slotsError: 'Unable to load times.',
      slotsPending: 'Searching available times...',
    }
  : {
      chooseMaster: 'Обрати майстра',
      chooseTime: 'Обрати час',
      contact: 'До контактів',
      date: 'Дата',
      next: 'Далі',
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

const formatRecoveryDate = (value: string) =>
  new Intl.DateTimeFormat(dateLocale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(`${value}T12:00:00+03:00`))

const alternativeMasterPhoto = (slot: BookingAlternativeSlotDto) =>
  masterPhoto(mastersById.value.get(slot.master.id))

const selectedSlot = computed(() =>
  visibleSlots.value.find(slot => sameBookingInstant(slot.start_at, selectedSlotStart.value)) || null,
)

const isServiceComplete = computed(() => selectedServiceCount.value > 0)
const isMasterComplete = computed(() => Boolean(selectedMaster.value))
const isTimeComplete = computed(() => Boolean(selectedDate.value && !isSelectedDateClosed.value && selectedSlot.value))
const isContactComplete = computed(() =>
  Boolean(form.customer_name.trim() && isValidPhoneNumber(form.customer_phone)),
)
const firstVisitBookingOffer = computed(() => firstVisitOffers(bookingOffers.value).find(offer =>
  !campaignOfferContext.value &&
  (!selectedMasterId.value ? offer.applies_to_all_masters : offerAppliesToMaster(offer, selectedMasterId.value))
  && (selectedServices.value.length
    ? selectedServices.value.some(service => offerAppliesToService(offer, 'base_service_id' in service && typeof service.base_service_id === 'number' ? service.base_service_id : null))
    : offer.applies_to_all_services),
) || null)
const quoteCopy = computed(() => locale.value === 'en' ? {
  checking: 'Checking eligibility and price…',
  failed: 'We could not verify the price. Check any promo code you entered and try again before booking.',
  subtotal: 'Regular subtotal',
  discount: 'Discount',
  firstVisit: 'First-visit discount',
  total: 'Total',
  customerRequired: 'Enter your contact details to check eligibility.',
  provisional: 'Eligibility is checked across all masters and again when booking. This quote does not reserve the offer.',
  changed: 'The price has changed. Review the updated total before booking.',
  showDetails: 'Discount details',
  hideDetails: 'Hide details',
} : {
  checking: 'Перевіряємо доступність знижки та ціну…',
  failed: 'Не вдалося перевірити ціну. Перевірте введений промокод, якщо він є, та спробуйте ще раз перед записом.',
  subtotal: 'Вартість без знижки',
  discount: 'Знижка',
  firstVisit: 'Знижка на перший візит',
  total: 'До сплати',
  customerRequired: 'Вкажіть контактні дані для перевірки доступності знижки.',
  provisional: 'Право на знижку перевіряється серед усіх майстрів і повторно під час запису. Розрахунок не резервує пропозицію.',
  changed: 'Ціна змінилася. Перегляньте оновлену суму перед записом.',
  showDetails: 'Деталі знижки',
  hideDetails: 'Сховати деталі',
})
const quoteReview = shallowRef<QuoteReviewState>({
  quote: null, pending: false, failed: false, accepted: false, changed: false,
})
const campaignOfferErrorMessage = (code: string | null) => {
  if (!code || !campaignOfferContext.value) return quoteCopy.value.failed
  if (code === 'offer_identity_or_master_mismatch') return locale.value === 'en'
    ? 'This offer does not match these contact details or the selected master. Choose a regular booking to continue.'
    : 'Ця пропозиція не відповідає контактним даним або обраному майстру. Щоб продовжити, оберіть звичайний запис.'
  if (code === 'offer_visit_outside_validity' || code === 'offer_expired_or_not_started') return locale.value === 'en'
    ? 'The selected time is outside the offer period. Choose another time or continue at the regular price.'
    : 'Обраний час поза терміном дії пропозиції. Оберіть інший час або продовжіть за звичайною ціною.'
  if (code.startsWith('offer_') || ['audience_no_longer_eligible', 'future_booking'].includes(code)) return locale.value === 'en'
    ? 'This offer is no longer available for this booking. You can continue at the regular price.'
    : 'Ця пропозиція більше недоступна для цього запису. Ви можете продовжити за звичайною ціною.'
  return quoteCopy.value.failed
}
const quoteController = createBookingQuoteReview(
  payload => quoteApi<BookingQuote>('/public/bookings/quote', { method: 'POST', body: payload }),
  next => { quoteReview.value = next },
)
const quotePayload = computed<BookingQuoteRequest | null>(() =>
  selectedMasterId.value && selectedServiceIds.value.length && selectedSlotStart.value && isContactComplete.value
    ? { master_id: selectedMasterId.value, service_ids: [...selectedServiceIds.value],
        start_at: selectedSlotStart.value, customer_phone: formatPhoneForSubmit(form.customer_phone),
        promotion_code: effectiveCampaignOfferToken.value ? null : effectivePromotionCode.value || null,
        offer_token: effectiveCampaignOfferToken.value }
    : null,
)
const quoteInputKey = computed(() => JSON.stringify(quotePayload.value))
let quoteTimer: ReturnType<typeof setTimeout> | null = null
const verifyPrice = async () => {
  if (quoteTimer) clearTimeout(quoteTimer)
  const payload = quotePayload.value
  if (!payload) return false
  return quoteController.verify(payload)
}
watch([quoteInputKey, () => JSON.stringify(bookingOffers.value)], () => {
  if (quoteTimer) clearTimeout(quoteTimer)
  quoteController.invalidate()
  if (quotePayload.value) quoteTimer = setTimeout(() => { void verifyPrice() }, 400)
}, { flush: 'sync', immediate: true })
onBeforeUnmount(() => {
  if (quoteTimer) clearTimeout(quoteTimer)
  quoteController.invalidate()
})
const quoteDetailsOpen = ref(false)
watch(
  () => [quoteReview.value.quote, quoteReview.value.changed] as const,
  ([quote, changed], [previousQuote]) => {
    if (changed) quoteDetailsOpen.value = true
    else if (quote !== previousQuote) quoteDetailsOpen.value = false
  },
)
const quoteDiscountLabel = computed(() => {
  const promotion = quoteReview.value.quote?.applied_promotion
  if (!promotion) return quoteCopy.value.discount
  const label = promotion.eligibility_type === 'first_visit'
    ? quoteCopy.value.firstVisit
    : (locale.value === 'en' ? promotion.name_en : promotion.name_uk)
  return label
})
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
const canConfirmBooking = computed(() => canSubmit.value
  && Boolean(quoteReview.value.quote)
  && !quoteReview.value.pending
  && !quoteReview.value.failed
  && quoteReview.value.quote?.eligibility.status !== 'customer_required')
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

const syncAutofilledContact = () => {
  if (contactNameInput.value && contactNameInput.value.value !== form.customer_name) {
    form.customer_name = constrainFormInput(contactNameInput.value.value, FORM_FIELD_LIMITS.fullName)
  }
  if (contactPhoneInput.value && contactPhoneInput.value.value !== form.customer_phone) {
    form.customer_phone = formatPhoneInput(contactPhoneInput.value.value)
  }
}

const handleContactAutofill = (event: AnimationEvent) => {
  if (event.animationName === 'booking-contact-autofill') syncAutofilledContact()
}

const handlePhonePasteEvent = (event: ClipboardEvent) => {
  handlePhonePaste(event, value => {
    form.customer_phone = value
  })
}

const handleWaitlistPhonePaste = (event: ClipboardEvent) => {
  handlePhonePaste(event, value => {
    waitlistForm.customer_phone = value
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

const resetBookingFlow = async (customer: SavedBookingCustomer | null = null) => {
  dateExplicitlySelected.value = false
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
  applySavedBookingCustomer(customer)
  promotionConfirmed.value = false
  activeStepIndex.value = 0
  submitAttempted.value = false
  actionAttemptedStepIndex.value = null
  bookingFunnel.reset()
  await nextTick()
  isResettingAfterSubmit.value = false
}

const errorMessage = (error: unknown) => {
  const status = (error as { response?: { status?: number }, status?: number })?.response?.status
    || (error as { status?: number })?.status

  if (isCampaignOfferError(error)) return campaignOfferErrorMessage(bookingErrorCode(error))
  if (status === 409 && isPromotionConflict(error)) return quoteCopy.value.changed
  if (status === 409) {
    return locale.value === 'en'
      ? 'That time has just been taken. We refreshed the available times so you can choose another one.'
      : 'Цей час вже зайнятий. Ми оновили доступні слоти, щоб ви могли обрати інший.'
  }
  if (status === 400) {
    return locale.value === 'en'
      ? 'Please check the booking details: the time must be in the future and within working hours.'
      : 'Перевірте дані запису: час має бути майбутнім і в межах робочих годин.'
  }
  return terms.value.pages.contacts.error
}

const submit = async () => {
  if (state.loading || quoteReview.value.pending) return
  submitAttempted.value = true

  if (!canSubmit.value || !selectedMasterId.value || !selectedServiceIds.value.length || !selectedSlotStart.value) {
    goToStep(firstIncompleteStepIndex.value)
    return
  }

  const reviewedInput = quoteInputKey.value
  quoteController.accept(true)
  if (!await verifyPrice() || reviewedInput !== quoteInputKey.value) {
    goToStep(lastStepIndex.value)
    return
  }
  const expectedTotalAmount = quoteController.approvedTotal()
  if (expectedTotalAmount === null) return

  state.loading = true
  state.success = ''
  state.error = ''
  state.browserSessionCreated = false
  trackEvent('booking_submit', {
    source: props.analyticsSource,
    master_id: selectedMasterId.value,
    appointment_date: selectedDate.value,
    appointment_hour: formatTime(selectedSlotStart.value),
    service_count: selectedServiceIds.value.length,
    duration_minutes: selectedDurationMinutes.value,
  })
  const selectedFromAlternative = recoverySelection.value?.masterId === selectedMasterId.value
    && sameBookingInstant(recoverySelection.value?.startAt, selectedSlotStart.value)

  try {
    const funnelSessionId = bookingFunnel.sessionId()
    recordReachedMasterStep(selectedMasterId.value, selectedServiceIds.value[0])
    bookingFunnel.recordInBackground('slot_selected', {
      masterId: selectedMasterId.value,
      serviceId: selectedServiceIds.value[0],
    })
    bookingFunnel.recordInBackground('contact_entered', {
      masterId: selectedMasterId.value,
      serviceId: selectedServiceIds.value[0],
    })
    const bookedMasterName = masterName(selectedMaster.value)
    const bookedStartAt = selectedSlotStart.value
    const bookedServiceNames = selectedServices.value.map(serviceName)
    const bookedDurationMinutes = selectedDurationMinutes.value
    const bookedCustomer = {
      name: constrainFormInput(form.customer_name, FORM_FIELD_LIMITS.fullName).trim(),
      phone: formatPhoneForSubmit(form.customer_phone),
    }
    const customerComment = sanitizeFormText(form.customer_comment, FORM_FIELD_LIMITS.comment)
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
    const submittedOfferToken = effectiveCampaignOfferToken.value
    const bookingResult = await domain.createBooking({
      expected_total_amount: expectedTotalAmount,
      master_id: selectedMasterId.value,
      service_id: selectedServiceIds.value[0],
      service_ids: selectedServiceIds.value,
      duration_minutes: selectedDurationMinutes.value,
      customer_name: sanitizeFormText(bookedCustomer.name, FORM_FIELD_LIMITS.fullName),
      customer_phone: bookedCustomer.phone,
      customer_comment: bookingComment,
      promotion_code: effectiveCampaignOfferToken.value ? null : effectivePromotionCode.value || null,
      offer_token: submittedOfferToken,
      start_at: selectedSlotStart.value,
      funnel_session_id: funnelSessionId,
      ...(selectedFromAlternative ? { recovery_source: 'alternative' as const, recovery_search_context_id: recoverySelection.value?.searchContextId, recovery_offer_id: recoverySelection.value?.offerId } : {}),
    }, props.repeatBookingToken || undefined)

    if (submittedOfferToken) {
      campaignOfferBooked.value = true
      try { clearCampaignOffer(window.sessionStorage) }
      catch { /* The completed booking remains valid. */ }
      capturedCampaignOfferToken.value = null
      capturedCampaignOfferEventId.value = ''
    }

    persistBookingCustomer(bookedCustomer)
    await resetBookingFlow(bookedCustomer)
    await refreshSlots()
    state.successTotal = bookingResult.booking.total_amount ?? null
    state.successMasterName = bookedMasterName
    state.successStartAt = bookedStartAt
    state.successServiceNames = bookedServiceNames
    state.successDurationMinutes = bookedDurationMinutes
    state.browserSessionCreated = bookingResult.browserSessionCreated
    state.success = terms.value.home.booking.successLabel
    trackEvent('booking_success', bookingEventParams)
  }
  catch (error) {
    state.error = errorMessage(error)
    const status = (error as { response?: { status?: number }, status?: number })?.response?.status
      || (error as { status?: number })?.status
    const funnelFailureEvent = bookingFunnelFailureEvent(status)
    if (funnelFailureEvent) {
      bookingFunnel.recordInBackground(funnelFailureEvent, {
        masterId: selectedMasterId.value,
        serviceId: selectedServiceIds.value[0],
      })
    }
    if (status === 409 && isPromotionConflict(error)) {
      quoteController.invalidate()
      await verifyPrice()
      goToStep(lastStepIndex.value)
    }
    else if (isCampaignOfferError(error)) {
      quoteController.invalidate()
      await verifyPrice()
      goToStep(lastStepIndex.value)
    }
    else if (status === 409) {
      selectedSlotStart.value = ''
      await refreshSlots()
      goToStep(2)
      if (selectedFromAlternative) recovery.stale = recoveryCopy.value.stale
    }
    trackEvent(
      funnelFailureEvent === 'booking_error' ? 'booking_error' : 'booking_submit_failed',
      {
        source: props.analyticsSource,
        master_id: selectedMasterId.value,
        appointment_date: selectedDate.value,
        reason: status === 409 ? 'slot_conflict' : funnelFailureEvent ? 'technical' : 'validation',
        status_code: Number.isInteger(status) ? status : undefined,
      },
    )
    if (!campaignOfferToken.value) console.error(error)
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
  state.successTotal = null
  state.successMasterName = ''
  state.successStartAt = ''
  state.successServiceNames = []
  state.successDurationMinutes = 0
  state.browserSessionCreated = false
}

const trackGoogleCalendarClick = () => {
  trackEvent('booking_calendar_click', {
    source: props.analyticsSource,
    channel: 'web',
    message_type: 'booking_success',
  })
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
              <p class="mt-4 text-sm leading-6 text-white/65 md:mt-6 md:text-base md:leading-8">
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
          class="booking-form relative scroll-mt-24 overflow-hidden bg-transparent sm:bg-white/[0.03] lg:scroll-mt-28"
          :class="isDrawerMode ? 'booking-form--drawer flex-1' : 'booking-form--section self-start p-2'"
          :data-reveal="isDrawerMode ? undefined : 'soft'"
          :data-reveal-delay="isDrawerMode ? undefined : '140'"
          @submit.prevent="submit"
        >
          <div v-if="campaignOfferContext && !campaignOfferBooked" class="mx-2 mb-3 rounded-lg border border-amber-300/45 bg-amber-300/10 p-3 text-sm text-white lg:m-3" data-campaign-offer>
            <p class="font-semibold">{{ locale === 'en' ? campaignOfferContext.name_en : campaignOfferContext.name_uk }}<span v-if="effectiveCampaignOfferToken"> · −{{ campaignOfferContext.discount_percent }}%</span></p>
            <p class="mt-1 text-white/85">{{ locale === 'en' ? 'Master:' : 'Майстер:' }} {{ campaignOfferMasterName }}</p>
            <p class="mt-1 text-white/75">{{ locale === 'en' ? 'Eligible services:' : 'Послуги за пропозицією:' }} {{ campaignOfferServiceNames.join(', ') }}</p>
            <p class="mt-1 text-white/75">{{ locale === 'en' ? 'Valid until:' : 'Діє до:' }} {{ campaignOfferExpiry }}</p>
            <p v-if="!effectiveCampaignOfferToken" class="mt-2 text-amber-100" role="status">{{ locale === 'en' ? 'The selected master or services are outside this offer. Your price will be checked as a regular booking.' : 'Обраний майстер або послуги не входять до пропозиції. Ціну буде перевірено як для звичайного запису.' }}</p>
            <button type="button" class="mt-2 font-semibold underline underline-offset-4" @click="continueRegularBooking">{{ locale === 'en' ? 'Continue with a regular booking' : 'Продовжити звичайний запис' }}</button>
          </div>
          <BookingPromotionNotice
            v-if="firstVisitBookingOffer && activeStepIndex !== lastStepIndex"
            :offer="firstVisitBookingOffer"
            compact
            mobile-tight
            class="mx-2 my-0 text-white lg:m-3"
          />
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
            class="booking-step-panel scroll-mt-28 px-2 pb-2 sm:px-3 sm:pb-3"
            :class="`booking-step-panel--${activeStepKey}`"
          >
            <div>
              <div class="booking-step-content">
                <AppTransition>
                  <section v-if="activeStepIndex === 0" key="booking-service" class="booking-service-step">
                    <label class="booking-service-search-field glass-control glass-control--dark flex items-center gap-2 px-3 py-2.5 text-white/70 focus-within:text-white">
                      <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="m14.2 14.2 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                        <path d="M8.8 15.1a6.3 6.3 0 1 0 0-12.6 6.3 6.3 0 0 0 0 12.6Z" stroke="currentColor" stroke-width="1.6" />
                      </svg>
                      <input
                        v-model="serviceSearchQuery"
                        type="search"
                        :placeholder="serviceSearchPlaceholder"
                        :aria-label="serviceSearchLabels.placeholder"
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
                          <article
                            v-for="service in filteredActiveServices"
                            :key="serviceKey(service)"
                            class="booking-service__item relative isolate flex min-h-24 w-full flex-col justify-between overflow-visible bg-white/[0.045] p-2 text-left transition hover:bg-white/[0.075] hover:text-white sm:min-h-32 sm:p-2.5"
                            :class="[
                              serviceHasMilitaryPromotion(service) ? 'is-army-service' : '',
                              serviceSelected(service) ? 'bg-white/[0.09] text-white' : 'text-white/72',
                              serviceSelectionLimitReached && !serviceSelected(service) ? 'cursor-not-allowed opacity-45' : '',
                            ]"
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
                            <button
                              type="button"
                              class="relative isolate flex w-full flex-1 flex-col justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700/60"
                              :disabled="serviceSelectionLimitReached && !serviceSelected(service)"
                              :aria-pressed="serviceSelected(service)"
                              @click="selectService(service)"
                            >
                            <span class="relative z-10">
                              <span class="flex items-center gap-2 text-sm font-semibold leading-snug sm:text-base">
                                <span class="min-w-0">{{ serviceName(service) }}</span>
                              </span>
                              <span class="sr-only">{{ serviceSelected(service) ? terms.home.booking.selected : terms.home.booking.continue }}</span>
                              <span
                                class="mt-1 hidden text-xs leading-5 sm:block"
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
                            </button>
                            <ServiceDescriptionAccordion
                              class="relative z-10 mt-1 sm:hidden"
                              :description="serviceDescription(service)"
                              theme="dark"
                            />
                            <span
                              v-if="serviceHasMilitaryPromotion(service)"
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
                          </article>
                          <p v-if="servicesPending" class="text-sm text-white/55 sm:col-span-2 xl:col-span-3">{{ terms.home.services.loading }}</p>
                          <p v-else-if="!activeServices.length" class="text-sm text-white/55 sm:col-span-2 xl:col-span-3">{{ terms.home.services.empty }}</p>
                          <p v-else-if="!filteredActiveServices.length" class="text-sm text-white/55 sm:col-span-2 xl:col-span-3">{{ serviceSearchLabels.noResults }}</p>
                        </div>
                      </Transition>
                    </div>
                  </section>

                  <section v-else-if="activeStepIndex === 1" key="booking-master">
                  <div class="grid grid-cols-2 gap-1">
                    <button
                      v-for="master in availableMasters"
                      :key="master.id"
                      type="button"
                      class="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2 px-2 py-1 text-left transition sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-4 sm:p-3"
                      :class="selectedMasterId === master.id ? 'bg-white text-neutral-950' : 'text-white/75 hover:text-white'"
                      @click="selectMaster(master.id)"
                    >
                      <img :src="masterPhoto(master)" :alt="masterName(master)" class="h-16 w-16 object-cover object-top sm:h-20 sm:w-20">
                      <div class="min-w-0 self-center">
                        <span class="block text-[0.6875rem] font-semibold leading-4">{{ masterName(master) }}</span>
                        <span class="mt-0.5 block text-[0.625rem] leading-4 opacity-70">{{ masterPosition(master) }}</span>
                      </div>
                      <MasterRatingBlock
                        :master-id="master.id"
                        :tone="selectedMasterId === master.id ? 'light' : 'dark'"
                        :show-summary-details="false"
                        :review-limit="2"
                        show-review-count
                        show-reviews
                        hide-empty
                        class="booking-master-rating col-span-2 mt-1"
                      />
                    </button>
                    <p v-if="mastersPending" class="text-sm text-white/55">Завантажуємо майстрів...</p>
                    <p v-else-if="!availableMasters.length" class="text-sm text-white/55">Для цієї послуги немає доступних майстрів.</p>
                  </div>
                </section>

                <section v-else-if="activeStepIndex === 2" key="booking-time" class="booking-time-step grid gap-4 md:grid-cols-[18rem_1fr] md:gap-5">
                  <div class="booking-date-control">
                    <BookingDatePicker
                      :model-value="selectedDate"
                      :availability="dateAvailability"
                      @update:model-value="selectBookingDate"
                      :min="today"
                      :max="maxBookableDate"
                      :locale="locale"
                      :disabled-weekdays="closedWeekdays"
                      :inline="isDrawerMode"
                    />
                    <button v-if="nearestAvailableDate" type="button" class="mt-3 text-sm underline" @click="selectBookingDate(nearestAvailableDate)">
                      {{ locale === 'en' ? 'Nearest available date:' : 'Найближча вільна дата:' }} {{ nearestAvailableDate }}
                    </button>
                    <button v-if="Object.values(dateAvailability).includes('error')" type="button" class="mt-3 text-sm underline" @click="loadDateAvailability">
                      {{ locale === 'en' ? 'Retry calendar availability' : 'Повторити перевірку календаря' }}
                    </button>
                  </div>

                  <div class="booking-slots-column">
                    <p v-if="recovery.stale" class="text-sm text-amber-100" role="alert">{{ recovery.stale }}</p>
                    <div v-if="visibleSlots.length" class="booking-slots-grid grid grid-cols-3 gap-2">
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
                    <p v-else-if="slotsPending" role="status" class="mt-4 text-sm text-white/55">{{ bookingTimeLabels.slotsPending }}</p>
                    <div v-else-if="slotsError" class="mt-4 text-sm text-rose-200" role="alert">
                      <p>{{ bookingTimeLabels.slotsError }}</p>
                      <button type="button" class="mt-2 underline" @click="refreshSlots">{{ locale === 'en' ? 'Try again' : 'Спробувати ще раз' }}</button>
                    </div>
                    <div
                      v-else-if="!visibleSlots.length"
                      class="booking-recovery"
                      role="region"
                      :aria-label="recoveryCopy.title"
                    >
                      <div class="flex items-start gap-2">
                        <span class="mt-0.5 flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-stone-100 p-[1px] text-neutral-950" aria-hidden="true">
                          <FeedbackFace
                            name="sad-droopy-face"
                            class="h-[2.4rem] w-[2.4rem]"
                            style="--feedback-face-cutout: #f5f5f4"
                          />
                        </span>
                        <div class="min-w-0">
                          <p class="text-xs font-semibold leading-4 text-white">{{ recoveryCopy.title }}</p>
                          <p class="text-[11px] leading-[1.35] text-white/65">{{ recoveryCopy.description }}</p>
                        </div>
                      </div>
                      <p v-if="recovery.loading" role="status" class="mt-3 text-sm text-white/55">{{ recoveryCopy.loading }}</p>
                      <div v-else-if="recovery.error" class="mt-3 text-sm text-rose-200" role="alert">
                        <p>{{ recovery.error }}</p>
                        <button type="button" class="mt-2 underline" @click="loadRecoveryAlternatives(true)">{{ locale === 'en' ? 'Try again' : 'Спробувати ще раз' }}</button>
                      </div>
                      <button v-if="hasMoreAlternatives && !showAllAlternatives" type="button" class="mt-3 underline" @click="loadMoreAlternatives">{{ locale === 'en' ? 'Show all times' : 'Показати весь час' }}</button>

                      <section v-if="sameMasterAlternatives.length" class="mt-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                          {{ recoveryCopy.sameMaster(sameMasterAlternatives[0].master.name) }}
                        </p>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <button
                            v-for="slot in sameMasterAlternatives"
                            v-recovery-impression="slot"
                            :key="`${recovery.searchContextId}-${slot.offer_id || slot.start_at}`"
                            type="button"
                            class="bg-white/[0.055] px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            :disabled="recovery.loading || selectingAlternative"
                            :data-offer-id="slot.offer_id"
                            @click="selectRecoveryAlternative(slot)"
                          >
                            <span class="block">{{ formatRecoveryDate(slot.date) }}</span>
                            <span class="mt-0.5 block text-xs opacity-70">{{ formatTime(slot.start_at) }} · {{ recoveryCopy.duration(slot.duration_minutes) }} · {{ slot.price }} ₴</span>
                          </button>
                        </div>
                      </section>

                      <section v-if="sameDayOtherMasterAlternatives.length" class="mt-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">{{ recoveryCopy.otherMasters }}</p>
                        <p v-if="campaignOfferContext" class="mt-1 text-xs text-amber-100">{{ locale === 'en' ? 'Choosing another master may change the offer price. We will check the new total before booking.' : 'Вибір іншого майстра може змінити ціну за пропозицією. Перед записом перевіримо нову суму.' }}</p>
                        <div class="mt-2 grid gap-2">
                          <button
                            v-for="slot in sameDayOtherMasterAlternatives"
                            v-recovery-impression="slot"
                            :key="`${recovery.searchContextId}-${slot.offer_id || slot.start_at}`"
                            type="button"
                            class="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 bg-white/[0.045] p-2.5 text-left transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            :disabled="recovery.loading || selectingAlternative"
                            :data-offer-id="slot.offer_id"
                            @click="selectRecoveryAlternative(slot)"
                          >
                            <img :src="alternativeMasterPhoto(slot)" :alt="slot.master.name" class="h-14 w-14 object-cover object-top">
                            <span class="min-w-0">
                              <span class="block truncate text-sm font-semibold text-white">{{ slot.master.name }}</span>
                              <span v-if="slot.master.role" class="block truncate text-xs text-white/60">{{ slot.master.role }}</span>
                              <span v-if="slot.master.rating_summary !== null" class="block text-xs text-white/60">{{ recoveryCopy.rating(slot.master.rating_summary) }}</span>
                            </span>
                            <span class="text-right text-sm font-semibold text-white">
                              <span class="block">{{ formatTime(slot.start_at) }}</span>
                              <span class="mt-0.5 block text-xs font-normal text-white/60">{{ recoveryCopy.duration(slot.duration_minutes) }} · {{ slot.price }} ₴</span>
                            </span>
                            <span v-if="alternativeChanges(slot)" class="col-span-3 text-xs text-amber-100">{{ alternativeChanges(slot) }}</span>
                          </button>
                        </div>
                      </section>

                      <section v-if="nearbyDateAlternatives.length" class="mt-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">{{ recoveryCopy.otherDates }}</p>
                        <div class="mt-2 grid gap-2 sm:grid-cols-2">
                          <button
                            v-for="slot in nearbyDateAlternatives"
                            v-recovery-impression="slot"
                            :key="`${recovery.searchContextId}-${slot.offer_id || slot.start_at}`"
                            type="button"
                            class="bg-white/[0.045] p-2.5 text-left transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            :disabled="recovery.loading || selectingAlternative"
                            :data-offer-id="slot.offer_id"
                            @click="selectRecoveryAlternative(slot)"
                          >
                            <span class="block text-sm font-semibold text-white">{{ formatRecoveryDate(slot.date) }} · {{ formatTime(slot.start_at) }}</span>
                            <span class="mt-1 block text-xs text-white/60">{{ slot.master.name }} · {{ recoveryCopy.duration(slot.duration_minutes) }} · {{ slot.price }} ₴</span>
                            <span v-if="alternativeChanges(slot)" class="mt-1 block text-xs text-amber-100">{{ alternativeChanges(slot) }}</span>
                          </button>
                        </div>
                      </section>

                      <button v-if="showAllAlternatives && recovery.nextOffset !== null" type="button" class="mt-3 underline" :disabled="recovery.pageLoading" @click="loadMoreAlternatives">
                        {{ recovery.pageLoading ? (locale === 'en' ? 'Loading…' : 'Завантажуємо…') : (locale === 'en' ? 'More times' : 'Ще варіанти часу') }}
                      </button>
                      <div class="mt-2 grid grid-cols-2 gap-1.5 sm:mt-4 sm:flex sm:flex-wrap sm:gap-2">
                        <BaseButton type="button" variant="light" size="sm" class="booking-recovery-action w-full sm:w-auto" :disabled="recovery.loading || selectingAlternative" @click="openWaitlist">
                          <span class="text-[0.85em] leading-none" aria-hidden="true">🔔</span>
                          {{ recoveryCopy.waitlist }}
                        </BaseButton>
                        <BaseButton type="button" variant="outline-light" size="sm" class="booking-recovery-action w-full sm:w-auto" @click="goToStep(1)">
                          {{ recoveryCopy.chooseAnother }}
                        </BaseButton>
                      </div>
                    </div>
                  </div>
                </section>

                <section v-else key="booking-contact" @focusin="syncAutofilledContact" @focusout="syncAutofilledContact">
                  <div class="grid gap-3 md:grid-cols-2">
                    <div class="booking-contact-field">
                      <svg class="booking-contact-field__icon" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.15288 4.98124 7.54738 6.49373 7.98351C5.2997 8.12901 4.27557 8.55134 3.50407 9.31167C2.52216 10.2794 2.02502 11.72 2.02502 13.5999C2.02502 13.8623 2.23769 14.0749 2.50002 14.0749C2.76236 14.0749 2.97502 13.8623 2.97502 13.5999C2.97502 11.8799 3.42786 10.7206 4.17091 9.9883C4.91536 9.25463 6.02674 8.87499 7.49995 8.87499C8.97317 8.87499 10.0846 9.25463 10.8291 9.98831C11.5721 10.7206 12.025 11.8799 12.025 13.5999C12.025 13.8623 12.2376 14.0749 12.5 14.0749C12.7623 14.075 12.975 13.8623 12.975 13.6C12.975 11.72 12.4778 10.2794 11.4959 9.31166C10.7244 8.55135 9.70025 8.12903 8.50625 7.98352C10.0187 7.5474 11.125 6.15289 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM4.825 4.5C4.825 3.02264 6.02264 1.825 7.5 1.825C8.97736 1.825 10.175 3.02264 10.175 4.5C10.175 5.97736 8.97736 7.175 7.5 7.175C6.02264 7.175 4.825 5.97736 4.825 4.5Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                      </svg>
                      <input
                        v-model="form.customer_name"
                        ref="contactNameInput"
                        required
                        autocomplete="name"
                        :placeholder="recoveryCopy.name"
                        :aria-label="recoveryCopy.name"
                        minlength="2"
                        :maxlength="FORM_FIELD_LIMITS.fullName"
                        class="glass-control glass-control--dark booking-contact-field__input py-2.5 pr-3 text-white outline-none placeholder:text-white/35"
                        :class="shouldShowStepIssue(3) && !form.customer_name.trim() ? 'glass-control--invalid' : ''"
                        @input="handleTextInput('customer_name', FORM_FIELD_LIMITS.fullName)"
                        @change="syncAutofilledContact"
                        @animationstart="handleContactAutofill"
                      >
                    </div>
                    <div class="booking-contact-field">
                      <svg class="booking-contact-field__icon" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M4 2.5C4 2.22386 4.22386 2 4.5 2H10.5C10.7761 2 11 2.22386 11 2.5V12.5C11 12.7761 10.7761 13 10.5 13H4.5C4.22386 13 4 12.7761 4 12.5V2.5ZM4.5 1C3.67157 1 3 1.67157 3 2.5V12.5C3 13.3284 3.67157 14 4.5 14H10.5C11.3284 14 12 13.3284 12 12.5V2.5C12 1.67157 11.3284 1 10.5 1H4.5ZM6 11.65C5.8067 11.65 5.65 11.8067 5.65 12C5.65 12.1933 5.8067 12.35 6 12.35H9C9.1933 12.35 9.35 12.1933 9.35 12C9.35 11.8067 9.1933 11.65 9 11.65H6Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                      </svg>
                      <input
                        v-model="form.customer_phone"
                        ref="contactPhoneInput"
                        required
                        type="tel"
                        inputmode="tel"
                        autocomplete="tel"
                        :placeholder="recoveryCopy.phone"
                        :aria-label="recoveryCopy.phone"
                        maxlength="17"
                        pattern="\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}"
                        class="glass-control glass-control--dark booking-contact-field__input py-2.5 pr-3 text-white outline-none placeholder:text-white/35"
                        :class="shouldShowStepIssue(3) && !isValidPhoneNumber(form.customer_phone) ? 'glass-control--invalid' : ''"
                        @input="handlePhoneInput"
                        @change="syncAutofilledContact"
                        @animationstart="handleContactAutofill"
                        @paste="handlePhonePasteEvent"
                      >
                    </div>
                  </div>
                  <div class="booking-contact-field mt-3">
                    <svg class="booking-contact-field__icon" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M3.94993 2.95002L3.94993 4.49998C3.94993 4.74851 3.74845 4.94998 3.49993 4.94998C3.2514 4.94998 3.04993 4.74851 3.04993 4.49998V2.50004C3.04993 2.45246 3.05731 2.40661 3.07099 2.36357C3.12878 2.18175 3.29897 2.05002 3.49993 2.05002H11.4999C11.6553 2.05002 11.7922 2.12872 11.8731 2.24842C11.9216 2.32024 11.9499 2.40682 11.9499 2.50002L11.9499 2.50004V4.49998C11.9499 4.74851 11.7485 4.94998 11.4999 4.94998C11.2514 4.94998 11.0499 4.74851 11.0499 4.49998V2.95002H8.04993V12.05H9.25428C9.50281 12.05 9.70428 12.2515 9.70428 12.5C9.70428 12.7486 9.50281 12.95 9.25428 12.95H5.75428C5.50575 12.95 5.30428 12.7486 5.30428 12.5C5.30428 12.2515 5.50575 12.05 5.75428 12.05H6.94993V2.95002H3.94993Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                    </svg>
                    <input
                      v-model="form.customer_comment"
                      type="text"
                      autocomplete="off"
                      :placeholder="locale === 'en' ? 'Comment' : 'Коментар'"
                      :aria-label="locale === 'en' ? 'Comment' : 'Коментар'"
                      :maxlength="FORM_FIELD_LIMITS.comment"
                      class="glass-control glass-control--dark booking-contact-field__input py-2.5 pr-3 text-white outline-none placeholder:text-white/35"
                      @input="handleTextInput('customer_comment', FORM_FIELD_LIMITS.comment)"
                    >
                  </div>
                  <div class="booking-contact-field mt-3">
                    <span class="booking-contact-field__icon booking-contact-field__icon--emoji" aria-hidden="true">🎁</span>
                    <input
                      v-model="form.promotion_code"
                      autocomplete="off"
                      inputmode="text"
                      :placeholder="locale === 'en' ? 'Promo code' : 'Промокод'"
                      :aria-label="locale === 'en' ? 'Promo code' : 'Промокод'"
                      maxlength="50"
                      class="glass-control glass-control--dark booking-contact-field__input py-2.5 pr-3 text-white uppercase outline-none placeholder:normal-case placeholder:text-white/35"
                      @input="handleTextInput('promotion_code', 50)"
                    >
                  </div>
                  <label
                    v-if="selectedServicesHavePromotion"
                    class="glass-control glass-control--dark booking-army-toggle mt-3 flex cursor-pointer items-center justify-between gap-3 overflow-hidden px-3 py-2.5 text-white"
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
                        <span class="block text-sm font-semibold leading-tight">{{ promotionDiscountLabels.title }}</span>
                        <span class="mt-0.5 block line-clamp-2 text-[0.68rem] leading-4 text-white/68">{{ promotionDiscountLabels.description }}</span>
                      </span>
                    </span>
                    <span class="flex shrink-0 items-center">
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

              <AppTransition name="booking-quote-panel" mode="default" appear>
              <section
                v-if="activeStepIndex === lastStepIndex && isContactComplete"
                class="booking-price-review mt-3 p-3 text-sm text-white sm:mt-4 sm:p-4"
                :class="quoteReview.quote?.applied_promotion ? 'booking-price-review--promotion' : ''"
                aria-live="polite"
                aria-atomic="true"
                :aria-busy="quoteReview.pending || (!quoteReview.quote && !quoteReview.failed)"
              >
                <Transition name="booking-quote-state" mode="out-in">
                <div v-if="quoteReview.failed" key="failed" role="alert" class="space-y-2 text-rose-200">
                  <p>{{ campaignOfferErrorMessage(quoteReview.errorCode || null) }}</p>
                  <button type="button" class="underline underline-offset-4" @click="verifyPrice">
                    {{ locale === 'en' ? 'Check price again' : 'Перевірити ціну знову' }}
                  </button>
                </div>
                <div v-else-if="!quoteReview.quote" key="checking" role="status">
                  <p>{{ quoteCopy.checking }}</p>
                </div>
                <div v-else key="quoted">
                  <p v-if="quoteReview.changed" class="mb-3 font-semibold text-amber-200">{{ quoteCopy.changed }}</p>
                  <p v-if="quoteReview.quote.eligibility.status === 'customer_required'" class="mb-3">{{ quoteCopy.customerRequired }}</p>
                  <Transition name="booking-accordion-appear" appear>
                    <BaseAccordion
                      v-if="quoteReview.quote.applied_promotion"
                      v-model="quoteDetailsOpen"
                      summary-class="w-full items-center gap-3 py-1 text-left focus-visible:ring-2 focus-visible:ring-white/70"
                      content-class="mt-3 bg-black/10 p-3 sm:mt-4 sm:p-4"
                    >
                    <template #summary="{ open }">
                      <span class="flex min-w-0 items-center justify-between gap-3">
                        <span class="min-w-0">
                          <span class="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">{{ open ? quoteCopy.hideDetails : quoteCopy.showDetails }}</span>
                          <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span class="text-base font-semibold sm:text-lg">{{ quoteCopy.total }}</span>
                            <span class="booking-price-discount-badge text-[0.72rem]">−{{ quoteReview.quote.applied_promotion.discount_percent }}%</span>
                          </span>
                        </span>
                        <span class="flex shrink-0 flex-col items-end leading-tight">
                          <span class="sr-only">{{ quoteCopy.subtotal }}: </span>
                          <del class="text-xs font-medium text-white/60 sm:text-sm">{{ localizedService.servicePrice(quoteReview.quote.subtotal_amount) }}</del>
                          <strong class="mt-0.5 text-lg sm:text-xl">{{ localizedService.servicePrice(quoteReview.quote.total_amount) }}</strong>
                        </span>
                      </span>
                    </template>
                    <dl class="space-y-2 text-[0.82rem] sm:text-sm">
                      <div class="flex justify-between gap-4"><dt>{{ quoteCopy.subtotal }}</dt><dd class="shrink-0">{{ localizedService.servicePrice(quoteReview.quote.subtotal_amount) }}</dd></div>
                      <div v-if="quoteReview.quote.applied_promotion" class="flex items-start justify-between gap-4">
                        <dt class="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span>{{ quoteDiscountLabel }}</span>
                          <span
                            v-if="quoteReview.quote.applied_promotion.eligibility_type === 'first_visit'"
                            class="booking-price-discount-badge"
                          >−{{ quoteReview.quote.applied_promotion.discount_percent }}%</span>
                          <span v-else>−{{ quoteReview.quote.applied_promotion.discount_percent }}%</span>
                        </dt>
                        <dd class="shrink-0">−{{ localizedService.servicePrice(quoteReview.quote.discount_amount) }}</dd>
                      </div>
                    </dl>
                    <p v-if="quoteReview.quote.applied_promotion" class="mt-3 text-[0.7rem] leading-4 text-white/70 sm:text-xs sm:leading-5">{{ quoteCopy.provisional }}</p>
                    </BaseAccordion>
                  </Transition>
                  <div v-if="!quoteReview.quote.applied_promotion" class="flex flex-col gap-3 py-1">
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-base font-semibold sm:text-lg">{{ quoteCopy.total }}</span>
                      <strong class="shrink-0 text-lg sm:text-xl">{{ localizedService.servicePrice(quoteReview.quote.total_amount) }}</strong>
                    </div>
                  </div>
                </div>
                </Transition>
              </section>
              </AppTransition>

              <p v-if="activeStepIndex === lastStepIndex" class="mt-3 mb-1 text-[10px] leading-[14px] text-white/55">
                {{ terms.common.bookingConsentPrefix }}
                <NuxtLink class="transition hover:text-white" to="/terms">
                  <BaseHoverUnderlineText>{{ terms.common.termsLinkLabel }}</BaseHoverUnderlineText>
                </NuxtLink>
                {{ terms.common.bookingConsentSuffix }}
              </p>
              <div class="booking-step-actions flex flex-row gap-3 sm:items-center">
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
                  :disabled="state.loading || quoteReview.pending || (activeStepIndex === lastStepIndex && !canConfirmBooking)"
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
            tone="dark"
          >
            <div class="mt-5 grid gap-2.5 text-left sm:mt-6 sm:grid-cols-2 sm:gap-3">
              <div class="bg-white/[0.05] p-3 sm:p-4">
                <p class="type-eyebrow text-xs text-white/45">
                  {{ terms.home.booking.steps[1] }}
                </p>
                <p class="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
                  {{ state.successMasterName }}
                </p>
              </div>
              <div class="bg-white/[0.05] p-3 sm:p-4">
                <p class="type-eyebrow text-xs text-white/45">
                  {{ terms.home.booking.steps[2] }}
                </p>
                <p class="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
                  {{ formatBookingDateTime(state.successStartAt) }}
                </p>
              </div>
            </div>
            <p v-if="state.successTotal !== null" class="mt-4 text-lg font-semibold text-white" role="status">{{ quoteCopy.total }}: {{ localizedService.servicePrice(state.successTotal) }}</p>
            <p v-if="state.browserSessionCreated" class="mt-3 text-sm leading-5 text-white/76 sm:mt-4 sm:leading-6">
              {{ browserSessionHint }}
            </p>
            <p v-if="googleCalendarUrl" class="mt-3 text-sm leading-5 text-white/68 sm:mt-4 sm:leading-6">
              {{ googleCalendarCopy.hint }}
            </p>
            <template #actions>
              <div class="mt-3 grid gap-2 sm:mt-5 sm:flex sm:justify-center sm:gap-3">
                <BaseButton
                  v-if="googleCalendarUrl"
                  :href="googleCalendarUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="light"
                  size="sm"
                  class="booking-success-action"
                  @click="trackGoogleCalendarClick"
                >
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M5 4.5h10a1.5 1.5 0 0 1 1.5 1.5v8.7a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5Z" stroke="currentColor" stroke-width="1.6" />
                    <path d="M6.5 3.8v2.4M13.5 3.8v2.4M3.8 8.1h12.4M10 10v4M8 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  </svg>
                  {{ googleCalendarCopy.action }}
                </BaseButton>
                <BaseButton type="button" variant="outline-light" size="sm" class="booking-success-action" @click="closeSuccess">
                  {{ terms.home.booking.successAction }}
                </BaseButton>
              </div>
            </template>
          </FormStatusOverlay>
        </form>

        <BaseModal
          v-model="waitlistOpen"
          :dialog-label="recoveryCopy.waitlistTitle"
          :close-label="recoveryCopy.close"
          type="right"
        >
          <template #header>
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-neutral-950 text-white" aria-hidden="true">
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none">
                  <path d="M6.2 8.1a3.8 3.8 0 1 1 7.6 0c0 4 1.7 4.5 1.7 4.5h-11S6.2 12.1 6.2 8.1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                  <path d="M8.2 15a2 2 0 0 0 3.6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </span>
              <p class="min-w-0 text-sm font-semibold leading-5 text-neutral-950">{{ recoveryCopy.waitlist }}</p>
            </div>
          </template>

          <form class="mx-auto w-full max-w-xl p-4 pt-5 sm:p-8 sm:pt-6" @submit.prevent="submitWaitlist">
            <h2 class="text-xl font-semibold leading-tight text-neutral-950 sm:text-2xl">{{ recoveryCopy.waitlistTitle }}</h2>
            <p class="mt-2 text-sm leading-5 text-neutral-600 sm:leading-6">{{ recoveryCopy.waitlistDescription }}</p>

            <template v-if="waitlistState === 'form' || waitlistState === 'submitting'">
              <div v-if="waitlistNeedsName || waitlistNeedsPhone" class="mt-5 grid gap-3 sm:grid-cols-2">
                <BaseInput
                  v-if="waitlistNeedsName"
                  v-model="waitlistForm.customer_name"
                  :label="recoveryCopy.name"
                  required
                  autocomplete="name"
                  minlength="2"
                  :maxlength="FORM_FIELD_LIMITS.fullName"
                  @input="waitlistForm.customer_name = constrainFormInput(waitlistForm.customer_name, FORM_FIELD_LIMITS.fullName)"
                >
                  <template #icon>
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="3" stroke="currentColor" stroke-width="1.5" /><path d="M4.8 16c.7-3 2.4-4.5 5.2-4.5s4.5 1.5 5.2 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
                  </template>
                </BaseInput>
                <BaseInput
                  v-if="waitlistNeedsPhone"
                  v-model="waitlistForm.customer_phone"
                  :label="recoveryCopy.phone"
                  required
                  type="tel"
                  phone-mask
                  inputmode="tel"
                  autocomplete="tel"
                  placeholder="+380 __ ___ __ __"
                  maxlength="17"
                  pattern="\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}"
                  @paste="handleWaitlistPhonePaste"
                >
                  <template #icon>
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none"><path d="M6.2 3.5h2l1 3-1.5 1.3a11 11 0 0 0 4.5 4.5l1.3-1.5 3 1v2c0 1.1-.9 2-2 2-5.8 0-10.5-4.7-10.5-10.5 0-1.1.9-2 2-2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
                  </template>
                </BaseInput>
              </div>
              <p v-else class="mt-5 flex items-center gap-2 border border-neutral-200 bg-neutral-50 p-3 text-sm leading-5 text-neutral-600">
                <svg class="h-4 w-4 shrink-0 text-neutral-950" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4.5 10 3.3 3.3 7.7-7.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                {{ recoveryCopy.contactSaved }}
              </p>

              <fieldset class="mt-5">
                <legend class="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="6" r="3" stroke="currentColor" stroke-width="1.5" /><path d="M4.8 16c.7-3 2.4-4.5 5.2-4.5s4.5 1.5 5.2 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
                  {{ recoveryCopy.masterPreference }}
                </legend>
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <BaseRadio v-model="waitlistForm.another_master_acceptable" :name="`${props.idPrefix}-waitlist-master-preference`" :value="false" :label="recoveryCopy.onlyThisMaster">
                    <template #icon><svg class="h-4 w-4" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.2" r="2.7" stroke="currentColor" stroke-width="1.5" /><path d="M5.2 15.7c.7-2.8 2.3-4.2 4.8-4.2s4.1 1.4 4.8 4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg></template>
                  </BaseRadio>
                  <BaseRadio v-model="waitlistForm.another_master_acceptable" :name="`${props.idPrefix}-waitlist-master-preference`" :value="true" :label="recoveryCopy.anotherMaster">
                    <template #icon><svg class="h-4 w-4" viewBox="0 0 20 20" fill="none"><circle cx="7" cy="6.5" r="2.3" stroke="currentColor" stroke-width="1.4" /><circle cx="13.5" cy="7.5" r="1.8" stroke="currentColor" stroke-width="1.4" /><path d="M3.5 15.5c.5-2.7 1.8-4 3.9-4 2.2 0 3.6 1.4 4.1 4M12 12c2.4-.4 3.9.8 4.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg></template>
                  </BaseRadio>
                </div>
              </fieldset>

              <fieldset class="mt-5">
                <legend class="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.5" y="4.5" width="13" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5" /><path d="M6.5 3v3M13.5 3v3M3.8 8h12.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
                  {{ recoveryCopy.datePreference }}
                </legend>
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <BaseRadio v-model="waitlistForm.nearby_dates_acceptable" :name="`${props.idPrefix}-waitlist-date-preference`" :value="false" :label="recoveryCopy.onlyThisDate">
                    <template #icon><svg class="h-4 w-4" viewBox="0 0 20 20" fill="none"><rect x="3.5" y="4.5" width="13" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5" /><path d="M6.5 3v3M13.5 3v3M3.8 8h12.4M10 10.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg></template>
                  </BaseRadio>
                  <BaseRadio v-model="waitlistForm.nearby_dates_acceptable" :name="`${props.idPrefix}-waitlist-date-preference`" :value="true" :label="recoveryCopy.nearbyDates">
                    <template #icon><svg class="h-4 w-4" viewBox="0 0 20 20" fill="none"><rect x="3.5" y="4.5" width="13" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5" /><path d="M6.5 3v3M13.5 3v3M3.8 8h12.4M7 11h1M10 11h1M13 11h1M7 14h1M10 14h1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg></template>
                  </BaseRadio>
                </div>
              </fieldset>

              <BaseCheckbox v-model="waitlistForm.notification_consent" class="mt-5" :label="recoveryCopy.consent" required>
                <template #icon>
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none"><path d="M6.2 8.1a3.8 3.8 0 1 1 7.6 0c0 4 1.7 4.5 1.7 4.5h-11S6.2 12.1 6.2 8.1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /><path d="M8.2 15a2 2 0 0 0 3.6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
                </template>
              </BaseCheckbox>
              <p v-if="waitlistError" class="mt-3 text-sm leading-6 text-rose-700">{{ waitlistError }}</p>
              <div class="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                <BaseButton type="submit" variant="dark" size="sm" :disabled="waitlistState === 'submitting' || !waitlistForm.notification_consent">
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6.2 8.1a3.8 3.8 0 1 1 7.6 0c0 4 1.7 4.5 1.7 4.5h-11S6.2 12.1 6.2 8.1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /><path d="M8.2 15a2 2 0 0 0 3.6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
                  {{ waitlistState === 'submitting' ? recoveryCopy.sending : recoveryCopy.submit }}
                </BaseButton>
                <BaseButton type="button" variant="outline-dark" size="sm" @click="returnToSelection">
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m11.8 5-5 5 5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  {{ recoveryCopy.back }}
                </BaseButton>
              </div>
            </template>

            <div v-else class="mt-8">
              <p class="text-sm leading-6 text-neutral-700 md:text-base md:leading-7">
                {{ waitlistState === 'success' ? recoveryCopy.success : waitlistError }}
              </p>
              <BaseButton type="button" variant="dark" size="sm" class="mt-6" @click="returnToSelection">
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m11.8 5-5 5 5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                {{ recoveryCopy.back }}
              </BaseButton>
            </div>
          </form>
        </BaseModal>
      </div>
    </div>
  </component>
</template>

<style scoped>
.booking-success-action {
  border: 0;
}

.booking-contact-field {
  position: relative;
}

.booking-contact-field__input {
  display: block;
  width: 100%;
  padding-left: 2.5rem;
}

.booking-contact-field__icon {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 0.75rem;
  pointer-events: none;
  color: rgb(255 255 255 / 45%);
  transform: translateY(-50%);
  transition:
    color 240ms ease,
    filter 240ms ease,
    opacity 240ms ease;
}

.booking-contact-field:focus-within .booking-contact-field__icon {
  color: rgb(255 255 255 / 92%);
  filter: drop-shadow(0 0 0.3rem rgb(255 255 255 / 18%));
}

.booking-contact-field__icon--emoji {
  font-size: 0.9rem;
  line-height: 1;
  opacity: 0.7;
  filter: saturate(0.85) brightness(0.95);
}

.booking-contact-field:focus-within .booking-contact-field__icon--emoji {
  opacity: 1;
  filter: saturate(1.05) brightness(1.08) drop-shadow(0 0 0.3rem rgb(255 255 255 / 16%));
}

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

.booking-step-panel--master :deep(.booking-master-rating [role='img']) {
  gap: 0.125rem;
  font-size: 0.6875rem;
}

.booking-step-panel--master :deep(.booking-master-rating .text-sm) {
  font-size: 0.6875rem;
  line-height: 1rem;
}

.booking-step-panel--master :deep(.booking-master-rating .text-xs) {
  gap: 0.25rem;
  font-size: 0.625rem;
  line-height: 0.875rem;
}

.booking-step-panel--master :deep(.booking-master-rating .h-3) {
  height: 0.625rem;
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

@media (max-width: 639.98px) {
  .booking-form .booking-step-content {
    gap: 0.5rem;
  }
}

.booking-form .booking-step-actions {
  flex-shrink: 0;
  padding-top: 0;
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

  .booking-step-panel--time .booking-recovery {
    min-height: 0;
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .booking-step-panel--service .booking-step-actions,
  .booking-step-panel--time .booking-step-actions {
    flex-shrink: 0;
    margin-top: 1rem;
    padding-top: 0;
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
    padding-top: 0;
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
  padding-top: 0;
}

.booking-guided-action {
  border: 1px solid rgb(115 115 115 / 0.7);
  animation: booking-guided-border 2.1s ease-in-out infinite;
}

.booking-price-review {
  background: rgb(255 255 255 / 0.055);
}

.booking-contact-field__input:-webkit-autofill {
  animation-name: booking-contact-autofill;
  animation-duration: 1ms;
}

@keyframes booking-contact-autofill {
  from,
  to { opacity: 1; }
}

.booking-quote-panel-enter-active,
.booking-quote-panel-leave-active,
.booking-quote-state-enter-active,
.booking-quote-state-leave-active {
  overflow: hidden;
  transition:
    opacity 320ms cubic-bezier(0.3, 1, 0.3, 1),
    transform 320ms cubic-bezier(0.3, 1, 0.3, 1),
    max-height 320ms cubic-bezier(0.3, 1, 0.3, 1);
}

.booking-quote-panel-enter-active,
.booking-quote-panel-leave-active { max-height: 45rem; }

.booking-quote-state-enter-active,
.booking-quote-state-leave-active { max-height: 40rem; }

.booking-quote-panel-enter-from,
.booking-quote-panel-leave-to,
.booking-quote-state-enter-from,
.booking-quote-state-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(0.5rem);
}

.booking-quote-panel-leave-active,
.booking-quote-state-leave-active { pointer-events: none; }

.booking-price-discount-badge {
  display: inline-flex;
  padding: 0.08rem 0.38rem;
  color: white;
  font-weight: 700;
  white-space: nowrap;
  background: linear-gradient(110deg, rgb(127 29 29), rgb(239 68 68), rgb(153 27 27));
  background-size: 220% 100%;
  animation: booking-price-discount-glow 5s ease-in-out infinite;
}

@keyframes booking-price-discount-glow {
  0%,
  100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.booking-accordion-appear-enter-active,
.booking-accordion-appear-leave-active {
  max-height: 40rem;
  overflow: hidden;
  transition:
    opacity 420ms cubic-bezier(0.3, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.3, 1, 0.3, 1),
    max-height 420ms cubic-bezier(0.3, 1, 0.3, 1);
}

.booking-accordion-appear-leave-active {
  pointer-events: none;
}

.booking-accordion-appear-enter-from,
.booking-accordion-appear-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(0.65rem);
}

.booking-price-review--promotion {
  background:
    radial-gradient(circle at 100% 0%, rgb(110 231 183 / 0.12), transparent 45%),
    linear-gradient(
      120deg,
      rgb(255 255 255 / 0.055),
      rgb(30 74 63 / 0.3),
      rgb(70 37 77 / 0.24),
      rgb(87 35 42 / 0.22),
      rgb(255 255 255 / 0.055)
    );
  background-size: 220% 220%, 320% 320%;
  animation: booking-price-background 14s ease-in-out infinite;
}

@keyframes booking-price-background {
  0%,
  100% {
    background-position: 100% 0%, 0% 50%;
  }

  50% {
    background-position: 72% 24%, 100% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .booking-quote-panel-enter-active,
  .booking-quote-panel-leave-active,
  .booking-quote-state-enter-active,
  .booking-quote-state-leave-active,
  .booking-accordion-appear-enter-active,
  .booking-accordion-appear-leave-active,
  .booking-price-discount-badge,
  .booking-price-review--promotion {
    animation: none;
    transition: none;
  }
}

:deep(.booking-recovery-action) {
  border-color: transparent;
  box-shadow: none;
}

:deep(.booking-recovery-action .sc-button__text) {
  gap: 0.125rem;
}

@media (max-width: 639px) {
  :deep(.booking-recovery-action) {
    min-height: 2.25rem;
    padding: 0.4rem 0.35rem;
    font-size: 0.625rem;
    line-height: 1.15;
  }
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
