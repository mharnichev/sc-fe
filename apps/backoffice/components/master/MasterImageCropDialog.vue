<script setup lang="ts">
import { ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/vue/24/outline'

type CropShape = 'original' | 'square'

const props = defineProps<{
  modelValue: boolean
  file: File | null
  title: string
  squareOnly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  apply: [file: File]
}>()

const frameRef = ref<HTMLElement | null>(null)
const sourceUrl = ref('')
const imageWidth = ref(0)
const imageHeight = ref(0)
const frameWidth = ref(0)
const frameHeight = ref(0)
const centerX = ref(0)
const centerY = ref(0)
const zoom = ref(1)
const shape = ref<CropShape>('original')
const loading = ref(false)
const exporting = ref(false)
const error = ref('')
const loadedImage = shallowRef<HTMLImageElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let generation = 0
let dragStart: { x: number, y: number, centerX: number, centerY: number } | null = null

const aspectRatio = computed(() =>
  props.squareOnly || shape.value === 'square' ? 1 : (imageWidth.value / imageHeight.value || 1),
)
const frameStyle = computed(() => ({
  aspectRatio: String(aspectRatio.value),
  width: `min(100%, ${Math.min(360, 320 * aspectRatio.value)}px)`,
}))
const scale = computed(() => Math.max(
  frameWidth.value / imageWidth.value || 0,
  frameHeight.value / imageHeight.value || 0,
) * zoom.value)
const cropWidth = computed(() => frameWidth.value / scale.value || 0)
const cropHeight = computed(() => frameHeight.value / scale.value || 0)
const imageStyle = computed(() => ({
  width: `${imageWidth.value * scale.value}px`,
  height: `${imageHeight.value * scale.value}px`,
  left: `${frameWidth.value / 2 - centerX.value * scale.value}px`,
  top: `${frameHeight.value / 2 - centerY.value * scale.value}px`,
}))

const clampCenter = () => {
  if (!imageWidth.value || !imageHeight.value || !scale.value) return
  const halfWidth = Math.min(imageWidth.value, cropWidth.value) / 2
  const halfHeight = Math.min(imageHeight.value, cropHeight.value) / 2
  centerX.value = Math.max(halfWidth, Math.min(imageWidth.value - halfWidth, centerX.value))
  centerY.value = Math.max(halfHeight, Math.min(imageHeight.value - halfHeight, centerY.value))
}

const cleanup = () => {
  generation += 1
  dragStart = null
  loadedImage.value = null
  loading.value = false
  exporting.value = false
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
  imageWidth.value = 0
  imageHeight.value = 0
  frameWidth.value = 0
  frameHeight.value = 0
}

const loadFile = () => {
  cleanup()
  error.value = ''
  zoom.value = 1
  shape.value = 'original'
  if (!props.modelValue || !props.file) return

  const currentGeneration = generation
  const url = URL.createObjectURL(props.file)
  const image = new Image()
  sourceUrl.value = url
  loading.value = true
  image.onload = () => {
    if (currentGeneration !== generation) return
    if (!image.naturalWidth || !image.naturalHeight) {
      error.value = 'Не вдалося прочитати зображення.'
      loading.value = false
      return
    }
    loadedImage.value = image
    imageWidth.value = image.naturalWidth
    imageHeight.value = image.naturalHeight
    centerX.value = image.naturalWidth / 2
    centerY.value = image.naturalHeight / 2
    loading.value = false
  }
  image.onerror = () => {
    if (currentGeneration !== generation) return
    loading.value = false
    error.value = 'Не вдалося прочитати зображення.'
  }
  image.src = url
}

watch(() => [props.modelValue, props.file], loadFile, { immediate: true })
watch(zoom, clampCenter, { flush: 'sync' })
const measureFrame = () => {
  frameWidth.value = frameRef.value?.clientWidth || 0
  frameHeight.value = frameRef.value?.clientHeight || 0
  clampCenter()
}
watch(frameRef, (frame) => {
  resizeObserver?.disconnect()
  measureFrame()
  if (!frame) return
  resizeObserver = new ResizeObserver(measureFrame)
  resizeObserver.observe(frame)
}, { flush: 'post' })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cleanup()
})

const close = () => {
  if (!exporting.value) emit('update:modelValue', false)
}

const setZoom = (value: number) => {
  zoom.value = Math.max(1, Math.min(4, value))
}

const handlePointerDown = (event: PointerEvent) => {
  if (!loadedImage.value || exporting.value) return
  const frame = event.currentTarget as HTMLElement
  frame.setPointerCapture(event.pointerId)
  dragStart = { x: event.clientX, y: event.clientY, centerX: centerX.value, centerY: centerY.value }
}

const handlePointerMove = (event: PointerEvent) => {
  if (!dragStart || !scale.value) return
  centerX.value = dragStart.centerX - (event.clientX - dragStart.x) / scale.value
  centerY.value = dragStart.centerY - (event.clientY - dragStart.y) / scale.value
  clampCenter()
}

const handleKeydown = (event: KeyboardEvent) => {
  const step = event.shiftKey ? 0.1 : 0.02
  if (event.key === 'ArrowLeft') centerX.value -= cropWidth.value * step
  else if (event.key === 'ArrowRight') centerX.value += cropWidth.value * step
  else if (event.key === 'ArrowUp') centerY.value -= cropHeight.value * step
  else if (event.key === 'ArrowDown') centerY.value += cropHeight.value * step
  else if (event.key === '+' || event.key === '=') setZoom(zoom.value + 0.1)
  else if (event.key === '-') setZoom(zoom.value - 0.1)
  else return
  event.preventDefault()
  clampCenter()
}

const applyCrop = async () => {
  const image = loadedImage.value
  const file = props.file
  // A new file or aspect ratio can render before ResizeObserver reports its size.
  measureFrame()
  if (!image || !file || !frameWidth.value || !frameHeight.value || exporting.value) return
  const currentGeneration = generation
  exporting.value = true
  error.value = ''
  try {
    const width = cropWidth.value
    const height = cropHeight.value
    const outputScale = Math.min(1, 3000 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * outputScale))
    canvas.height = Math.max(1, Math.round(height * outputScale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, centerX.value - width / 2, centerY.value - height / 2, width, height, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      try { canvas.toBlob(resolve, 'image/webp', 0.9) }
      catch (cause) { reject(cause) }
    })
    if (currentGeneration !== generation) return
    if (!blob || blob.type !== 'image/webp') throw new Error('WebP export unavailable')
    emit('apply', new File([blob], file.name, { type: 'image/webp', lastModified: Date.now() }))
    emit('update:modelValue', false)
  }
  catch {
    if (currentGeneration === generation) error.value = 'Не вдалося обрізати фото. Оригінальний файл збережено; спробуйте ще раз.'
  }
  finally {
    if (currentGeneration === generation) exporting.value = false
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-xl" :aria-label="`Обрізати ${title.toLowerCase()}`" :close-on-backdrop="!exporting" :close-on-escape="!exporting" @update:model-value="!$event && close()">
    <template #head>
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="type-eyebrow text-[0.68rem] text-ui-accent">Попередній перегляд</p>
          <h2 class="mt-0.5 text-lg font-semibold text-ui-primary">Обрізати {{ title.toLowerCase() }}</h2>
        </div>
        <BaseButton type="button" :disabled="exporting" class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ui text-ui-secondary" aria-label="Скасувати обрізання" @click="close">
          <XMarkIcon class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
      </div>
    </template>
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-ui-secondary">Перетягніть зображення або скористайтеся стрілками для вибору області. Клавіші + і − змінюють масштаб.</p>
        <div v-if="loading" class="flex h-56 items-center justify-center rounded-xl bg-ui-subtle text-sm text-ui-secondary">Завантаження зображення…</div>
        <div v-if="loadedImage" class="flex justify-center rounded-xl bg-ui-subtle p-3">
          <div
            ref="frameRef"
            :style="frameStyle"
            class="relative overflow-hidden rounded-lg bg-[var(--bo-control)] shadow-md ring-2 ring-inset ring-[var(--bo-accent)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bo-focus-border)] touch-none cursor-move"
            role="group"
            tabindex="0"
            :aria-label="`Область обрізання: ${title}. Стрілки переміщують, клавіші плюс і мінус змінюють масштаб.`"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerup="dragStart = null"
            @pointercancel="dragStart = null"
            @keydown="handleKeydown"
          >
            <img :src="sourceUrl" alt="" draggable="false" class="pointer-events-none absolute max-w-none select-none" :style="imageStyle">
          </div>
        </div>
        <div v-if="loadedImage" class="space-y-3">
          <div v-if="!squareOnly" class="flex flex-wrap gap-2" role="group" aria-label="Пропорції обрізання">
            <BaseButton type="button" :disabled="exporting" class="rounded-lg border px-3 py-2 text-sm" :class="shape === 'original' ? 'border-[var(--bo-accent)] bg-[var(--bo-control-active)] text-ui-accent' : 'border-ui text-ui-secondary'" :aria-pressed="shape === 'original'" @click="shape = 'original'">Оригінальні пропорції</BaseButton>
            <BaseButton type="button" :disabled="exporting" class="rounded-lg border px-3 py-2 text-sm" :class="shape === 'square' ? 'border-[var(--bo-accent)] bg-[var(--bo-control-active)] text-ui-accent' : 'border-ui text-ui-secondary'" :aria-pressed="shape === 'square'" @click="shape = 'square'">Квадрат</BaseButton>
          </div>
          <p v-else class="text-sm text-ui-secondary">Avatar буде квадратним.</p>
          <label class="flex items-center gap-3 text-sm font-medium text-ui-secondary">
            <ArrowsPointingOutIcon class="h-4 w-4 text-ui-accent" aria-hidden="true" />
            Масштаб
            <input type="range" min="1" max="4" step="0.01" :value="zoom" :disabled="exporting" class="min-w-0 flex-1 accent-[var(--bo-accent)]" aria-label="Масштаб обрізання" @input="setZoom(Number(($event.target as HTMLInputElement).value))">
            <span class="w-12 text-right tabular-nums">{{ Math.round(zoom * 100) }}%</span>
          </label>
        </div>
        <p v-if="error" role="alert" class="rounded-lg bg-[var(--bo-danger-surface)] p-3 text-sm text-[var(--bo-danger-text)]">{{ error }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <BaseButton type="button" :disabled="exporting" class="rounded-lg border border-ui px-4 py-2 text-sm font-medium text-ui-secondary" @click="close">Скасувати</BaseButton>
          <BaseButton type="button" :disabled="!loadedImage || exporting || !frameWidth || !frameHeight" class="rounded-lg bg-ui-accent px-4 py-2 text-sm font-medium text-[var(--bo-on-accent)] disabled:opacity-50" @click="applyCrop">{{ exporting ? 'Обрізання…' : 'Застосувати обрізання' }}</BaseButton>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
