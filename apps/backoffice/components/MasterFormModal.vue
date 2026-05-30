<script setup lang="ts">
import { ArrowsPointingOutIcon, PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import type { Master, MasterFormPayload, MasterPayload, MasterPosition, UploadAsset } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  master?: Master | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const { apiErrorMessage } = useBookingFormatting()
const { formatPhone, normalizePhone, isCompletePhone } = useUkrainianPhoneMask()

const form = reactive<MasterPayload>({
  full_name: '',
  last_name: null,
  first_name_en: null,
  last_name_en: null,
  position: 'master',
  phone: null,
  email: null,
  password: '',
  description: null,
  photo_url: null,
  is_active: true,
})
const formError = ref('')
const saving = ref(false)
const photoFile = ref<File | null>(null)
const avatarFile = ref<File | null>(null)
const photoPreviewUrl = ref('')
const avatarPreviewUrl = ref('')
const imagePreviewUrl = ref('')
const imagePreviewAlt = ref('')
const fileInputKey = ref(0)
const phoneFocused = ref(false)

const positionOptions: Array<{ value: MasterPosition, label: string }> = [
  { value: 'ambassador', label: 'Амбасадор' },
  { value: 'senior_master', label: 'Старший Майстер' },
  { value: 'master', label: 'Майстер' },
]

const editing = computed(() => props.master || null)
const maskedPhone = computed({
  get: () => formatPhone(form.phone, phoneFocused.value),
  set: value => {
    form.phone = formatPhone(value, true)
  },
})

const uploadUrl = (value?: string | UploadAsset | null) => {
  if (!value) return ''
  return typeof value === 'string' ? value : value.file_url || ''
}

const currentPhotoUrl = computed(() => editing.value?.photo_url || uploadUrl(editing.value?.photo) || '')
const existingPhotoUrl = computed(() => assetUrl(editing.value?.photo || editing.value?.photo_url))
const existingAvatarUrl = computed(() => assetUrl(editing.value?.avatar || editing.value?.avatar_url))
const displayedPhotoUrl = computed(() => {
  if (photoPreviewUrl.value) return photoPreviewUrl.value
  const formPhotoUrl = form.photo_url?.trim() || ''
  if (formPhotoUrl && formPhotoUrl !== currentPhotoUrl.value) return assetUrl(formPhotoUrl)
  return existingPhotoUrl.value || assetUrl(formPhotoUrl)
})
const displayedAvatarUrl = computed(() => avatarPreviewUrl.value || existingAvatarUrl.value)

const revokeObjectUrl = (url: string) => {
  if (url) URL.revokeObjectURL(url)
}

const resetFiles = () => {
  revokeObjectUrl(photoPreviewUrl.value)
  revokeObjectUrl(avatarPreviewUrl.value)
  photoFile.value = null
  avatarFile.value = null
  photoPreviewUrl.value = ''
  avatarPreviewUrl.value = ''
  fileInputKey.value += 1
}

const splitNameFallback = (value?: string | null) => {
  const parts = (value || '').trim().split(/\s+/).filter(Boolean)
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' '),
  }
}

const fillForm = (master?: Master | null) => {
  resetFiles()
  const ukFallback = splitNameFallback(master?.full_name_uk || master?.full_name || master?.name)
  const enFallback = splitNameFallback(master?.full_name_en)
  form.full_name = master?.first_name_uk || master?.full_name || ukFallback.first
  form.last_name = master?.last_name_uk || master?.last_name || ukFallback.last || null
  form.first_name_en = master?.first_name_en || enFallback.first || null
  form.last_name_en = master?.last_name_en || enFallback.last || null
  form.position = master?.position || 'master'
  form.phone = master?.phone || null
  form.email = master?.email || null
  form.password = ''
  form.description = master?.description || null
  form.photo_url = master?.photo_url || uploadUrl(master?.photo) || null
  form.is_active = master ? (master.is_active ?? master.status !== 'неактивний') : true
  formError.value = ''
}

const close = () => {
  emit('update:modelValue', false)
}

const openImagePreview = (url: string, alt: string) => {
  imagePreviewUrl.value = url
  imagePreviewAlt.value = alt
}

const closeImagePreview = () => {
  imagePreviewUrl.value = ''
  imagePreviewAlt.value = ''
}

const setFilePreview = (event: Event, kind: 'photo' | 'avatar') => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  if (kind === 'photo') {
    revokeObjectUrl(photoPreviewUrl.value)
    photoFile.value = file
    photoPreviewUrl.value = file ? URL.createObjectURL(file) : ''
    return
  }

  revokeObjectUrl(avatarPreviewUrl.value)
  avatarFile.value = file
  avatarPreviewUrl.value = file ? URL.createObjectURL(file) : ''
}

const validate = () => {
  if (!form.full_name.trim()) return 'Ім’я українською обов’язкове.'
  if (!form.last_name?.trim()) return 'Прізвище українською обов’язкове.'
  if (!form.first_name_en?.trim()) return 'Ім’я англійською обов’язкове.'
  if (!form.last_name_en?.trim()) return 'Прізвище англійською обов’язкове.'
  if (!form.position) return 'Позиція обов’язкова.'
  if (!editing.value && !form.email?.trim()) return 'Email для входу майстра обов’язковий.'
  if (!editing.value && !form.password?.trim()) return 'Пароль для входу майстра обов’язковий.'
  if (!editing.value && (form.password || '').trim().length < 6) return 'Пароль має містити щонайменше 6 символів.'
  if (form.phone?.trim() && !isCompletePhone(form.phone)) return 'Введіть повний український номер у форматі +380 XX XXX XX XX.'
  if (photoFile.value && photoFile.value.type !== 'image/webp') return 'Фото має бути у форматі .webp.'
  if (avatarFile.value && avatarFile.value.type !== 'image/webp') return 'Avatar має бути у форматі .webp.'
  return ''
}

const focusPhone = () => {
  phoneFocused.value = true
  form.phone = formatPhone(form.phone, true)
}

const blurPhone = () => {
  phoneFocused.value = false
  form.phone = formatPhone(form.phone) || null
}

const submit = async () => {
  formError.value = validate()
  if (formError.value) return
  saving.value = true
  const payload: MasterFormPayload = {
    ...form,
    full_name: form.full_name.trim(),
    last_name: form.last_name?.trim() || null,
    first_name_en: form.first_name_en?.trim() || null,
    last_name_en: form.last_name_en?.trim() || null,
    phone: normalizePhone(form.phone) || null,
    email: form.email?.trim() || null,
    password: editing.value ? undefined : form.password?.trim() || null,
    description: form.description?.trim() || null,
    photo_url: form.photo_url?.trim() || null,
    photo: photoFile.value,
    avatar: avatarFile.value,
  }

  try {
    if (editing.value) {
      const { password: _password, ...updatePayload } = payload
      await api.adminUpdateMaster(editing.value.id, updatePayload)
      emit('saved', 'Майстра оновлено.')
    }
    else {
      await api.adminCreateMaster(payload)
      emit('saved', 'Майстра створено.')
    }
    close()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося зберегти майстра.')
  }
  finally {
    saving.value = false
  }
}

watch(
  () => [props.modelValue, props.master] as const,
  ([open, master]) => {
    if (!open) {
      closeImagePreview()
      return
    }
    if (open) fillForm(master)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  closeImagePreview()
  resetFiles()
})
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-3xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 sm:text-sm">Майстри</p>
          <h2 class="mt-1 text-xl font-semibold text-slate-900 sm:mt-2 sm:text-2xl">{{ editing ? 'Редагувати майстра' : 'Створити майстра' }}</h2>
        </div>
        <button type="button" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm" aria-label="Закрити" @click="closeModal">
          <XMarkIcon class="h-5 w-5 sm:hidden" aria-hidden="true" />
          <span class="hidden sm:inline">Закрити</span>
        </button>
      </div>
    </template>

    <template #body>
      <form class="space-y-3 sm:space-y-5" @submit.prevent="submit">
        <div class="grid gap-3 md:grid-cols-2 md:gap-4">
          <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Ім’я українською</span>
            <input v-model="form.full_name" required autocomplete="given-name" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
          <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Прізвище українською</span>
            <input v-model="form.last_name" required autocomplete="family-name" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
        </div>
        <div class="grid gap-3 md:grid-cols-2 md:gap-4">
          <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">First name англійською</span>
            <input v-model="form.first_name_en" required class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
          <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Last name англійською</span>
            <input v-model="form.last_name_en" required class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
        </div>
        <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
          <span class="font-medium">Позиція</span>
          <select v-model="form.position" required class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
            <option v-for="option in positionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <div class="grid gap-3 md:grid-cols-2 md:gap-4">
          <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Телефон</span>
            <input
              v-model="maskedPhone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="+380 XX XXX XX XX"
              maxlength="17"
              class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3"
              @focus="focusPhone"
              @blur="blurPhone"
            >
          </label>
          <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Email для входу</span>
            <input v-model="form.email" type="email" :required="!editing" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
          </label>
        </div>
        <label v-if="!editing" class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
          <span class="font-medium">Пароль для входу</span>
          <input v-model="form.password" required type="password" minlength="6" autocomplete="new-password" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
        </label>
        <p v-else class="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 sm:rounded-2xl sm:px-4 sm:py-3">
          Пароль для входу задається лише під час створення майстра. Для зміни наявного пароля потрібен backend endpoint керування користувачами.
        </p>
        <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
          <span class="font-medium">URL фото</span>
          <input v-model="form.photo_url" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
        </label>
        <div class="grid gap-3 md:grid-cols-2 md:gap-4">
          <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Фото</span>
            <input :key="`photo-${fileInputKey}`" type="file" accept=".webp,image/webp" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white sm:rounded-2xl sm:px-4 sm:py-3 sm:file:mr-4 sm:file:px-4 sm:file:py-2" @change="setFilePreview($event, 'photo')">
          </label>
          <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
            <span class="font-medium">Avatar</span>
            <input :key="`avatar-${fileInputKey}`" type="file" accept=".webp,image/webp" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white sm:rounded-2xl sm:px-4 sm:py-3 sm:file:mr-4 sm:file:px-4 sm:file:py-2" @change="setFilePreview($event, 'avatar')">
          </label>
        </div>
        <div v-if="displayedPhotoUrl || displayedAvatarUrl" class="grid gap-3 rounded-xl bg-slate-50 p-3 sm:rounded-2xl sm:p-4 md:grid-cols-2 md:gap-4">
          <div v-if="displayedPhotoUrl" class="space-y-1.5 sm:space-y-2">
            <p class="text-sm font-medium text-slate-700">{{ editing ? 'Поточне фото' : 'Попередній перегляд фото' }}</p>
            <button type="button" class="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl" title="Відкрити повний перегляд" @click="openImagePreview(displayedPhotoUrl, 'Фото майстра')">
              <img :src="displayedPhotoUrl" alt="Фото майстра" class="h-32 w-full object-cover sm:h-44">
              <span class="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-100 transition group-hover:bg-slate-950 sm:opacity-0 sm:group-hover:opacity-100">
                <ArrowsPointingOutIcon class="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
          <div v-if="displayedAvatarUrl" class="space-y-1.5 sm:space-y-2">
            <p class="text-sm font-medium text-slate-700">{{ editing ? 'Поточний avatar' : 'Попередній перегляд avatar' }}</p>
            <button type="button" class="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl" title="Відкрити повний перегляд" @click="openImagePreview(displayedAvatarUrl, 'Avatar майстра')">
              <img :src="displayedAvatarUrl" alt="Avatar майстра" class="h-32 w-full object-cover sm:h-44">
              <span class="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-100 transition group-hover:bg-slate-950 sm:opacity-0 sm:group-hover:opacity-100">
                <ArrowsPointingOutIcon class="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
        <label class="space-y-1.5 text-sm text-slate-700 sm:space-y-2">
          <span class="font-medium">Опис</span>
          <textarea v-model="form.description" rows="3" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3" />
        </label>
        <p class="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 sm:rounded-2xl sm:px-4 sm:py-3">
          Після створення майстра активні базові послуги копіюються автоматично. Використовуйте дію «Послуги» у списку, щоб керувати особистими послугами майстра.
        </p>
        <label class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 sm:rounded-2xl sm:px-4 sm:py-3">
          <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300">
          Майстер активний
        </label>
        <div class="flex flex-wrap gap-2 sm:gap-3">
          <button type="submit" :disabled="saving || disabled" class="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 sm:flex-none sm:px-5 sm:py-3">
            <PlusIcon v-if="!editing && !saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти майстра' }}
          </button>
          <button type="button" class="rounded-full border border-slate-300 px-4 py-2.5 text-sm sm:px-5 sm:py-3" @click="fillForm(editing)">
            Скинути
          </button>
        </div>
        <p v-if="formError" class="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-600 sm:rounded-2xl sm:px-4 sm:py-3">{{ formError }}</p>
      </form>
    </template>
  </BaseModal>

  <Teleport to="body">
    <div
      v-if="imagePreviewUrl"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      @click.self="closeImagePreview"
    >
      <button type="button" class="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-5 sm:top-5" aria-label="Закрити перегляд" @click="closeImagePreview">
        <XMarkIcon class="h-6 w-6" aria-hidden="true" />
      </button>
      <img :src="imagePreviewUrl" :alt="imagePreviewAlt" class="max-h-[92dvh] max-w-full rounded-xl object-contain">
    </div>
  </Teleport>
</template>
