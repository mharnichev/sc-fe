<script setup lang="ts">
import type { Master, MasterPayload, UploadAsset } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const auth = useAuthStore()
const { masterName, normalizeItems, normalizeTotal, apiErrorMessage } = useBookingFormatting()

const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const page = ref(1)
const pageSize = 100
const filters = reactive({ search: '', is_active: '' })
const form = reactive<MasterPayload>({
  full_name: '',
  phone: null,
  email: null,
  password: '',
  description: null,
  photo_url: null,
  is_active: true,
})
const editing = ref<Master | null>(null)
const formError = ref('')
const successMessage = ref('')
const saving = ref(false)
const photoFile = ref<File | null>(null)
const avatarFile = ref<File | null>(null)
const photoPreviewUrl = ref('')
const avatarPreviewUrl = ref('')
const fileInputKey = ref(0)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-masters',
  () => {
    if (!isAdmin.value) return Promise.resolve([] as Master[])
    return api.adminGetMasters(page.value, pageSize, {
      search: filters.search || undefined,
      is_active: filters.is_active === '' ? null : filters.is_active === 'true',
    })
  },
  { watch: [page] },
)

const masters = computed(() => normalizeItems(data.value))
const total = computed(() => normalizeTotal(data.value))

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

const resetFiles = () => {
  revokeObjectUrl(photoPreviewUrl.value)
  revokeObjectUrl(avatarPreviewUrl.value)
  photoFile.value = null
  avatarFile.value = null
  photoPreviewUrl.value = ''
  avatarPreviewUrl.value = ''
  fileInputKey.value += 1
}

const resetForm = () => {
  editing.value = null
  form.full_name = ''
  form.phone = null
  form.email = null
  form.password = ''
  form.description = null
  form.photo_url = null
  form.is_active = true
  resetFiles()
  formError.value = ''
}

const editMaster = (master: Master) => {
  editing.value = master
  form.full_name = masterName(master)
  form.phone = master.phone || null
  form.email = master.email || null
  form.password = ''
  form.description = master.description || null
  form.photo_url = master.photo_url || uploadUrl(master.photo) || null
  form.is_active = master.is_active ?? master.status !== 'неактивний'
  resetFiles()
  formError.value = ''
}

onBeforeUnmount(resetFiles)

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
  successMessage.value = ''
  if (formError.value) return
  saving.value = true
  const payload = {
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
      successMessage.value = 'Майстра оновлено.'
    }
    else {
      await api.adminCreateMaster(payload)
      successMessage.value = 'Майстра створено.'
    }
    resetForm()
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося зберегти майстра.')
  }
  finally {
    saving.value = false
  }
}

const toggleMaster = async (master: Master) => {
  formError.value = ''
  successMessage.value = ''
  try {
    await api.adminUpdateMaster(master.id, { is_active: !(master.is_active ?? master.status !== 'неактивний') })
    successMessage.value = 'Статус майстра оновлено.'
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося оновити статус майстра.')
  }
}

const applyFilters = async () => {
  if (!isAdmin.value) return
  page.value = 1
  if (page.value === 1) await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Адмін</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Майстри</h1>
    </div>

    <p v-if="!isAdmin" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Для керування майстрами потрібен доступ адміністратора.
    </p>

    <section class="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <form class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="submit">
        <h2 class="text-xl font-semibold text-slate-900">{{ editing ? 'Редагувати майстра' : 'Створити майстра' }}</h2>
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
          <button type="submit" :disabled="saving || !isAdmin" class="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
            {{ saving ? 'Збереження...' : 'Зберегти майстра' }}
          </button>
          <button type="button" class="rounded-full border border-slate-300 px-5 py-3 text-sm" @click="resetForm">Скинути</button>
        </div>
        <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
        <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ successMessage }}</p>
      </form>

      <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input v-model="filters.search" placeholder="Пошук майстрів" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
          <select v-model="filters.is_active" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
            <option value="">Будь-який статус</option>
            <option value="true">Активні</option>
            <option value="false">Неактивні</option>
          </select>
          <button class="rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
        </div>
        <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {{ apiErrorMessage(error, 'Не вдалося завантажити майстрів.') }}
        </p>
        <p class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">Total: {{ total }}</p>
        <div v-if="pending" class="text-sm text-slate-500">Завантаження майстрів...</div>
        <div v-else-if="!masters.length" class="text-sm text-slate-500">Майстрів не знайдено.</div>
        <div v-else class="divide-y divide-slate-100">
          <article v-for="master in masters" :key="master.id" class="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p class="font-medium text-slate-900">{{ masterName(master) }}</p>
              <p class="text-sm text-slate-500">{{ master.phone || master.email || 'Без контактів' }}</p>
              <p class="text-xs text-slate-500">{{ master.services?.map(service => service.name).join(', ') || 'Немає призначених послуг' }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full px-3 py-1 text-xs font-medium" :class="(master.is_active ?? master.status !== 'неактивний') ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                {{ (master.is_active ?? master.status !== 'неактивний') ? 'активний' : 'неактивний' }}
              </span>
              <NuxtLink class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700" :to="`/masters/${master.id}/services`">Послуги</NuxtLink>
              <button class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700" @click="editMaster(master)">Редагувати</button>
              <button class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700" :disabled="!isAdmin" @click="toggleMaster(master)">
                {{ (master.is_active ?? master.status !== 'неактивний') ? 'Деактивувати' : 'Активувати' }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>
  </div>
</template>
