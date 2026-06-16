<script setup lang="ts">
import {
  ArrowPathIcon,
  BanknotesIcon,
  CakeIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  IdentificationIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const api = useBackofficeApi()
const {
  bookingComment,
  bookingEnd,
  bookingStart,
  bookingServicesLabel,
  formatBookingStatus,
  formatDate,
  formatDateTime,
  formatMoney,
  formatTime,
} = useBookingFormatting()

const customerId = computed(() => route.params.id as string)

const [{ data: customer }, { data: orders }, { data: bookings }, { data: stats }] = await Promise.all([
  useAsyncData(
    () => `customer-${customerId.value}`,
    () => api.getCustomer(customerId.value),
    { watch: [customerId] },
  ),
  useAsyncData(
    () => `customer-orders-${customerId.value}`,
    () => api.getCustomerOrders(customerId.value, 1, 50),
    { watch: [customerId] },
  ),
  useAsyncData(
    () => `customer-bookings-${customerId.value}`,
    () => api.getCustomerBookings(customerId.value, 1, 50),
    { watch: [customerId] },
  ),
  useAsyncData(
    () => `customer-stats-${customerId.value}`,
    () => api.getCustomerStats(customerId.value),
    { watch: [customerId] },
  ),
])

const fullName = computed(() => {
  if (!customer.value) return ''
  return [customer.value.name, customer.value.surname].filter(Boolean).join(' ') || 'Клієнт без імені'
})

const topServices = computed(() => stats.value?.most_used_services || [])
const { isAdmin } = useBackofficeAccess()
</script>

<template>
  <div v-if="customer" class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">CRM</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">{{ fullName }}</h1>
        <p class="mt-2 text-sm text-slate-500">Customer #{{ customer.id }}</p>
      </div>
      <NuxtLink to="/customers" class="rounded-full border border-slate-300 px-5 py-3 text-sm">
        Назад до списку
      </NuxtLink>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Інформація про клієнта</h2>
        <dl class="customer-info-grid mt-5 grid gap-3 md:grid-cols-2">
          <div class="customer-info-item">
            <PhoneIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Телефон</dt>
              <dd class="customer-info-value">{{ customer.phone }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <EnvelopeIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Email</dt>
              <dd class="customer-info-value">{{ customer.email || '—' }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <IdentificationIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Назва</dt>
              <dd class="customer-info-value">{{ customer.name || '—' }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <UserCircleIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Прізвище</dt>
              <dd class="customer-info-value">{{ customer.surname || '—' }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <CakeIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Дата народження</dt>
              <dd class="customer-info-value">{{ formatDate(customer.birthday) }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <DocumentTextIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Нотатки</dt>
              <dd class="customer-info-value whitespace-pre-line">{{ customer.notes || '—' }}</dd>
            </div>
          </div>
          <div class="customer-import-grid grid gap-3 md:col-span-2 md:grid-cols-2">
            <div class="customer-import-stat">
              <BanknotesIcon class="customer-import-stat-icon" aria-hidden="true" />
              <div class="min-w-0">
                <dt class="text-xs text-slate-500">Витрати</dt>
                <dd class="mt-1 truncate font-semibold text-slate-900">{{ formatMoney(customer.imported_total_spent) }}</dd>
              </div>
            </div>
            <div class="customer-import-stat">
              <CalendarDaysIcon class="customer-import-stat-icon" aria-hidden="true" />
              <div class="min-w-0">
                <dt class="text-xs text-slate-500">Візит</dt>
                <dd class="mt-1 truncate font-semibold text-slate-900">{{ formatDateTime(customer.imported_last_visit_at) }}</dd>
              </div>
            </div>
            <div class="customer-import-stat sm:col-span-2">
              <UserCircleIcon class="customer-import-stat-icon" aria-hidden="true" />
              <div class="min-w-0">
                <dt class="text-xs text-slate-500">Статус</dt>
                <dd class="mt-1">
                  <span class="customer-import-status rounded-full px-3 py-1 text-xs font-medium" :class="customer.imported_is_new_client ? 'customer-import-status-new' : 'customer-import-status-current'">
                    {{ customer.imported_is_new_client ? 'новий клієнт' : 'поточний клієнт' }}
                  </span>
                </dd>
              </div>
            </div>
          </div>
          <div class="customer-info-item">
            <CheckCircleIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Статус</dt>
              <dd class="mt-1">
                <span class="customer-info-badge rounded-full px-3 py-1 text-xs font-medium" :class="customer.is_active ? 'customer-info-badge-active' : 'customer-info-badge-muted'">
                  {{ customer.is_active ? 'активний' : 'неактивний' }}
                </span>
              </dd>
            </div>
          </div>
          <div class="customer-info-item">
            <ShieldCheckIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Телефон підтверджено</dt>
              <dd class="customer-info-value">{{ formatDateTime(customer.phone_verified_at) }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <ClockIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Останній вхід</dt>
              <dd class="customer-info-value">{{ formatDateTime(customer.last_login_at) }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <CalendarDaysIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Створено</dt>
              <dd class="customer-info-value">{{ formatDateTime(customer.created_at) }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <ArrowPathIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Оновлено</dt>
              <dd class="customer-info-value">{{ formatDateTime(customer.updated_at) }}</dd>
            </div>
          </div>
        </dl>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Статистика бронювань</h2>

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Бронювань</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ stats?.total_bookings || 0 }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Останній візит</p>
            <p class="mt-2 text-base font-semibold text-slate-900">{{ formatDateTime(stats?.last_visit_date) }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Топ майстер</p>
            <p class="mt-2 text-base font-semibold text-slate-900">
              {{ stats?.most_visited_barber?.name || '—' }}
            </p>
            <p v-if="stats?.most_visited_barber" class="mt-1 text-xs text-slate-500">
              {{ stats.most_visited_barber.count }} бронювань
            </p>
          </div>
        </div>

        <div class="mt-5">
          <p class="text-sm font-medium text-slate-900">Найчастіші послуги</p>
          <div v-if="topServices.length" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="service in topServices"
              :key="`${service.id}-${service.name}`"
              class="customer-service-chip rounded-full px-3 py-1 text-xs font-medium"
            >
              {{ service.name }} · {{ service.count }}
            </span>
          </div>
          <p v-else class="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Немає даних про послуги.
          </p>
        </div>
      </section>
    </div>

    <ClientCommunicationPanel v-if="isAdmin" :customer-id="customer.id" />

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-xl font-semibold text-slate-900">Замовлення</h2>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {{ orders?.total || 0 }} усього
          </span>
        </div>

        <div v-if="orders?.items.length" class="mt-5 space-y-3">
          <article v-for="order in orders?.items || []" :key="order.id" class="rounded-2xl bg-slate-50 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="font-medium text-slate-900">Замовлення #{{ order.id }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ order.customer_email || order.customer_phone || 'Без контактів' }}</p>
              </div>
              <div class="sm:text-right">
                <p class="font-semibold text-slate-900">{{ order.total_amount }}</p>
                <p class="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-700">{{ order.status }}</p>
              </div>
            </div>
            <p class="mt-3 text-xs text-slate-500">
              Створено: {{ formatDateTime(order.created_at) }}
            </p>
          </article>
        </div>
        <p v-else class="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          У цього клієнта ще немає замовлень.
        </p>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-xl font-semibold text-slate-900">Бронювання</h2>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {{ bookings?.total || 0 }} усього
          </span>
        </div>

        <div v-if="bookings?.items.length" class="mt-5 space-y-3">
          <article v-for="booking in bookings?.items || []" :key="booking.id" class="rounded-2xl bg-slate-50 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="font-medium text-slate-900">Бронювання #{{ booking.id }}</p>
                <p class="mt-1 text-sm text-slate-500">
                  {{ formatDate(bookingStart(booking)) }} · {{ formatTime(bookingStart(booking)) }}-{{ formatTime(bookingEnd(booking)) }}
                </p>
              </div>
              <div class="sm:text-right">
                <p class="text-xs uppercase tracking-[0.2em] text-cyan-700">{{ formatBookingStatus(booking.status) }}</p>
                <p class="mt-1 text-sm text-slate-500">Майстер #{{ booking.master_id }} · {{ bookingServicesLabel(booking) }}</p>
              </div>
            </div>
            <div class="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>{{ booking.customer_email || booking.customer_phone || 'Без контактів' }}</p>
              <p v-if="booking.cancelled_at">Скасовано: {{ formatDateTime(booking.cancelled_at) }}</p>
              <p v-if="booking.completed_at">Завершено: {{ formatDateTime(booking.completed_at) }}</p>
            </div>
            <p v-if="bookingComment(booking)" class="mt-3 whitespace-pre-line text-sm text-slate-600">
              {{ bookingComment(booking) }}
            </p>
          </article>
        </div>
        <p v-else class="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          У цього клієнта ще немає бронювань.
        </p>
      </section>
    </div>
  </div>
</template>
