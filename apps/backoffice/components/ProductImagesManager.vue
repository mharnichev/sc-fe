<script setup lang="ts">
import { ArrowLeftIcon, ArrowRightIcon, ArrowPathIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import type { ProductImage } from '~/composables/useBackofficeApi'

interface UploadItem {
  id: string
  file: File
  previewUrl: string
  status: 'ready' | 'uploading' | 'error'
  error: string
}

interface ReplacementDraft {
  file: File
  previewUrl: string
  error: string
}

const props = withDefaults(defineProps<{
  productId: number | string
  initialImages?: ProductImage[] | null
  legacyImageUrls?: string[]
}>(), { initialImages: undefined, legacyImageUrls: () => [] })

const emit = defineEmits<{ change: [images: ProductImage[]] }>()
const api = useBackofficeApi()
const toast = useBaseToastNotification()
const assetUrl = useAssetUrl()

const images = ref<ProductImage[]>([])
const loading = ref(false)
const loadError = ref('')
const uploads = ref<UploadItem[]>([])
const uploadInput = ref<HTMLInputElement | null>(null)
const uploadInProgress = ref(false)
const replacePending = ref<Set<number>>(new Set())
const updatePending = ref<Set<number>>(new Set())
const reorderInProgress = ref(false)
const pendingDeleteId = ref<number | null>(null)
const deleteTarget = ref<ProductImage | null>(null)
const deleteConfirmOpen = ref(false)
const altDrafts = reactive<Record<number, string>>({})
const altErrors = reactive<Record<number, string>>({})
const replacementDrafts = reactive<Record<number, ReplacementDraft | undefined>>({})
let imagesRevision = 0
let loadRequestId = 0
let disposed = false
const maxFileSize = 5 * 1024 * 1024
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const sortedImages = computed(() => [...images.value].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id))
const mainImageId = computed(() => sortedImages.value.find(image => image.is_active && image.image_url)?.id ?? null)
const hasProductImages = computed(() => images.value.length > 0)
const legacyPreviewUrls = computed(() => [...new Set(
  props.legacyImageUrls.map(value => value.trim()).filter(Boolean),
)])
const deletePending = computed(() => pendingDeleteId.value !== null)
const reorderBlocked = computed(() =>
  reorderInProgress.value
  || uploadInProgress.value
  || pendingDeleteId.value !== null
  || replacePending.value.size > 0
  || updatePending.value.size > 0,
)

const errorMessage = (cause: unknown, fallback: string) => {
  if (typeof cause === 'object' && cause && 'data' in cause && typeof cause.data === 'object' && cause.data && 'detail' in cause.data) {
    return String(cause.data.detail)
  }
  if (cause instanceof Error && cause.message) return cause.message
  return fallback
}

const applyImages = (next: ProductImage[]) => {
  images.value = [...next].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  const nextIds = new Set(images.value.map(image => image.id))
  for (const id of Object.keys(altDrafts).map(Number)) {
    if (!nextIds.has(id)) delete altDrafts[id]
  }
  for (const id of Object.keys(altErrors).map(Number)) {
    if (!nextIds.has(id)) delete altErrors[id]
  }
  for (const id of Object.keys(replacementDrafts).map(Number)) {
    if (nextIds.has(id)) continue
    const draft = replacementDrafts[id]
    if (draft) URL.revokeObjectURL(draft.previewUrl)
    delete replacementDrafts[id]
  }
  for (const image of images.value) {
    if (!(image.id in altDrafts)) altDrafts[image.id] = image.alt || ''
  }
}

const syncImages = (next: ProductImage[]) => {
  if (disposed) return
  imagesRevision += 1
  loadError.value = ''
  applyImages(next)
  emit('change', images.value)
}

const loadImages = async () => {
  const requestId = ++loadRequestId
  const startingRevision = imagesRevision
  loading.value = true
  loadError.value = ''
  try {
    const loadedImages = await api.getProductImages(props.productId)
    if (disposed || requestId !== loadRequestId || startingRevision !== imagesRevision) return
    syncImages(loadedImages)
  }
  catch (cause) {
    if (disposed || requestId !== loadRequestId || startingRevision !== imagesRevision) return
    loadError.value = errorMessage(cause, 'Не вдалося завантажити фотографії.')
  }
  finally {
    if (!disposed && requestId === loadRequestId) loading.value = false
  }
}

const validateFile = (file: File) => {
  if (!acceptedTypes.has(file.type)) return 'Підтримуються лише JPEG, PNG та WebP.'
  if (file.size > maxFileSize) return 'Максимальний розмір файлу — 5 МБ.'
  return ''
}

const revokeUploadPreview = (item: UploadItem) => URL.revokeObjectURL(item.previewUrl)
const removeUploadItem = (id: string) => {
  const item = uploads.value.find(upload => upload.id === id)
  if (item) revokeUploadPreview(item)
  uploads.value = uploads.value.filter(upload => upload.id !== id)
}

const selectFiles = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  for (const file of files) {
    const validationError = validateFile(file)
    uploads.value.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: validationError ? 'error' : 'ready',
      error: validationError,
    })
  }
  if (files.length) void uploadReadyFiles()
}

const uploadReadyFiles = async () => {
  if (uploadInProgress.value) return
  uploadInProgress.value = true
  try {
    let item = uploads.value.find(upload => upload.status === 'ready')
    while (item) {
      item.status = 'uploading'
      item.error = ''
      try {
        const uploaded = await api.uploadProductImage(props.productId, item.file)
        if (disposed) return
        syncImages([...images.value, uploaded])
        removeUploadItem(item.id)
      }
      catch (cause) {
        if (disposed) return
        item.status = 'error'
        item.error = errorMessage(cause, 'Не вдалося завантажити файл.')
      }
      item = uploads.value.find(upload => upload.status === 'ready')
    }
  }
  finally {
    if (!disposed) {
      uploadInProgress.value = false
      if (uploads.value.some(upload => upload.status === 'ready')) void uploadReadyFiles()
    }
  }
}

const retryUpload = (item: UploadItem) => {
  if (item.status !== 'error' || validateFile(item.file)) return
  item.status = 'ready'
  item.error = ''
  void uploadReadyFiles()
}

const clearReplacementDraft = (imageId: number) => {
  const draft = replacementDrafts[imageId]
  if (draft) URL.revokeObjectURL(draft.previewUrl)
  delete replacementDrafts[imageId]
}

const performReplacement = async (image: ProductImage) => {
  const draft = replacementDrafts[image.id]
  if (
    disposed
    || reorderInProgress.value
    || !draft
    || replacePending.value.has(image.id)
    || updatePending.value.has(image.id)
    || pendingDeleteId.value === image.id
  ) return
  const nextPending = new Set(replacePending.value).add(image.id)
  replacePending.value = nextPending
  draft.error = ''
  try {
    const replaced = await api.replaceProductImage(props.productId, image.id, draft.file)
    if (disposed) return
    syncImages(images.value.map(item => item.id === image.id ? replaced : item))
    clearReplacementDraft(image.id)
    toast.success('Фотографію замінено.')
  }
  catch (cause) {
    if (disposed) return
    draft.error = errorMessage(cause, 'Не вдалося замінити фотографію.')
    toast.error(draft.error)
  }
  finally {
    if (!disposed) {
      const pending = new Set(replacePending.value)
      pending.delete(image.id)
      replacePending.value = pending
    }
  }
}

const replaceImage = (image: ProductImage, event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (disposed || reorderInProgress.value || !file) return
  const validationError = validateFile(file)
  if (validationError) {
    toast.error(validationError)
    return
  }
  clearReplacementDraft(image.id)
  replacementDrafts[image.id] = { file, previewUrl: URL.createObjectURL(file), error: '' }
  void performReplacement(image)
}

const updateImage = async (image: ProductImage, payload: { alt?: string | null, is_active?: boolean }) => {
  if (
    disposed
    || reorderInProgress.value
    || updatePending.value.has(image.id)
    || replacePending.value.has(image.id)
    || pendingDeleteId.value === image.id
  ) return
  const pending = new Set(updatePending.value).add(image.id)
  updatePending.value = pending
  altErrors[image.id] = ''
  try {
    const updated = await api.updateProductImage(props.productId, image.id, payload)
    if (disposed) return
    syncImages(images.value.map(item => item.id === image.id ? updated : item))
    altDrafts[image.id] = updated.alt || ''
    toast.success(payload.alt !== undefined ? 'Опис фотографії збережено.' : 'Статус фотографії оновлено.')
  }
  catch (cause) {
    if (disposed) return
    const message = errorMessage(cause, 'Не вдалося оновити фотографію.')
    altErrors[image.id] = message
    toast.error(message)
  }
  finally {
    if (!disposed) {
      const next = new Set(updatePending.value)
      next.delete(image.id)
      updatePending.value = next
    }
  }
}

const saveAlt = (image: ProductImage) => {
  if (updatePending.value.has(image.id)) return
  const alt = (altDrafts[image.id] || '').trim()
  if (alt === (image.alt || '')) return
  void updateImage(image, { alt: alt || null })
}

const toggleActive = (image: ProductImage, event: Event) => {
  const input = event.target as HTMLInputElement
  input.checked = image.is_active
  if (reorderInProgress.value) return
  void updateImage(image, { is_active: !image.is_active })
}

const moveImage = async (image: ProductImage, direction: -1 | 1) => {
  const list = sortedImages.value
  const index = list.findIndex(item => item.id === image.id)
  const target = index + direction
  if (disposed || index < 0 || target < 0 || target >= list.length || reorderBlocked.value) return
  reorderInProgress.value = true
  try {
    const ids = list.map(item => item.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    const reorderedImages = await api.reorderProductImages(props.productId, ids)
    if (disposed) return
    syncImages(reorderedImages)
  }
  catch (cause) {
    if (disposed) return
    toast.error(errorMessage(cause, 'Не вдалося змінити порядок фотографій.'))
  }
  finally {
    if (!disposed) reorderInProgress.value = false
  }
}

const removeImage = async () => {
  if (!deleteTarget.value) return
  const image = deleteTarget.value
  pendingDeleteId.value = image.id
  try {
    await api.deleteProductImage(props.productId, image.id)
    if (disposed) return
    syncImages(images.value.filter(item => item.id !== image.id))
    clearReplacementDraft(image.id)
    deleteTarget.value = null
    deleteConfirmOpen.value = false
    toast.success('Фотографію видалено.')
  }
  catch (cause) {
    if (disposed) return
    toast.error(errorMessage(cause, 'Не вдалося видалити фотографію.'))
  }
  finally {
    if (!disposed) pendingDeleteId.value = null
  }
}

onMounted(() => {
  if (props.initialImages === undefined) void loadImages()
})

watch(() => props.initialImages, value => {
  if (value !== undefined) applyImages(value || [])
}, { deep: true, immediate: true })

onBeforeUnmount(() => {
  disposed = true
  loadRequestId += 1
  uploads.value.forEach(revokeUploadPreview)
  Object.keys(replacementDrafts).map(Number).forEach(clearReplacementDraft)
})
</script>

<template>
  <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">Фотографії товару</h2>
        <p class="mt-1 text-sm text-slate-500">JPEG, PNG або WebP до 5 МБ. Перша активна фотографія є головною.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton type="button" variant="neutral" :disabled="loading" @click="loadImages">
          <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
          Оновити
        </BaseButton>
        <BaseButton type="button" variant="primary" :disabled="reorderInProgress || deletePending" @click="uploadInput?.click()">
          <PhotoIcon class="h-4 w-4" aria-hidden="true" />
          Додати фото
        </BaseButton>
        <input ref="uploadInput" class="hidden" type="file" multiple accept="image/jpeg,image/png,image/webp" @change="selectFiles">
      </div>
    </div>

    <div v-if="loading" class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500" aria-live="polite">Завантаження фотографій…</div>
    <div v-else-if="loadError" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">
      <span>{{ loadError }}</span>
      <BaseButton type="button" variant="neutral" @click="loadImages">Повторити</BaseButton>
    </div>

    <div v-if="uploads.length" class="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4">
      <p class="text-sm font-semibold text-slate-800">Нові файли</p>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="item in uploads" :key="item.id" class="flex gap-3 rounded-xl border border-slate-200 bg-white p-2">
          <img :src="item.previewUrl" alt="" class="h-16 w-16 shrink-0 rounded-lg object-cover">
          <div class="min-w-0 text-xs">
            <p class="truncate font-medium text-slate-700">{{ item.file.name }}</p>
            <p v-if="item.status === 'uploading'" class="mt-1 text-cyan-700" aria-live="polite">Завантаження…</p>
            <p v-else-if="item.error" class="mt-1 text-rose-600">{{ item.error }}</p>
            <p v-else class="mt-1 text-emerald-600">Готово до завантаження</p>
            <div v-if="item.status === 'error'" class="mt-2 flex gap-2">
              <BaseButton v-if="!validateFile(item.file)" type="button" class="px-2 py-1 text-xs" variant="neutral" @click="retryUpload(item)">Повторити</BaseButton>
              <BaseButton type="button" class="px-2 py-1 text-xs" variant="neutral" @click="removeUploadItem(item.id)">Прибрати</BaseButton>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div v-if="hasProductImages" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article v-for="(image, index) in sortedImages" :key="image.id" class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div class="relative aspect-[4/3] bg-slate-100">
          <img
            v-if="replacementDrafts[image.id]?.previewUrl || image.image_url"
            :src="replacementDrafts[image.id]?.previewUrl || assetUrl(image.image_url)"
            :alt="image.alt || 'Фотографія товару'"
            class="h-full w-full object-cover"
            :class="!image.is_active ? 'opacity-50' : ''"
          >
          <div v-else class="flex h-full items-center justify-center text-sm text-slate-400">Немає зображення</div>
          <span v-if="image.id === mainImageId" class="absolute left-3 top-3 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">Головна</span>
          <span v-if="!image.is_active" class="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-600">Прихована</span>
          <span v-if="replacementDrafts[image.id]" class="absolute bottom-3 left-3 rounded-full bg-cyan-700 px-3 py-1 text-xs font-medium text-white">Нове прев’ю</span>
        </div>
        <div class="space-y-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-500">Фото {{ index + 1 }}</span>
            <div class="flex gap-1">
              <BaseButton type="button" variant="neutral" class="h-8 w-8 p-0" :disabled="index === 0 || reorderBlocked" aria-label="Перемістити вліво" title="Вище" @click="moveImage(image, -1)"><ArrowLeftIcon class="mx-auto h-4 w-4" /></BaseButton>
              <BaseButton type="button" variant="neutral" class="h-8 w-8 p-0" :disabled="index === sortedImages.length - 1 || reorderBlocked" aria-label="Перемістити вправо" title="Нижче" @click="moveImage(image, 1)"><ArrowRightIcon class="mx-auto h-4 w-4" /></BaseButton>
              <BaseButton
                type="button"
                variant="danger-icon"
                class="h-8 w-8 p-0"
                :disabled="pendingDeleteId === image.id || replacePending.has(image.id) || updatePending.has(image.id) || reorderInProgress"
                aria-label="Видалити фотографію"
                title="Видалити"
                @click="deleteTarget = image; deleteConfirmOpen = true"
              >
                <TrashIcon class="mx-auto h-4 w-4" />
              </BaseButton>
            </div>
          </div>
          <label class="block space-y-1 text-xs font-medium text-slate-600">
            <span>Alt-текст</span>
            <BaseInput v-model="altDrafts[image.id]" maxlength="255" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" @keyup.enter="saveAlt(image)" />
          </label>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <BaseButton type="button" variant="neutral" class="px-3 py-2 text-xs" :disabled="reorderInProgress || updatePending.has(image.id) || replacePending.has(image.id) || pendingDeleteId === image.id" @click="saveAlt(image)">Зберегти alt</BaseButton>
            <label class="flex items-center gap-2 text-xs text-slate-600">
              <BaseCheckbox :checked="image.is_active" :disabled="reorderInProgress || updatePending.has(image.id) || replacePending.has(image.id) || pendingDeleteId === image.id" @change="toggleActive(image, $event)" />
              Показувати
            </label>
          </div>
          <p v-if="altErrors[image.id]" class="text-xs text-rose-600" role="alert">{{ altErrors[image.id] }}</p>
          <p v-if="replacementDrafts[image.id]?.error" class="text-xs text-rose-600" role="alert">{{ replacementDrafts[image.id]?.error }}</p>
          <div v-if="replacementDrafts[image.id]?.error" class="flex flex-wrap justify-center gap-2">
            <BaseButton type="button" variant="neutral" class="px-3 py-2 text-xs" :disabled="reorderInProgress || replacePending.has(image.id)" @click="performReplacement(image)">Повторити заміну</BaseButton>
            <BaseButton type="button" variant="neutral" class="px-3 py-2 text-xs" :disabled="replacePending.has(image.id)" @click="clearReplacementDraft(image.id)">Скасувати</BaseButton>
          </div>
          <label class="block cursor-pointer text-center text-xs font-medium text-cyan-700 hover:text-cyan-900" :class="reorderInProgress || replacePending.has(image.id) || updatePending.has(image.id) || pendingDeleteId === image.id ? 'pointer-events-none opacity-60' : ''">
            Замінити файл
            <input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp" :disabled="reorderInProgress || replacePending.has(image.id) || updatePending.has(image.id) || pendingDeleteId === image.id" @change="replaceImage(image, $event)">
            <span v-if="replacePending.has(image.id)" class="ml-1">(завантаження…)</span>
          </label>
        </div>
      </article>
    </div>
    <div v-else-if="!loading && !loadError && !legacyPreviewUrls.length" class="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
      Галерея порожня. Додайте першу фотографію товару.
    </div>

    <div v-if="!hasProductImages && legacyPreviewUrls.length" class="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
      <p>Нижче показані старі зображення з URL. Після додавання ProductImage основною стане нова галерея.</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <a v-for="url in legacyPreviewUrls" :key="url" :href="assetUrl(url)" target="_blank" rel="noreferrer" class="overflow-hidden rounded-xl border border-amber-200 bg-white">
          <img :src="assetUrl(url)" alt="Старе зображення товару" class="aspect-square w-full object-cover">
        </a>
      </div>
    </div>

    <ConfirmActionModal
      v-model="deleteConfirmOpen"
      title="Видалити фотографію?"
      message="Фотографію буде видалено з галереї товару. Цю дію не можна скасувати."
      confirm-label="Видалити"
      :pending="deletePending"
      destructive
      @confirm="removeImage"
    />
  </section>
</template>
