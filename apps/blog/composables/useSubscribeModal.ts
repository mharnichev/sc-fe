export const useSubscribeModal = () => {
  const isOpen = useState('blog-subscribe-modal-open', () => false)
  const initialEmail = useState('blog-subscribe-modal-email', () => '')

  const openSubscribeModal = async (email = '') => {
    initialEmail.value = email

    if (isOpen.value) {
      isOpen.value = false
      await nextTick()
    }

    isOpen.value = true
  }

  const closeSubscribeModal = () => {
    isOpen.value = false
  }

  return {
    closeSubscribeModal,
    initialEmail,
    isOpen,
    openSubscribeModal,
  }
}
