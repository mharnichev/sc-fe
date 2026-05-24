<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'
import type { Master, MasterFormPayload, MasterPayload, UploadAsset } from '~/composables/useBackofficeApi'

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
const { masterName, apiErrorMessage } = useBookingFormatting()

const form = reactive<MasterPayload>({
  full_name: '',
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
const fileInputKey = ref(0)

const editing = computed(() => props.master || null)

const uploadUrl = (value?: string | UploadAsset | null) => {
  if (!value) return ''
  return typeof value === 'string' ? value : value.file_url || ''
}

const existingPhotoUrl = computed(() => editing.value?.photo_url || uploadUrl(editing.value?.photo))
const existingAvatarUrl = computed(() => editing.value?.avatar_url || uploadUrl(editing.value?.avatar))
const displayedPhotoUrl = computed(() => photoPreviewUrl.value || form.photo_url || existingPhotoUrl.value)
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

const fillForm = (master?: Master | null) => {
  resetFiles()
  form.full_name = master ? masterName(master) : ''
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
  if (!form.full_name.trim()) return 'Повне ім’я обов’язкове.'
  if (!editing.value && !form.email?.trim()) return 'Email для входу майстра обов’язковий.'
  if (!editing.value && !form.password?.trim()) return 'Пароль для входу майстра обов’язковий.'
  if (!editing.value && (form.password || '').trim().length < 6) return 'Пароль має містити щонайменше 6 символів.'
  if (photoFile.value && photoFile.value.type !== 'image/webp') return 'Фото має бути у форматі .webp.'
  if (avatarFile.value && avatarFile.value.type !== 'image/webp') return 'Avatar має бути у форматі .webp.'
  return ''
}

const submit = async () => {
  formError.value = validate()
  if (formError.value) return
  saving.value = true
  const payload: MasterFormPayload = {
    ...form,
    full_name: form.full_name.trim(),
    phone: form.phone?.trim() || null,
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
    if (open) fillForm(master)
  },
  { immediate: true },
)

onBeforeUnmount(resetFiles)
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-4xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.25em] text-cyan-700">Майстри</p>
          <h2 class="mt-2 text-2xl font-semibold text-slate-900">{{ editing ? 'Редагувати майстра' : 'Створити майстра' }}</h2>
        </div>
        <button type="button" class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700" @click="closeModal">
          Закрити
        </button>
      </div>
    </template>

    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Повне ім’я</span>
          <input v-model="form.full_name" required class="w-full rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Телефон</span>
            <input v-model="form.phone" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Email для входу</span>
            <input v-model="form.email" type="email" :required="!editing" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
          </label>
        </div>
        <label v-if="!editing" class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Пароль для входу</span>
          <input v-model="form.password" required type="password" minlength="6" autocomplete="new-password" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <p v-else class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Пароль для входу задається лише під час створення майстра. Для зміни наявного пароля потрібен backend endpoint керування користувачами.
        </p>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">URL фото</span>
          <input v-model="form.photo_url" class="w-full rounded-2xl border border-slate-300 px-4 py-3">
        </label>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Фото</span>
            <input :key="`photo-${fileInputKey}`" type="file" accept=".webp,image/webp" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white" @change="setFilePreview($event, 'photo')">
          </label>
          <label class="space-y-2 text-sm text-slate-700">
            <span class="font-medium">Avatar</span>
            <input :key="`avatar-${fileInputKey}`" type="file" accept=".webp,image/webp" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white" @change="setFilePreview($event, 'avatar')">
          </label>
        </div>
        <div v-if="displayedPhotoUrl || displayedAvatarUrl" class="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
          <div v-if="displayedPhotoUrl" class="space-y-2">
            <p class="text-sm font-medium text-slate-700">{{ editing ? 'Поточне фото' : 'Попередній перегляд фото' }}</p>
            <img :src="displayedPhotoUrl" alt="Фото майстра" class="h-44 w-full rounded-2xl object-cover">
          </div>
          <div v-if="displayedAvatarUrl" class="space-y-2">
            <p class="text-sm font-medium text-slate-700">{{ editing ? 'Поточний avatar' : 'Попередній перегляд avatar' }}</p>
            <img :src="displayedAvatarUrl" alt="Avatar майстра" class="h-44 w-full rounded-2xl object-cover">
          </div>
        </div>
        <label class="space-y-2 text-sm text-slate-700">
          <span class="font-medium">Опис</span>
          <textarea v-model="form.description" rows="4" class="w-full rounded-2xl border border-slate-300 px-4 py-3" />
        </label>
        <p class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Після створення майстра активні базові послуги копіюються автоматично. Використовуйте дію «Послуги» у списку, щоб керувати особистими послугами майстра.
        </p>
        <label class="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300">
          Майстер активний
        </label>
        <div class="flex flex-wrap gap-3">
          <button type="submit" :disabled="saving || disabled" class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
            <PlusIcon v-if="!editing && !saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти майстра' }}
          </button>
          <button type="button" class="rounded-full border border-slate-300 px-5 py-3 text-sm" @click="fillForm(editing)">
            Скинути
          </button>
        </div>
        <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
      </form>
    </template>
  </BaseModal>
</template>
