<script setup lang="ts">
import type { Booking, BookingStatus } from '~/composables/useBackofficeApi'
import type { Master, Service } from '~/composables/useBackofficeApi'

const props = defineProps<{
  booking: Booking | null
  allowedStatuses?: BookingStatus[]
  pendingStatus?: BookingStatus | ''
  error?: string
  masters?: Master[]
  services?: Service[]
}>()

const emit = defineEmits<{
  close: []
  updateStatus: [status: BookingStatus]
}>()

const {
  bookingStart,
  bookingEnd,
  bookingComment,
  bookingPhone,
  customerName,
  masterName,
  serviceName,
  formatDateTime,
  formatBookingStatus,
} = useBookingFormatting()

const allowed = computed(() => props.allowedStatuses || [])

const resolvedMaster = computed(() =>
  props.booking?.master || props.booking?.barber || props.masters?.find(master => master.id === props.booking?.master_id) || null,
)

const resolvedService = computed(() =>
  props.booking?.service || props.services?.find(service => service.id === props.booking?.service_id) || null,
)
</script>

<template>
  <div v-if="booking" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
    <section class="max-h-full w-full max-w-3xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl">
      <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div>
          <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Деталі бронювання</p>
          <h2 class="mt-2 text-2xl font-semibold text-slate-900">
            #{{ booking.id }} · {{ customerName(booking) }}
          </h2>
        </div>
        <button class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700" @click="emit('close')">
          Закрити
        </button>
      </div>

      <div class="space-y-6 px-6 py-5">
        <div class="flex flex-wrap items-center gap-3">
          <BookingStatusBadge :status="booking.status" />
          <p class="text-sm text-slate-500">{{ formatDateTime(bookingStart(booking)) }} - {{ formatDateTime(bookingEnd(booking)) }}</p>
        </div>

        <dl class="grid gap-4 md:grid-cols-2">
          <div class="rounded-2xl bg-slate-50 p-4">
            <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">Клієнт</dt>
            <dd class="mt-2 font-medium text-slate-900">{{ customerName(booking) }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">Телефон</dt>
            <dd class="mt-2 font-medium text-slate-900">{{ bookingPhone(booking) || '-' }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">Майстер</dt>
            <dd class="mt-2 font-medium text-slate-900">{{ masterName(resolvedMaster) }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">Послуга</dt>
            <dd class="mt-2 font-medium text-slate-900">{{ serviceName(resolvedService) }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">Час початку</dt>
            <dd class="mt-2 font-medium text-slate-900">{{ formatDateTime(bookingStart(booking)) }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">Час завершення</dt>
            <dd class="mt-2 font-medium text-slate-900">{{ formatDateTime(bookingEnd(booking)) }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">Створено</dt>
            <dd class="mt-2 font-medium text-slate-900">{{ formatDateTime(booking.created_at) }}</dd>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">Скасовано</dt>
            <dd class="mt-2 font-medium text-slate-900">{{ formatDateTime(booking.cancelled_at) }}</dd>
          </div>
        </dl>

        <div class="rounded-2xl bg-slate-50 p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Коментар клієнта</p>
          <p class="mt-2 text-sm leading-6 text-slate-700">{{ bookingComment(booking) || 'Без коментаря' }}</p>
        </div>

        <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {{ error }}
        </p>

        <div v-if="allowed.length" class="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          <button
            v-for="status in allowed"
            :key="status"
            class="rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
            :class="status === 'cancelled' ? 'border border-rose-300 text-rose-700' : 'bg-slate-950 text-white'"
            :disabled="pendingStatus === status"
            @click="emit('updateStatus', status)"
          >
            {{ pendingStatus === status ? 'Оновлення...' : `Позначити як "${formatBookingStatus(status)}"` }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
