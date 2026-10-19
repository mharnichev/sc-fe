<script setup lang="ts">
import OrderQrMock from '~/components/orders/OrderQrMock.vue'
const route = useRoute()
const attemptId = computed(() => /^\d+$/.test(String(route.params.id)) ? Number(route.params.id) : 0)
</script>
<template>
  <div class="space-y-5">
    <h1 class="text-3xl font-semibold">Локальний симулятор monobank QR</h1>
    <p>Доступ потребує входу в Backoffice і прав QR-продажу. Сканування та відкриття сторінки не підтверджує оплату. Оберіть явний тестовий сценарій.</p>
    <OrderQrMock v-if="Number.isSafeInteger(attemptId) && attemptId > 0" :attempt-id="attemptId" simulator />
    <p v-else role="alert">Некоректний номер QR.</p>
    <NuxtLink to="/orders" class="underline">До замовлень</NuxtLink>
  </div>
</template>
