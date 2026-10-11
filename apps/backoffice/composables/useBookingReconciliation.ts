import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { Booking } from '~/composables/useBackofficeApi'

const COMPLETED_MESSAGE = 'Цей запис уже завершено. Час, послуги та статус змінювати не можна. Показуємо актуальні дані.'

const errorStatus = (cause: unknown) => {
  const error = cause as { response?: { status?: number }, statusCode?: number } | null
  return error?.response?.status ?? error?.statusCode
}

const errorDetail = (cause: unknown) =>
  (cause as { data?: { detail?: unknown } } | null)?.data?.detail

export const isCompletedBookingConflict = (cause: unknown) =>
  errorStatus(cause) === 400 && errorDetail(cause) === 'Completed bookings cannot be modified'

export const bookingActionErrorMessage = (cause: unknown, fallback: string) => {
  if (isCompletedBookingConflict(cause)) return COMPLETED_MESSAGE
  const detail = errorDetail(cause)
  if (typeof detail === 'object' && detail && 'code' in detail
    && detail.code === 'attributed_booking_cannot_be_deleted') {
    return 'Цей запис пов’язаний з акцією. Замість видалення скасуйте його, щоб зберегти історію.'
  }
  if (errorStatus(cause) === 403) return 'У вас немає доступу до цієї дії. Можливо, запис передано іншому майстру.'
  if (errorStatus(cause) === 404) return 'Цей запис більше недоступний. Оновіть дані або зверніться до адміністратора.'
  if (errorStatus(cause) === 409) return 'Дані запису або доступність часу змінилися. Перевірте актуальні дані та спробуйте ще раз.'
  // Keep localized business validation; never expose raw English/server diagnostics to a barber.
  if (typeof detail === 'string' && /[А-Яа-яІіЇїЄєҐґ]/.test(detail)) return detail
  return fallback
}

export const useBookingReconciliation = (selected: Ref<Booking | null>, options: {
  load: (id: number) => Promise<Booking>
  onUpdated: (booking: Booking) => void
  onDeleted: (id: number) => void
  refreshList: () => Promise<unknown>
}) => {
  const checking = ref(false)
  const saving = ref(false)
  const needsRefresh = ref(false)
  const notice = ref('')
  const error = ref('')
  const busy = computed(() => checking.value || saving.value || needsRefresh.value)
  let verificationError = false
  let version = 0
  let lastCheckedAt = Date.now()
  let inFlight: Promise<void> | null = null
  let resumePromise: Promise<unknown> | null = null
  const current = (id: number, requestVersion: number) => selected.value?.id === id && version === requestVersion

  const applyFresh = (booking: Booking, requestVersion: number) => {
    if (!current(booking.id, requestVersion)) return
    if (selected.value?.status !== booking.status) {
      error.value = ''
      notice.value = booking.status === 'completed'
        ? COMPLETED_MESSAGE
        : 'Запис змінився, поки сторінка була відкрита. Показуємо актуальні дані — перевірте їх перед наступною дією.'
    }
    selected.value = booking
    options.onUpdated(booking)
  }

  const check = (allowDuringSave = false): Promise<void> => {
    if (!selected.value || saving.value && !allowDuringSave) return Promise.resolve()
    if (inFlight) return inFlight
    const id = selected.value.id
    const requestVersion = version
    checking.value = true
    const request = (async () => {
      try {
        const fresh = await Promise.resolve().then(() => options.load(id))
        if (!current(id, requestVersion)) return
        applyFresh(fresh, requestVersion)
        needsRefresh.value = false
        if (verificationError) error.value = ''
        verificationError = false
      }
      catch (cause) {
        if (!current(id, requestVersion)) return
        if (errorStatus(cause) === 404) {
          // Archived records are hidden from reads, including after a lost DELETE response.
          options.onDeleted(id)
          selected.value = null
          return
        }
        needsRefresh.value = true
        verificationError = true
        error.value = bookingActionErrorMessage(cause, 'Не вдалося перевірити актуальність запису. Перевірте інтернет і натисніть «Оновити дані».')
      }
      finally {
        if (current(id, requestVersion)) {
          checking.value = false
          lastCheckedAt = Date.now()
          inFlight = null
        }
      }
    })()
    inFlight = request
    return request
  }

  const refreshSelected = () => {
    error.value = ''
    return check()
  }

  const mutate = async (action: (booking: Booking) => Promise<Booking | void>, fallback: string, deleted = false) => {
    if (!selected.value || busy.value) return false
    const snapshot = selected.value
    const requestVersion = version
    saving.value = true
    error.value = ''
    verificationError = false
    try {
      const updated = await action(snapshot)
      if (deleted) {
        options.onDeleted(snapshot.id)
        if (current(snapshot.id, requestVersion)) selected.value = null
      }
      else if (updated) {
        options.onUpdated(updated)
        if (current(snapshot.id, requestVersion)) selected.value = updated
      }
      return true
    }
    catch (cause) {
      if (!current(snapshot.id, requestVersion)) return false
      error.value = bookingActionErrorMessage(cause, fallback)
      if (isCompletedBookingConflict(cause)) {
        const completed = { ...snapshot, status: 'completed' }
        selected.value = completed
        options.onUpdated(completed)
        notice.value = COMPLETED_MESSAGE
        error.value = ''
      }
      // A failed request can still have changed the server state (for example, a lost response).
      await check(true)
      return false
    }
    finally {
      saving.value = false
      // A different record opened during the mutation still needs its own verification.
      if (selected.value && version !== requestVersion) void check()
    }
  }

  const stopSelectionWatch = watch(() => selected.value?.id, () => {
    version++
    inFlight = null
    checking.value = false
    needsRefresh.value = false
    notice.value = ''
    error.value = ''
    verificationError = false
    if (selected.value) void check()
  }, { flush: 'sync', immediate: true })

  const resume = () => {
    if (document.hidden || saving.value || Date.now() - lastCheckedAt < 30_000) return
    if (selected.value) void check()
    else if (!resumePromise) {
      lastCheckedAt = Date.now()
      resumePromise = options.refreshList().catch(() => {}).finally(() => { resumePromise = null })
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      window.addEventListener('focus', resume)
      document.addEventListener('visibilitychange', resume)
    })
    onBeforeUnmount(() => {
      version++
      stopSelectionWatch()
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', resume)
    })
  }

  return { checking, saving, needsRefresh, notice, error, busy, refreshSelected, mutate }
}
