export const useFloatingBookingDrawer = () => {
  const isOpen = useState<boolean>('floating-booking-drawer-open', () => false)

  const open = () => {
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
  }

  return {
    isOpen,
    open,
    close,
  }
}
