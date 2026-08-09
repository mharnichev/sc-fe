import type { AvailableSlotDto, BookingDto, BrandDto, GoogleBusinessReviewsResponseDto, PageDto, PaginatedResponse, ServicePromotionDto } from '@shared-types'
import type { PublicMasterDto, PublicServiceCatalogItemDto, PublicServiceDto } from '~/utils/seoRoutes'
import type { BookingFunnelEventPayload } from '~/utils/bookingFunnel'

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
  funnel_session_id?: string
  recovery_source?: 'alternative'
}

export interface BookingFunnelEventReceipt {
  event_id: string
  status: 'recorded' | 'duplicate'
}

export interface BookingAlternativeMasterDto {
  id: number
  name: string
  photo_url: string | null
  avatar_url: string | null
  role: string | null
  rating_summary: number | null
}

export interface BookingAlternativeSlotDto {
  master: BookingAlternativeMasterDto
  start_at: string
  end_at: string
  date: string
  duration_minutes: number
}

export interface BookingAlternativesResponseDto {
  same_master: BookingAlternativeSlotDto[]
  other_masters: BookingAlternativeSlotDto[]
}

export interface BookingAlternativesPayload {
  master_id: number
  service_ids: number[]
  desired_date: string
  duration_minutes: number
  another_master_acceptable: boolean
  funnel_session_id?: string
}

export interface PublicWaitlistPayload {
  customer_name: string
  customer_phone: string
  service_ids: number[]
  preferred_master_id: number | null
  desired_date: string
  acceptable_date_from?: string
  acceptable_date_to?: string
  duration_minutes: number
  notification_consent: true
}

export interface PublicWaitlistResponseDto {
  public_id: string
  status: 'active' | 'offered' | 'booked' | 'expired' | 'cancelled'
  expires_at: string
  cancel_token: string
}

export interface BookingRecoveryEventPayload {
  event_id: string
  anonymous_session_id: string
  event_type: 'alternative_slot_selected' | 'waitlist_opened'
  master_id?: number
  service_id?: number
}

export interface WaitlistOfferClaimResponseDto {
  public_id: string
  start_at: string
  end_at: string
}

export interface CustomerActivityBookingDto {
  public_id: string
  master_name: string
  service_names: string[]
  start_at: string
  end_at: string
  status: 'confirmed'
}

export interface CustomerActivityWaitlistDto {
  public_id: string
  master_name?: string | null
  service_names: string[]
  desired_date: string
  preferred_time_from?: string | null
  preferred_time_to?: string | null
  status: 'active' | 'offered'
  expires_at?: string | null
  offered_start_at?: string | null
  offered_end_at?: string | null
  offer_expires_at?: string | null
}

export interface CustomerActivityResponseDto {
  bookings: CustomerActivityBookingDto[]
  waitlist: CustomerActivityWaitlistDto[]
}

export interface MasterRatingSummaryDto {
  master_id: number
  average_rating: number | null
  approved_review_count: number
}

type RawMasterRatingSummaryDto = MasterRatingSummaryDto & {
  pending_review_count?: number
  rating_distribution?: Record<number, number>
}

export interface PublicMasterReviewDto {
  id: number
  rating: number
  comment: string | null
  author_name: string
  published_at: string
}

export interface PublicMasterReviewsResponseDto {
  items: PublicMasterReviewDto[]
  total: number
  page: number
  page_size: number
}

export interface PublicReviewRequestDto {
  state: 'available' | 'submitted'
  master_id: number
  master_name: string
  master_photo_url: string | null
  visit_date: string
  service_names: string[]
  expires_at: string
}

export interface SubmitPublicReviewPayload {
  token: string
  rating: number
  comment?: string | null
}

export interface SubmitPublicReviewResponseDto {
  status: 'pending'
  submitted_at: string
}

const publicPromotion = (promotion?: ServicePromotionDto | null) => promotion
  ? {
      id: promotion.id,
      code: promotion.code,
      name_uk: promotion.name_uk,
      name_en: promotion.name_en,
      discount_percent: promotion.discount_percent,
      discount_amount: promotion.discount_amount,
      promotional_price: promotion.promotional_price,
    }
  : null

const publicMasterService = (service: PublicServiceDto): PublicServiceDto => ({
  id: service.id,
  barber_id: service.barber_id,
  base_service_id: service.base_service_id,
  source_type: service.source_type,
  created_at: service.created_at,
  updated_at: service.updated_at,
  name: service.name,
  title_uk: service.title_uk,
  title_en: service.title_en,
  slug: service.slug,
  description: service.description,
  description_uk: service.description_uk,
  description_en: service.description_en,
  price: service.price,
  duration_minutes: service.duration_minutes,
  status: service.status,
  is_active: service.is_active,
  active_promotion: publicPromotion(service.active_promotion),
})

const publicAssetUrl = (value: PublicMasterDto['photo'] | PublicMasterDto['avatar']) =>
  typeof value === 'string' ? value : value?.file_url || null

const publicMaster = (master: PublicMasterDto): PublicMasterDto => ({
  id: master.id,
  created_at: master.created_at,
  updated_at: master.updated_at,
  name: master.name,
  full_name: master.full_name,
  last_name: master.last_name,
  first_name_uk: master.first_name_uk,
  last_name_uk: master.last_name_uk,
  first_name_en: master.first_name_en,
  last_name_en: master.last_name_en,
  full_name_uk: master.full_name_uk,
  full_name_en: master.full_name_en,
  position: master.position,
  position_uk: master.position_uk,
  position_en: master.position_en,
  title_uk: master.title_uk,
  title_en: master.title_en,
  slug: master.slug,
  title: master.title,
  description: master.description,
  description_uk: master.description_uk,
  description_en: master.description_en,
  bio: master.bio,
  bio_uk: master.bio_uk,
  bio_en: master.bio_en,
  photo_url: master.photo_url || publicAssetUrl(master.photo),
  avatar_url: master.avatar_url || publicAssetUrl(master.avatar),
  status: master.status,
  is_active: master.is_active,
  showOnMasterBlock: master.showOnMasterBlock,
  show_on_master_block: master.show_on_master_block,
  services: master.services?.map(publicMasterService),
})

export const useBarbershopDomain = () => {
  const api = useApi()

  const getServices = () => api<PublicServiceDto[]>('/public/services')
  const getServiceCatalog = () => api<PublicServiceCatalogItemDto[]>('/public/service-catalog')
  const getMasters = async () =>
    (await api<PublicMasterDto[]>('/public/masters')).map(publicMaster)
  const getMasterRatingSummary = async (masterId: number): Promise<MasterRatingSummaryDto> => {
    const summary = await api<RawMasterRatingSummaryDto>(`/public/reviews/masters/${masterId}/summary`)

    return {
      master_id: summary.master_id,
      average_rating: summary.average_rating,
      approved_review_count: summary.approved_review_count,
    }
  }
  const getMasterReviews = async (masterId: number, limit = 2) => {
    const response = await api<PublicMasterReviewsResponseDto>(`/public/reviews/masters/${masterId}`, {
      query: { page: 1, page_size: limit },
    })

    return {
      items: response.items.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        author_name: review.author_name,
        published_at: review.published_at,
      })),
      total: response.total,
      page: response.page,
      page_size: response.page_size,
    }
  }
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
  const getBookingAlternatives = (payload: BookingAlternativesPayload) =>
    api<BookingAlternativesResponseDto>('/public/booking-alternatives', { method: 'POST', body: payload })
  const createWaitlistRequest = (payload: PublicWaitlistPayload) =>
    api<PublicWaitlistResponseDto>('/public/waitlist', { method: 'POST', body: payload })
  const recordBookingRecoveryEvent = (payload: BookingRecoveryEventPayload) =>
    api<BookingFunnelEventReceipt>('/public/booking-recovery/events', {
      method: 'POST',
      body: payload,
      keepalive: true,
      retry: 2,
      retryDelay: 200,
    })
  const claimWaitlistOffer = (token: string) =>
    api<WaitlistOfferClaimResponseDto>('/public/waitlist/offers/claim', {
      method: 'POST',
      body: { token },
    })
  // Keep the opaque capability transport in one place. Its caller retains it
  // only in memory after reading a private SMS fragment.
  const customerActivityHeaders = (token: string) => ({
    'X-Customer-Activity-Token': token,
  })
  const resolveCustomerActivity = (token: string) =>
    api<CustomerActivityResponseDto>('/public/customer-activity', {
      headers: customerActivityHeaders(token),
    })
  const cancelCustomerActivityBooking = (publicId: string, token: string) =>
    api<void>(`/public/customer-activity/bookings/${encodeURIComponent(publicId)}/cancel`, {
      method: 'POST',
      headers: customerActivityHeaders(token),
    })
  const cancelCustomerActivityWaitlist = (publicId: string, token: string) =>
    api<void>(`/public/customer-activity/waitlist/${encodeURIComponent(publicId)}/cancel`, {
      method: 'POST',
      headers: customerActivityHeaders(token),
    })
  const recordBookingFunnelEvent = (payload: BookingFunnelEventPayload) =>
    api<BookingFunnelEventReceipt>('/public/booking-funnel/events', {
      method: 'POST',
      body: payload,
      keepalive: true,
      retry: 2,
      retryDelay: 200,
    })
  const resolveReviewRequest = (token: string) =>
    api<PublicReviewRequestDto>('/public/reviews/request', {
      headers: { 'X-Review-Token': token },
    })
  const recordReviewFormOpen = (token: string) =>
    api<void>('/public/reviews/request/open', {
      method: 'POST',
      headers: { 'X-Review-Token': token },
      keepalive: true,
      retry: 2,
      retryDelay: 200,
    })
  const submitReviewRequest = (payload: SubmitPublicReviewPayload) =>
    api<SubmitPublicReviewResponseDto>('/public/reviews/request', {
      method: 'POST',
      headers: { 'X-Review-Token': payload.token },
      body: {
        rating: payload.rating,
        comment: payload.comment,
      },
    })

  return {
    getServices,
    getServiceCatalog,
    getMasters,
    getMasterRatingSummary,
    getMasterReviews,
    getPages,
    getReviews,
    getBrands,
    getAvailableSlots,
    createBooking,
    getBookingAlternatives,
    createWaitlistRequest,
    recordBookingRecoveryEvent,
    claimWaitlistOffer,
    resolveCustomerActivity,
    cancelCustomerActivityBooking,
    cancelCustomerActivityWaitlist,
    recordBookingFunnelEvent,
    resolveReviewRequest,
    recordReviewFormOpen,
    submitReviewRequest,
  }
}
