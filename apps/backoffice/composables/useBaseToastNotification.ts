import { toast } from 'vue-sonner'
import type { ExternalToast } from 'vue-sonner'

export const useBaseToastNotification = () => {
  const baseOptions = (options?: ExternalToast): ExternalToast => ({
    duration: 5000,
    ...options,
  })

  const success = (message: string, options?: ExternalToast) =>
    toast.success(message, baseOptions(options))

  const warning = (message: string, options?: ExternalToast) =>
    toast.warning(message, baseOptions(options))

  const error = (message: string, options?: ExternalToast) =>
    toast.error(message, baseOptions(options))

  const bookingCreated = () =>
    success('Бронювання створено.')

  return {
    success,
    warning,
    error,
    bookingCreated,
  }
}
