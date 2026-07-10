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
    root-class="search-modal"
    type="fullscreen"
    :show-header="false"
    @close="hideSearchModal"
  >
    <section class="mobile-search-modal">
      <header class="mobile-search-modal__header">
        <div>
          <p>{{ terms.common.search }}</p>
          <h2>{{ terms.header.searchProductsTitle }}</h2>
        </div>
        <BaseButton
          type="button"
          variant="outline-dark"
          size="sm"
          shape="circle"
          :aria-label="terms.common.closeDialog"
          @click="hideSearchModal"
        >
          <BaseIcon name="close" size="xxs" />
        </BaseButton>
      </header>

      <div class="mobile-search-modal__body">
        <HeaderSearch variant="modal" autofocus @close="hideSearchModal" />
      </div>
    </section>
  </BaseModal>
</template>

<style scoped>
.mobile-search-modal {
  min-height: 100%;
  background: #f5f5f4;
}

.mobile-search-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  padding: 0.875rem 1rem;
}

.mobile-search-modal__header p {
  color: #737373;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.mobile-search-modal__header h2 {
  margin-top: 0.15rem;
  color: #0a0a0a;
  font-size: 1.05rem;
  font-weight: 800;
}

.mobile-search-modal__body {
  padding: 1rem;
}
</style>
