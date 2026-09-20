<script setup lang="ts">
import { CalendarDaysIcon, ChartBarSquareIcon, ChatBubbleLeftRightIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, LockOpenIcon, PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Booking, Master, MasterAvailabilityWindow, TimeBlock } from '~/composables/useBackofficeApi'
import { intersectRanges, mergeRanges, minutesInRanges, rangesFromItems, subtractRanges, timestamp, type TimeRange } from '~/utils/scheduleIntervals'

interface CalendarDayColumn { date: string, dayNumber: number, weekday: string, isToday: boolean }
interface AvailabilityDaySummary { items: MasterAvailabilityWindow[], scheduledRanges: TimeRange[], ranges: TimeRange[], intervalsLabel: string, totalMinutes: number }
interface BlockDaySummary { items: TimeBlock[], ranges: TimeRange[], intervalsLabel: string, reasonsLabel: string, totalMinutes: number }
interface DaySchedule { availability: MasterAvailabilityWindow[], availabilitySummary: AvailabilityDaySummary | null, blocks: TimeBlock[], blockSummary: BlockDaySummary | null }
interface SelectedScheduleItem { date: string, kind: 'availability' | 'block', intervalsLabel: string, totalMinutes: number, reason?: string }

const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const auth = useAuthStore()
const toast = useBaseToastNotification()
const { todayInput, addDaysInput, formatTime, bookingStart, bookingEnd, masterName, normalizeItems, apiErrorMessage, toKyivIso } = useBookingFormatting()
const calendar = useBookingCalendar()

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (auth.user?.is_superuser || auth.user?.role === 'admin') return navigateTo('/time-blocks')
  },
})

const today = todayInput()
const anchorDate = ref(`${today.slice(0, 7)}-01`)
const timeBlockModalOpen = ref(false)
const availabilityModalOpen = ref(false)
const telegramConnectLoading = ref(false)
const telegramConnectLink = ref<string | null>(null)
const deletingAvailabilityId = ref<number | null>(null)
const deletingBlockIds = ref<number[]>([])
const availabilityToDelete = ref<MasterAvailabilityWindow | null>(null)
const blockSummaryToDelete = ref<BlockDaySummary | null>(null)
const selectedScheduleItem = ref<SelectedScheduleItem | null>(null)

const pad = (value: number) => String(value).padStart(2, '0')
const dateInput = (year: number, monthIndex: number, day: number) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`
const monthStart = computed(() => `${anchorDate.value.slice(0, 7)}-01`)
const monthEnd = computed(() => {
  const [year, month] = monthStart.value.split('-').map(Number)
  return `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0, 12)).getUTCDate())}`
})
const monthFormatter = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', timeZone: 'Europe/Kyiv' })
const selectedDayFormatter = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })
const monthLabel = computed(() => {
  const [year, month] = monthStart.value.split('-').map(Number)
  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1, 12)))
})
const monthRangeLabel = computed(() => `${monthStart.value} — ${monthEnd.value}`)
const activeFilterCount = computed(() => monthStart.value === `${todayInput().slice(0, 7)}-01` ? 0 : 1)
const addMonthsInput = (date: string, offset: number) => {
  const [year, month] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + offset, 1, 12))
  return dateInput(next.getUTCFullYear(), next.getUTCMonth(), 1)
}
const moveMonth = (offset: -1 | 1) => { anchorDate.value = addMonthsInput(monthStart.value, offset) }
const goToCurrentMonth = () => { anchorDate.value = `${todayInput().slice(0, 7)}-01` }

const { data: publicMasters } = useAsyncData('sidebar-public-masters', () => api.getPublicMasters())
const selfMaster = computed<Master | null>(() =>
  (publicMasters.value || []).find(master => Number(master.id) === Number(auth.user?.master_id)) || null,
)
const selfMasterName = computed(() => selfMaster.value ? masterName(selfMaster.value) : auth.user?.full_name || auth.user?.email || 'Майстер')
const selfMasterImageUrl = computed(() => {
  const master = selfMaster.value
  return master ? assetUrl(master.avatar || master.avatar_url || master.photo || master.photo_url) : ''
})
const selfMasterInitials = computed(() => initials(selfMasterName.value) || 'SC')

const { data, pending, error, refresh } = await useAsyncData(
  'my-time-blocks-month',
  async () => {
    const range = { date_from: toKyivIso(monthStart.value, '00:00'), date_to: toKyivIso(addDaysInput(monthEnd.value, 1), '00:00') }
    const availabilityRange = { date_from: toKyivIso(monthStart.value, calendar.workdayStart), date_to: toKyivIso(monthEnd.value, calendar.workdayEnd) }
    const [timeBlocks, availability, bookings] = await Promise.all([
      api.getMyTimeBlocks(range),
      api.getMyAvailability(availabilityRange),
      api.getMyCalendar(range),
    ])
    return { timeBlocks, availability, bookings }
  },
  { watch: [monthStart] },
)

const blocks = computed<TimeBlock[]>(() => normalizeItems(data.value?.timeBlocks))
const availabilityWindows = computed<MasterAvailabilityWindow[]>(() => normalizeItems(data.value?.availability))
const bookings = computed<Booking[]>(() => normalizeItems(data.value?.bookings))
const monthDays = computed<CalendarDayColumn[]>(() => {
  const [year, month] = monthStart.value.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  return Array.from({ length: lastDay }, (_, index) => {
    const date = addDaysInput(monthStart.value, index)
    return { date, dayNumber: Number(date.slice(8, 10)), weekday: weekdayFormatter.format(new Date(toKyivIso(date, '12:00'))).replace('.', ''), isToday: date === today }
  })
})

const intervalLabel = (startAt: string, endAt: string) => `${formatTime(startAt)}–${formatTime(endAt)}`
const rangeLabel = (range: TimeRange) => intervalLabel(new Date(range.start).toISOString(), new Date(range.end).toISOString())
const formatHours = (minutes: number) => {
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours.toLocaleString('uk-UA')} год` : `${hours.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} год`
}
const summarizeDayBlocks = (dayBlocks: TimeBlock[]): BlockDaySummary | null => {
  const items = [...new Map(dayBlocks.map(block => [block.id, block])).values()]
  const ranges = mergeRanges(rangesFromItems(items))
  if (!ranges.length) return null
  const reasons = [...new Set(items.map(block => block.reason?.trim()).filter((reason): reason is string => Boolean(reason)))]
  return { items, ranges, intervalsLabel: ranges.map(rangeLabel).join(', '), reasonsLabel: reasons.join(', ') || 'Блокування', totalMinutes: minutesInRanges(ranges) }
}
const summarizeDayAvailability = (availability: MasterAvailabilityWindow[], dayBlocks: TimeBlock[]): AvailabilityDaySummary | null => {
  const items = [...new Map(availability.map(window => [window.id, window])).values()]
  const scheduledRanges = mergeRanges(rangesFromItems(items))
  if (!scheduledRanges.length) return null
  const ranges = subtractRanges(scheduledRanges, intersectRanges(scheduledRanges, rangesFromItems(dayBlocks)))
  return { items, scheduledRanges, ranges, intervalsLabel: ranges.length ? ranges.map(rangeLabel).join(', ') : 'Немає доступного часу', totalMinutes: minutesInRanges(ranges) }
}
const scheduleByDay = computed<Record<string, DaySchedule>>(() => {
  const schedules: Record<string, DaySchedule> = {}
  const ensure = (date: string) => schedules[date] ||= { availability: [], availabilitySummary: null, blocks: [], blockSummary: null }
  for (const window of availabilityWindows.value) {
    const date = calendar.dateInputFromDateTime(window.start_at)
    if (date) ensure(date).availability.push(window)
  }
  for (const block of blocks.value) {
    const date = calendar.dateInputFromDateTime(block.start_at)
    if (date) ensure(date).blocks.push(block)
  }
  for (const schedule of Object.values(schedules)) {
    schedule.availability.sort((first, second) => first.start_at.localeCompare(second.start_at))
    schedule.blocks.sort((first, second) => first.start_at.localeCompare(second.start_at))
    schedule.availabilitySummary = summarizeDayAvailability(schedule.availability, schedule.blocks)
    schedule.blockSummary = summarizeDayBlocks(schedule.blocks)
  }
  return schedules
})
const availabilityRanges = computed(() => mergeRanges(rangesFromItems(availabilityWindows.value)))
const blockedRanges = computed(() => intersectRanges(availabilityRanges.value, rangesFromItems(blocks.value)))
const capacityRanges = computed(() => subtractRanges(availabilityRanges.value, blockedRanges.value))
const bookingRange = (booking: Booking): TimeRange | null => {
  const start = timestamp(bookingStart(booking))
  if (start == null || booking.status === 'cancelled') return null
  const end = timestamp(bookingEnd(booking))
  return { start, end: end && end > start ? end : start + 30 * 60000 }
}
const bookingRanges = computed(() => intersectRanges(capacityRanges.value, bookings.value.map(bookingRange).filter((range): range is TimeRange => Boolean(range))))
const scheduledMinutes = computed(() => minutesInRanges(availabilityRanges.value))
const blockedMinutes = computed(() => minutesInRanges(blockedRanges.value))
const capacityMinutes = computed(() => minutesInRanges(capacityRanges.value))
const bookedMinutes = computed(() => minutesInRanges(bookingRanges.value))
const freeMinutes = computed(() => Math.max(0, capacityMinutes.value - bookedMinutes.value))
const loadPercent = computed(() => capacityMinutes.value ? Math.round((bookedMinutes.value / capacityMinutes.value) * 100) : bookedMinutes.value ? 100 : 0)
const workDays = computed(() => Object.values(scheduleByDay.value).filter(schedule => schedule.availability.length).length)
const hasScheduleData = computed(() => availabilityWindows.value.length || blocks.value.length || bookings.value.length)
const selectAvailabilitySummary = (date: string, summary: AvailabilityDaySummary) => { selectedScheduleItem.value = { date, kind: 'availability', intervalsLabel: summary.intervalsLabel, totalMinutes: summary.totalMinutes } }
const selectBlockSummary = (date: string, summary: BlockDaySummary) => { selectedScheduleItem.value = { date, kind: 'block', intervalsLabel: summary.intervalsLabel, totalMinutes: summary.totalMinutes, reason: summary.reasonsLabel } }
const selectedScheduleLabel = computed(() => {
  const selected = selectedScheduleItem.value
  if (!selected) return 'Натисніть відкритий інтервал або блокування в таблиці.'
  return `${selectedDayFormatter.format(new Date(toKyivIso(selected.date, '12:00')))} · ${selected.kind === 'block' ? selected.reason || 'Блокування' : 'Доступно'} · ${selected.intervalsLabel} · ${formatHours(selected.totalMinutes)}`
})
watch(monthStart, () => { selectedScheduleItem.value = null })

const openTelegramConnect = async () => {
  telegramConnectLoading.value = true
  try {
    const response = await api.getMyMasterTelegramConnectLink()
    telegramConnectLink.value = response.connect_link
    if (import.meta.client) window.open(response.connect_link, '_blank', 'noopener,noreferrer')
    toast.success(response.telegram_connected ? 'Telegram вже підключено. Посилання оновлено.' : 'Посилання для Telegram створено.')
  }
  catch (cause) { toast.error(apiErrorMessage(cause, 'Не вдалося створити посилання для Telegram.')) }
  finally { telegramConnectLoading.value = false }
}
const copyTelegramConnectLink = async () => {
  if (!telegramConnectLink.value || !import.meta.client) return
  try { await navigator.clipboard.writeText(telegramConnectLink.value); toast.success('Посилання скопійовано.') }
  catch { toast.error('Не вдалося скопіювати посилання.') }
}
const handleSaved = async (message: string) => { toast.success(message); await refresh() }
const openDeleteAvailabilityConfirm = (window: MasterAvailabilityWindow) => { if (deletingAvailabilityId.value == null) availabilityToDelete.value = window }
const handleAvailabilityDeleteConfirmUpdate = (value: boolean) => { if (!value && deletingAvailabilityId.value == null) availabilityToDelete.value = null }
const confirmDeleteAvailability = async () => {
  const window = availabilityToDelete.value
  if (!window || deletingAvailabilityId.value != null) return
  deletingAvailabilityId.value = window.id
  try {
    await api.deleteMyAvailabilityWindow(window.id)
    toast.success('Відкритий інтервал закрито.')
    availabilityToDelete.value = null
    await refresh()
  }
  catch (cause) { toast.error(apiErrorMessage(cause, 'Не вдалося закрити доступність.')) }
  finally { deletingAvailabilityId.value = null }
}
const openDeleteBlockConfirm = (summary: BlockDaySummary) => { if (!deletingBlockIds.value.length) blockSummaryToDelete.value = summary }
const handleBlockDeleteConfirmUpdate = (value: boolean) => { if (!value && !deletingBlockIds.value.length) blockSummaryToDelete.value = null }
const confirmDeleteBlockSummary = async () => {
  const summary = blockSummaryToDelete.value
  if (!summary || deletingBlockIds.value.length) return
  deletingBlockIds.value = summary.items.map(block => block.id)
  const results = await Promise.allSettled(summary.items.map(block => api.deleteMyTimeBlock(block.id)))
  const deletedCount = results.filter(result => result.status === 'fulfilled').length
  const failedResult = results.find(result => result.status === 'rejected')
  try {
    await refresh()
    blockSummaryToDelete.value = null
    selectedScheduleItem.value = null
    if (failedResult) toast.error(apiErrorMessage(failedResult.reason, deletedCount ? `Видалено ${deletedCount} з ${summary.items.length} блокувань. Оновіть і повторіть спробу.` : 'Не вдалося видалити блокування часу.'))
    else toast.success(summary.items.length > 1 ? 'Блокування дня видалено.' : 'Блокування часу видалено.')
  }
  finally { deletingBlockIds.value = [] }
}
const availabilityDeleteContextItems = computed(() => availabilityToDelete.value ? [
  { label: 'Дата', value: selectedDayFormatter.format(new Date(availabilityToDelete.value.start_at)) },
  { label: 'Робочий час', value: intervalLabel(availabilityToDelete.value.start_at, availabilityToDelete.value.end_at) },
] : [])
const blockDeleteContextItems = computed(() => blockSummaryToDelete.value ? [
  { label: 'Заблоковано', value: `${formatHours(blockSummaryToDelete.value.totalMinutes)} · ${blockSummaryToDelete.value.intervalsLabel}` },
  { label: 'Причина', value: blockSummaryToDelete.value.reasonsLabel },
] : [])
const blockDeleteMessage = computed(() => {
  const count = blockSummaryToDelete.value?.items.length ?? 0
  return count > 1
    ? `Буде видалено всі блокування, об’єднані в цьому денному слоті (${count}).`
    : 'Цей інтервал блокування буде видалено з вашого графіка.'
})
</script>

<template>
  <div class="space-y-4 md:space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3 md:gap-4">
      <div>
        <p class="type-eyebrow ui-eyebrow text-xs md:text-sm">Особистий календар</p>
        <h1 class="type-page-title mt-1 text-2xl text-ui-primary md:mt-2 md:text-3xl">Моя доступність</h1>
        <p class="mt-1 text-sm text-ui-muted">Відкривайте час для запису й блокуйте недоступні інтервали у своєму графіку.</p>
      </div>
      <div class="grid w-full grid-cols-3 gap-1.5 min-[576px]:flex min-[576px]:w-auto min-[576px]:gap-2">
        <BaseButton type="button" variant="neutral" size="lg" class="min-w-0 !gap-1 !px-1.5 !text-[0.7rem] min-[576px]:flex-none min-[576px]:!gap-2 min-[576px]:!px-5 min-[576px]:!text-sm" :disabled="telegramConnectLoading" @click="openTelegramConnect"><ChatBubbleLeftRightIcon class="h-4 w-4 shrink-0" aria-hidden="true" /><span class="truncate">{{ telegramConnectLoading ? 'Створення...' : 'Підключити TG' }}</span></BaseButton>
        <BaseButton type="button" variant="success" size="lg" class="min-w-0 !gap-1 !px-1.5 !text-[0.7rem] min-[576px]:flex-none min-[576px]:!gap-2 min-[576px]:!px-5 min-[576px]:!text-sm" @click="availabilityModalOpen = true"><LockOpenIcon class="h-4 w-4 shrink-0" aria-hidden="true" /><span class="truncate">Відкрити час</span></BaseButton>
        <BaseButton type="button" variant="create" size="lg" class="min-w-0 !gap-1 !px-1.5 !text-[0.7rem] min-[576px]:flex-none min-[576px]:!gap-2 min-[576px]:!px-5 min-[576px]:!text-sm" @click="timeBlockModalOpen = true"><PlusIcon class="h-4 w-4 shrink-0" aria-hidden="true" /><span class="truncate">Блокування</span></BaseButton>
      </div>
    </div>

    <section v-if="telegramConnectLink" class="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 md:p-4">
      <div class="flex flex-wrap items-center gap-2"><a :href="telegramConnectLink" target="_blank" rel="noopener noreferrer" class="min-w-0 flex-1 truncate text-sm font-medium text-cyan-800 underline decoration-cyan-300 underline-offset-4">{{ telegramConnectLink }}</a><BaseButton type="button" variant="neutral" size="sm" @click="copyTelegramConnectLink">Копіювати</BaseButton></div>
    </section>

    <BaseFilterPanel
      padding="sm"
      :active-count="activeFilterCount"
      mobile-title="Фільтри мого графіка"
      card-class="relative z-30"
      fields-class="!block"
      actions-class="justify-stretch xl:justify-end"
      :loading="pending"
      :show-clear="false"
      aria-label="Фільтри мого графіка"
      @apply="refresh"
    >
      <div class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto_2.25rem] items-center gap-1.5 md:flex md:w-auto md:gap-2">
          <BaseButton type="button" variant="icon" class="h-9 w-9" aria-label="Попередній місяць" title="Попередній місяць" @click="moveMonth(-1)"><ChevronLeftIcon class="h-5 w-5" aria-hidden="true" /></BaseButton>
          <p class="min-w-0 text-center text-base font-semibold capitalize text-ui-primary md:min-w-48 md:text-left md:text-lg">{{ monthLabel }}</p>
          <BaseButton type="button" variant="neutral" size="sm" @click="goToCurrentMonth">Цей місяць</BaseButton>
          <BaseButton type="button" variant="icon" class="h-9 w-9" aria-label="Наступний місяць" title="Наступний місяць" @click="moveMonth(1)"><ChevronRightIcon class="h-5 w-5" aria-hidden="true" /></BaseButton>
      </div>

      <template #actions>
        <BaseButton type="submit" variant="primary" class="w-full sm:w-auto" :loading="pending">Оновити</BaseButton>
      </template>

      <template #summary>
        <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ui-subtle px-3 py-2 text-xs text-ui-secondary md:px-4 md:py-3 md:text-sm"><p class="font-medium text-ui-primary">{{ monthRangeLabel }}</p><p>У графіку {{ formatHours(scheduledMinutes) }} · Доступно {{ formatHours(capacityMinutes) }} · Заброньовано {{ formatHours(bookedMinutes) }}</p></div>
      </template>

      <template #after>
        <p v-if="error" class="ui-status-danger rounded-2xl px-4 py-3 text-sm">{{ apiErrorMessage(error, 'Не вдалося завантажити ваш графік.') }}</p>
        <BaseLoader v-if="pending" label="Завантаження графіка…" size="sm" />
      </template>
    </BaseFilterPanel>

    <BaseCard as="section" padding="none" class="overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-ui px-3 py-3 md:px-4"><div class="flex flex-wrap items-center gap-2 text-xs text-ui-secondary"><BaseBadge tone="success" dot>Доступно після блокувань</BaseBadge><BaseBadge tone="danger" dot>Заблокований час</BaseBadge><BaseBadge tone="neutral" dot>Вихідний</BaseBadge></div><p class="text-xs text-ui-muted">Дні прокручуються горизонтально</p></div>
      <div class="flex min-h-11 items-center gap-2 border-b border-ui bg-ui-subtle px-3 py-2 text-xs md:px-4 md:text-sm"><span class="shrink-0 font-medium text-ui-muted">Вибрано</span><span class="min-w-0 truncate text-ui-primary">{{ selectedScheduleLabel }}</span></div>
      <BaseEmptyState v-if="!pending && !hasScheduleData" compact title="У цьому місяці ще немає інтервалів або записів" />
      <ScheduleMatrixTable v-else caption="Мій графік робочого часу за днями місяця" :days="monthDays">
        <template #leading-header>
          <span class="flex w-full items-center justify-center md:hidden">
            <CalendarDaysIcon class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">Мій графік</span>
          </span>
          <span class="hidden md:inline">Мій графік</span>
        </template>
        <template #day-header="{ day }"><span class="block text-[0.65rem] font-medium uppercase tracking-[0.1em] text-ui-muted">{{ day.weekday }}</span><span class="mt-0.5 block text-sm font-semibold text-ui-primary">{{ day.dayNumber }}</span></template>
        <template #trailing-header>
          <span class="flex w-full items-center justify-center md:hidden">
            <ChartBarSquareIcon class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">Завантаження</span>
          </span>
          <span class="hidden md:inline">Завантаження</span>
        </template>
        <template #default="{ leadingCellClass, dayCellClass, trailingCellClass, todayCellClass }">
        <tr>
          <th scope="row" :class="leadingCellClass"><span class="flex min-h-10 items-center justify-center md:hidden"><span class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-[0.65rem] font-semibold text-ui-secondary"><img v-if="selfMasterImageUrl" :src="selfMasterImageUrl" alt="" class="h-full w-full object-cover"><span v-else>{{ selfMasterInitials }}</span></span><span class="sr-only">Моя доступність · {{ selfMasterName }}</span></span><div class="hidden md:block"><p class="text-sm font-semibold text-ui-primary">Моя доступність</p><p class="mt-0.5 text-[0.68rem] font-normal text-ui-muted">{{ workDays }} робочих дн. у місяці</p></div></th>
          <td v-for="day in monthDays" :key="day.date" :class="[dayCellClass, day.isToday ? todayCellClass : '']">
            <div v-if="scheduleByDay[day.date]?.availabilitySummary || scheduleByDay[day.date]?.blockSummary" class="space-y-1">
              <div v-if="scheduleByDay[day.date]?.availabilitySummary" class="flex min-h-10 items-start gap-1 rounded-lg border px-1.5 py-1.5" :class="scheduleByDay[day.date].availabilitySummary!.ranges.length ? 'border-emerald-500/20 bg-emerald-500/12' : 'border-amber-500/25 bg-amber-500/10'">
                <BaseButton type="button" variant="unstyled" class="min-w-0 flex-1 text-left" :class="scheduleByDay[day.date].availabilitySummary!.ranges.length ? 'text-emerald-700' : 'text-amber-700'" :aria-label="`${day.date}, доступно ${scheduleByDay[day.date].availabilitySummary!.intervalsLabel}`" :title="scheduleByDay[day.date].availabilitySummary!.intervalsLabel" @click="selectAvailabilitySummary(day.date, scheduleByDay[day.date].availabilitySummary!)">
                  <span class="block text-[0.58rem] font-semibold uppercase tracking-[0.08em] opacity-75">{{ scheduleByDay[day.date].availabilitySummary!.ranges.length ? `Доступно · ${formatHours(scheduleByDay[day.date].availabilitySummary!.totalMinutes)}` : 'Доступного часу немає' }}</span>
                  <span v-if="scheduleByDay[day.date].availabilitySummary!.ranges.length" class="mt-0.5 block space-y-0.5 text-[0.68rem] font-semibold leading-tight"><span v-for="range in scheduleByDay[day.date].availabilitySummary!.ranges" :key="`${range.start}-${range.end}`" class="block whitespace-nowrap">{{ rangeLabel(range) }}</span></span>
                  <span v-else class="mt-0.5 block text-[0.68rem] font-semibold leading-tight">Заблоковано повністю</span>
                </BaseButton>
                <details class="group/manage relative shrink-0 text-[0.62rem] text-ui-muted"><summary class="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full transition hover:bg-emerald-500/10 hover:text-emerald-700 md:h-5 md:w-5" title="Керувати відкритим часом"><span class="sr-only">Керувати відкритим часом</span><ChevronDownIcon class="h-3.5 w-3.5 transition group-open/manage:rotate-180" aria-hidden="true" /></summary><div class="absolute right-0 top-6 z-50 w-40 space-y-1 rounded-lg border border-ui bg-ui-surface p-1.5 shadow-lg"><p class="px-1 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-ui-muted">Відкриті інтервали</p><div v-for="window in scheduleByDay[day.date].availabilitySummary!.items" :key="window.id" class="flex items-center gap-1 rounded-md bg-ui-subtle px-1 py-0.5"><span class="min-w-0 flex-1 whitespace-nowrap text-ui-secondary">{{ intervalLabel(window.start_at, window.end_at) }}</span><BaseButton type="button" variant="unstyled" class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ui-muted transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40 md:h-5 md:w-5" :disabled="deletingAvailabilityId === window.id" :aria-label="`Закрити інтервал ${intervalLabel(window.start_at, window.end_at)}`" title="Закрити робочий інтервал" @click="openDeleteAvailabilityConfirm(window)"><XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" /></BaseButton></div></div></details>
              </div>
              <div v-if="scheduleByDay[day.date]?.blockSummary" class="flex min-h-8 items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-1.5 py-1"><BaseButton type="button" variant="unstyled" class="min-w-0 flex-1 text-left text-rose-600" :aria-label="`${day.date}, блокування ${scheduleByDay[day.date].blockSummary!.intervalsLabel}`" :title="`${scheduleByDay[day.date].blockSummary!.intervalsLabel} · ${scheduleByDay[day.date].blockSummary!.reasonsLabel}`" @click="selectBlockSummary(day.date, scheduleByDay[day.date].blockSummary!)"><span class="block text-[0.58rem] font-semibold uppercase tracking-[0.08em] opacity-75">Заблоковано · {{ formatHours(scheduleByDay[day.date].blockSummary!.totalMinutes) }}</span><span class="mt-0.5 block space-y-0.5 text-[0.68rem] font-semibold leading-tight"><span v-for="range in scheduleByDay[day.date].blockSummary!.ranges" :key="`${range.start}-${range.end}`" class="block whitespace-nowrap">{{ rangeLabel(range) }}</span></span></BaseButton><BaseButton type="button" variant="unstyled" class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-rose-600/65 transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40 md:h-5 md:w-5" :disabled="deletingBlockIds.length > 0" :aria-label="`Видалити блокування ${scheduleByDay[day.date].blockSummary!.intervalsLabel}`" title="Видалити блокування дня" @click="openDeleteBlockConfirm(scheduleByDay[day.date].blockSummary!)"><XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" /></BaseButton></div>
            </div>
            <span v-else class="flex min-h-8 items-center justify-center text-sm text-ui-muted">—</span>
          </td>
          <td :class="trailingCellClass"><span class="flex min-h-10 items-center justify-center text-sm font-semibold text-ui-primary md:hidden">{{ loadPercent }}%</span><div class="hidden items-center justify-between gap-2 text-xs md:flex"><span class="font-semibold text-ui-primary">{{ loadPercent }}%</span><span class="text-ui-muted">{{ formatHours(bookedMinutes) }}</span></div><div class="mt-2 hidden h-1.5 overflow-hidden rounded-full bg-ui-subtle md:block"><div class="h-full rounded-full bg-cyan-500 transition-all" :style="{ width: `${Math.min(100, loadPercent)}%` }" /></div><p class="mt-1 hidden text-[0.62rem] text-ui-muted md:block">{{ workDays }} дн. · {{ formatHours(scheduledMinutes) }}</p></td>
        </tr>
        </template>
      </ScheduleMatrixTable>
    </BaseCard>

    <BaseCard as="section" padding="none"><div class="border-b border-ui px-4 py-3 md:px-5 md:py-4"><h2 class="text-lg font-semibold text-ui-primary md:text-xl">Моя завантаженість за місяць</h2><p class="mt-1 text-xs text-ui-muted md:text-sm">Завантаження = заброньований час / доступний час після блокувань. Скасовані записи не враховуються.</p></div><div class="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-5 md:px-5"><div><p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">Робочі дні</p><p class="mt-1 font-semibold text-ui-primary">{{ workDays }}</p></div><div><p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">У графіку</p><p class="mt-1 font-semibold text-ui-primary">{{ formatHours(scheduledMinutes) }}</p></div><div><p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">Заблоковано</p><p class="mt-1 font-semibold text-ui-primary">{{ formatHours(blockedMinutes) }}</p></div><div><p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">Заброньовано</p><p class="mt-1 font-semibold text-ui-primary">{{ formatHours(bookedMinutes) }}</p></div><div><p class="text-[0.65rem] uppercase tracking-[0.1em] text-ui-muted">Вільно</p><p class="mt-1 font-semibold text-ui-primary">{{ formatHours(freeMinutes) }} з {{ formatHours(capacityMinutes) }}</p></div></div></BaseCard>

    <AvailabilityWindowFormModal :model-value="availabilityModalOpen" @saved="handleSaved" @update:model-value="availabilityModalOpen = $event" />
    <MyTimeBlockFormModal :model-value="timeBlockModalOpen" @saved="handleSaved" @update:model-value="timeBlockModalOpen = $event" />
    <ConfirmActionModal :model-value="Boolean(availabilityToDelete)" title="Закрити відкритий час?" message="Цей робочий інтервал буде видалено з вашого графіка одразу після підтвердження." confirm-label="Так, закрити" :context-items="availabilityDeleteContextItems" :pending="deletingAvailabilityId != null" destructive @confirm="confirmDeleteAvailability" @update:model-value="handleAvailabilityDeleteConfirmUpdate" />
    <ConfirmActionModal :model-value="Boolean(blockSummaryToDelete)" title="Видалити блокування?" :message="blockDeleteMessage" confirm-label="Так, видалити" :context-items="blockDeleteContextItems" :pending="deletingBlockIds.length > 0" destructive @confirm="confirmDeleteBlockSummary" @update:model-value="handleBlockDeleteConfirmUpdate" />
  </div>
</template>
