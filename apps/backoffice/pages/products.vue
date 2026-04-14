<script setup lang="ts">
const api = useBackofficeApi()
const page = ref(1)

const { data, refresh } = await useAsyncData(
  'backoffice-products',
  () => api.getProducts(page.value, 20),
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
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Catalog</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Products</h1>
    </div>
    <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Name</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Category</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Brand</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Price</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Stock</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in data?.items || []" :key="item.id">
            <td class="px-4 py-3">
              <p class="font-medium text-slate-900">{{ item.name }}</p>
              <p class="text-xs text-slate-500">{{ item.slug }}</p>
            </td>
            <td class="px-4 py-3 text-slate-700">{{ item.category?.name || '—' }}</td>
            <td class="px-4 py-3 text-slate-700">{{ item.brand?.name || '—' }}</td>
            <td class="px-4 py-3 text-slate-700">{{ item.price }}</td>
            <td class="px-4 py-3 text-slate-700">{{ item.stock_quantity }}</td>
            <td class="px-4 py-3">
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                {{ item.is_active ? 'active' : 'inactive' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex gap-3">
      <button :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="prev">Previous</button>
      <button class="rounded-full border border-slate-300 px-4 py-2 text-sm" @click="next">Next</button>
    </div>
  </div>
</template>
