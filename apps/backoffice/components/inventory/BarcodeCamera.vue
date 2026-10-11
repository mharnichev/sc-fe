<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { cameraErrorMessage, createCameraDecoder, stopCameraTracks } from '~/utils/barcodeCamera'

const emit = defineEmits<{ recognized: [barcode: string], close: [] }>()
const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref('')
const starting = ref(true)
let stream: MediaStream | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let stopped = false

const stop = () => {
  stopped = true
  clearTimeout(timer)
  stopCameraTracks(stream)
  stream = null
  if (videoRef.value) videoRef.value.srcObject = null
}
const close = () => { stop(); emit('close') }
const hidden = () => { if (document.hidden) close() }

onMounted(async () => {
  document.addEventListener('visibilitychange', hidden)
  window.addEventListener('pagehide', close)
  if (!window.isSecureContext) {
    error.value = 'Для камери потрібне захищене з’єднання HTTPS. Введіть штрихкод вручну.'
    starting.value = false
    return
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = 'Цей браузер не підтримує доступ до камери. Введіть штрихкод вручну.'
    starting.value = false
    return
  }
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
    if (stopped) { stopCameraTracks(acquired); return }
    stream = acquired
    await nextTick()
    const video = videoRef.value
    if (!video || stopped) { stop(); return }
    video.srcObject = acquired
    await video.play()
    if (stopped) return
    const decode = await createCameraDecoder()
    if (stopped) return
    starting.value = false
    const scan = async () => {
      if (stopped) return
      const barcode = await decode(video)
      if (stopped) return
      if (barcode) { stop(); emit('recognized', barcode); return }
      timer = setTimeout(scan, 200)
    }
    void scan()
  } catch (cause) {
    if (stopped) return
    stop()
    error.value = cameraErrorMessage(cause)
    starting.value = false
  }
})
onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', hidden)
  window.removeEventListener('pagehide', close)
})
</script>

<template>
  <BaseModal :model-value="true" aria-label="Сканування штрихкоду" max-width-class="max-w-lg" @close="close">
    <template #head>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Сканування штрихкоду</h2>
        <BaseButton type="button" variant="secondary" @click="close">Закрити</BaseButton>
      </div>
    </template>
    <template #body>
      <p v-if="error" role="alert" class="mb-3 text-sm text-[var(--bo-danger-text)]">{{ error }}</p>
      <template v-else>
        <video ref="videoRef" autoplay muted playsinline class="aspect-video w-full rounded-xl bg-black object-cover" aria-label="Зображення з камери" />
        <p class="mt-3 text-sm">{{ starting ? 'Запускаємо камеру…' : 'Наведіть задню камеру на штрихкод товару. Тримайте код рівно та забезпечте достатнє освітлення.' }}</p>
      </template>
      <BaseButton type="button" variant="secondary" class="mt-4" @click="close">Ввести вручну</BaseButton>
    </template>
  </BaseModal>
</template>
