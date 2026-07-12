import type { AvailableSlotDto, BookingDto, BrandDto, GoogleBusinessReviewsResponseDto, MasterDto, PageDto, PaginatedResponse, ServiceCatalogItemDto, ServiceDto } from '@shared-types'

interface PublicBrandDto {
  id: number
  name: string
  slug: string
  description: string | null
  logo_url?: string | null
  website?: string | null
  status?: string
}

export interface PublicBookingPayload {
  master_id: number
  service_id: number
  service_ids?: number[]
  duration_minutes?: number
  customer_name: string
  customer_phone: string
  customer_comment?: string | null
  promotion_code?: string | null
  start_at: string
}

export const useBarbershopDomain = () => {
  const api = useApi()

  const getServices = () => api<ServiceDto[]>('/public/services')
  const getServiceCatalog = () => api<ServiceCatalogItemDto[]>('/public/service-catalog')
  const getMasters = () => api<MasterDto[]>('/public/masters')
  const getPages = () => api<PageDto[]>('/public/pages')
  const getReviews = () => api<GoogleBusinessReviewsResponseDto>('/public/reviews')
  const getBrands = async (): Promise<BrandDto[]> => {
    const response = await api<PaginatedResponse<PublicBrandDto>>('/public/brands', {
      query: {
        page: 1,
        page_size: 100,
        has_active_products: true,
      },
    })

    return response.items.map(brand => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logo_url: brand.logo_url ?? null,
      website: brand.website ?? null,
      status: brand.status ?? 'active',
    }))
  }
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

  return { getServices, getServiceCatalog, getMasters, getPages, getReviews, getBrands, getAvailableSlots, createBooking }
}
