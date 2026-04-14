import type { BookingDto, MasterDto, PageDto, ServiceDto } from '@shared-types'

export const useBarbershopDomain = () => {
  const api = useApi()

  const getServices = () => api<ServiceDto[]>('/public/services')
  const getMasters = () => api<MasterDto[]>('/public/masters')
  const getPages = () => api<PageDto[]>('/public/pages')
  const createBooking = (payload: Record<string, unknown>) => api<BookingDto>('/public/bookings', { method: 'POST', body: payload })

  return { getServices, getMasters, getPages, createBooking }
}
