<script setup lang="ts">
import type { CustomerSegment, SegmentRules } from '~/types/segments'
import { defaultSegmentRules, loadSegmentServiceOptions, segmentApiError, validateRules } from '~/utils/segmentRules.mjs'
import SegmentRuleBuilder from './SegmentRuleBuilder.vue'
import SegmentMembers from './SegmentMembers.vue'
const props = defineProps<{ segment?: CustomerSegment; duplicate?: boolean }>()
const api = useBackofficeApi()
const { masterName, serviceName } = useBookingFormatting()
const name = ref(props.segment ? `${props.segment.name}${props.duplicate ? ' — копія' : ''}` : '')
const description = ref(props.segment?.description || '')
const rules = ref<SegmentRules>(props.segment ? JSON.parse(JSON.stringify(props.segment.rules)) : defaultSegmentRules())
const saving = ref(false)
const error = ref('')
const attempted = ref(false)
const errors = computed(() => [
  ...(!name.value.trim() ? ['Вкажіть назву сегмента.'] : name.value.trim().length > 255 ? ['Назва має містити до 255 символів.'] : []),
  ...(description.value.length > 5000 ? ['Опис має містити до 5000 символів.'] : []),
  ...validateRules(rules.value),
])
type Option = { value: number; label: string }
const masters = ref<Option[]>([])
const services = ref<Option[]>([])
const campaigns = ref<Option[]>([])
const catalogError = ref('')
const catalogPending = ref(false)
const mastersLoaded = ref(false)
const servicesLoaded = ref(false)
const servicesPending = ref(false)
const servicesError = ref('')
const needsServices = computed(() => [...rules.value.conditions, ...rules.value.exclusions].some(rule => rule.type === 'received_service'))
async function loadServices() {
  if (!mastersLoaded.value || servicesPending.value) return
  servicesPending.value = true
  servicesError.value = ''
  try {
    services.value = await loadSegmentServiceOptions(masters.value, api.getMasterServices, serviceName)
    servicesLoaded.value = true
  } catch (reason) { servicesError.value = `Не вдалося завантажити послуги майстрів. ${segmentApiError(reason)}` }
  finally { servicesPending.value = false }
}
watch([needsServices, mastersLoaded], ([needed, loaded]) => {
  if (needed && loaded && !servicesLoaded.value) void loadServices()
})
async function loadCatalogs() {
  catalogPending.value = true
  catalogError.value = ''
  const results = await Promise.allSettled([
    (async () => {
      const options: Option[] = []
      let page = 1
      while (true) {
        const response = await api.adminGetMasters(page, 100)
        const items = Array.isArray(response) ? response : response.items
        options.push(...items.map(item => ({ value: item.id, label: `${masterName(item)}${item.is_active === false ? ' (неактивний)' : ''}` })))
        if (Array.isArray(response) || page * 100 >= response.total || !items.length) break
        page += 1
      }
      masters.value = options
      mastersLoaded.value = true
    })(),
    (async () => {
      const options: Option[] = []
      let page = 1
      while (true) {
        const response = await api.getMessagingCampaigns(page, 100, { view: 'campaigns' })
        options.push(...response.items.map(item => ({ value: Number(item.id), label: `${item.name}${item.status === 'archived' ? ' (архів)' : ''}` })))
        if (page * 100 >= response.total || !response.items.length) break
        page += 1
      }
      campaigns.value = options
    })(),
  ])
  if (results.some(result => result.status === 'rejected')) catalogError.value = 'Не вдалося завантажити всі довідники майстрів або кампаній.'
  catalogPending.value = false
}
onMounted(loadCatalogs)
async function save() {
  attempted.value = true
  if (errors.value.length || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const payload = { name: name.value.trim(), description: description.value.trim() || null, rules: JSON.parse(JSON.stringify(rules.value)) }
    const saved = props.segment && !props.duplicate
      ? await api.updateSegment(props.segment.id, { ...payload, expected_revision: props.segment.revision })
      : await api.createSegment(payload)
    await navigateTo(`/customers/segments/${saved.id}`)
  } catch (reason) { error.value = segmentApiError(reason) }
  finally { saving.value = false }
}
</script>
<template>
  <form class="space-y-6" novalidate @submit.prevent="save">
    <BaseCard class="space-y-5">
      <BaseInput v-model="name" label="Назва сегмента" required :maxlength="255" :error="attempted && !name.trim() ? 'Вкажіть назву' : ''" />
      <BaseTextarea v-model="description" label="Опис" :maxlength="5000" :rows="3" />
      <p v-if="catalogPending" role="status" class="text-sm text-ui-muted">Завантаження довідників…</p>
      <div v-if="catalogError" role="alert" class="flex flex-wrap items-center gap-3 text-sm text-rose-600">{{ catalogError }} <BaseButton variant="neutral" :loading="catalogPending" @click="loadCatalogs">Повторити</BaseButton></div>
      <p v-if="servicesPending" role="status" class="text-sm text-ui-muted">Завантаження послуг майстрів…</p>
      <div v-if="needsServices && servicesError" role="alert" class="flex flex-wrap items-center gap-3 text-sm text-rose-600">{{ servicesError }} <BaseButton variant="neutral" :loading="servicesPending" @click="loadServices">Повторити завантаження послуг</BaseButton></div>
      <SegmentRuleBuilder v-model="rules" :masters="masters" :services="services" :campaigns="campaigns" />
    </BaseCard>
    <BaseCard v-if="attempted && errors.length" variant="subtle" padding="sm"><ul role="alert" class="space-y-1 text-sm text-rose-600"><li v-for="item in errors" :key="item">{{ item }}</li></ul></BaseCard>
    <BaseCard><SegmentMembers :rules="rules" /></BaseCard>
    <p v-if="error" role="alert" class="text-sm text-rose-600">{{ error }}</p>
    <div class="flex flex-wrap gap-3">
      <BaseButton type="submit" variant="primary" :loading="saving">Зберегти сегмент</BaseButton>
      <NuxtLink :to="segment && !duplicate ? `/customers/segments/${segment.id}` : '/customers/segments'" class="base-button base-button--neutral px-4 py-2">Скасувати</NuxtLink>
    </div>
  </form>
</template>
