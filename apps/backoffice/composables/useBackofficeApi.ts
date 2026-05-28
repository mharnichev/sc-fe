export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface AdminUser {
  id: number
  email: string
  full_name?: string | null
  role?: string | null
  master_id?: number | null
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
}

export interface UploadAsset {
  id: number
  file_name: string
  file_path: string
  file_url: string | null
  content_type: string | null
  size: number | null
  created_at: string
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  is_active: boolean
  parent_id: number | null
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[]
}

export interface Brand {
  id: number
  name: string
  slug: string
  description: string | null
}

export interface Product {
  id: number
  created_at: string
  updated_at: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  price: string
  recommended_retail_price: string | null
  sku: string | null
  stock_quantity: number
  is_active: boolean
  image_url: string | null
  external_url: string | null
  availability_status: string | null
  attributes_json: Record<string, unknown> | null
  brand_id: number | null
  category_id: number | null
  brand?: Brand | null
  category?: Category | null
}

export interface ProductPayload {
  name: string
  slug: string
  description: string | null
  short_description: string | null
  price: number
  recommended_retail_price: number | null
  sku: string | null
  stock_quantity: number
  is_active: boolean
  image_url: string | null
  external_url: string | null
  availability_status: string | null
  attributes_json: Record<string, unknown> | null
  brand_id: number | null
  category_id: number | null
}

export interface OrderSummary {
  id: number
  status: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  total_amount: string
  created_at: string
  updated_at: string
}

export interface CustomerSummary {
  id: number
  phone: string
  email: string | null
  name: string | null
  surname: string | null
  notes: string | null
  imported_total_spent: string | number
  imported_last_visit_at: string | null
  imported_is_new_client: boolean
  is_verified: boolean
}

export interface Customer {
  id: number
  created_at: string
  updated_at: string
  phone: string
  email: string | null
  name: string | null
  surname: string | null
  birthday: string | null
  notes: string | null
  imported_total_spent: string | number
  imported_last_visit_at: string | null
  imported_is_new_client: boolean
  is_active: boolean
  phone_verified_at: string | null
  last_login_at: string | null
}

export interface CustomerBookingStatsItem {
  id: number | null
  name: string
  count: number
}

export interface CustomerBookingStats {
  total_bookings: number
  most_visited_barber: CustomerBookingStatsItem | null
  most_used_services: CustomerBookingStatsItem[]
  last_visit_date: string | null
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface Master {
  id: number
  admin_user_id?: number | null
  full_name?: string | null
  name?: string | null
  phone?: string | null
  email?: string | null
  description?: string | null
  photo_url?: string | null
  photo_upload_id?: number | null
  photo?: string | UploadAsset | null
  avatar_url?: string | null
  avatar_upload_id?: number | null
  avatar?: string | UploadAsset | null
  is_active?: boolean
  status?: string | null
  service_ids?: number[]
  services?: Service[]
}

export interface Service {
  id: number
  barber_id?: number | string
  base_service_id?: number | string | null
  source_type?: 'base' | 'custom'
  name: string
  title_uk?: string | null
  title_en?: string | null
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  duration_minutes: number
  price: string | number
  is_active?: boolean
  status?: string | null
  base_service?: BaseServiceSummary | null
}

export interface BaseServiceSummary {
  id: number | string
  name: string
  title_uk?: string | null
  title_en?: string | null
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  duration_minutes: number
  price: string | number
  is_active: boolean
}

export interface BaseService {
  id: number | string
  name: string
  title_uk?: string | null
  title_en?: string | null
  duration_minutes: number
  price: string | number
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface MasterService {
  id: number | string
  barber_id: number | string
  base_service_id?: number | string | null
  source_type: 'base' | 'custom'
  name: string
  title_uk?: string | null
  title_en?: string | null
  duration_minutes: number
  price: string | number
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  is_active: boolean
  base_service?: BaseServiceSummary | null
  created_at?: string
  updated_at?: string
}

export interface Booking {
  id: number
  master_id?: number
  service_id?: number
  service_ids?: number[]
  customer_id?: number | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  customer_comment?: string | null
  comment?: string | null
  note?: string | null
  start_at?: string
  end_at?: string
  scheduled_at?: string
  status: BookingStatus | string
  created_at?: string
  updated_at?: string
  cancelled_at?: string | null
  completed_at?: string | null
  master?: Master | null
  barber?: Master | null
  service?: Service | null
  services?: Service[]
  customer?: {
    id?: number
    name?: string | null
    first_name?: string | null
    surname?: string | null
    last_name?: string | null
    phone?: string | null
    email?: string | null
  } | null
}

export interface AvailableSlot {
  start_at: string
  end_at: string
}

export interface PublicBookingPayload {
  master_id: number
  service_id: number
  service_ids?: number[]
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  customer_comment?: string | null
  start_at: string
}

export interface ManualBookingPayload extends PublicBookingPayload {
  end_at: string
  note?: string | null
  status?: BookingStatus
}

export interface BookingSchedulePayload {
  start_at?: string
  end_at?: string
  service_ids?: number[]
}

export interface TimeBlock {
  id: number
  master_id: number
  start_at: string
  end_at: string
  reason?: string | null
  created_at?: string
  master?: Master | null
}

export interface TimeBlockPayload {
  start_at: string
  end_at: string
  reason?: string | null
  master_id?: number
}

export interface ServicePayload {
  name: string
  title_uk: string
  title_en: string
  description: string | null
  description_uk: string | null
  description_en: string | null
  duration_minutes: number
  price: number
  is_active: boolean
}

export type BaseServicePayload = ServicePayload
export interface MasterServicePayload {
  base_service_id?: number | null
  name?: string
  title_uk?: string
  title_en?: string
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  duration_minutes?: number
  price?: number
  is_active?: boolean
}

export interface SyncDefaultServicesResponse {
  barber_id: number
  created_count: number
}

export interface StatisticsBarberSummary {
  id: number
  full_name: string
}

export interface StatisticsServiceItem {
  service_id: number
  service_name: string
  count: number
  revenue: string | number
}

export interface StatisticsCategoryItem {
  category: string
  count: number
  revenue: string | number
}

export interface StatisticsWorkloadDayItem {
  date: string
  completed_appointments: number
  revenue: string | number
}

export interface StatisticsWorkloadWeekItem {
  week: number
  completed_appointments: number
  revenue: string | number
}

export interface StatisticsClientBreakdown {
  new_clients: number
  returning_clients: number
}

export interface BarberMonthlyStatisticsResponse {
  year: number
  month: number
  barber: StatisticsBarberSummary | null
  total_income: string | number
  completed_appointments: number
  unique_clients: number
  total_services_performed: number
  most_popular_services: StatisticsServiceItem[]
  revenue_by_service: StatisticsServiceItem[]
  average_check_per_appointment: string | number
  average_revenue_per_client: string | number
  clients: StatisticsClientBreakdown
  cancelled_appointments: number
  no_show_appointments: number
  workload_by_day: StatisticsWorkloadDayItem[]
  workload_by_week: StatisticsWorkloadWeekItem[]
  best_revenue_day: StatisticsWorkloadDayItem | null
  service_category_breakdown: StatisticsCategoryItem[]
  tips: string | number
  bonuses: string | number
}

export interface BarberComparisonItem {
  barber: StatisticsBarberSummary
  revenue: string | number
  unique_clients: number
  completed_appointments: number
  average_check: string | number
  popular_services: StatisticsServiceItem[]
}

export interface AdminMonthlyStatisticsResponse {
  year: number
  month: number
  barber_id: number | null
  total_barbershop_monthly_revenue: string | number
  total_clients: number
  total_completed_appointments: number
  total_cancelled_appointments: number
  aggregate: BarberMonthlyStatisticsResponse
  top_barbers: BarberComparisonItem[]
  most_popular_services: StatisticsServiceItem[]
}

export interface BarbersComparisonResponse {
  year: number
  month: number
  barbers: BarberComparisonItem[]
  top_performing_barbers: BarberComparisonItem[]
}

export interface MasterPayload {
  full_name: string
  phone: string | null
  email: string | null
  password?: string | null
  description: string | null
  photo_url: string | null
  photo_upload_id?: number | null
  avatar_url?: string | null
  avatar_upload_id?: number | null
  is_active: boolean
  service_ids?: number[]
  admin_user_id?: number | null
}

export type MasterFormPayload = Partial<MasterPayload> & {
  photo?: File | null
  avatar?: File | null
}

export interface BookingFilters {
  date_from?: string
  date_to?: string
  master_id?: number | null
  service_id?: number | null
  status?: BookingStatus | '' | null
}

export const useBackofficeApi = () => {
  const api = useApi()
  const config = useRuntimeConfig()
  const normalizePageSize = (pageSize: number) => Math.min(Math.max(pageSize, 1), 100)

  const login = (email: string, password: string) =>
    $fetch<TokenResponse>('/backoffice/auth/login', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: new URLSearchParams({
        username: email,
        password,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

  const me = () => api<AdminUser>('/backoffice/auth/me')

  const getProducts = (
    page = 1,
    pageSize = 10,
    filters: {
      search?: string
      category_id?: number | null
      brand_id?: number | null
      is_active?: boolean | null
      availability_status?: string | null
    } = {},
  ) =>
    api<PaginatedResponse<Product>>('/backoffice/products', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        category_id: filters.category_id ?? undefined,
        brand_id: filters.brand_id ?? undefined,
        is_active: filters.is_active ?? undefined,
        availability_status: filters.availability_status || undefined,
      },
    })

  const getProduct = (productId: number | string) =>
    api<Product>(`/backoffice/products/${productId}`)

  const createProduct = (payload: ProductPayload) =>
    api<Product>('/backoffice/products', {
      method: 'POST',
      body: payload,
    })

  const updateProduct = (productId: number | string, payload: Partial<ProductPayload>) =>
    api<Product>(`/backoffice/products/${productId}`, {
      method: 'PUT',
      body: payload,
    })

  const deleteProduct = (productId: number | string) =>
    api(`/backoffice/products/${productId}`, {
      method: 'DELETE',
    })

  const getCategories = (
    page = 1,
    pageSize = 10,
    filters: {
      search?: string
      parent_id?: number | null
      is_active?: boolean | null
    } = {},
  ) =>
    api<PaginatedResponse<Category>>('/backoffice/categories', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        parent_id: filters.parent_id ?? undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const getCategoryTree = () => api<CategoryTreeNode[]>('/backoffice/categories/tree')

  const getBrands = (page = 1, pageSize = 10) =>
    api<PaginatedResponse<Brand>>('/backoffice/brands', {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getOrders = (page = 1, pageSize = 10) =>
    api<PaginatedResponse<OrderSummary>>('/backoffice/orders', {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getCustomers = (
    page = 1,
    pageSize = 10,
    filters: {
      search?: string
      is_active?: string | null
      is_verified?: string | null
      sort_by?: string
      sort_order?: string
    } = {},
  ) =>
    api<PaginatedResponse<CustomerSummary>>('/backoffice/customers', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active || undefined,
        is_verified: filters.is_verified || undefined,
        sort_by: filters.sort_by || 'created_at',
        sort_order: filters.sort_order || 'desc',
      },
    })

  const getCustomer = (customerId: number | string) =>
    api<Customer>(`/backoffice/customers/${customerId}`)

  const getCustomerOrders = (customerId: number | string, page = 1, pageSize = 10) =>
    api<PaginatedResponse<OrderSummary>>(`/backoffice/customers/${customerId}/orders`, {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getCustomerBookings = (customerId: number | string, page = 1, pageSize = 10) =>
    api<PaginatedResponse<Booking>>(`/backoffice/customers/${customerId}/bookings`, {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getCustomerStats = (customerId: number | string) =>
    api<CustomerBookingStats>(`/backoffice/customers/${customerId}/stats`)

  const getPublicMasters = () => api<Master[]>('/public/masters')

  const getServices = () => api<Service[]>('/public/services')

  const getAvailableSlots = (masterId: number | string, date: string, serviceId: number | string | Array<number | string>) => {
    const serviceIds = Array.isArray(serviceId) ? serviceId : [serviceId]
    return api<AvailableSlot[]>(`/public/masters/${masterId}/available-slots`, {
      query: {
        date,
        service_id: serviceIds[0],
        service_ids: serviceIds,
      },
    })
  }

  const createPublicBooking = (payload: PublicBookingPayload) =>
    api<Booking>('/public/bookings', {
      method: 'POST',
      body: payload,
    })

  const createMyManualBooking = (payload: ManualBookingPayload) =>
    api<Booking>('/backoffice/masters/me/bookings', {
      method: 'POST',
      body: payload,
    })

  const getMyCalendar = (filters: BookingFilters = {}) =>
    api<Booking[] | PaginatedResponse<Booking>>('/backoffice/masters/me/calendar', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      },
    })

  const getMyBookings = (filters: BookingFilters = {}) =>
    api<Booking[] | PaginatedResponse<Booking>>('/backoffice/masters/me/bookings', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        status: filters.status || undefined,
      },
    })

  const updateMyBookingStatus = (bookingId: number | string, status: BookingStatus) =>
    api<Booking>(`/backoffice/masters/me/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: { status },
    })

  const updateMyBookingSchedule = (bookingId: number | string, payload: BookingSchedulePayload) =>
    api<Booking>(`/backoffice/masters/me/bookings/${bookingId}`, {
      method: 'PATCH',
      body: payload,
    })

  const getMyServices = () =>
    api<MasterService[]>('/backoffice/masters/me/services')

  const updateMyService = (serviceId: number | string, payload: Partial<MasterServicePayload>) =>
    api<MasterService>(`/backoffice/masters/me/services/${serviceId}`, {
      method: 'PATCH',
      body: payload,
    })

  const getMyTimeBlocks = (filters: { date_from?: string, date_to?: string } = {}) =>
    api<TimeBlock[] | PaginatedResponse<TimeBlock>>('/backoffice/masters/me/time-blocks', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      },
    })

  const createMyTimeBlock = (payload: TimeBlockPayload) =>
    api<TimeBlock>('/backoffice/masters/me/time-blocks', {
      method: 'POST',
      body: payload,
    })

  const deleteMyTimeBlock = (blockId: number | string) =>
    api(`/backoffice/masters/me/time-blocks/${blockId}`, {
      method: 'DELETE',
    })

  const getMyMonthlyStatistics = (year: number, month: number) =>
    api<BarberMonthlyStatisticsResponse>('/backoffice/statistics/me/monthly', {
      query: { year, month },
    })

  const getBarberMonthlyStatistics = (barberId: number | string, year: number, month: number) =>
    api<BarberMonthlyStatisticsResponse>(`/backoffice/statistics/barbers/${barberId}/monthly`, {
      query: { year, month },
    })

  const adminGetMonthlyStatistics = (year: number, month: number, barberId?: number | string | null) =>
    api<AdminMonthlyStatisticsResponse>('/backoffice/statistics/admin/monthly', {
      query: {
        year,
        month,
        barber_id: barberId ?? undefined,
      },
    })

  const adminGetBarbersComparison = (year: number, month: number) =>
    api<BarbersComparisonResponse>('/backoffice/statistics/admin/barbers-comparison', {
      query: { year, month },
    })

  const adminGetMasters = (page = 1, pageSize = 100, filters: { search?: string, is_active?: boolean | null } = {}) =>
    api<Master[] | PaginatedResponse<Master>>('/backoffice/masters', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const masterPayloadBody = (payload: MasterFormPayload) => {
    const { photo: _photo, avatar: _avatar, ...body } = payload
    return body
  }

  const uploadMasterImage = (masterId: number | string, kind: 'photo' | 'avatar', file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api<Master>(`/backoffice/masters/${masterId}/${kind}`, {
      method: 'POST',
      body: formData,
    })
  }

  const applyMasterImageUploads = async (master: Master, payload: MasterFormPayload) => {
    let result = master
    if (payload.photo) {
      result = await uploadMasterImage(result.id, 'photo', payload.photo)
    }
    if (payload.avatar) {
      result = await uploadMasterImage(result.id, 'avatar', payload.avatar)
    }
    return result
  }

  const adminCreateMaster = async (payload: MasterFormPayload) => {
    const master = await api<Master>('/backoffice/masters', {
      method: 'POST',
      body: masterPayloadBody(payload),
    })
    return applyMasterImageUploads(master, payload)
  }

  const adminUpdateMaster = async (masterId: number | string, payload: MasterFormPayload) => {
    const master = await api<Master>(`/backoffice/masters/${masterId}`, {
      method: 'PUT',
      body: masterPayloadBody(payload),
    })
    return applyMasterImageUploads(master, payload)
  }

  const adminGetServices = (page = 1, pageSize = 100, filters: { search?: string, is_active?: boolean | null } = {}) =>
    api<Service[] | PaginatedResponse<Service>>('/backoffice/booking-services', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const adminCreateService = (payload: ServicePayload) =>
    api<Service>('/backoffice/booking-services', {
      method: 'POST',
      body: payload,
    })

  const adminUpdateService = (serviceId: number | string, payload: Partial<ServicePayload>) =>
    api<Service>(`/backoffice/booking-services/${serviceId}`, {
      method: 'PUT',
      body: payload,
    })

  const adminGetBaseServices = (page = 1, pageSize = 100, filters: { search?: string, is_active?: boolean | null } = {}) =>
    api<BaseService[] | PaginatedResponse<BaseService>>('/backoffice/admin/services', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const adminCreateBaseService = (payload: BaseServicePayload) =>
    api<BaseService>('/backoffice/admin/services', {
      method: 'POST',
      body: payload,
    })

  const adminUpdateBaseService = (serviceId: number | string, payload: Partial<BaseServicePayload>) =>
    api<BaseService>(`/backoffice/admin/services/${serviceId}`, {
      method: 'PATCH',
      body: payload,
    })

  const adminDeleteBaseService = (serviceId: number | string) =>
    api(`/backoffice/admin/services/${serviceId}`, {
      method: 'DELETE',
    })

  const getMasterServices = (barberId: number | string) =>
    api<MasterService[] | PaginatedResponse<MasterService>>(`/backoffice/barbers/${barberId}/services`)

  const createMasterService = (barberId: number | string, payload: MasterServicePayload) =>
    api<MasterService>(`/backoffice/barbers/${barberId}/services`, {
      method: 'POST',
      body: payload,
    })

  const updateMasterService = (barberId: number | string, serviceId: number | string, payload: Partial<MasterServicePayload>) =>
    api<MasterService>(`/backoffice/barbers/${barberId}/services/${serviceId}`, {
      method: 'PATCH',
      body: payload,
    })

  const deleteMasterService = (barberId: number | string, serviceId: number | string) =>
    api(`/backoffice/barbers/${barberId}/services/${serviceId}`, {
      method: 'DELETE',
    })

  const syncDefaultMasterServices = (barberId: number | string) =>
    api<SyncDefaultServicesResponse>(`/backoffice/admin/barbers/${barberId}/services/sync-defaults`, {
      method: 'POST',
    })

  const adminGetBookings = (page = 1, pageSize = 100, filters: BookingFilters = {}) =>
    api<Booking[] | PaginatedResponse<Booking>>('/backoffice/bookings', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        master_id: filters.master_id ?? undefined,
        service_id: filters.service_id ?? undefined,
        status: filters.status || undefined,
      },
    })

  const adminCreateBooking = (payload: ManualBookingPayload) =>
    api<Booking>('/backoffice/bookings', {
      method: 'POST',
      body: payload,
    })

  const adminUpdateBookingStatus = (bookingId: number | string, status: BookingStatus) =>
    api<Booking>(`/backoffice/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: { status },
    })

  const adminUpdateBookingSchedule = (bookingId: number | string, payload: BookingSchedulePayload) =>
    api<Booking>(`/backoffice/bookings/${bookingId}`, {
      method: 'PATCH',
      body: payload,
    })

  const adminGetTimeBlocks = (page = 1, pageSize = 100, filters: { date_from?: string, date_to?: string, master_id?: number | null } = {}) =>
    api<TimeBlock[] | PaginatedResponse<TimeBlock>>('/backoffice/time-blocks', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        master_id: filters.master_id ?? undefined,
      },
    })

  const adminCreateTimeBlock = (payload: TimeBlockPayload) =>
    api<TimeBlock>('/backoffice/time-blocks', {
      method: 'POST',
      body: payload,
    })

  const adminDeleteTimeBlock = (blockId: number | string) =>
    api(`/backoffice/time-blocks/${blockId}`, {
      method: 'DELETE',
    })

  return {
    login,
    me,
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getCategories,
    getCategoryTree,
    getBrands,
    getOrders,
    getCustomers,
    getCustomer,
    getCustomerOrders,
    getCustomerBookings,
    getCustomerStats,
    getPublicMasters,
    getServices,
    getAvailableSlots,
    createPublicBooking,
    createMyManualBooking,
    getMyCalendar,
    getMyBookings,
    updateMyBookingStatus,
    updateMyBookingSchedule,
    getMyServices,
    updateMyService,
    getMyTimeBlocks,
    createMyTimeBlock,
    deleteMyTimeBlock,
    getMyMonthlyStatistics,
    getBarberMonthlyStatistics,
    adminGetMonthlyStatistics,
    adminGetBarbersComparison,
    adminGetMasters,
    adminCreateMaster,
    adminUpdateMaster,
    adminGetServices,
    adminCreateService,
    adminUpdateService,
    adminGetBaseServices,
    adminCreateBaseService,
    adminUpdateBaseService,
    adminDeleteBaseService,
    getMasterServices,
    createMasterService,
    updateMasterService,
    deleteMasterService,
    syncDefaultMasterServices,
    adminGetBookings,
    adminCreateBooking,
    adminUpdateBookingStatus,
    adminUpdateBookingSchedule,
    adminGetTimeBlocks,
    adminCreateTimeBlock,
    adminDeleteTimeBlock,
  }
}
