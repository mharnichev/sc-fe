export const useSubscribeModal = () => {
  const isOpen = useState('blog-subscribe-modal-open', () => false)
  const initialEmail = useState('blog-subscribe-modal-email', () => '')
  const { trackBlogEvent } = useBlogAnalytics()

  const openSubscribeModal = async (email = '', source = 'unknown') => {
    initialEmail.value = email
    trackBlogEvent('subscribe_modal_open', {
      has_prefilled_email: Boolean(email),
      source,
    })

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
