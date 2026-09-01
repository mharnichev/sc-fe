<script setup lang="ts">
import { ShoppingBagIcon } from '@heroicons/vue/24/outline'
import type { Brand } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage } = useBookingFormatting()
const { data, refresh } = await useAsyncData('backoffice-brands', () => api.getBrands(1, 50))
const pendingBrandIds = ref<Set<number>>(new Set())

const isBrandActive = (brand: Brand) => brand.is_active !== false
const isBrandPending = (brandId: number) => pendingBrandIds.value.has(brandId)
const setBrandPending = (brandId: number, pending: boolean) => {
  const next = new Set(pendingBrandIds.value)
  if (pending) next.add(brandId)
  else next.delete(brandId)
  pendingBrandIds.value = next
}

const toggleBrandVisibility = async (brand: Brand) => {
  if (isBrandPending(brand.id)) return
  const nextActive = !isBrandActive(brand)
  setBrandPending(brand.id, true)
  try {
    const updated = await api.updateBrand(brand.id, { is_active: nextActive })
    if (updated.is_active !== nextActive) {
      toast.error('API брендів не повернув оновлений статус видимості.')
      return
    }
    toast.success(nextActive ? 'Бренд показано.' : 'Бренд приховано.')
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити видимість бренду.'))
  }
  finally {
    setBrandPending(brand.id, false)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Каталог</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Бренди</h1>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in data?.items || []" :key="item.id" class="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" :class="{ 'opacity-65': !isBrandActive(item) }">
        <h2 class="text-lg font-semibold text-slate-900">{{ item.name }}</h2>
        <p class="mt-1 text-xs text-slate-500">{{ item.slug }}</p>
        <p class="mt-4 text-sm leading-7 text-slate-600">{{ item.description || 'Без опису' }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <BaseButton
            type="button"
            variant="neutral"
            size="sm"
            :loading="isBrandPending(item.id)"
            :loading-label="isBrandActive(item) ? 'Приховуємо бренд…' : 'Показуємо бренд…'"
            :aria-label="`${isBrandActive(item) ? 'Приховати' : 'Показати'} бренд ${item.name}`"
            @click="toggleBrandVisibility(item)"
          >
            {{ isBrandActive(item) ? 'Приховати' : 'Показати' }}
          </BaseButton>
          <NuxtLink
            :to="{ path: '/products', query: { brand_id: String(item.id) } }"
            class="base-button base-button--neutral min-h-9 gap-2 px-3 py-1.5 text-xs"
            :aria-label="`Переглянути товари бренду ${item.name}`"
          >
            <ShoppingBagIcon class="h-4 w-4" aria-hidden="true" />
            Переглянути товари
          </NuxtLink>
        </div>
      </article>
    </div>
  </div>
</template>
