<script setup lang="ts">
const route = useRoute()
const api = useBackofficeApi()

const customerId = computed(() => route.params.id as string)

const [{ data: customer }, { data: orders }] = await Promise.all([
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
])

const fullName = computed(() => {
  if (!customer.value) return ''
  return [customer.value.name, customer.value.surname].filter(Boolean).join(' ') || 'Клієнт без імені'
})
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
        <dl class="mt-5 space-y-4 text-sm">
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Телефон</dt>
            <dd class="font-medium text-slate-900">{{ customer.phone }}</dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Email</dt>
            <dd class="font-medium text-slate-900">{{ customer.email || '—' }}</dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Назва</dt>
            <dd class="font-medium text-slate-900">{{ customer.name || '—' }}</dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Прізвище</dt>
            <dd class="font-medium text-slate-900">{{ customer.surname || '—' }}</dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Дата народження</dt>
            <dd class="font-medium text-slate-900">{{ customer.birthday || '—' }}</dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Статус</dt>
            <dd>
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="customer.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                {{ customer.is_active ? 'активний' : 'неактивний' }}
              </span>
            </dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Телефон підтверджено</dt>
            <dd class="font-medium text-slate-900">{{ customer.phone_verified_at || '—' }}</dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Останній вхід</dt>
            <dd class="font-medium text-slate-900">{{ customer.last_login_at || '—' }}</dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Створено</dt>
            <dd class="font-medium text-slate-900">{{ customer.created_at }}</dd>
          </div>
          <div class="grid grid-cols-[140px_1fr] gap-3">
            <dt class="text-slate-500">Оновлено</dt>
            <dd class="font-medium text-slate-900">{{ customer.updated_at }}</dd>
          </div>
        </dl>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-xl font-semibold text-slate-900">Замовлення</h2>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {{ orders?.total || 0 }} total
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
              Створено: {{ order.created_at }}
            </p>
          </article>
        </div>
        <p v-else class="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          У цього клієнта ще немає замовлень.
        </p>
      </section>
    </div>
  </div>
</template>
