<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { modalRegistry } from '~/utils/modal-registry'

const modalStore = useModalStore()
const { activeModal, modalProps, isVisible } = storeToRefs(modalStore)
const { hideModal, finalizeClose } = modalStore

const modalComponent = computed(() => {
  return activeModal.value ? modalRegistry[activeModal.value] : null
})
</script>

<template>
  <component
    :is="modalComponent"
    v-if="modalComponent"
    :model-value="isVisible"
    v-bind="modalProps"
    @close="hideModal"
    @after-leave="finalizeClose"
  />
</template>
