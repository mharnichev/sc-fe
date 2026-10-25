<script setup lang="ts">
import { CalendarDaysIcon, CheckIcon, CheckCircleIcon, ClockIcon, BriefcaseIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, LockOpenIcon, UserCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master } from '~/composables/useBackofficeApi'

type DayDraft = { date: string, start: string, end: string, error: string }
const props = withDefaults(defineProps<{ modelValue: boolean, admin?: boolean, masters?: Master[], disabled?: boolean, initialDate?: string, initialMasterId?: number | null, initialStartTime?: string, initialEndTime?: string }>(), { admin: false, masters: () => [], disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: boolean], saved: [message: string] }>()
const api = useBackofficeApi()
const auth = useAuthStore()
let generation = 0
let disposed = false
const sessionKey = () => JSON.stringify([auth.sessionRevision, auth.user?.id, auth.user?.role, auth.user?.master_id, auth.user?.is_superuser])
const assetUrl = useAssetUrl()
const toast = useBaseToastNotification()
const calendar = useBookingCalendar()
const { todayInput, addDaysInput, toKyivIso, masterName, apiErrorMessage } = useBookingFormatting()
const form = reactive({ master_id: '', start_time: calendar.workdayStart, end_time: calendar.workdayEnd })
const drafts = ref<DayDraft[]>([])
const selectedDays = computed(() => [...drafts.value].sort((a, b) => a.date.localeCompare(b.date)))
const formError = ref('')
const saving = ref(false)
const locked = computed(() => saving.value || props.disabled)
const openMenu = ref<'master' | null>(null)
const masterSelectRef = ref<HTMLElement | null>(null)
const addCalendarMonthsInput = (date: string, months: number) => {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`
}
const horizonEnd = computed(() => addCalendarMonthsInput(todayInput(), 2))
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(`${date}T12:00:00Z`))
  && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
const visibleMonth = ref(todayInput().slice(0, 7))
const monthLabel = computed(() => new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${visibleMonth.value}-01T12:00:00Z`)))
const compactDate = (date: string) => `${date.slice(8)}.${date.slice(5, 7)}`
const formatDate = (date: string) => new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
const monthDays = computed(() => {
  const first = `${visibleMonth.value}-01`
  const days = new Date(`${first}T12:00:00Z`)
  const offset = (days.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(days.getUTCFullYear(), days.getUTCMonth() + 1, 0)).getUTCDate()
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
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
  if (locked.value || date < todayInput() || date > horizonEnd.value) return
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
  if (locked.value) return
  for (const day of monthDays.value) {
    if (!day || day.disabled || isSelected(day.date)) continue
    const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay()
    if (!weekdays || (weekday !== 0 && weekday !== 6)) drafts.value.push({ date: day.date, start: form.start_time, end: form.end_time, error: '' })
  }
  formError.value = ''
}
const timeError = (start: string, end: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return 'Вкажіть час початку й завершення.'
  if (start >= end) return 'Початок має бути раніше завершення.'
  if (start < calendar.workdayStart || end > calendar.workdayEnd) return `Час має бути в межах ${calendar.workdayStart}–${calendar.workdayEnd}.`
  return ''
}
const applyTimes = () => {
  if (locked.value) return
  formError.value = timeError(form.start_time, form.end_time)
  if (formError.value) return
  for (const day of drafts.value) { day.start = form.start_time; day.end = form.end_time; day.error = '' }
}
const fillForm = () => {
  form.master_id = ''; form.start_time = calendar.workdayStart; form.end_time = calendar.workdayEnd
  drafts.value = []; visibleMonth.value = todayInput().slice(0, 7); openMenu.value = null; formError.value = ''
  form.master_id = props.initialMasterId ? String(props.initialMasterId) : ''
  if (props.initialStartTime && props.initialEndTime && !timeError(props.initialStartTime, props.initialEndTime)) {
    form.start_time = props.initialStartTime
    form.end_time = props.initialEndTime
  }
  const date = props.initialDate
  if (date && validDate(date) && date >= todayInput() && date <= horizonEnd.value) {
    visibleMonth.value = date.slice(0, 7)
    drafts.value = [{ date, start: form.start_time, end: form.end_time, error: '' }]
  }
}
const close = () => { if (!saving.value) emit('update:modelValue', false) }
const validate = () => {
  if (!auth.user || (props.admin && !(auth.user.is_superuser || auth.user.role === 'admin'))) return 'Сесію змінено. Відкрийте форму знову.'
  if (props.admin && (!Number.isSafeInteger(Number(form.master_id)) || Number(form.master_id) <= 0 || !selectedMaster.value)) return 'Виберіть майстра.'
  if (!drafts.value.length) return 'Оберіть дні в календарі.'
  for (const day of drafts.value) {
    day.error = !validDate(day.date) || day.date < todayInput() || day.date > horizonEnd.value ? 'Дата поза дозволеним періодом.' : timeError(day.start, day.end)
    if (!day.error && new Date(toKyivIso(day.date, day.end)).getTime() <= Date.now()) day.error = 'Минулий час не можна відкривати для запису.'
  }
  return drafts.value.some(day => day.error) ? 'Перевірте час у позначених днях.' : ''
}
const submit = async () => {
  if (locked.value || !props.modelValue || disposed) return
  formError.value = validate()
  if (formError.value) return
  saving.value = true
  openMenu.value = null
  const failed: DayDraft[] = []
  const batch = selectedDays.value.map(day => ({ ...day }))
  const revision = ++generation
  const identity = sessionKey()
  const admin = props.admin
  const masterId = Number(form.master_id)
  const current = () => !disposed && revision === generation && identity === sessionKey() && props.modelValue && !props.disabled && props.admin === admin
  const readWindows = (date: string) => {
    const filters = { date_from: toKyivIso(date, '00:00'), date_to: toKyivIso(addDaysInput(date, 1), '00:00'), master_id: masterId }
    return admin ? api.adminGetAvailability(filters) : api.getMyAvailability(filters)
  }
  const matches = (windows: Array<{ start_at: string, end_at: string }>, payload: { start_at: string, end_at: string }) => windows.some(window =>
    Date.parse(window.start_at) === Date.parse(payload.start_at) && Date.parse(window.end_at) === Date.parse(payload.end_at))
  let created = 0
  try {
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
        day.error = apiErrorMessage(cause, 'Не вдалося відкрити цей день.'); failed.push(day)
      }
    }
    if (!current()) return
    drafts.value = failed
    if (created) emit('saved', `Відкрито днів: ${created}.`)
    if (failed.length) {
      formError.value = `Не збережено днів: ${failed.length}. Перевірте повідомлення біля дат і спробуйте ще раз.`
      toast.warning(formError.value)
    }
    else emit('update:modelValue', false)
  }
  finally { if (revision === generation && !disposed) saving.value = false }
}
const handleClickOutside = (event: MouseEvent) => {
  if (event.target instanceof Node && !masterSelectRef.value?.contains(event.target)) openMenu.value = null
}
watch(() => props.modelValue, open => {
  generation++
  saving.value = false
  if (open) fillForm()
}, { immediate: true })
watch(sessionKey, () => {
  generation++
  saving.value = false
  drafts.value = []
  emit('update:modelValue', false)
}, { flush: 'sync' })
onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onBeforeRouteLeave(() => {
  generation++
  saving.value = false
  emit('update:modelValue', false)
})
onBeforeUnmount(() => { disposed = true; generation++; document.removeEventListener('mousedown', handleClickOutside) })
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="availability-modal max-w-4xl" aria-label="Відкрити для запису" :close-on-backdrop="!saving" :close-on-escape="!saving" @update:model-value="close">
    <template #head>
      <div class="flex items-start justify-between gap-2.5">
        <div>
          <p class="hidden text-[11px] uppercase tracking-[0.18em] text-ui-muted sm:block">{{ admin ? 'Адмін · Доступність' : 'Доступність' }}</p>
          <h2 class="flex items-center gap-2 text-base font-semibold text-ui-primary sm:mt-1 sm:text-lg"><LockOpenIcon class="h-5 w-5 text-ui-muted" aria-hidden="true" />Відкрити для запису</h2>
        </div>
        <ModalCloseButton :disabled="saving" @click="close" />
      </div>
    </template>
    <template #body>
      <form novalidate @submit.prevent="submit">
        <fieldset :disabled="locked" class="min-w-0 space-y-1 sm:space-y-2">
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


          <div class="availability-layout grid min-w-0 items-start gap-1 md:grid-cols-2 md:gap-3">
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
                <BaseButton type="button" v-if="day" class="availability-day" :class="{ 'is-selected': isSelected(day.date), 'is-today': day.date === todayInput() }" :disabled="locked || day.disabled" :data-date="day.date" :aria-label="formatDate(day.date)" :aria-pressed="isSelected(day.date)" @click="toggleDate(day.date)">{{ day.day }}</BaseButton>
                <span v-else aria-hidden="true" />
              </template>
            </div>
            <div class="availability-shortcuts mt-1 flex flex-nowrap gap-1">
              <BaseButton type="button" variant="secondary" size="sm" @click="selectMonth(true)"><BriefcaseIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Будні</BaseButton>
              <BaseButton type="button" variant="secondary" size="sm" @click="selectMonth(false)"><CheckCircleIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Увесь місяць</BaseButton>
              <BaseButton type="button" variant="ghost" size="sm" :disabled="locked || !drafts.length" @click="drafts = []; formError = ''" aria-label="Очистити" title="Очистити"><TrashIcon class="h-3.5 w-3.5" aria-hidden="true" /><span class="hidden sm:inline">Очистити</span></BaseButton>
            </div>

          </section>
          <div class="min-w-0 space-y-1 sm:space-y-2">
          <section class="availability-common rounded-lg border border-ui p-1 sm:p-2">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold text-ui-primary"><ClockIcon class="h-4 w-4" aria-hidden="true" />Спільний час</h3>

            <div class="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_10px_minmax(0,1fr)_32px] items-end gap-1.5">
              <BaseInput v-model="form.start_time" type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :spellcheck="false" aria-label="Початок для всіх" input-class="base-control min-w-0 w-full px-2 py-1.5 text-sm" />
              <span class="self-center text-center text-ui-muted" aria-hidden="true">-</span>
              <BaseInput v-model="form.end_time" type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :spellcheck="false" aria-label="Завершення для всіх" input-class="base-control min-w-0 w-full px-2 py-1.5 text-sm" />
              <BaseButton type="button" variant="success" class="flex h-8 w-8 items-center justify-center rounded-lg" aria-label="Застосувати до обраних" title="Застосувати до обраних" :disabled="locked || !drafts.length" @click="applyTimes"><CheckIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></BaseButton>
            </div>
          </section>
          <section v-if="selectedDays.length" class="min-w-0" aria-label="Обрані дні">
            <h3 class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ui-primary sm:text-sm" aria-live="polite"><CalendarDaysIcon class="h-4 w-4" aria-hidden="true" />Обрано днів: {{ selectedDays.length }}</h3>
            <div class="availability-drafts grid grid-cols-2 gap-1 overflow-y-auto">
              <div v-for="day in selectedDays" :key="day.date" :data-selected-date="day.date" class="availability-draft rounded-lg px-1 py-0.5 sm:px-2">
                <div class="availability-draft-row grid min-w-0 items-center gap-1">
                  <span class="text-[10px] font-semibold text-ui-primary" :title="formatDate(day.date)">{{ compactDate(day.date) }}</span>
                  <BaseInput v-model="day.start" type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :spellcheck="false" :aria-label="`Початок ${day.date}`" required input-class="base-control min-w-0 w-full px-1 py-1 text-xs" @input="day.error = ''" />
                  <span class="text-center text-ui-muted" aria-hidden="true">-</span>
                  <BaseInput v-model="day.end" type="text" inputmode="text" placeholder="ГГ:ХХ" :maxlength="5" autocomplete="off" :spellcheck="false" :aria-label="`Завершення ${day.date}`" required input-class="base-control min-w-0 w-full px-1 py-1 text-xs" @input="day.error = ''" />
                  <BaseButton type="button" class="availability-remove flex h-7 w-[18px] items-center justify-center rounded-lg" :aria-label="`Прибрати ${formatDate(day.date)}`" @click="toggleDate(day.date)"><XMarkIcon class="h-4 w-4" aria-hidden="true" /></BaseButton>
                </div>
                <p v-if="day.error" class="mt-1 text-xs text-red-500" role="alert">{{ day.error }}</p>
              </div>
            </div>
          </section>
          </div>
          </div>
          <p v-if="formError" class="text-xs text-red-500" role="alert">{{ formError }}</p>
          <div class="backoffice-modal-actions">
            <BaseButton type="submit" :disabled="locked || !drafts.length" :loading="saving" loading-label="Відкриття доступності" class="backoffice-modal-action-button backoffice-modal-action-success">
              <LockOpenIcon class="h-4 w-4" aria-hidden="true" />
              Відкрити {{ drafts.length }} днів
            </BaseButton>
          </div>
        </fieldset>
      </form>
    </template>
  </BaseModal>
</template>

<style scoped>
.availability-day {
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
.availability-day.is-today { border-color: var(--bo-accent); }
.availability-day.is-selected {
  background: var(--bo-accent) !important;
  border-color: var(--bo-accent) !important;
  color: var(--bo-on-action) !important;
  font-weight: 700;
}
.availability-day:disabled { opacity: 0.3; cursor: not-allowed; }
.availability-day:focus-visible { outline: 2px solid var(--bo-accent); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .availability-day:not(:disabled):not(.is-selected):hover { background: var(--bo-surface-hover); }
}
</style>

<style>
.availability-draft {
  background: linear-gradient(180deg, rgb(255 255 255 / 0.06), transparent), color-mix(in srgb, var(--bo-control) 82%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 1px 2px rgb(0 0 0 / 0.04);
}
.availability-modal .availability-draft .availability-draft-row input.base-control {
  border-color: transparent !important;
  background: color-mix(in srgb, var(--bo-surface-elevated) 80%, transparent) !important;
  box-shadow: none !important;
}
.availability-modal .availability-draft-row input:focus-visible { outline: 2px solid var(--bo-accent); outline-offset: -2px; }
.availability-remove, .availability-remove svg { color: var(--bo-danger-text) !important; }
@media (hover: hover) and (pointer: fine) {
  .availability-remove:hover { background: var(--bo-danger-surface); }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .availability-draft { background: var(--bo-surface-elevated); box-shadow: none; }
}
@media (forced-colors: active) {
  .availability-draft { outline: 1px solid CanvasText; }
  .availability-modal .availability-draft .availability-draft-row input.base-control { border-color: ButtonText !important; }
  .availability-remove, .availability-remove svg { color: ButtonText !important; }
}
.availability-modal .availability-draft-row { grid-template-columns: 34px minmax(0, 1fr) 6px minmax(0, 1fr) 28px; gap: 3px; }
.availability-modal .availability-draft-row input { min-height: 36px !important; height: 36px; border-radius: 6px; font-size: 12px !important; padding-left: 2px !important; padding-right: 2px !important; text-align: center; }
.availability-modal .availability-draft-row button { width: 28px; min-height: 36px; }
.availability-modal .availability-drafts { grid-template-columns: minmax(0, 1fr); }
.availability-drafts { max-height: clamp(160px, calc(100dvh - 430px), 420px); }
.availability-calendar > div:first-child button { min-height: 28px; height: 28px; width: 28px; }
.availability-shortcuts button { gap: 4px; padding: 4px 6px; white-space: nowrap; }
.availability-modal .availability-layout > div > section:first-child input { min-height: 32px; height: 32px; padding-top: 4px; padding-bottom: 4px; }
@media (max-width: 639px) {
  .availability-modal .base-modal__header button { min-height: 32px; height: 32px; width: 32px; }
  .availability-modal .availability-draft-row { gap: 2px; }
  .availability-modal .availability-draft-row input { font-size: 12px; }
  .availability-modal .base-modal__header { padding: 6px; }
  .availability-modal .base-modal__header + div { padding: 6px; }
  .availability-modal .backoffice-modal-actions { margin-top: 4px; padding-top: 2px; padding-bottom: 0; }
}
</style>
