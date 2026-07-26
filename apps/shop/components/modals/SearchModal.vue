<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const modal = useModalStore()
const { terms } = useShopLocale()
const isShow = ref(false)

watch(() => props.modelValue, value => {
  isShow.value = value
}, { immediate: true })

const hideSearchModal = () => {
  emit('update:modelValue', false)
  isShow.value = false
  modal.hideModal()
}
</script>

<template>
  <BaseModal
    v-model="isShow"
    full-height
    type="bottom"
    content-type="secondary"
    @close="hideSearchModal"
  >
    <template #header-title>{{ terms.common.search }}</template>

    <div class="mobile-search-modal">
      <p class="mobile-search-modal__title">{{ terms.header.searchProductsTitle }}</p>
      <HeaderSearch variant="modal" autofocus @close="hideSearchModal" />
    </div>
  </BaseModal>
</template>

<style scoped>
.mobile-search-modal {
  min-height: 100%;
  padding: 0.75rem;
}

.mobile-search-modal__title {
  margin-bottom: 0.75rem;
  color: #525252;
  font-size: 0.75rem;
  font-weight: 700;
}
</style>
