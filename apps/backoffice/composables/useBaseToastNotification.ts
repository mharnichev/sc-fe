import { toast } from 'vue-sonner'
import type { ExternalToast } from 'vue-sonner'

export const useBaseToastNotification = () => {
  const success = (message: string, options?: ExternalToast) =>
    toast.success(message, options)

  const bookingCreated = () =>
    success('Бронювання створено.')

  return {
    success,
    bookingCreated,
  }
}
