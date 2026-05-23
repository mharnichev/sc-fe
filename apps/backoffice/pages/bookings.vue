<script setup lang="ts">
import type { AvailableSlot, Booking, BookingStatus } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const auth = useAuthStore()
const {
  statuses,
  todayInput,
  addDaysInput,
  bookingStart,
  bookingEnd,
  bookingComment,
  bookingPhone,
  customerName,
  masterName,
  serviceName,
  toKyivIso,
  formatDateTime,
  formatTime,
  formatBookingStatus,
  normalizeItems,
  normalizeTotal,
  apiErrorMessage,
} = useBookingFormatting()

const page = ref(1)
const pageSize = 100
const filters = reactive({
  date_from: todayInput(),
  date_to: addDaysInput(todayInput(), 7),
  master_id: '',
  service_id: '',
  status: '',
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-bookings',
  () => api.adminGetBookings(page.value, pageSize, {
    date_from: filters.date_from,
    date_to: filters.date_to,
    master_id: filters.master_id ? Number(filters.master_id) : null,
    service_id: filters.service_id ? Number(filters.service_id) : null,
    status: filters.status as BookingStatus | '',
  }),
  { watch: [page] },
)

const [{ data: masters }, { data: services }] = await Promise.all([
  useAsyncData('booking-master-options', () =>
    auth.user?.is_superuser ? api.adminGetMasters(1, 200) : api.getPublicMasters(),
  ),
  useAsyncData('booking-service-options', () => api.getServices()),
])

const selected = ref<Booking | null>(null)
const actionError = ref('')
const pendingStatus = ref<BookingStatus | ''>('')
const showCreate = ref(false)
const activeCreateStep = ref<'master' | 'service' | 'time' | 'customer'>('master')
const createForm = reactive({
  master_id: '',
  service_id: '',
  date: todayInput(),
  time: '',
  customer_name: '',
  customer_phone: '',
  customer_comment: '',
})
const availableSlots = ref<AvailableSlot[]>([])
const slotsPending = ref(false)
const createPending = ref(false)
const createError = ref('')
const createSuccess = ref('')

const bookings = computed(() => normalizeItems(data.value))
const masterOptions = computed(() => normalizeItems(masters.value))
const serviceOptions = computed(() => normalizeItems(services.value))
const createServiceOptions = computed(() => {
  const masterId = createForm.master_id ? Number(createForm.master_id) : null
  if (!masterId) return serviceOptions.value
  return serviceOptions.value.filter(service => !service.barber_id || Number(service.barber_id) === masterId)
})
const { isAdmin, isBarber, linkedMaster, roleLabel, canManageBooking } = useBackofficeAccess(masterOptions)

const visibleBookings = computed(() => {
  const selectedServiceId = filters.service_id ? Number(filters.service_id) : null
  if (!selectedServiceId) return bookings.value
  return bookings.value.filter(booking => booking.service_id === selectedServiceId)
})

const total = computed(() =>
  filters.service_id ? visibleBookings.value.length : normalizeTotal(data.value),
)

const resolveMaster = (booking: Booking) =>
  booking.master || booking.barber || masterOptions.value.find(master => master.id === booking.master_id) || null

const resolveService = (booking: Booking) =>
  booking.service || serviceOptions.value.find(service => service.id === booking.service_id) || null

const selectedCreateMaster = computed(() =>
  masterOptions.value.find(master => master.id === Number(createForm.master_id)) || null,
)

const selectedCreateService = computed(() =>
  createServiceOptions.value.find(service => service.id === Number(createForm.service_id)) || null,
)

const effectiveCreateDuration = computed(() => selectedCreateService.value?.duration_minutes || 60)

const createSteps = computed(() => [
  {
    id: 'master' as const,
    label: 'Майстер',
    value: selectedCreateMaster.value ? masterName(selectedCreateMaster.value) : 'Не вибрано',
    complete: Boolean(createForm.master_id),
  },
  {
    id: 'service' as const,
    label: 'Послуга',
    value: selectedCreateService.value ? serviceName(selectedCreateService.value) : 'Не вибрано',
    complete: Boolean(createForm.service_id),
  },
  {
    id: 'time' as const,
    label: 'Час',
    value: createForm.time ? `${createForm.date} ${createForm.time}` : 'Не вибрано',
    complete: Boolean(createForm.date && createForm.time),
  },
  {
    id: 'customer' as const,
    label: 'Клієнт',
    value: createForm.customer_name || 'Не вибрано',
    complete: Boolean(createForm.customer_name && createForm.customer_phone),
  },
])

const padTime = (value: number) => String(value).padStart(2, '0')

const addMinutesToTime = (time: string, minutes: number) => {
  const [hour, minute] = time.split(':').map(Number)
  const total = hour * 60 + minute + minutes
  return `${padTime(Math.floor(total / 60))}:${padTime(total % 60)}`
}

const createTimeCandidates = computed(() => {
  const duration = effectiveCreateDuration.value
  const result: { time: string, endTime: string }[] = []
  for (let minutes = 8 * 60; minutes + duration <= 20 * 60; minutes += 30) {
    const time = `${padTime(Math.floor(minutes / 60))}:${padTime(minutes % 60)}`
    result.push({ time, endTime: addMinutesToTime(time, duration) })
  }
  return result
})

const slotAvailabilityReady = computed(() =>
  Boolean(createForm.master_id && createForm.service_id && createForm.date),
)

const availableSlotByTime = computed(() => {
  const map = new Map<string, AvailableSlot>()
  for (const slot of availableSlots.value) {
    map.set(formatTime(slot.start_at), slot)
  }
  return map
})

const createSlotState = (time: string) => {
  if (!slotAvailabilityReady.value) return 'unchecked'
  return availableSlotByTime.value.has(time) ? 'available' : 'busy'
}

const selectedSlotIsBusy = computed(() =>
  Boolean(createForm.time && createSlotState(createForm.time) === 'busy'),
)

const loadAvailableSlots = async () => {
  availableSlots.value = []
  createError.value = ''
  if (!slotAvailabilityReady.value) return
  slotsPending.value = true
  try {
    availableSlots.value = await api.getAvailableSlots(
      createForm.master_id,
      createForm.date,
      createForm.service_id,
    )
  }
  catch (cause) {
    createError.value = apiErrorMessage(cause, 'Не вдалося завантажити доступні слоти.')
  }
  finally {
    slotsPending.value = false
  }
}

watch(
  () => [createForm.master_id, createForm.service_id, createForm.date],
  () => {
    void loadAvailableSlots()
  },
)

watch(
  linkedMaster,
  master => {
    if (!isAdmin.value && master && !createForm.master_id) {
      createForm.master_id = String(master.id)
    }
  },
  { immediate: true },
)

const openCreateBooking = () => {
  showCreate.value = true
  activeCreateStep.value = isAdmin.value ? 'master' : 'service'
  createError.value = ''
  createSuccess.value = ''
  if (!isAdmin.value && linkedMaster.value) {
    createForm.master_id = String(linkedMaster.value.id)
  }
}

const resetCreateForm = () => {
  createForm.master_id = !isAdmin.value && linkedMaster.value ? String(linkedMaster.value.id) : ''
  createForm.service_id = ''
  createForm.date = todayInput()
  createForm.time = ''
  createForm.customer_name = ''
  createForm.customer_phone = ''
  createForm.customer_comment = ''
  activeCreateStep.value = isAdmin.value ? 'master' : 'service'
  availableSlots.value = []
  createError.value = ''
}

const closeCreateBooking = () => {
  showCreate.value = false
}

const selectCreateMaster = (masterId: number) => {
  if (!isAdmin.value && linkedMaster.value?.id !== masterId) return
  createForm.master_id = String(masterId)
  if (createForm.service_id && !createServiceOptions.value.some(service => service.id === Number(createForm.service_id))) {
    createForm.service_id = ''
  }
}

const selectCreateService = (serviceId: number) => {
  createForm.service_id = String(serviceId)
}

const selectCreateTime = (time: string) => {
  if (createSlotState(time) === 'busy') return
  createForm.time = time
}

const createBooking = async () => {
  createError.value = ''
  createSuccess.value = ''
  if (!createForm.master_id) {
    createError.value = 'Виберіть майстра.'
    activeCreateStep.value = 'master'
    return
  }
  if (!createForm.service_id) {
    createError.value = 'Виберіть послугу.'
    activeCreateStep.value = 'service'
    return
  }
  if (!createForm.date || !createForm.time) {
    createError.value = 'Виберіть дату й час.'
    activeCreateStep.value = 'time'
    return
  }
  if (selectedSlotIsBusy.value) {
    createError.value = 'Вибраний час уже зайнятий для цього майстра й послуги.'
    activeCreateStep.value = 'time'
    return
  }
  if (!createForm.customer_name.trim() || !createForm.customer_phone.trim()) {
    createError.value = 'Ім’я клієнта та телефон обов’язкові.'
    activeCreateStep.value = 'customer'
    return
  }

  const matchedSlot = availableSlotByTime.value.get(createForm.time)
  createPending.value = true
  try {
    await api.createPublicBooking({
      master_id: Number(createForm.master_id),
      service_id: Number(createForm.service_id),
      customer_name: createForm.customer_name.trim(),
      customer_phone: createForm.customer_phone.trim(),
      customer_comment: createForm.customer_comment.trim() || null,
      start_at: matchedSlot?.start_at || toKyivIso(createForm.date, createForm.time),
    })
    createSuccess.value = 'Бронювання створено.'
    await refresh()
    resetCreateForm()
  }
  catch (cause) {
    createError.value = apiErrorMessage(cause, 'Не вдалося створити бронювання.')
  }
  finally {
    createPending.value = false
  }
}

const applyFilters = async () => {
  page.value = 1
  if (page.value === 1) await refresh()
}

const clearFilters = async () => {
  filters.date_from = todayInput()
  filters.date_to = addDaysInput(todayInput(), 7)
  filters.master_id = ''
  filters.service_id = ''
  filters.status = ''
  await applyFilters()
}

const allowedStatusActions = (booking: Booking | null) =>
  !booking || !canManageBooking(booking.master_id)
    ? []
    : statuses.filter(status => status !== booking.status)

const updateStatus = async (status: BookingStatus) => {
  if (!selected.value) return
  pendingStatus.value = status
  actionError.value = ''
  try {
    const updated = await api.adminUpdateBookingStatus(selected.value.id, status)
    selected.value = { ...selected.value, ...updated }
    await refresh()
  }
  catch (cause) {
    actionError.value = apiErrorMessage(cause, 'Не вдалося оновити статус бронювання.')
  }
  finally {
    pendingStatus.value = ''
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Календар</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Бронювання</h1>
        <p class="mt-2 text-sm text-slate-500">Години бронювання: 08:00-20:00 Europe/Kyiv.</p>
        <p class="mt-1 text-sm text-slate-500">
          Роль: {{ roleLabel }}<span v-if="linkedMaster"> · {{ masterName(linkedMaster) }}</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <button class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white" @click="openCreateBooking">
          Нове бронювання
        </button>
        <NuxtLink to="/my-bookings" class="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">
          Мої бронювання
        </NuxtLink>
      </div>
    </div>

    <p v-if="isBarber" class="rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
      Майстри можуть переглядати всі бронювання, але дії зі статусом доступні лише для бронювань, призначених їхньому профілю майстра.
    </p>
    <p v-else-if="!isAdmin && !linkedMaster" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Ваш акаунт не прив’язаний до профілю майстра. Ви можете переглядати бронювання, якщо це дозволяє бекенд, але дії зі статусом приховані.
    </p>

    <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-6">
      <label class="space-y-2 text-sm text-slate-700">
        <span class="font-medium">Від</span>
        <input v-model="filters.date_from" type="date" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
      </label>
      <label class="space-y-2 text-sm text-slate-700">
        <span class="font-medium">До</span>
        <input v-model="filters.date_to" type="date" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
      </label>
      <label class="space-y-2 text-sm text-slate-700">
        <span class="font-medium">Майстер</span>
        <select v-model="filters.master_id" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          <option value="">Усі майстри</option>
          <option v-for="master in masterOptions" :key="master.id" :value="String(master.id)">
            {{ masterName(master) }}
          </option>
        </select>
      </label>
      <label class="space-y-2 text-sm text-slate-700">
        <span class="font-medium">Послуга</span>
        <select v-model="filters.service_id" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          <option value="">Усі послуги</option>
          <option v-for="service in serviceOptions" :key="service.id" :value="String(service.id)">
            {{ service.name }}
          </option>
        </select>
      </label>
      <label class="space-y-2 text-sm text-slate-700">
        <span class="font-medium">Статус</span>
        <select v-model="filters.status" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          <option value="">Будь-який статус</option>
          <option v-for="status in statuses" :key="status" :value="status">{{ formatBookingStatus(status) }}</option>
        </select>
      </label>
      <div class="flex items-end gap-3">
        <button class="flex-1 rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
        <button class="flex-1 rounded-full border border-slate-300 px-4 py-3 text-sm" @click="clearFilters">Очистити</button>
      </div>
    </section>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ apiErrorMessage(error, 'Не вдалося завантажити бронювання з /backoffice/bookings.') }}
    </p>

    <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Total: {{ total }}
    </div>

    <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div v-if="pending" class="p-6 text-sm text-slate-500">Завантаження бронювань...</div>
      <div v-else-if="!visibleBookings.length" class="p-6 text-sm text-slate-500">За вибраними фільтрами бронювань не знайдено.</div>
      <table v-else class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Час</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнт</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Майстер</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Послуга</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Коментар</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Дії</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="booking in visibleBookings" :key="booking.id">
            <td class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ formatDateTime(bookingStart(booking)) }}</p>
              <p class="text-xs text-slate-500">{{ formatTime(bookingStart(booking)) }} - {{ formatTime(bookingEnd(booking)) }}</p>
            </td>
            <td class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ customerName(booking) }}</p>
              <p class="text-xs text-slate-500">{{ bookingPhone(booking) || 'Без телефону' }}</p>
            </td>
            <td class="px-4 py-3 text-slate-700">{{ masterName(resolveMaster(booking)) }}</td>
            <td class="px-4 py-3 text-slate-700">{{ serviceName(resolveService(booking)) }}</td>
            <td class="px-4 py-3"><BookingStatusBadge :status="booking.status" /></td>
            <td class="max-w-xs px-4 py-3 text-slate-600">{{ bookingComment(booking) || '-' }}</td>
            <td class="px-4 py-3">
              <button class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700" @click="selected = booking">
                Переглянути
              </button>
              <p v-if="!canManageBooking(booking.master_id)" class="mt-2 text-xs text-slate-400">Лише перегляд</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BookingDetailsModal
      :booking="selected"
      :allowed-statuses="allowedStatusActions(selected)"
      :pending-status="pendingStatus"
      :error="actionError"
      :masters="masterOptions"
      :services="serviceOptions"
      @close="selected = null"
      @update-status="updateStatus"
    />

    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section class="max-h-full w-full max-w-6xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Нове бронювання</p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900">Створити запис</h2>
          </div>
          <button class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700" @click="closeCreateBooking">
            Закрити
          </button>
        </div>

        <div class="space-y-6 px-6 py-5">
          <div class="grid gap-3 md:grid-cols-4">
            <button
              v-for="step in createSteps"
              :key="step.id"
              type="button"
              class="rounded-2xl border px-4 py-3 text-left transition"
              :class="activeCreateStep === step.id ? 'border-cyan-500 bg-cyan-50' : step.complete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'"
              @click="activeCreateStep = step.id"
            >
              <p class="text-xs uppercase tracking-[0.18em]" :class="step.complete ? 'text-emerald-700' : 'text-slate-500'">
                {{ step.complete ? 'Вибрано' : 'Крок' }}
              </p>
              <p class="mt-1 font-medium text-slate-900">{{ step.label }}</p>
              <p class="mt-1 truncate text-sm text-slate-500">{{ step.value }}</p>
            </button>
          </div>

          <section v-show="activeCreateStep === 'master'" class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Виберіть майстра</h3>
              <p class="mt-1 text-sm text-slate-500">Адміністратор може вибрати будь-якого майстра. Майстри можуть створювати бронювання лише для власного профілю.</p>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <button
                v-for="master in masterOptions"
                :key="master.id"
                type="button"
                class="rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45"
                :class="createForm.master_id === String(master.id) ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'"
                :disabled="!isAdmin && linkedMaster?.id !== master.id"
                @click="selectCreateMaster(master.id)"
              >
                <p class="font-medium text-slate-900">{{ masterName(master) }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ master.email || master.phone || 'Без контактів' }}</p>
                <p v-if="!isAdmin && linkedMaster?.id !== master.id" class="mt-2 text-xs text-slate-400">Для вашої ролі доступний лише перегляд</p>
              </button>
            </div>
            <p v-if="!masterOptions.length" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Немає доступних майстрів.</p>
          </section>

          <section v-show="activeCreateStep === 'service'" class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Виберіть послугу</h3>
              <p class="mt-1 text-sm text-slate-500">Послугу можна вибрати до або після вибору часу.</p>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <button
                v-for="service in createServiceOptions"
                :key="service.id"
                type="button"
                class="rounded-2xl border p-4 text-left transition"
                :class="createForm.service_id === String(service.id) ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'"
                @click="selectCreateService(service.id)"
              >
                <p class="font-medium text-slate-900">{{ service.name }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ service.duration_minutes }} min · {{ service.price }} UAH</p>
                <p v-if="service.description" class="mt-2 text-sm text-slate-500">{{ service.description }}</p>
              </button>
            </div>
            <p v-if="!createServiceOptions.length" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Для вибраного майстра немає доступних послуг.</p>
          </section>

          <section v-show="activeCreateStep === 'time'" class="space-y-4">
            <div class="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
              <label class="space-y-2 text-sm text-slate-700">
                <span class="font-medium">Дата</span>
                <input v-model="createForm.date" type="date" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
              </label>
              <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span v-if="slotAvailabilityReady && slotsPending">Перевірка слотів...</span>
                <span v-else-if="slotAvailabilityReady">Недоступний час вимкнено для вибраного майстра, послуги та дати.</span>
                <span v-else>Зараз можна вибрати будь-який час. Доступність перевіряється після вибору майстра й послуги.</span>
              </div>
            </div>
            <div class="grid gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              <button
                v-for="slot in createTimeCandidates"
                :key="slot.time"
                type="button"
                class="rounded-2xl border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed"
                :class="[
                  createForm.time === slot.time ? 'border-cyan-500 bg-cyan-50 text-slate-950' : 'border-slate-200',
                  createSlotState(slot.time) === 'available' ? 'hover:bg-emerald-50' : '',
                  createSlotState(slot.time) === 'busy' ? 'border-rose-200 bg-rose-50 text-rose-700 opacity-70' : '',
                  createSlotState(slot.time) === 'unchecked' ? 'hover:bg-slate-50' : '',
                ]"
                :disabled="createSlotState(slot.time) === 'busy'"
                @click="selectCreateTime(slot.time)"
              >
                <span class="font-medium">{{ slot.time }} - {{ slot.endTime }}</span>
                <span class="mt-1 block text-xs">
                  <span v-if="createSlotState(slot.time) === 'available'" class="text-emerald-700">Вільно</span>
                  <span v-else-if="createSlotState(slot.time) === 'busy'" class="text-rose-700">Зайнято</span>
                  <span v-else class="text-slate-500">Не перевірено</span>
                </span>
              </button>
            </div>
          </section>

          <section v-show="activeCreateStep === 'customer'" class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Дані клієнта</h3>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-2 text-sm text-slate-700">
                <span class="font-medium">Назва</span>
                <input v-model="createForm.customer_name" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
              </label>
              <label class="space-y-2 text-sm text-slate-700">
                <span class="font-medium">Телефон</span>
                <input v-model="createForm.customer_phone" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
              </label>
            </div>
            <label class="space-y-2 text-sm text-slate-700">
              <span class="font-medium">Коментар</span>
              <textarea v-model="createForm.customer_comment" rows="4" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
            </label>
          </section>

          <p v-if="createError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ createError }}</p>
          <p v-if="createSuccess" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ createSuccess }}</p>

          <div class="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            <button :disabled="createPending" class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60" @click="createBooking">
              {{ createPending ? 'Створення...' : 'Створити бронювання' }}
            </button>
            <button class="rounded-full border border-slate-300 px-5 py-3 text-sm" @click="resetCreateForm">
              Скинути
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
