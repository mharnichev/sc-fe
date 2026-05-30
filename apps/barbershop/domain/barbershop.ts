import type { AvailableSlotDto, BookingDto, GoogleBusinessReviewsResponseDto, MasterDto, PageDto, ServiceCatalogItemDto, ServiceDto } from '@shared-types'

export interface PublicBookingPayload {
  master_id: number
  service_id: number
  service_ids?: number[]
  duration_minutes?: number
  customer_name: string
  customer_phone: string
  customer_comment?: string | null
  start_at: string
}

export const useBarbershopDomain = () => {
  const api = useApi()

  const getServices = () => api<ServiceDto[]>('/public/services')
  const getServiceCatalog = () => api<ServiceCatalogItemDto[]>('/public/service-catalog')
  const getMasters = () => api<MasterDto[]>('/public/masters')
  const getPages = () => api<PageDto[]>('/public/pages')
  const getReviews = () => api<GoogleBusinessReviewsResponseDto>('/public/reviews')
  const getAvailableSlots = (masterId: number, serviceId: number | number[], date: string, durationMinutes?: number) => {
    const serviceIds = Array.isArray(serviceId) ? serviceId : [serviceId]
    return api<AvailableSlotDto[]>(`/public/masters/${masterId}/available-slots`, {
      query: {
        service_id: serviceIds[0],
        service_ids: serviceIds,
        duration_minutes: durationMinutes,
        date,
      },
    })
  }
  const createBooking = (payload: PublicBookingPayload) => api<BookingDto>('/public/bookings', { method: 'POST', body: payload })

  return { getServices, getServiceCatalog, getMasters, getPages, getReviews, getAvailableSlots, createBooking }
}
