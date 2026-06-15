<script setup lang="ts">
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  LockOpenIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master } from '~/composables/useBackofficeApi'

type PeriodPreset = 'day' | 'week' | 'month' | 'custom'
type WindowType = 'full_day' | 'custom'
type SelectMenu = 'master' | 'period' | 'window' | null

const props = withDefaults(defineProps<{
  modelValue: boolean
  admin?: boolean
  masters?: Master[]
  disabled?: boolean
}>(), {
  admin: false,
  masters: () => [],
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const toast = useBaseToastNotification()
const calendar = useBookingCalendar()
const {
  todayInput,
  addDaysInput,
  toKyivIso,
  masterName,
  apiErrorMessage,
} = useBookingFormatting()

const periodOptions: Array<{ value: PeriodPreset, label: string, description: string, icon: typeof SunIcon }> = [
  { value: 'day', label: 'День', description: 'Одна дата', icon: SunIcon },
  { value: 'week', label: 'Тиждень', description: '7 календарних днів', icon: CalendarDaysIcon },
  { value: 'month', label: 'Місяць', description: '1 календарний місяць', icon: CalendarIcon },
  { value: 'custom', label: 'Власний період', description: 'Діапазон дат', icon: AdjustmentsHorizontalIcon },
]

const windowTypeOptions: Array<{ value: WindowType, label: string, description: string, icon: typeof LockOpenIcon }> = [
  { value: 'full_day', label: 'Повний день', description: '09:00-20:00', icon: LockOpenIcon },
  { value: 'custom', label: 'Власний час', description: 'Свій інтервал', icon: ClockIcon },
]

const form = reactive({
  master_id: '',
  period_preset: 'day' as PeriodPreset,
  date_from: todayInput(),
  date_to: todayInput(),
  window_type: 'full_day' as WindowType,
  start_time: calendar.workdayStart,
  end_time: calendar.workdayEnd,
})
const formError = ref('')
const saving = ref(false)
const openMenu = ref<SelectMenu>(null)
const masterSelectRef = ref<HTMLElement | null>(null)
const periodSelectRef = ref<HTMLElement | null>(null)
const windowSelectRef = ref<HTMLElement | null>(null)

const addCalendarMonthsInput = (dateInput: string, months: number) => {
  const [year, month, day] = dateInput.split('-').map(Number)
  const monthIndex = month - 1 + months
  const nextYear = year + Math.floor(monthIndex / 12)
  const nextMonthIndex = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(nextYear, nextMonthIndex + 1, 0, 12)).getUTCDate()
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

const horizonEnd = computed(() => addCalendarMonthsInput(todayInput(), 2))
const selectedMaster = computed(() => props.masters.find(master => String(master.id) === form.master_id) || null)
const selectedPeriod = computed(() => periodOptions.find(option => option.value === form.period_preset) || periodOptions[0])
const selectedWindowType = computed(() => windowTypeOptions.find(option => option.value === form.window_type) || windowTypeOptions[0])
const selectableEndDate = computed(() => form.period_preset === 'custom')

const masterImageUrl = (master?: Master | null) =>
  master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''
const masterInitials = (master?: Master | null) => initials(masterName(master)) || 'SC'

const presetEndDate = (preset: PeriodPreset, dateFrom: string) => {
  if (preset === 'week') return addDaysInput(dateFrom, 6)
  if (preset === 'month') return addCalendarMonthsInput(dateFrom, 1)
  return dateFrom
}

const syncDateRangeToPreset = () => {
  if (form.period_preset !== 'custom') {
    form.date_to = presetEndDate(form.period_preset, form.date_from)
  }
}

const fillForm = () => {
  form.master_id = ''
  form.period_preset = 'day'
  form.date_from = todayInput()
  form.date_to = todayInput()
  form.window_type = 'full_day'
  form.start_time = calendar.workdayStart
  form.end_time = calendar.workdayEnd
  openMenu.value = null
  formError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

watch(
  () => form.period_preset,
  () => syncDateRangeToPreset(),
)

watch(
  () => form.date_from,
  () => syncDateRangeToPreset(),
)

watch(
  () => form.window_type,
  value => {
    if (value === 'full_day') {
      form.start_time = calendar.workdayStart
      form.end_time = calendar.workdayEnd
    }
  },
)

const toggleMenu = (menu: SelectMenu) => {
  openMenu.value = openMenu.value === menu ? null : menu
}

const selectMaster = (master: Master) => {
  form.master_id = String(master.id)
  openMenu.value = null
}

const selectPeriod = (preset: PeriodPreset) => {
  form.period_preset = preset
  syncDateRangeToPreset()
  openMenu.value = null
}

const selectWindowType = (windowType: WindowType) => {
  form.window_type = windowType
  openMenu.value = null
}

const datesInRange = () => {
  const dates: string[] = []
  let cursor = form.date_from
  while (cursor <= form.date_to) {
    dates.push(cursor)
    cursor = addDaysInput(cursor, 1)
  }
  return dates
}

const businessDatesInRange = () =>
  datesInRange().filter(date => !calendar.isMonday(date))

const validate = () => {
  if (props.admin && !form.master_id) return 'Майстер обов’язковий.'
  if (!form.date_from || !form.date_to) return 'Період обов’язковий.'
  if (form.date_from > form.date_to) return 'Дата початку має бути раніше або дорівнювати даті завершення.'
  if (form.date_from < todayInput()) return 'Минулі дні не можна відкривати для запису.'
  if (form.date_to > horizonEnd.value) return 'Доступність можна відкривати лише на найближчі 2 місяці.'
  if (!businessDatesInRange().length) {
    return form.period_preset === 'day' ? 'Понеділок — вихідний день.' : 'У діапазоні немає робочих днів для відкриття.'
  }
  if (!form.window_type) return 'Тип доступності обов’язковий.'
  if (!form.start_time || !form.end_time) return 'Час початку й завершення обов’язкові.'
  if (form.start_time >= form.end_time) return 'Час початку має бути раніше часу завершення.'
  if (form.start_time < calendar.workdayStart || form.end_time > calendar.workdayEnd) {
    return `Інтервал має бути в межах ${calendar.workdayStart}-${calendar.workdayEnd}.`
  }
  if (new Date(toKyivIso(form.date_from, form.end_time)).getTime() <= Date.now()) return 'Минулий час не можна відкривати для запису.'
  return ''
}

const createWindowForDate = async (date: string) => {
  const payload = {
    start_at: toKyivIso(date, form.window_type === 'full_day' ? calendar.workdayStart : form.start_time),
    end_at: toKyivIso(date, form.window_type === 'full_day' ? calendar.workdayEnd : form.end_time),
  }

  if (props.admin) {
    await api.adminCreateAvailabilityWindow({
      master_id: Number(form.master_id),
      ...payload,
    })
    return
  }

  await api.createMyAvailabilityWindow(payload)
}

const submit = async () => {
  formError.value = validate()
  if (formError.value) {
    toast.warning(formError.value)
    return
  }

  saving.value = true
  const dates = businessDatesInRange()
  let created = 0
  let failed = 0
  let lastError: unknown = null

  try {
    for (const date of dates) {
      try {
        await createWindowForDate(date)
        created += 1
      }
      catch (cause) {
        failed += 1
        lastError = cause
      }
    }

    if (!created) {
      formError.value = apiErrorMessage(lastError, 'Не вдалося відкрити доступність.')
      toast.error(formError.value)
      return
    }

    if (failed) {
      toast.warning(`Відкрито ${created} інтервалів, ${failed} не вдалося відкрити.`)
    }
    emit('saved', created === 1 ? 'Доступність відкрито для запису.' : `Відкрито ${created} інтервалів для запису.`)
    close()
  }
  finally {
    saving.value = false
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Node)) return
  if (
    masterSelectRef.value?.contains(target)
    || periodSelectRef.value?.contains(target)
    || windowSelectRef.value?.contains(target)
  ) return
  openMenu.value = null
}

watch(
  () => props.modelValue,
  open => {
    if (open) fillForm()
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-2xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <p class="text-[11px] uppercase tracking-[0.18em] text-cyan-700">{{ admin ? 'Адмін' : 'Доступність' }}</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-900">Відкрити для запису</h2>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-3" @submit.prevent="submit">
        <div v-if="admin" ref="masterSelectRef" class="relative space-y-1 text-xs text-slate-700">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <UserCircleIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
            Майстер
          </span>
          <button
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
          </button>
          <div
            v-if="openMenu === 'master'"
            class="booking-select-menu absolute z-[220] mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
          >
            <button
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
            </button>
          </div>
        </div>

        <div class="grid gap-2.5 md:grid-cols-2">
          <div ref="periodSelectRef" class="relative space-y-1 text-xs text-slate-700">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <CalendarDaysIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Період
            </span>
            <button
              type="button"
              class="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-left text-sm"
              :aria-expanded="openMenu === 'period'"
              @click="toggleMenu('period')"
            >
              <span class="flex min-w-0 items-center gap-2">
                <component :is="selectedPeriod.icon" class="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span class="min-w-0">
                  <span class="block truncate font-medium text-slate-900">{{ selectedPeriod.label }}</span>
                  <span class="block truncate text-xs text-slate-500">{{ selectedPeriod.description }}</span>
                </span>
              </span>
              <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-400 transition" :class="openMenu === 'period' ? 'rotate-180' : ''" aria-hidden="true" />
            </button>
            <div v-if="openMenu === 'period'" class="booking-select-menu absolute z-[210] mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              <button
                v-for="option in periodOptions"
                :key="option.value"
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-slate-50"
                :class="form.period_preset === option.value ? 'bg-slate-50' : ''"
                @click="selectPeriod(option.value)"
              >
                <component :is="option.icon" class="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span class="min-w-0">
                  <span class="block truncate font-medium text-slate-900">{{ option.label }}</span>
                  <span class="block truncate text-xs text-slate-500">{{ option.description }}</span>
                </span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <label class="space-y-1 text-xs text-slate-700">
              <span class="inline-flex items-center gap-1.5 font-medium">
                <CalendarIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
                Від
              </span>
              <input v-model="form.date_from" required type="date" :min="todayInput()" :max="horizonEnd" class="min-h-10 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm">
            </label>
            <label class="space-y-1 text-xs text-slate-700">
              <span class="inline-flex items-center gap-1.5 font-medium">
                <CalendarIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
                До
              </span>
              <input v-model="form.date_to" required type="date" :disabled="!selectableEndDate" :min="form.date_from || todayInput()" :max="horizonEnd" class="min-h-10 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100">
            </label>
          </div>
        </div>

        <div class="grid gap-2.5 md:grid-cols-2">
          <div ref="windowSelectRef" class="relative space-y-1 text-xs text-slate-700">
            <span class="inline-flex items-center gap-1.5 font-medium">
              <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
              Час
            </span>
            <button
              type="button"
              class="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-left text-sm"
              :aria-expanded="openMenu === 'window'"
              @click="toggleMenu('window')"
            >
              <span class="flex min-w-0 items-center gap-2">
                <component :is="selectedWindowType.icon" class="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span class="min-w-0">
                  <span class="block truncate font-medium text-slate-900">{{ selectedWindowType.label }}</span>
                  <span class="block truncate text-xs text-slate-500">{{ selectedWindowType.description }}</span>
                </span>
              </span>
              <ChevronDownIcon class="h-4 w-4 shrink-0 text-slate-400 transition" :class="openMenu === 'window' ? 'rotate-180' : ''" aria-hidden="true" />
            </button>
            <div v-if="openMenu === 'window'" class="booking-select-menu absolute z-[200] mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              <button
                v-for="option in windowTypeOptions"
                :key="option.value"
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-slate-50"
                :class="form.window_type === option.value ? 'bg-slate-50' : ''"
                @click="selectWindowType(option.value)"
              >
                <component :is="option.icon" class="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span class="min-w-0">
                  <span class="block truncate font-medium text-slate-900">{{ option.label }}</span>
                  <span class="block truncate text-xs text-slate-500">{{ option.description }}</span>
                </span>
              </button>
            </div>
          </div>

          <div class="grid gap-2.5 md:grid-cols-2">
            <label class="space-y-1 text-xs text-slate-700">
              <span class="inline-flex items-center gap-1.5 font-medium">
                <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
                Початок
              </span>
              <input v-model="form.start_time" :disabled="form.window_type === 'full_day'" type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="min-h-10 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100">
            </label>
            <label class="space-y-1 text-xs text-slate-700">
              <span class="inline-flex items-center gap-1.5 font-medium">
                <ClockIcon class="h-4 w-4 text-slate-500" aria-hidden="true" />
                Завершення
              </span>
              <input v-model="form.end_time" :disabled="form.window_type === 'full_day'" type="time" :min="calendar.workdayStart" :max="calendar.workdayEnd" class="min-h-10 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100">
            </label>
          </div>
        </div>

        <p class="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Понеділки в діапазоні автоматично пропускаються.
        </p>
        <p v-if="formError" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{{ formError }}</p>

        <div class="backoffice-modal-actions">
          <button type="submit" :disabled="saving || disabled" class="backoffice-modal-action-button backoffice-modal-action-success">
            <LockOpenIcon v-if="!saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Відкриття...' : 'Відкрити для запису' }}
          </button>
          <button type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" @click="fillForm">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Скинути
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
