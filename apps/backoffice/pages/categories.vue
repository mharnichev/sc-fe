<script setup lang="ts">
const api = useBackofficeApi()
const { data } = await useAsyncData('backoffice-categories', () => api.getCategories(1, 50))
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Catalog</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Categories</h1>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in data?.items || []" :key="item.id" class="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">{{ item.name }}</h2>
            <p class="mt-1 text-xs text-slate-500">{{ item.slug }}</p>
          </div>
          <span class="rounded-full px-3 py-1 text-xs font-medium" :class="item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
            {{ item.is_active ? 'active' : 'inactive' }}
          </span>
        </div>
        <p class="mt-4 text-sm leading-7 text-slate-600">{{ item.description || 'No description' }}</p>
      </article>
    </div>
  </div>
</template>
