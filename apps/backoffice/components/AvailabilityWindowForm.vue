<script setup lang="ts">
import { ExclamationTriangleIcon, CalendarDaysIcon, CheckIcon, CheckCircleIcon, ClockIcon, BriefcaseIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, LockOpenIcon, LockClosedIcon, UserCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master, MasterAvailabilityWindow } from '~/composables/useBackofficeApi'

type DayDraft = { date: string, start: string, end: string, error: string, errorSignature?: string, backendError?: string }
const props = withDefaults(defineProps<{ active?: boolean, admin?: boolean, masters?: Master[], disabled?: boolean, initialDate?: string, initialMasterId?: number | null, initialStartTime?: string, initialEndTime?: string }>(), { active: true, admin: false, masters: () => [], disabled: false })
const emit = defineEmits<{ saved: [message: string], complete: [], busy: [value: boolean] }>()
const instanceId = `availability-${useId()}`
const fieldId = (kind: string, date?: string) => `${instanceId}-${kind}${date ? `-${date}` : ''}`
const api = useBackofficeApi()
const auth = useAuthStore()
let generation = 0
let disposed = false
const sessionKey = () => JSON.stringify([auth.sessionRevision, auth.user?.id, auth.user?.role, auth.user?.master_id, auth.user?.is_superuser])
const validActor = () => Boolean(auth.user && (props.admin ? auth.user.is_superuser || auth.user.role === 'admin' : auth.user.role === 'barber' || auth.user.is_superuser || auth.user.role === 'admin'))
const operationFence = () => {
  const revision = generation, identity = sessionKey(), admin = props.admin, master = form.master_id
  return () => !disposed && revision === generation && identity === sessionKey() && props.active && !props.disabled && props.admin === admin && form.master_id === master && validActor() && (!admin || Boolean(selectedMaster.value))
}

const assetUrl = useAssetUrl()
const toast = useBaseToastNotification()
const calendar = useBookingCalendar()
const { todayInput, addDaysInput, toKyivIso, masterName, apiErrorMessage } = useBookingFormatting()
const form = reactive({ master_id: '', start_time: calendar.workdayStart, end_time: calendar.workdayEnd })
const drafts = ref<DayDraft[]>([])
const selectedDays = computed(() => [...drafts.value].sort((a, b) => a.date.localeCompare(b.date)))
const formError = ref('')
const saving = ref(false)
const focusedDate = ref('')
const commonError = ref('')
const closeError = ref('')
const availabilityErrorRef = ref<HTMLElement | null>(null)
const existingWindows = ref<MasterAvailabilityWindow[]>([])
const availabilityLoading = ref(false)
const availabilityError = ref('')
const availabilityReady = ref(false)
let requestVersion = 0
let initializing = false
const dateInKyiv = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const timeInKyiv = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
const existingByDate = computed(() => {
  const result: Record<string, MasterAvailabilityWindow[]> = {}
  for (const window of existingWindows.value) {
    let date = dateInKyiv(window.start_at)
    if (date < todayInput()) date = todayInput()
    const last = dateInKyiv(new Date(new Date(window.end_at).getTime() - 1).toISOString())
    while (date <= last && date <= horizonEnd.value) {
      if (date >= todayInput()) (result[date] ||= []).push(window)
      date = addDaysInput(date, 1)
    }
  }
  return result
})
const existingForFocusedDate = computed(() => existingByDate.value[focusedDate.value] || [])
const hasSpanningWindow = computed(() => existingForFocusedDate.value.some(window => dateInKyiv(window.start_at) !== dateInKyiv(new Date(new Date(window.end_at).getTime() - 1).toISOString())))
const isExisting = (date: string) => Boolean(existingByDate.value[date]?.length)
const canPick = computed(() => !locked.value && availabilityReady.value && !availabilityLoading.value && !availabilityError.value)
const hasErrors = computed(() => drafts.value.some(day => day.error))
const localError = (cause: unknown, fallback: string) => {
  const message = apiErrorMessage(cause, fallback)
  if (message.includes('Availability window overlaps an existing window')) return 'Цей день уже є у графіку. Оновіть графік або виберіть інший день.'
  if (message.includes('Availability window has active bookings')) return 'У цьому інтервалі є активні бронювання. Зверніться до адміністратора, щоб перенести записи.'
  return /[іїєґІЇЄҐа-яА-Я]/.test(message) ? message : fallback
}
const resolvedOwnerId = () => {
  let master = selectedMaster.value
  const visited = new Set<number>()
  while (master) {
    if (visited.has(master.id)) return undefined
    visited.add(master.id)
    const redirect = master.booking_redirect_master_id
    // An incomplete master list cannot reproduce the server's chained resolution.
    if (redirect === undefined) return undefined
    if (redirect === null) return master.id
    master = props.masters.find(candidate => candidate.id === redirect) || null
  }
  return undefined
}
const loadAvailability = async () => {
  const version = ++requestVersion
  const current = operationFence()
  availabilityReady.value = false
  availabilityError.value = ''
  if (!current() || (props.admin && !selectedMaster.value)) { availabilityLoading.value = false; existingWindows.value = []; return false }
  availabilityLoading.value = true
  const masterId = form.master_id
  const ownerId = props.admin ? resolvedOwnerId() : undefined
  try {
    const filters = { date_from: toKyivIso(todayInput(), '00:00'), date_to: toKyivIso(addDaysInput(horizonEnd.value, 1), '00:00'), master_id: props.admin ? Number(masterId) : undefined }
    const windows = props.admin ? await api.adminGetAvailability(filters) : await api.getMyAvailability(filters)
    if (!current() || version !== requestVersion || masterId !== form.master_id) return false
    // The selected-master-scoped backend resolves owners when local metadata is incomplete.
    if (windows.some(window => !Number.isSafeInteger(window.id) || window.id <= 0 || !Number.isFinite(Date.parse(window.start_at)) || !Number.isFinite(Date.parse(window.end_at)) || Date.parse(window.start_at) >= Date.parse(window.end_at) || (ownerId !== undefined && window.master_id !== ownerId))) throw new Error('Invalid availability response')
    existingWindows.value = windows
    availabilityReady.value = true
    return true
  }
  catch (cause) {
    if (current() && version === requestVersion) availabilityError.value = localError(cause, 'Не вдалося завантажити графік. Спробуйте ще раз.')
    return false
  }
  finally { if (current() && version === requestVersion) availabilityLoading.value = false }
}
const focusError = async () => {
  const day = selectedDays.value.find(day => day.error)
  if (!day) return
  focusedDate.value = day.date
  visibleMonth.value = day.date.slice(0, 7)
  const current = operationFence()
  await nextTick()
  if (!current()) return
  const input = document.getElementById(fieldId('start', day.date))
  input?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  input?.focus({ preventScroll: true })
}
const validateDay = (day: DayDraft, preserveBackend = true) => {
  let error = !validDate(day.date) || day.date < todayInput() || day.date > horizonEnd.value ? 'Дата поза дозволеним періодом.' : timeError(day.start, day.end)
  if (!error && new Date(toKyivIso(day.date, day.end)).getTime() <= Date.now()) error = 'Минулий час не можна відкривати для запису.'
  if (!error && preserveBackend && day.errorSignature === `${day.start}|${day.end}` && day.backendError) { day.error = day.backendError; return }
  day.error = error
  if (!error && day.errorSignature !== `${day.start}|${day.end}`) { day.errorSignature = undefined; day.backendError = undefined }
}
const editDay = (day: DayDraft) => {
  if (day.error) validateDay(day)
  focusedDate.value = day.date
  formError.value = ''
}
const showExistingSchedule = async () => {
  if (!canPick.value) return
  const dates = Object.keys(existingByDate.value).sort()
  const date = dates.find(value => value.startsWith(visibleMonth.value)) || dates[0]
  if (!date) return
  focusedDate.value = date
  visibleMonth.value = date.slice(0, 7)
  closeError.value = ''
  await nextTick()
  document.getElementById(fieldId('existing-panel'))?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
}
const closeExistingDay = async () => {
  if (!canPick.value || !existingForFocusedDate.value.length || focusedDate.value < todayInput() || hasSpanningWindow.value) return
  const revision = ++generation
  const active = operationFence()
  const admin = props.admin
  saving.value = true
  const windows = [...existingForFocusedDate.value]
  let deleted = 0
  closeError.value = ''
  try {
    for (const window of windows) {
      try {
        if (!active()) return
        if (admin) await api.adminDeleteAvailabilityWindow(window.id)
        else await api.deleteMyAvailabilityWindow(window.id)
        if (!active()) return
        existingWindows.value = existingWindows.value.filter(item => item.id !== window.id)
        deleted++
      }
      catch (cause) { if (!active()) return; closeError.value = localError(cause, 'Не вдалося закрити інтервал. Спробуйте ще раз.'); toast.error(closeError.value); break }
    }
    if (active() && deleted) emit('saved', `Закрито інтервалів: ${deleted}. Бронювання збережено.`)
  }
  finally { if (!disposed && revision === generation) saving.value = false }
}
const locked = computed(() => saving.value || props.disabled || !props.active || disposed || !validActor())
const openMenu = ref<'master' | null>(null)
const masterSelectRef = ref<HTMLElement | null>(null)
const addCalendarMonthsInput = (date: string, months: number) => {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`
}
const horizonEnd = computed(() => addCalendarMonthsInput(todayInput(), 2))
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T12:00:00Z')) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date
const visibleMonth = ref(todayInput().slice(0, 7))
const monthLabel = computed(() => new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${visibleMonth.value}-01T12:00:00Z`)))
const compactDate = (date: string) => `${date.slice(8)}.${date.slice(5, 7)}`
const formatDate = (date: string) => new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
const monthDays = computed(() => {
  const first = `${visibleMonth.value}-01`
  const days = new Date(`${first}T12:00:00Z`)
  const offset = (days.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(days.getUTCFullYear(), days.getUTCMonth() + 1, 0)).getUTCDate()
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1
    const date = `${visibleMonth.value}-${String(day).padStart(2, '0')}`
    return day < 1 || day > count ? null : { day, date, disabled: date < todayInput() || date > horizonEnd.value }
  })
})
const selectedMaster = computed(() => props.masters.find(master => String(master.id) === form.master_id) || null)
const masterImageUrl = (master?: Master | null) => master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''
const masterInitials = (master?: Master | null) => initials(masterName(master)) || 'SC'
const toggleMenu = (_menu: 'master') => { if (!locked.value) openMenu.value = openMenu.value ? null : 'master' }
const selectMaster = (master: Master) => { if (!locked.value) { form.master_id = String(master.id); openMenu.value = null } }
const isSelected = (date: string) => drafts.value.some(day => day.date === date)
const toggleDate = (date: string) => {
  if (!canPick.value || !validDate(date) || date < todayInput() || date > horizonEnd.value) return
  focusedDate.value = date
  closeError.value = ''
  if (isExisting(date)) return
  if (isSelected(date)) drafts.value = drafts.value.filter(day => day.date !== date)
  else drafts.value.push({ date, start: form.start_time, end: form.end_time, error: '' })
  formError.value = ''
}
const moveMonth = (offset: number) => {
  if (locked.value) return
  const next = addCalendarMonthsInput(`${visibleMonth.value}-01`, offset).slice(0, 7)
  if (next >= todayInput().slice(0, 7) && next <= horizonEnd.value.slice(0, 7)) visibleMonth.value = next
}
const selectMonth = (weekdays: boolean) => {
  if (!canPick.value) return
  for (const day of monthDays.value) {
    if (!day || day.disabled || isSelected(day.date) || isExisting(day.date)) continue
    const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay()
    if (!weekdays || (weekday !== 0 && weekday !== 6)) drafts.value.push({ date: day.date, start: form.start_time, end: form.end_time, error: '' })
  }
  formError.value = ''
}
const timeError = (start: string, end: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return !start || !end ? 'Заповніть початок і завершення.' : 'Вкажіть час у форматі ГГ:ХХ, наприклад 09:30.'
  if (start >= end) return 'Початок має бути раніше завершення.'
  if (start < calendar.workdayStart || end > calendar.workdayEnd) return `Час має бути в межах ${calendar.workdayStart}–${calendar.workdayEnd}.`
  return ''
}
const applyTimes = () => {
  if (locked.value) return
  commonError.value = timeError(form.start_time, form.end_time)
  if (commonError.value) return
  formError.value = ''
  for (const day of drafts.value) { day.start = form.start_time; day.end = form.end_time; day.error = ''; day.errorSignature = undefined; day.backendError = undefined }
}
const fillForm = () => {
  form.master_id = ''; form.start_time = calendar.workdayStart; form.end_time = calendar.workdayEnd
  commonError.value = ''; closeError.value = ''; focusedDate.value = ''; existingWindows.value = []; availabilityReady.value = false
  drafts.value = []; visibleMonth.value = todayInput().slice(0, 7); openMenu.value = null; formError.value = ''
  form.master_id = props.initialMasterId ? String(props.initialMasterId) : ''
  if (props.initialStartTime && props.initialEndTime && !timeError(props.initialStartTime, props.initialEndTime)) {
    form.start_time = props.initialStartTime
    form.end_time = props.initialEndTime
  }
  const date = props.initialDate
  if (date && validDate(date) && date >= todayInput() && date <= horizonEnd.value) {
    visibleMonth.value = date.slice(0, 7)
    focusedDate.value = date
  }
}
const validate = () => {
  if (!validActor()) return 'Сесію змінено. Відкрийте форму знову.'
  if (props.admin && (!Number.isSafeInteger(Number(form.master_id)) || Number(form.master_id) <= 0 || !selectedMaster.value)) return 'Виберіть майстра.'
  if (!drafts.value.length) return 'Оберіть дні в календарі.'
  for (const day of drafts.value) {
    validateDay(day, false)
  }
  return drafts.value.some(day => day.error) ? 'Перевірте час у позначених днях.' : ''
}
const submit = async () => {
  if (locked.value || availabilityLoading.value || !props.active || disposed || !validActor()) return
  formError.value = validate()
  if (formError.value) { await focusError(); return }
  saving.value = true
  openMenu.value = null
  const failed: DayDraft[] = []
  const batch = selectedDays.value.map(day => ({ ...day }))
  const revision = ++generation
  const identity = sessionKey()
  const admin = props.admin
  const masterId = Number(form.master_id)
  const fence = operationFence()
  const current = () => fence() && revision === generation && identity === sessionKey() && props.admin === admin && Number(form.master_id) === masterId
  const readWindows = (date: string) => {
    const filters = { date_from: toKyivIso(date, '00:00'), date_to: toKyivIso(addDaysInput(date, 1), '00:00'), master_id: masterId }
    return admin ? api.adminGetAvailability(filters) : api.getMyAvailability(filters)
  }
  const matches = (windows: Array<{ start_at: string, end_at: string }>, payload: { start_at: string, end_at: string }) => windows.some(window =>
    Date.parse(window.start_at) === Date.parse(payload.start_at) && Date.parse(window.end_at) === Date.parse(payload.end_at))
  let created = 0
  try {
    const ready = await loadAvailability()
    if (!current()) return
    if (!ready) {
      formError.value = availabilityError.value || 'Оновіть графік і спробуйте ще раз.'
      return
    }
    const conflicts = batch.filter(day => {
      const windows = existingByDate.value[day.date] || []
      if (!windows.length) return false
      // Only an unchanged failed attempt may reconcile a previously committed POST.
      const retry = day.backendError && day.errorSignature === `${day.start}|${day.end}`
      return !retry || !matches(windows, { start_at: toKyivIso(day.date, day.start), end_at: toKyivIso(day.date, day.end) })
    })
    if (conflicts.length) {
      const dates = new Set(conflicts.map(day => day.date))
      focusedDate.value = conflicts[0].date
      visibleMonth.value = conflicts[0].date.slice(0, 7)
      drafts.value = drafts.value.filter(day => !dates.has(day.date))
      formError.value = 'Частина обраних дат уже є у графіку. Їх прибрано з нових днів. Перевірте графік і збережіть решту.'
      return
    }
    for (const day of batch) {
      if (!current()) return
      const payload = { start_at: toKyivIso(day.date, day.start), end_at: toKyivIso(day.date, day.end) }
      try {
        // Reconcile retries, including a POST committed before its response was lost.
        const existing = await readWindows(day.date)
        if (!current()) return
        if (!matches(existing, payload)) {
          if (admin) await api.adminCreateAvailabilityWindow({ master_id: masterId, ...payload })
          else await api.createMyAvailabilityWindow(payload)
        }
        if (!current()) return
        created++
      }
      catch (cause) {
        if (!current()) return
        day.error = localError(cause, 'Не вдалося відкрити цей день.'); day.errorSignature = `${day.start}|${day.end}`; day.backendError = day.error; failed.push(day)
      }
    }
    if (!current()) return
    drafts.value = failed
    if (created) emit('saved', `Відкрито днів: ${created}.`)
    if (failed.length) {
      formError.value = `Не збережено днів: ${failed.length}. Перевірте повідомлення біля дат і спробуйте ще раз.`
      toast.warning(formError.value)
    }
    else { saving.value = false; emit('complete') }
  }
  finally {
    if (revision === generation && !disposed) saving.value = false
    if (current() && failed.length) await focusError()
  }
}
const handleClickOutside = (event: MouseEvent) => {
  if (event.target instanceof Node && !masterSelectRef.value?.contains(event.target)) openMenu.value = null
}
const invalidate = () => { generation++; requestVersion++; saving.value = false; availabilityLoading.value = false; availabilityReady.value = false; existingWindows.value = []; availabilityError.value = ''; closeError.value = '' }
let initialized = false
let initialSelectionPending = true
const applyInitialSelection = () => {
  if (!initialSelectionPending) return
  initialSelectionPending = false
  const date = props.initialDate
  if (date && validDate(date) && focusedDate.value === date && !isExisting(date)) drafts.value = [{ date, start: form.start_time, end: form.end_time, error: '' }]
}
watch(() => props.active, () => invalidate(), { immediate: true, flush: 'sync' })
watch(() => props.active, async active => {
  if (!active || disposed || !validActor()) return
  if (!initialized) {
    initializing = true
    fillForm()
    initializing = false
    initialized = true
  }
  const current = operationFence()
  if (await loadAvailability() && current()) applyInitialSelection()
}, { immediate: true, flush: 'post' })
watch(saving, value => emit('busy', value), { immediate: true, flush: 'sync' })
watch(() => [form.master_id, props.admin, props.disabled, props.initialMasterId, props.masters.map(master => `${master.id}:${master.booking_redirect_master_id}`).join(',')], (values, previous) => {
  if (initializing) return
  invalidate(); drafts.value = []; focusedDate.value = ''; formError.value = ''
  if (previous && values[3] !== previous[3]) {
    initializing = true
    form.master_id = props.initialMasterId ? String(props.initialMasterId) : ''
    initializing = false
  }
  const current = operationFence()
  if (props.active && !props.disabled) void loadAvailability().then(ready => { if (ready && current()) applyInitialSelection() })
}, { flush: 'sync' })
watch(sessionKey, () => { invalidate(); drafts.value = []; initialized = false; initialSelectionPending = true; emit('complete') }, { flush: 'sync' })
onBeforeRouteLeave(() => { invalidate(); drafts.value = []; emit('complete') })
onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onBeforeUnmount(() => { disposed = true; invalidate(); document.removeEventListener('mousedown', handleClickOutside) })
</script>

<template>
      <form class="availability-form flex min-h-full flex-col gap-2.5" novalidate @submit.prevent="submit">
        <fieldset :disabled="locked" class="contents">
        <div v-if="admin" ref="masterSelectRef" class="relative space-y-1 text-xs text-slate-700">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <UserCircleIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
            Майстер
          </span>
          <BaseButton
            type="button"
            class="flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-left text-sm"
            :aria-expanded="openMenu === 'master'"
            @click="toggleMenu('master')"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.65rem] font-semibold text-slate-600 ring-1 ring-slate-200">
                <img v-if="masterImageUrl(selectedMaster)" :src="masterImageUrl(selectedMaster)" :alt="masterName(selectedMaster)" class="h-full w-full object-cover">
                <span v-else>{{ selectedMaster ? masterInitials(selectedMaster) : 'SC' }}</span>
              </span>
              <span class="min-w-0 truncate" :class="selectedMaster ? 'text-slate-900' : 'text-slate-500'">
                {{ selectedMaster ? masterName(selectedMaster) : 'Виберіть майстра' }}
              </span>
            </span>
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-400 transition" :class="openMenu === 'master' ? 'rotate-180' : ''" aria-hidden="true" />
          </BaseButton>
          <div
            v-if="openMenu === 'master'"
            class="booking-select-menu absolute z-[220] mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          >
            <BaseButton
              v-for="master in masters"
              :key="master.id"
              type="button"
              class="flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              :class="form.master_id === String(master.id) ? 'bg-slate-50' : ''"
              @click="selectMaster(master)"
            >
              <span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.65rem] font-semibold text-slate-600 ring-1 ring-slate-200">
                <img v-if="masterImageUrl(master)" :src="masterImageUrl(master)" :alt="masterName(master)" class="h-full w-full object-cover">
                <span v-else>{{ masterInitials(master) }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ masterName(master) }}</span>
                <span v-if="master.position_uk" class="block truncate text-xs text-slate-500">{{ master.position_uk }}</span>
              </span>
            </BaseButton>
          </div>
        </div>


          <p v-if="admin && !form.master_id" class="text-xs text-ui-secondary">Спочатку виберіть майстра, щоб побачити його графік.</p>
          <p v-else-if="availabilityLoading" class="text-xs text-ui-secondary" role="status">Завантажуємо графік…</p>
          <div v-if="availabilityError" ref="availabilityErrorRef" tabindex="-1" class="availability-error rounded-lg p-2 text-xs" role="alert">
            {{ availabilityError }}
            <BaseButton type="button" variant="secondary" size="sm" :disabled="saving || availabilityLoading" @click="loadAvailability">Спробувати ще раз</BaseButton>
          </div>
          <div class="availability-layout grid min-w-0 items-start gap-2.5 md:grid-cols-2 md:gap-3">
          <section class="availability-calendar min-w-0" aria-label="Вибір днів">
            <div class="mb-1 flex items-center justify-between gap-2">
              <h3 class="flex min-w-0 items-center gap-1.5 text-sm font-semibold capitalize text-ui-primary" aria-live="polite"><CalendarDaysIcon class="h-4 w-4 shrink-0" aria-hidden="true" />{{ monthLabel }}</h3>
              <div class="flex gap-1">
                <BaseButton type="button" variant="icon" :disabled="locked || visibleMonth <= todayInput().slice(0, 7)" aria-label="Попередній місяць" @click="moveMonth(-1)"><ChevronLeftIcon class="h-4 w-4" /></BaseButton>
                <BaseButton type="button" variant="icon" :disabled="locked || visibleMonth >= horizonEnd.slice(0, 7)" aria-label="Наступний місяць" @click="moveMonth(1)"><ChevronRightIcon class="h-4 w-4" /></BaseButton>
              </div>
            </div>

            <div class="grid grid-cols-7 gap-0.5 text-center">
              <span v-for="weekday in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']" :key="weekday" class="py-0.5 text-[11px] text-ui-muted">{{ weekday }}</span>
              <template v-for="(day, index) in monthDays" :key="index">
                <BaseButton type="button" v-if="day" class="availability-day" :class="{ 'is-selected': isSelected(day.date), 'is-today': day.date === todayInput(), 'is-existing': isExisting(day.date), 'is-editing': focusedDate === day.date, 'is-error': drafts.some(draft => draft.date === day.date && draft.error) }" :disabled="!canPick || day.disabled" :data-date="day.date" :aria-label="`${formatDate(day.date)}${day.date === todayInput() ? ', сьогодні' : ''}${isExisting(day.date) ? ', уже відкрито' : isSelected(day.date) ? ', обрано' : ''}`" :aria-current="day.date === todayInput() ? 'date' : undefined" :aria-pressed="isSelected(day.date)" @click="toggleDate(day.date)">
                  <span>{{ day.day }}</span>
                  <ExclamationTriangleIcon v-if="drafts.some(draft => draft.date === day.date && draft.error)" class="availability-day-status h-2.5 w-2.5" aria-hidden="true" />
                  <ClockIcon v-else-if="isExisting(day.date)" class="availability-day-status h-2.5 w-2.5" aria-hidden="true" />
                  <CheckIcon v-else-if="isSelected(day.date)" class="availability-day-status h-2.5 w-2.5" aria-hidden="true" />
                  <span v-if="day.date === todayInput()" class="availability-today-dot" aria-hidden="true" />
                </BaseButton>
                <span v-else aria-hidden="true" />
              </template>
            </div>
            <div class="availability-shortcuts mt-1 flex flex-nowrap gap-1">
              <BaseButton type="button" variant="secondary" size="sm" :disabled="!canPick" @click="selectMonth(true)"><BriefcaseIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Будні</BaseButton>
              <BaseButton type="button" variant="secondary" size="sm" :disabled="!canPick" @click="selectMonth(false)"><CheckCircleIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Увесь місяць</BaseButton>
              <BaseButton type="button" variant="ghost" size="sm" :disabled="locked || !drafts.length" @click="drafts = []; formError = ''" aria-label="Очистити" title="Очистити"><TrashIcon class="h-3.5 w-3.5" aria-hidden="true" /><span class="hidden sm:inline">Очистити</span></BaseButton>
            </div>

            <div class="availability-legend mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ui-secondary">
              <span><span class="legend-dot today" />Сьогодні</span><span><ClockIcon class="inline h-3 w-3" /> Вже відкрито</span><span><CheckIcon class="inline h-3 w-3" /> Нові дні</span><span><span class="legend-dot editing" />Редагування</span>
            </div>
            <div v-if="existingWindows.length" class="mt-2 space-y-1">
              <p class="text-[11px] leading-relaxed text-ui-secondary"><ClockIcon class="mr-0.5 inline h-3.5 w-3.5" aria-hidden="true" />Дні з годинником уже у графіку. Оберіть день, щоб переглянути та закрити його інтервали.</p>
              <BaseButton type="button" variant="danger-outline" size="sm" :disabled="!canPick" @click="showExistingSchedule"><LockClosedIcon class="h-4 w-4" aria-hidden="true" />Закрити інтервали</BaseButton>
            </div>
            <section v-if="existingForFocusedDate.length" :id="fieldId('existing-panel')" :data-existing-date="focusedDate" class="availability-existing mt-2 rounded-lg border border-ui p-2">
              <h3 class="text-xs font-semibold text-ui-primary">{{ formatDate(focusedDate) }} · Відкритий час</h3>
              <ul class="mt-1 text-xs text-ui-secondary"><li v-for="window in existingForFocusedDate" :key="window.id">{{ timeInKyiv(window.start_at) }}–{{ timeInKyiv(window.end_at) }}<span v-if="dateInKyiv(window.start_at) !== dateInKyiv(new Date(new Date(window.end_at).getTime() - 1).toISOString())"> · {{ formatDate(dateInKyiv(window.start_at)) }} — {{ formatDate(dateInKyiv(new Date(new Date(window.end_at).getTime() - 1).toISOString())) }}</span></li></ul>
              <p class="mt-1 text-[10px] text-ui-muted"><span v-if="hasSpanningWindow">Цей інтервал охоплює кілька днів. Закриття тут недоступне; зверніться до адміністратора. </span>Бронювання не видаляються.</p>
              <p v-if="closeError" class="availability-error mt-1 text-xs" role="alert">{{ closeError }}</p>
              <BaseButton type="button" variant="danger-outline" size="sm" class="mt-2" :disabled="!canPick || hasSpanningWindow || focusedDate < todayInput()" :loading="saving" loading-label="Збереження графіка" @click="closeExistingDay"><LockClosedIcon class="h-4 w-4" aria-hidden="true" />Закрити день</BaseButton>
            </section>
          </section>
          <div class="min-w-0 space-y-2.5">
          <section class="availability-common rounded-lg border border-ui p-1 sm:p-2">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold text-ui-primary"><ClockIcon class="h-4 w-4" aria-hidden="true" />Спільний час</h3>

            <div class="mt-0.5 grid min-w-0 grid-cols-[minmax(0,1fr)_10px_minmax(0,1fr)_32px] items-center gap-1.5">
              <BaseInput v-model="form.start_time" type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :spellcheck="false" :aria-invalid="Boolean(commonError)" :aria-describedby="commonError ? fieldId('common-error') : fieldId('time-help')" aria-label="Початок для всіх" @input="commonError && (commonError = timeError(form.start_time, form.end_time))" @blur="commonError = timeError(form.start_time, form.end_time)" input-class="base-control min-w-0 w-full px-2 py-1.5 text-sm" />
              <span class="self-center text-center text-ui-muted" aria-hidden="true">-</span>
              <BaseInput v-model="form.end_time" type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :spellcheck="false" :aria-invalid="Boolean(commonError)" :aria-describedby="commonError ? fieldId('common-error') : fieldId('time-help')" aria-label="Завершення для всіх" @input="commonError && (commonError = timeError(form.start_time, form.end_time))" @blur="commonError = timeError(form.start_time, form.end_time)" input-class="base-control min-w-0 w-full px-2 py-1.5 text-sm" />
              <BaseButton type="button" variant="success" class="flex h-8 w-8 items-center justify-center rounded-lg" aria-label="Застосувати до обраних" title="Застосувати до обраних" :disabled="locked || !drafts.length" @click="applyTimes"><CheckIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></BaseButton>
            </div>
            <p :id="fieldId('time-help')" class="mt-1 text-[10px] text-ui-muted">ГГ:ХХ · {{ calendar.workdayStart }}–{{ calendar.workdayEnd }} · 24-годинний формат</p>
            <p v-if="commonError" :id="fieldId('common-error')" class="availability-error mt-1 text-xs" role="alert">{{ commonError }}</p>
          </section>
          <section v-if="selectedDays.length" class="min-w-0" aria-label="Обрані дні">
            <h3 class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ui-primary sm:text-sm" aria-live="polite"><CalendarDaysIcon class="h-4 w-4" aria-hidden="true" />Обрано днів: {{ selectedDays.length }}</h3>
            <div class="availability-drafts grid grid-cols-2 gap-1 overflow-y-auto">
              <div v-for="day in selectedDays" :key="day.date" :data-selected-date="day.date" :class="{ 'is-editing': focusedDate === day.date, 'is-error': day.error }" class="availability-draft rounded-lg px-1 py-0.5 sm:px-2">
                <div class="availability-draft-row grid min-w-0 items-center gap-1">
                  <span class="text-[10px] font-semibold text-ui-primary" :title="formatDate(day.date)"><ExclamationTriangleIcon v-if="day.error" class="availability-error inline h-3 w-3" aria-hidden="true" />{{ compactDate(day.date) }}</span>
                  <BaseInput v-model="day.start" type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :spellcheck="false" :id="fieldId('start', day.date)" :aria-invalid="Boolean(day.error)" :aria-describedby="day.error ? fieldId('error', day.date) : fieldId('time-help')" :aria-label="`Початок ${day.date}`" @focus="focusedDate = day.date" required input-class="base-control min-w-0 w-full px-1 py-1 text-xs" @input="editDay(day)" @blur="validateDay(day)" />
                  <span class="text-center text-ui-muted" aria-hidden="true">-</span>
                  <BaseInput v-model="day.end" type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :spellcheck="false" :aria-invalid="Boolean(day.error)" :aria-describedby="day.error ? fieldId('error', day.date) : fieldId('time-help')" :aria-label="`Завершення ${day.date}`" @focus="focusedDate = day.date" required input-class="base-control min-w-0 w-full px-1 py-1 text-xs" @input="editDay(day)" @blur="validateDay(day)" />
                  <BaseButton type="button" class="availability-remove flex h-7 w-[18px] items-center justify-center rounded-lg" :aria-label="`Прибрати ${formatDate(day.date)}`" @click="toggleDate(day.date)"><XMarkIcon class="h-4 w-4" aria-hidden="true" /></BaseButton>
                </div>
                <p v-if="day.error" :id="fieldId('error', day.date)" class="availability-error mt-1 text-[10px]" role="alert">{{ day.error }}</p>
              </div>
            </div>
          </section>
          </div>
          </div>
          <div v-if="formError" class="availability-error text-xs" role="alert">{{ formError }} <BaseButton v-if="hasErrors" type="button" class="underline" @click="focusError">Перейти до помилки</BaseButton></div>
          <div class="backoffice-modal-actions">
            <BaseButton type="submit" :disabled="!canPick || !drafts.length" :loading="saving" loading-label="Відкриття доступності" class="backoffice-modal-action-button backoffice-modal-action-success">
              <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
              Відкрити {{ drafts.length }} днів
            </BaseButton>
          </div>
        </fieldset>
      </form>
</template>

<style scoped>
.availability-day {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--bo-surface-elevated);
  color: var(--bo-text-primary);
  font-size: 13px;
  font-weight: 500;
}
.availability-day { background: color-mix(in srgb, var(--bo-surface-elevated) 65%, transparent); }
.availability-day.is-existing {
  background: linear-gradient(160deg, #4f7566, #3b5f52) !important;
  color: #ffffff !important;
}
.availability-day.is-selected {
  background: linear-gradient(160deg, #477950, #356540) !important;
  color: #ffffff !important;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), 0 2px 5px rgb(25 60 37 / 0.12);
}
.availability-day.is-editing {
  background: linear-gradient(160deg, #3d6e94, #315f88) !important;
  color: #ffffff !important;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14), 0 2px 6px rgb(30 65 95 / 0.18);
}
.availability-day.is-error {
  background: linear-gradient(160deg, #a34b53, #84343d) !important;
  color: #ffffff !important;
}
.availability-day-status {
  position: absolute;
  right: 2px;
  top: 2px;
  padding: 1px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.17);
  stroke-width: 2;
}
.availability-today-dot { position: absolute; bottom: 2px; left: calc(50% - 2px); width: 4px; height: 4px; border-radius: 50%; background: var(--bo-warning); }
.legend-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--bo-text-primary); margin-right: 3px; }
.legend-dot.today { background: var(--bo-warning); }
.legend-dot.editing { background: var(--bo-info); }
.availability-error { color: var(--bo-danger-text); }
.availability-common {
  background: color-mix(in srgb, var(--bo-accent) 12%, var(--bo-surface-elevated));
}
.availability-existing { background: color-mix(in srgb, var(--bo-accent) 7%, transparent); }
.availability-draft.is-editing { background: var(--bo-info-surface); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08); }
.availability-draft.is-error { background: var(--bo-danger-surface); box-shadow: none; }
.availability-day:disabled { opacity: 0.3; cursor: not-allowed; }
.availability-day:focus-visible { outline: 2px solid var(--bo-info); outline-offset: 1px; }
@media (hover: hover) and (pointer: fine) {
  .availability-day:not(:disabled):not(.is-selected):hover { background: var(--bo-surface-hover); }
}
</style>

<style>
/* Keep the dense list calm in both the embedded and standalone planner. */
.availability-form .backoffice-modal-actions { margin-top: auto; }
.availability-draft {
  background: linear-gradient(180deg, rgb(255 255 255 / 0.06), transparent), color-mix(in srgb, var(--bo-control) 82%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 1px 2px rgb(0 0 0 / 0.04);
}
.availability-form .availability-draft .availability-draft-row input.base-control {
  border-color: transparent !important;
  background: color-mix(in srgb, var(--bo-surface-elevated) 80%, transparent) !important;
  box-shadow: none !important;
}
.availability-form .availability-draft-row input:focus-visible {
  outline: 2px solid var(--bo-accent);
  outline-offset: -2px;
}
.availability-remove, .availability-remove svg { color: var(--bo-danger-text) !important; }
@media (hover: hover) and (pointer: fine) {
  .availability-remove:hover { background: var(--bo-danger-surface); }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .availability-draft { background: var(--bo-surface-elevated); box-shadow: none; }
}
@media (forced-colors: active) {
  .availability-draft { outline: 1px solid CanvasText; }
  .availability-form .availability-draft .availability-draft-row input.base-control { border-color: ButtonText !important; }
  .availability-remove, .availability-remove svg { color: ButtonText !important; }
}
.availability-draft-row { grid-template-columns: 28px minmax(0, 1fr) 6px minmax(0, 1fr) 18px; gap: 2px; }
.availability-form .availability-draft-row input { min-height: 28px !important; height: 28px; border-radius: 6px; font-size: 10px !important; padding-left: 1px !important; padding-right: 1px !important; text-align: center; }
.availability-drafts { max-height: 216px; align-items: start; overscroll-behavior: contain; }
.availability-common button { min-height: 32px; height: 32px; }
.availability-calendar > div:first-child button { min-height: 28px; height: 28px; width: 28px; }
.availability-shortcuts button { gap: 4px; padding: 4px 6px; white-space: nowrap; }
.availability-form .availability-layout > div > section:first-child input { min-height: 32px; height: 32px; padding-top: 4px; padding-bottom: 4px; }
@media (max-width: 639px) {
  .availability-drafts { max-height: 144px; }
  .availability-form .availability-draft-row { gap: 2px; }
  .availability-form .availability-draft-row input { font-size: 10px; padding-left: 1px; padding-right: 1px; }
  .availability-form .backoffice-modal-actions { margin-top: auto; padding-top: 6px; padding-bottom: 0; }
}
</style>
