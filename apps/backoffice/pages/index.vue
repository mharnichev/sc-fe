<script setup lang="ts">
import { StatCard } from '@shared-ui'

const auth = useAuthStore()
const api = useBackofficeApi()

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/dashboard')
    }
  },
})

const { data: dashboard } = await useAsyncData('backoffice-dashboard', async () => {
  const [products, categories, brands, orders] = await Promise.all([
    api.getProducts(1, 5),
    api.getCategories(1, 5),
    api.getBrands(1, 5),
    api.getOrders(1, 5),
  ])

  return { products, categories, brands, orders }
})
</script>

<template>
  <div class="space-y-8">
    <div>
      <p class="text-sm uppercase tracking-[0.35em] text-cyan-700">Огляд</p>
      <h1 class="mt-2 text-4xl font-semibold text-slate-900">Дашборд</h1>
      <p class="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        Ви увійшли як {{ auth.user?.email }}. Цей екран отримує актуальні дані з наявного backoffice API.
      </p>
    </div>
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Товари" :value="dashboard?.products.total || 0" />
      <StatCard label="Категорії" :value="dashboard?.categories.total || 0" />
      <StatCard label="Бренди" :value="dashboard?.brands.total || 0" />
      <StatCard label="Замовлення" :value="dashboard?.orders.total || 0" />
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Останні замовлення</h2>
        <div class="mt-4 space-y-3">
          <article v-for="order in dashboard?.orders.items || []" :key="order.id" class="rounded-2xl bg-slate-50 px-4 py-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-medium text-slate-900">#{{ order.id }} · {{ order.customer_name }}</p>
                <p class="text-sm text-slate-500">{{ order.customer_email || order.customer_phone || 'Без контактів' }}</p>
              </div>
              <div class="sm:text-right">
                <p class="font-semibold text-slate-900">{{ order.total_amount }}</p>
                <p class="text-xs uppercase tracking-[0.2em] text-cyan-700">{{ order.status }}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Зріз каталогу</h2>
        <div class="mt-4 space-y-3">
          <article v-for="product in dashboard?.products.items || []" :key="product.id" class="rounded-2xl bg-slate-50 px-4 py-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="font-medium text-slate-900">{{ product.name }}</p>
                <p class="text-sm text-slate-500">{{ product.category?.name || 'Без категорії' }} · {{ product.brand?.name || 'Без бренду' }}</p>
              </div>
              <div class="sm:text-right">
                <p class="font-semibold text-slate-900">{{ product.price }}</p>
                <p class="text-xs uppercase tracking-[0.2em]" :class="product.is_active ? 'text-emerald-700' : 'text-slate-400'">
                  {{ product.is_active ? 'активний' : 'неактивний' }}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
