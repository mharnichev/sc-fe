<script setup lang="ts">
const offline = ref(false)
const reconnect = ref(false)
const update = () => {
  if (offline.value && navigator.onLine) reconnect.value = true
  offline.value = !navigator.onLine
}
const reload = () => window.location.reload()
onMounted(() => {
  update()
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', update)
  window.removeEventListener('offline', update)
})
</script>

<template>
  <aside v-if="offline || reconnect" role="alert" class="network-status sticky top-0 z-[400] bg-amber-950 px-4 py-3 text-sm text-amber-50">
    <template v-if="offline">Немає з’єднання / Offline. Дані можуть бути застарілими. Зміни не надсилаються без інтернету.
    Після відновлення зв’язку перевірте запис перед повторною спробою: попередній запит міг надійти на сервер.</template>
    <template v-else>З’єднання відновлено / Back online. Оновіть дані та перевірте записи перед повторною спробою.
      <button type="button" class="min-h-11 px-3 underline" @click="reload">Оновити / Reload</button>
      <button type="button" class="min-h-11 px-3" @click="reconnect = false">Закрити / Dismiss</button>
    </template>
  </aside>
</template>
