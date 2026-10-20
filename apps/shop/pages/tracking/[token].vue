<script setup lang="ts">
import type { CustomerShipment } from '~/types/order'
const { runtimeText, runtimeMessage } = useShopRuntimeDisplay()
const route = useRoute()
const api = useApi()
const shipments = ref<CustomerShipment[]>([])
const loading = ref(false)
const error = ref('')
let generation = 0
const load = async () => {
  const current = ++generation
  shipments.value = []; error.value = ''; loading.value = true
  const token = String(route.params.token || '')
  try {
    if (!/^[A-Za-z0-9._~-]{20,2048}$/.test(token)) throw new Error('invalid token')
    const result = await api<{ shipments: CustomerShipment[] }>(`/public/orders/tracking/${encodeURIComponent(token)}`, { retry: 0 })
    if (current === generation && String(route.params.token || '') === token) shipments.value = result.shipments
  }
  catch { if (current === generation) error.value = 'Посилання недоступне або строк його дії закінчився.' }
  finally { if (current === generation) loading.value = false }
}
watch(() => route.params.token, load, { immediate: true })
useSeo(() => runtimeText.value.trackingTitle, () => runtimeText.value.trackingDescription)
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }, { name: 'referrer', content: 'no-referrer' }] })
</script>
<template><main class="tracking-page"><h1>{{ runtimeText.trackingHeading }}</h1><p v-if="loading">{{ runtimeText.loading }}</p><p v-if="error" role="alert">{{ runtimeMessage(error) }}</p><OrderShipments :shipments="shipments" /><p v-if="!loading && !error && !shipments.length">{{ runtimeText.noShipments }}</p><BaseButton :disabled="loading" @click="load">{{ runtimeText.refreshTracking }}</BaseButton></main></template>
<style scoped>.tracking-page { display:grid;gap:1rem;max-width:48rem;margin:2rem auto;padding:1rem; }.tracking-page h1{font-size:1.5rem;font-weight:800;}</style>
