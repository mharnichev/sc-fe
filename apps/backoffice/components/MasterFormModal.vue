<script setup lang="ts">
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowsPointingOutIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  EyeIcon,
  IdentificationIcon,
  InformationCircleIcon,
  KeyIcon,
  LanguageIcon,
  PencilSquareIcon,
  PhoneIcon,
  PhotoIcon,
  PlusIcon,
  UserCircleIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import type { Master, MasterFormPayload, MasterPayload, MasterPosition } from '~/composables/useBackofficeApi'

const props = defineProps<{
  modelValue: boolean
  master?: Master | null
  masters?: Master[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [message: string]
}>()

const api = useBackofficeApi()
const assetUrl = useAssetUrl()
const { apiErrorMessage, masterName } = useBookingFormatting()
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
  bookingRedirectMasterId: null,
  is_active: true,
  showOnMasterBlock: true,
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
const positionSelectOpen = ref(false)
const redirectSelectOpen = ref(false)
const positionSelectRef = ref<HTMLElement | null>(null)
const redirectSelectRef = ref<HTMLElement | null>(null)

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

const existingPhotoUrl = computed(() => assetUrl(editing.value?.photo || editing.value?.photo_url))
const existingAvatarUrl = computed(() => assetUrl(editing.value?.avatar || editing.value?.avatar_url))
const displayedPhotoUrl = computed(() => {
  if (photoPreviewUrl.value) return photoPreviewUrl.value
  return existingPhotoUrl.value
})
const displayedAvatarUrl = computed(() => avatarPreviewUrl.value || existingAvatarUrl.value)
const isMasterActive = (master: Master) => Boolean(master.is_active ?? master.status !== 'неактивний')
const selectedPositionOption = computed(() =>
  positionOptions.find(option => option.value === form.position) || positionOptions[0],
)
const formBookingRedirectMasterId = computed(() => {
  const numeric = Number(form.bookingRedirectMasterId)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
})
const redirectTargetId = (master?: Master | null) =>
  master?.bookingRedirectMasterId ?? master?.booking_redirect_master_id ?? null
const redirectMasterOptions = computed(() => {
  const currentId = editing.value?.id ?? null
  return (props.masters || []).filter(master => master.id !== currentId && isMasterActive(master))
})
const selectedRedirectMaster = computed(() =>
  props.masters?.find(master => master.id === formBookingRedirectMasterId.value) || null,
)
const wouldCreateRedirectCycle = (targetMaster: Master) => {
  const sourceId = editing.value?.id
  if (!sourceId) return false

  const mastersById = new Map((props.masters || []).map(master => [master.id, master]))
  const visited = new Set<number>()
  let nextId: number | null | undefined = targetMaster.id

  while (nextId) {
    if (nextId === sourceId) return true
    if (visited.has(nextId)) return false
    visited.add(nextId)
    nextId = redirectTargetId(mastersById.get(nextId))
  }

  return false
}
const availableRedirectMasterOptions = computed(() =>
  redirectMasterOptions.value.filter(master => !wouldCreateRedirectCycle(master)),
)
const selectedRedirectMasterMissing = computed(() =>
  Boolean(formBookingRedirectMasterId.value && !selectedRedirectMaster.value),
)
const selectedRedirectMasterInactive = computed(() =>
  Boolean(selectedRedirectMaster.value && !isMasterActive(selectedRedirectMaster.value)),
)
const selectedRedirectMasterUnavailable = computed(() =>
  Boolean(
    selectedRedirectMaster.value
    && !availableRedirectMasterOptions.value.some(master => master.id === selectedRedirectMaster.value?.id),
  ),
)
const selectedRedirectLabel = computed(() => {
  if (selectedRedirectMaster.value) return masterName(selectedRedirectMaster.value)
  if (formBookingRedirectMasterId.value) return `Майстер #${formBookingRedirectMasterId.value}`
  return 'Не перенаправляти'
})

const redirectMasterAvatarUrl = (master?: Master | null) =>
  assetUrl(master?.avatar || master?.avatar_url || master?.photo || master?.photo_url)

const masterInitials = (master?: Master | null) => {
  if (!master) return ''
  const name = masterName(master)
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

const selectPosition = (value: MasterPosition) => {
  form.position = value
  positionSelectOpen.value = false
}

const selectRedirectMaster = (value: number | null) => {
  form.bookingRedirectMasterId = value
  redirectSelectOpen.value = false
}

const handleSelectClickOutside = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Node)) return

  if (positionSelectRef.value && !positionSelectRef.value.contains(target)) {
    positionSelectOpen.value = false
  }

  if (redirectSelectRef.value && !redirectSelectRef.value.contains(target)) {
    redirectSelectOpen.value = false
  }
}

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
  form.bookingRedirectMasterId = redirectTargetId(master)
  form.is_active = master ? (master.is_active ?? master.status !== 'неактивний') : true
  form.showOnMasterBlock = master ? (master.showOnMasterBlock ?? master.show_on_master_block ?? true) : true
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
  if (editing.value && formBookingRedirectMasterId.value === editing.value.id) return 'Майстер не може перенаправляти записи на себе.'
  if (selectedRedirectMasterInactive.value) return 'Для перенаправлення можна вибрати лише активного майстра.'
  if (formBookingRedirectMasterId.value && selectedRedirectMaster.value && wouldCreateRedirectCycle(selectedRedirectMaster.value)) return 'Таке перенаправлення створює цикл.'
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
    photo: photoFile.value,
    avatar: avatarFile.value,
    bookingRedirectMasterId: formBookingRedirectMasterId.value,
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
      positionSelectOpen.value = false
      redirectSelectOpen.value = false
      return
    }
    if (open) fillForm(master)
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('mousedown', handleSelectClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleSelectClickOutside)
  closeImagePreview()
  resetFiles()
})
</script>

<template>
  <BaseModal :model-value="modelValue" max-width-class="max-w-3xl" @update:model-value="emit('update:modelValue', $event)" @close="formError = ''">
    <template #head="{ close: closeModal }">
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2.5">
          <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
            <UserCircleIcon class="h-5 w-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Майстри</p>
            <h2 class="mt-0.5 text-lg font-semibold leading-tight text-slate-900 sm:text-xl">{{ editing ? 'Редагувати майстра' : 'Створити майстра' }}</h2>
          </div>
        </div>
        <ModalCloseButton @click="closeModal" />
      </div>
    </template>

    <template #body>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <IdentificationIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Ім’я українською
            </span>
            <input v-model="form.full_name" required autocomplete="given-name" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4">
          </label>
          <label class="space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <IdentificationIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Прізвище українською
            </span>
            <input v-model="form.last_name" required autocomplete="family-name" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4">
          </label>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <LanguageIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              First name англійською
            </span>
            <input v-model="form.first_name_en" required class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4">
          </label>
          <label class="space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <LanguageIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Last name англійською
            </span>
            <input v-model="form.last_name_en" required class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4">
          </label>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div ref="positionSelectRef" class="relative min-w-0 space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <BriefcaseIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Позиція
            </span>
            <button
              type="button"
              class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-900 shadow-sm sm:px-4"
              :aria-expanded="positionSelectOpen"
              @click="positionSelectOpen = !positionSelectOpen"
            >
              <span class="min-w-0 truncate">{{ selectedPositionOption.label }}</span>
              <ChevronDownIcon class="h-4 w-4 shrink-0 text-cyan-700 transition" :class="{ 'rotate-180': positionSelectOpen }" aria-hidden="true" />
            </button>
            <div v-if="positionSelectOpen" class="booking-select-menu absolute z-[180] mt-1 max-h-72 w-full min-w-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl md:rounded-2xl">
              <button
                v-for="option in positionOptions"
                :key="option.value"
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                :class="form.position === option.value ? 'bg-slate-50 text-slate-950' : ''"
                @click="selectPosition(option.value)"
              >
                <span>{{ option.label }}</span>
                <CheckCircleIcon v-if="form.position === option.value" class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div ref="redirectSelectRef" class="relative min-w-0 space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <ArrowRightIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Перенаправляти онлайн-записи до
            </span>
            <button
              type="button"
              class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-900 shadow-sm sm:px-4"
              :aria-expanded="redirectSelectOpen"
              @click="redirectSelectOpen = !redirectSelectOpen"
            >
              <span class="flex min-w-0 items-center gap-2.5">
                <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-cyan-700">
                  <img v-if="redirectMasterAvatarUrl(selectedRedirectMaster)" :src="redirectMasterAvatarUrl(selectedRedirectMaster)" alt="" class="h-full w-full object-cover">
                  <ArrowRightIcon v-else-if="!selectedRedirectMaster" class="h-4 w-4" aria-hidden="true" />
                  <span v-else>{{ masterInitials(selectedRedirectMaster) }}</span>
                </span>
                <span class="min-w-0 truncate">{{ selectedRedirectLabel }}</span>
              </span>
              <ChevronDownIcon class="h-4 w-4 shrink-0 text-cyan-700 transition" :class="{ 'rotate-180': redirectSelectOpen }" aria-hidden="true" />
            </button>
            <div v-if="redirectSelectOpen" class="booking-select-menu absolute z-[180] mt-1 max-h-72 w-full min-w-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl md:rounded-2xl">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                :class="!formBookingRedirectMasterId ? 'bg-slate-50 text-slate-950' : ''"
                @click="selectRedirectMaster(null)"
              >
                <span class="flex min-w-0 items-center gap-2.5">
                  <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-cyan-700">
                    <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span class="min-w-0 truncate">Не перенаправляти</span>
                </span>
                <CheckCircleIcon v-if="!formBookingRedirectMasterId" class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              </button>
              <button
                v-if="selectedRedirectMasterMissing"
                type="button"
                disabled
                class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-500 opacity-70"
              >
                <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-cyan-700">#</span>
                <span class="min-w-0 truncate">Майстер #{{ formBookingRedirectMasterId }}</span>
              </button>
              <button
                v-if="selectedRedirectMasterUnavailable && selectedRedirectMaster"
                type="button"
                disabled
                class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-500 opacity-70"
              >
                <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-cyan-700">
                  <img v-if="redirectMasterAvatarUrl(selectedRedirectMaster)" :src="redirectMasterAvatarUrl(selectedRedirectMaster)" alt="" class="h-full w-full object-cover">
                  <span v-else>{{ masterInitials(selectedRedirectMaster) }}</span>
                </span>
                <span class="min-w-0 truncate">{{ masterName(selectedRedirectMaster) }}</span>
              </button>
              <button
                v-for="master in availableRedirectMasterOptions"
                :key="master.id"
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                :class="formBookingRedirectMasterId === master.id ? 'bg-slate-50 text-slate-950' : ''"
                @click="selectRedirectMaster(master.id)"
              >
                <span class="flex min-w-0 items-center gap-2.5">
                  <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-cyan-700">
                    <img v-if="redirectMasterAvatarUrl(master)" :src="redirectMasterAvatarUrl(master)" alt="" class="h-full w-full object-cover">
                    <span v-else>{{ masterInitials(master) }}</span>
                  </span>
                  <span class="min-w-0 truncate">{{ masterName(master) }}</span>
                </span>
                <CheckCircleIcon v-if="formBookingRedirectMasterId === master.id" class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <PhoneIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Телефон
            </span>
            <input
              v-model="maskedPhone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="+380 XX XXX XX XX"
              maxlength="17"
              class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4"
              @focus="focusPhone"
              @blur="blurPhone"
            >
          </label>
          <label class="space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <EnvelopeIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Email для входу
            </span>
            <input v-model="form.email" type="email" :required="!editing" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4">
          </label>
        </div>
        <label v-if="!editing" class="space-y-1.5 text-sm text-slate-700">
          <span class="flex items-center gap-2 font-medium">
            <KeyIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
            Пароль для входу
          </span>
          <input v-model="form.password" required type="password" minlength="6" autocomplete="new-password" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4">
        </label>
        <p v-else class="flex gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 sm:px-4">
          <InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" />
          <span>Пароль для входу задається лише під час створення майстра. Для зміни наявного пароля потрібен backend endpoint керування користувачами.</span>
        </p>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <PhotoIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Фото
            </span>
            <input :key="`photo-${fileInputKey}`" type="file" accept=".webp,image/webp" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white sm:px-4 sm:file:mr-4" @change="setFilePreview($event, 'photo')">
          </label>
          <label class="space-y-1.5 text-sm text-slate-700">
            <span class="flex items-center gap-2 font-medium">
              <UserCircleIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
              Avatar
            </span>
            <input :key="`avatar-${fileInputKey}`" type="file" accept=".webp,image/webp" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white sm:px-4 sm:file:mr-4" @change="setFilePreview($event, 'avatar')">
          </label>
        </div>
        <div v-if="displayedPhotoUrl || displayedAvatarUrl" class="grid gap-4 rounded-xl bg-slate-50 p-3 sm:p-4 md:grid-cols-2">
          <div v-if="displayedPhotoUrl" class="space-y-1.5">
            <p class="text-sm font-medium text-slate-700">{{ editing ? 'Поточне фото' : 'Попередній перегляд фото' }}</p>
            <button type="button" class="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-white" title="Відкрити повний перегляд" @click="openImagePreview(displayedPhotoUrl, 'Фото майстра')">
              <img :src="displayedPhotoUrl" alt="Фото майстра" class="h-32 w-full object-cover sm:h-44">
              <span class="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-100 transition group-hover:bg-slate-950 sm:opacity-0 sm:group-hover:opacity-100">
                <ArrowsPointingOutIcon class="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
          <div v-if="displayedAvatarUrl" class="space-y-1.5">
            <p class="text-sm font-medium text-slate-700">{{ editing ? 'Поточний avatar' : 'Попередній перегляд avatar' }}</p>
            <button type="button" class="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-white" title="Відкрити повний перегляд" @click="openImagePreview(displayedAvatarUrl, 'Avatar майстра')">
              <img :src="displayedAvatarUrl" alt="Avatar майстра" class="h-32 w-full object-cover sm:h-44">
              <span class="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-100 transition group-hover:bg-slate-950 sm:opacity-0 sm:group-hover:opacity-100">
                <ArrowsPointingOutIcon class="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
        <label class="mt-2 space-y-1.5 text-sm text-slate-700">
          <span class="flex items-center gap-2 font-medium">
            <DocumentTextIcon class="h-4 w-4 text-cyan-700" aria-hidden="true" />
            Опис
          </span>
          <textarea v-model="form.description" rows="3" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 sm:px-4" />
        </label>
        <p class="flex gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 sm:px-4">
          <InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" />
          <span>Після створення майстра активні базові послуги копіюються автоматично. Використовуйте дію «Послуги» у списку, щоб керувати особистими послугами майстра.</span>
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 sm:px-4">
            <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300">
            <CheckCircleIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
            <span>Майстер активний</span>
          </label>
          <label class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 sm:px-4">
            <input v-model="form.showOnMasterBlock" type="checkbox" class="h-4 w-4 rounded border-slate-300">
            <EyeIcon class="h-5 w-5 text-cyan-700" aria-hidden="true" />
            <span>Показувати у блоці майстрів</span>
          </label>
        </div>
        <div class="backoffice-modal-actions">
          <button type="submit" :disabled="saving || disabled" class="backoffice-modal-action-button backoffice-modal-action-primary">
            <PlusIcon v-if="!editing && !saving" class="h-4 w-4" aria-hidden="true" />
            <PencilSquareIcon v-else-if="editing && !saving" class="h-4 w-4" aria-hidden="true" />
            {{ saving ? 'Збереження...' : 'Зберегти майстра' }}
          </button>
          <button type="button" class="backoffice-modal-action-button backoffice-modal-action-secondary" @click="fillForm(editing)">
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
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
