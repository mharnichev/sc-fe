<script setup lang="ts">
const api = useBackofficeApi()
const page = ref(1)

const { data, refresh } = await useAsyncData(
  'backoffice-orders',
  () => api.getOrders(page.value, 20),
  { watch: [page] },
)

const next = async () => {
  page.value += 1
  await refresh()
}

const prev = async () => {
  page.value = Math.max(1, page.value - 1)
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Sales</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Orders</h1>
    </div>
    <div class="space-y-3">
      <article v-for="order in data?.items || []" :key="order.id" class="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm uppercase tracking-[0.2em] text-cyan-700">Order #{{ order.id }}</p>
            <h2 class="mt-2 text-xl font-semibold text-slate-900">{{ order.customer_name }}</h2>
            <p class="mt-1 text-sm text-slate-500">{{ order.customer_email || order.customer_phone || 'No contacts' }}</p>
          </div>
          <div class="text-right">
            <p class="text-xl font-semibold text-slate-900">{{ order.total_amount }}</p>
            <p class="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{{ order.status }}</p>
          </div>
        </div>
      </article>
    </div>
    <div class="flex gap-3">
      <button :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="prev">Previous</button>
      <button class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="next">Next</button>
    </div>
  </div>
</template>
