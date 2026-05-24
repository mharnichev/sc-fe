<script setup lang="ts">
const api = useBackofficeApi()
const page = ref(1)
const pageSize = 20

const { data, refresh } = await useAsyncData(
  'backoffice-orders',
  () => api.getOrders(page.value, pageSize),
  { watch: [page] },
)

const next = async () => {
  if (!data.value || page.value * pageSize >= data.value.total) return
  page.value += 1
}

const prev = async () => {
  page.value = Math.max(1, page.value - 1)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Продажі</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Замовлення</h1>
    </div>

    <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Total: {{ data?.total || 0 }}
    </div>

    <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Замовлення</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнт</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Контакти</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Усього</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Створено</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="order in data?.items || []" :key="order.id">
            <td data-label="Замовлення" class="px-4 py-3">
              <p class="font-medium text-slate-900">#{{ order.id }}</p>
            </td>
            <td data-label="Клієнт" class="px-4 py-3 text-slate-700">
              {{ order.customer_name }}
            </td>
            <td data-label="Контакти" class="px-4 py-3">
              <p class="text-slate-700">{{ order.customer_email || '—' }}</p>
              <p class="text-xs text-slate-500">{{ order.customer_phone || 'Без телефону' }}</p>
            </td>
            <td data-label="Усього" class="px-4 py-3 font-medium text-slate-900">
              {{ order.total_amount }}
            </td>
            <td data-label="Статус" class="px-4 py-3">
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] text-slate-700">
                {{ order.status }}
              </span>
            </td>
            <td data-label="Створено" class="px-4 py-3 text-slate-700">
              {{ order.created_at }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap gap-3">
      <button :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="prev">Попередня</button>
      <button :disabled="!data || page * pageSize >= data.total" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="next">Наступна</button>
    </div>
  </div>
</template>
