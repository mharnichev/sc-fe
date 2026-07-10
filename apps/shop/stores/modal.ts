import type { ModalKey } from '~/utils/modal-registry'

interface ModalState {
  activeModal: ModalKey | null
  modalProps: Record<string, unknown>
  isVisible: boolean
}

export const useModalStore = defineStore('modal', {
  state: (): ModalState => ({
    activeModal: null,
    modalProps: {},
    isVisible: false,
  }),
  actions: {
    openModal(name: ModalKey, props: Record<string, unknown> = {}) {
      this.activeModal = name
      this.modalProps = props
      this.isVisible = true
    },
    hideModal() {
      this.isVisible = false
    },
    finalizeClose() {
      this.activeModal = null
      this.modalProps = {}
    },
  },
})
