<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { cameraErrorMessage, createCameraDecoder, resolveCameraBarcode, stopCameraTracks } from '~/utils/barcodeCamera'

const props = defineProps<{ lookupBarcode?: (barcode: string) => Promise<{ barcode?: string | null }> }>()
const emit = defineEmits<{ recognized: [barcode: string], close: [] }>()
const api = useBackofficeApi()
const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref('')
const starting = ref(true)
let stream: MediaStream | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let stopped = false
const decoderAbort = new AbortController()

const stop = () => {
  stopped = true
  clearTimeout(timer)
  decoderAbort.abort()
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
    const decoder = await createCameraDecoder(decoderAbort.signal)
    if (stopped) return
    starting.value = false
    const scan = async () => {
      if (stopped) return
      try {
        const barcode = await decoder.decode(video)
        if (stopped) return
        if (barcode) {
          const matchedBarcode = await resolveCameraBarcode(barcode, props.lookupBarcode ?? api.lookupInventoryProductByBarcode)
          if (stopped) return
          stop(); emit('recognized', matchedBarcode); return
        }
        timer = setTimeout(scan, 60)
      } catch (cause) {
        if (stopped) return
        stop()
        error.value = cameraErrorMessage(cause)
      }
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
        <div class="relative">
          <video ref="videoRef" autoplay muted playsinline class="aspect-video w-full rounded-xl bg-black object-contain" aria-label="Зображення з камери" />
          <div aria-hidden="true" class="pointer-events-none absolute left-[7.5%] top-[20%] h-[60%] w-[85%] rounded-lg border-2 border-white/80" />
        </div>
        <p class="mt-3 text-sm">{{ starting ? 'Запускаємо камеру…' : 'Наведіть задню камеру на штрихкод товару. Тримайте код рівно та забезпечте достатнє освітлення.' }}</p>
      </template>
      <BaseButton type="button" variant="secondary" class="mt-4" @click="close">Ввести вручну</BaseButton>
    </template>
  </BaseModal>
</template>
