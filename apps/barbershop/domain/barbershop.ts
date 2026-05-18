import type { AvailableSlotDto, BookingDto, GoogleBusinessReviewsResponseDto, MasterDto, PageDto, ServiceCatalogItemDto, ServiceDto } from '@shared-types'

export interface PublicBookingPayload {
  master_id: number
  service_id: number
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
  const getAvailableSlots = (masterId: number, serviceId: number, date: string) =>
    api<AvailableSlotDto[]>(`/public/masters/${masterId}/available-slots`, {
      query: {
        service_id: serviceId,
        date,
      },
    })
  const createBooking = (payload: PublicBookingPayload) => api<BookingDto>('/public/bookings', { method: 'POST', body: payload })

  return { getServices, getServiceCatalog, getMasters, getPages, getReviews, getAvailableSlots, createBooking }
}
