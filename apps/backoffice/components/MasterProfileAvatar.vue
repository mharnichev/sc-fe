<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { initials } from '@shared-utils'
import type { Master } from '~/composables/useBackofficeApi'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  masterId: number
  name: string
  avatarUrl?: string | null
  master?: Master | null
}>()

const { getPublicMasters } = useBackofficeApi()
const { masterName } = useBookingFormatting()
const assetUrl = useAssetUrl()
const open = ref(false)
const opened = ref(false)
const pending = ref(false)
const failedAvatar = ref('')
const fetchedMaster = ref<Master>()
const profile = computed(() => props.master?.id === props.masterId ? props.master
  : fetchedMaster.value?.id === props.masterId ? fetchedMaster.value : undefined)
const profileName = computed(() => profile.value ? masterName(profile.value) : props.name)
const avatar = computed(() => {
  const master = profile.value
  return props.avatarUrl || assetUrl(master?.avatar || master?.avatar_url || master?.photo || master?.photo_url)
})
const showAvatar = computed(() => Boolean(avatar.value && failedAvatar.value !== avatar.value))
const positions = { ambassador: 'Амбасадор', senior_master: 'Старший майстер', master: 'Майстер' }
const position = computed(() => profile.value?.position_uk || (profile.value?.position ? positions[profile.value.position] : ''))
const services = computed(() => profile.value?.services?.map(service => service.title_uk || service.name).filter(Boolean) || [])

const openProfile = async () => {
  opened.value = true
  open.value = true
  if (profile.value || pending.value) return
  const id = props.masterId
  pending.value = true
  try {
    const masters = await getPublicMasters()
    if (id === props.masterId) fetchedMaster.value = masters.find(master => master.id === id)
  } catch {
    if (id === props.masterId) fetchedMaster.value = undefined
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <BaseButton variant="unstyled"
    v-bind="$attrs"
    type="button"
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle text-xs font-semibold text-ui-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    :aria-label="`Інформація про майстра: ${name}`"
    aria-haspopup="dialog"
    @click.stop="openProfile"
    @keydown.enter.stop
    @keydown.space.stop
  >
    <img v-if="showAvatar" :src="avatar" alt="" class="h-full w-full object-cover" loading="lazy" @error="failedAvatar = avatar || ''" />
    <span v-else aria-hidden="true">{{ initials(name) || 'SC' }}</span>
  </BaseButton>

  <BaseModal v-if="opened" v-model="open" :aria-label="`Інформація про майстра: ${profileName}`" max-width-class="max-w-md !h-auto">
    <template #head="{ close }">
      <div class="flex items-center gap-3">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ui bg-ui-subtle font-semibold text-ui-accent">
          <img v-if="showAvatar" :src="avatar" alt="" class="h-full w-full object-cover" @error="failedAvatar = avatar || ''" />
          <span v-else aria-hidden="true">{{ initials(profileName) || 'SC' }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="break-words text-base font-semibold text-ui-primary">{{ profileName }}</h2>
          <p v-if="position" class="text-sm text-ui-secondary">{{ position }}</p>
        </div>
        <BaseButton type="button" variant="icon" class="shrink-0" aria-label="Закрити" @click="close">
          <XMarkIcon class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
      </div>
    </template>
    <template #body>
      <div class="space-y-3 text-sm text-ui-secondary">
        <p v-if="pending" role="status">Завантаження профілю…</p>
        <p v-else-if="!profile">Деталі профілю недоступні.</p>
        <p v-if="profile?.description" class="whitespace-pre-line break-words">{{ profile.description }}</p>
        <p v-if="services.length" class="break-words"><span class="font-semibold text-ui-primary">Послуги</span> · {{ services.join(', ') }}</p>
        <slot />
      </div>
    </template>
  </BaseModal>
</template>
