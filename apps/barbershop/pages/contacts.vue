<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'
import { bookingFunnelFailureEvent } from '~/utils/bookingFunnel'

const { terms, locale } = useTerms()
const domain = useBarbershopDomain()
const localizedService = useLocalizedService()
const { trackContactClick, trackEvent } = useAnalytics()
const bookingFunnel = useBookingFunnel()
const { data: masters } = await useAsyncData('booking-masters', domain.getMasters)
const maxSelectedServices = 3

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  master_id: '',
  service_ids: [] as string[],
  scheduled_at: '',
  note: '',
})

const state = reactive({ loading: false, success: '', error: '' })

const phoneHref = computed(() => `tel:${terms.value.pages.contacts.phone.replace(/[^\d+]/g, '')}`)
const emailHref = computed(() => `mailto:${terms.value.pages.contacts.email}`)

const formatDateTimeLocalInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const minScheduledAt = formatDateTimeLocalInput(new Date())
const maxScheduledAt = formatDateTimeLocalInput(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))

const masterName = (master: {
  full_name?: string | null
  name?: string | null
  id: number
  last_name?: string | null
  first_name_uk?: string | null
  last_name_uk?: string | null
  full_name_uk?: string | null
}) =>
  master.full_name_uk
  || [master.first_name_uk || master.full_name, master.last_name_uk || master.last_name].filter(Boolean).join(' ')
  || master.full_name
  || master.name
  || `Master #${master.id}`

const selectedMaster = computed(() =>
  (masters.value || []).find(master => master.id === Number(form.master_id)) || null,
)

const availableServices = computed(() =>
  (selectedMaster.value?.services || []).filter(service => service.is_active ?? service.status !== 'inactive'),
)

const selectedServices = computed(() =>
  availableServices.value.filter(service => form.service_ids.includes(String(service.id))),
)

const selectedDurationMinutes = computed(() =>
  selectedServices.value.reduce((total, service) => total + Number(service.duration_minutes || 0), 0),
)

const selectedPrice = computed(() =>
  selectedServices.value.reduce((total, service) => total + Number(service.price || 0), 0),
)

const serviceSelected = (serviceId: number) => form.service_ids.includes(String(serviceId))
const serviceSelectionLimitReached = computed(() => form.service_ids.length >= maxSelectedServices)

const recordBookingStart = () => {
  bookingFunnel.recordInBackground('booking_start')
}

const toggleService = (serviceId: number) => {
  const id = String(serviceId)
  if (form.service_ids.includes(id)) {
    form.service_ids = form.service_ids.filter(item => item !== id)
    return
  }

  if (serviceSelectionLimitReached.value) return

  form.service_ids = [...form.service_ids, id]
  recordBookingStart()
  bookingFunnel.recordInBackground('service_selected', {
    masterId: Number(form.master_id),
    serviceId,
  })
  const service = availableServices.value.find(service => service.id === serviceId)
  trackEvent('select_service', {
    source: 'contacts_page',
    service_id: serviceId,
    service_name: service ? localizedService.serviceName(service) : undefined,
    service_count: form.service_ids.length,
    value: Number(service?.price || 0),
    currency: 'UAH',
  })
}

watch(() => form.master_id, () => {
  if (form.master_id) {
    recordBookingStart()
    bookingFunnel.recordInBackground('master_selected', {
      masterId: Number(form.master_id),
      serviceId: Number(form.service_ids[0]),
    })
    trackEvent('select_master', {
      source: 'contacts_page',
      master_id: Number(form.master_id),
      master_name: selectedMaster.value ? masterName(selectedMaster.value) : undefined,
    })
  }

  form.service_ids = form.service_ids.filter(serviceId =>
    availableServices.value.some(service => service.id === Number(serviceId)),
  )
})

const handlePhoneInput = (event: Event) => {
  form.phone = formatPhoneInput((event.target as HTMLInputElement).value)
}

const handlePhonePasteEvent = (event: ClipboardEvent) => {
  handlePhonePaste(event, value => {
    form.phone = value
  })
}

const handleTextInput = (
  field: 'first_name' | 'last_name' | 'email' | 'note',
  maxLength: number,
  options: { multiline?: boolean } = {},
) => {
  form[field] = constrainFormInput(form[field], maxLength, options)
}

const handleScheduledAtChange = () => {
  trackEvent('select_time', {
    source: 'contacts_page',
    appointment_date: form.scheduled_at.slice(0, 10),
  })
  bookingFunnel.recordInBackground('slot_selected', {
    masterId: Number(form.master_id),
    serviceId: Number(form.service_ids[0]),
  })
}

useSeo(
  () => terms.value.seo.contactsTitle,
  () => terms.value.seo.contactsDescription,
)

const submit = async () => {
  const safeFirstName = sanitizeFormText(form.first_name, FORM_FIELD_LIMITS.name)
  const safeLastName = sanitizeFormText(form.last_name, FORM_FIELD_LIMITS.name)
  const safeNote = sanitizeFormText(form.note, FORM_FIELD_LIMITS.comment, { multiline: true })
  const safeCustomerName = `${safeFirstName} ${safeLastName}`.trim()

  if (!safeFirstName || !safeLastName) {
    state.success = ''
    state.error = terms.value.pages.contacts.error
    return
  }

  if (!isValidPhoneNumber(form.phone)) {
    state.success = ''
    state.error = terms.value.pages.contacts.phoneInvalid
    return
  }

  const serviceIds = form.service_ids.map(Number).filter(Number.isFinite)
  if (!serviceIds.length) {
    state.success = ''
    state.error = terms.value.pages.contacts.error
    return
  }

  state.loading = true
  state.success = ''
  state.error = ''
  trackEvent('booking_submit', {
    source: 'contacts_page',
    master_id: Number(form.master_id),
    appointment_date: form.scheduled_at.slice(0, 10),
    service_count: serviceIds.length,
    duration_minutes: selectedDurationMinutes.value,
  })
  try {
    const funnelSessionId = bookingFunnel.sessionId()
    bookingFunnel.recordInBackground('contact_entered', {
      masterId: Number(form.master_id),
      serviceId: serviceIds[0],
    })
    await domain.createBooking({
      master_id: Number(form.master_id),
      service_id: serviceIds[0],
      service_ids: serviceIds,
      duration_minutes: selectedDurationMinutes.value,
      customer_name: safeCustomerName,
      customer_phone: formatPhoneForSubmit(form.phone),
      customer_comment: safeNote || null,
      start_at: new Date(form.scheduled_at).toISOString(),
      funnel_session_id: funnelSessionId,
    })
    state.success = terms.value.pages.contacts.success
    trackEvent('booking_success', {
      source: 'contacts_page',
      master_id: Number(form.master_id),
      appointment_date: form.scheduled_at.slice(0, 10),
      service_count: serviceIds.length,
      duration_minutes: selectedDurationMinutes.value,
    })
    Object.assign(form, {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      master_id: '',
      service_ids: [],
      scheduled_at: '',
      note: '',
    })
    bookingFunnel.reset()
  }
  catch (error) {
    state.error = terms.value.pages.contacts.error
    const status = (error as { response?: { status?: number }, status?: number })?.response?.status
      || (error as { status?: number })?.status
    bookingFunnel.recordInBackground(bookingFunnelFailureEvent(status), {
      masterId: Number(form.master_id),
      serviceId: serviceIds[0],
    })
    trackEvent('booking_error', {
      source: 'contacts_page',
      master_id: Number(form.master_id),
      appointment_date: form.scheduled_at.slice(0, 10),
      error_message: state.error,
    })
    console.error(error)
  }
  finally {
    state.loading = false
  }
}
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
    <section class="space-y-6" data-reveal="soft">
      <div class="space-y-3">
        <p class="text-sm uppercase tracking-[0.3em] text-amber-700">{{ terms.pages.contacts.label }}</p>
        <h1 class="text-5xl font-semibold text-stone-900">{{ terms.pages.contacts.title }}</h1>
      </div>
      <div class="rounded-[2rem] bg-white p-6 shadow-sm">
        <div class="space-y-4 text-sm leading-7 text-stone-600">
          <p><strong class="text-stone-900">{{ terms.pages.contacts.addressLabel }}</strong> {{ terms.pages.contacts.address }}</p>
          <p>
            <strong class="text-stone-900">{{ terms.pages.contacts.phoneLabel }}</strong>
            <a :href="phoneHref" class="transition hover:text-stone-900 hover:underline" @click="trackContactClick('phone', 'contacts_page')">
              {{ terms.pages.contacts.phone }}
            </a>
          </p>
          <p><strong class="text-stone-900">{{ terms.pages.contacts.hoursLabel }}</strong> {{ terms.pages.contacts.hours }}</p>
          <p v-if="terms.pages.contacts.email">
            <strong class="text-stone-900">{{ terms.pages.contacts.emailLabel }}</strong>
            <a :href="emailHref" class="transition hover:text-stone-900 hover:underline" @click="trackContactClick('email', 'contacts_page')">
              {{ terms.pages.contacts.email }}
            </a>
          </p>
        </div>
      </div>
    </section>

    <form class="space-y-4 rounded-[2rem] bg-white p-6 shadow-sm" data-reveal="soft" data-reveal-delay="140" @submit.prevent="submit">
      <div class="grid gap-4 md:grid-cols-2">
        <input
          v-model="form.first_name"
          required
          autocomplete="given-name"
          minlength="2"
          :maxlength="FORM_FIELD_LIMITS.name"
          :placeholder="terms.pages.contacts.placeholders.firstName"
          class="glass-control glass-control--light rounded-2xl px-4 py-3 outline-none"
          @input="handleTextInput('first_name', FORM_FIELD_LIMITS.name)"
        >
        <input
          v-model="form.last_name"
          required
          autocomplete="family-name"
          minlength="2"
          :maxlength="FORM_FIELD_LIMITS.name"
          :placeholder="terms.pages.contacts.placeholders.lastName"
          class="glass-control glass-control--light rounded-2xl px-4 py-3 outline-none"
          @input="handleTextInput('last_name', FORM_FIELD_LIMITS.name)"
        >
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <input
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          :maxlength="FORM_FIELD_LIMITS.email"
          :placeholder="terms.pages.contacts.placeholders.email"
          class="glass-control glass-control--light rounded-2xl px-4 py-3 outline-none"
          @input="handleTextInput('email', FORM_FIELD_LIMITS.email)"
        >
        <input
          v-model="form.phone"
          required
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          maxlength="17"
          pattern="\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}"
          :placeholder="terms.pages.contacts.placeholders.phone"
          class="glass-control glass-control--light rounded-2xl px-4 py-3 outline-none"
          @input="handlePhoneInput"
          @paste="handlePhonePasteEvent"
        >
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <select v-model="form.master_id" required class="glass-control glass-control--light rounded-2xl px-4 py-3 outline-none">
          <option value="">{{ terms.pages.contacts.placeholders.master }}</option>
          <option v-for="master in masters || []" :key="master.id" :value="master.id">{{ masterName(master) }}</option>
        </select>
        <div class="rounded-2xl bg-neutral-950 p-3 text-white">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm text-white/65">{{ terms.pages.contacts.placeholders.service }}</span>
            <span class="text-xs font-semibold text-white/55">{{ form.service_ids.length }}/{{ maxSelectedServices }}</span>
          </div>
          <div v-if="selectedServices.length" class="mt-2 text-xs text-white/65">
            {{ localizedService.serviceDuration(selectedDurationMinutes) }} · {{ localizedService.servicePrice(selectedPrice) }}
          </div>
          <div class="mt-3 grid gap-2">
            <button
              v-for="service in availableServices"
              :key="service.id"
              type="button"
              class="w-full rounded-xl px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-stone-500"
              :class="[
                serviceSelected(service.id) ? 'bg-white text-neutral-950' : 'bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white',
                serviceSelectionLimitReached && !serviceSelected(service.id) ? 'cursor-not-allowed opacity-45' : '',
              ]"
              :disabled="!selectedMaster || (serviceSelectionLimitReached && !serviceSelected(service.id))"
              @click="toggleService(service.id)"
            >
              <span class="block font-semibold">{{ localizedService.serviceName(service) }}</span>
              <span class="mt-1 block text-xs" :class="serviceSelected(service.id) ? 'text-neutral-600' : 'text-white/55'">
                {{ localizedService.serviceDuration(service.duration_minutes) }} · {{ localizedService.servicePrice(service.price) }}
              </span>
            </button>
            <p v-if="!selectedMaster" class="py-2 text-sm text-white/45">{{ terms.pages.contacts.placeholders.master }}</p>
            <FeedbackState
              v-else-if="!availableServices.length"
              compact
              kind="unavailable"
              face="sad-droopy-face"
              :title="locale === 'uk' ? 'Немає доступних послуг' : 'No services available'"
              class="text-white"
              style="--feedback-state-surface: #0a0a0a"
            />
          </div>
        </div>
      </div>
      <input
        v-model="form.scheduled_at"
        type="datetime-local"
        required
        :min="minScheduledAt"
        :max="maxScheduledAt"
        class="glass-control glass-control--light w-full rounded-2xl px-4 py-3 outline-none"
        @change="handleScheduledAtChange"
      >
      <textarea
        v-model="form.note"
        rows="4"
        :maxlength="FORM_FIELD_LIMITS.comment"
        :placeholder="terms.pages.contacts.placeholders.notes"
        class="glass-control glass-control--light w-full rounded-2xl px-4 py-3 outline-none"
        @input="handleTextInput('note', FORM_FIELD_LIMITS.comment, { multiline: true })"
      />
      <BaseButton type="submit" :disabled="state.loading">
        {{ state.loading ? terms.pages.contacts.sending : terms.pages.contacts.sendRequest }}
      </BaseButton>
      <p v-if="state.success" class="text-sm text-emerald-700">{{ state.success }}</p>
      <p v-if="state.error" class="text-sm text-rose-700">{{ state.error }}</p>
    </form>
  </div>
</template>
