export type EntityStatus = 'active' | 'inactive' | 'draft' | 'pending' | 'confirmed' | 'paid' | 'new'

export interface CategoryDto {
  id: number
  name: string
  slug: string
  description: string | null
  status: string
}

export interface BrandDto {
  id: number
  name: string
  slug: string
  description: string | null
  website?: string | null
  status: string
}

export interface ProductImageDto {
  id?: number
  image: string
  alt: string | null
  sort_order: number
}

export interface ProductDto {
  id: number
  category_id: number
  brand_id: number
  name: string
  slug: string
  sku: string
  short_description: string | null
  description: string
  price: string
  compare_at_price: string | null
  stock: number
  status: string
  seo_title: string | null
  seo_description: string | null
  meta_keywords: string | null
  category: CategoryDto
  brand: BrandDto
  images: ProductImageDto[]
}

export interface UploadAssetDto {
  id: number
  file_name: string
  file_path: string
  file_url: string | null
  content_type: string | null
  size: number | null
  created_at: string
}

export interface ServiceDto {
  id: number
  name: string
  title_uk?: string | null
  title_en?: string | null
  slug?: string
  description: string | null
  description_uk?: string | null
  description_en?: string | null
  price: string
  duration_minutes: number
  status?: string
  is_active?: boolean
  is_army_client?: boolean
}

export interface ServiceCatalogBarberServiceDto {
  id: number
  barber_id: number
  name: string
  title_uk?: string | null
  title_en?: string | null
  description: string | null
  description_uk?: string | null
  description_en?: string | null
  price: string | number
  duration_minutes: number
  is_active?: boolean
  is_army_client?: boolean
}

export interface ServiceCatalogItemDto {
  catalog_id: string
  base_service_id: number | null
  source_type: 'base' | 'custom'
  name: string
  title_uk?: string | null
  title_en?: string | null
  description: string | null
  description_uk?: string | null
  description_en?: string | null
  price: string | number
  duration_minutes: number
  is_army_client?: boolean
  barber_ids: number[]
  barber_service_ids: number[]
  barber_services: ServiceCatalogBarberServiceDto[]
}

export interface MasterDto {
  id: number
  name?: string
  full_name?: string
  last_name?: string | null
  first_name_uk?: string | null
  last_name_uk?: string | null
  first_name_en?: string | null
  last_name_en?: string | null
  full_name_uk?: string | null
  full_name_en?: string | null
  position?: 'ambassador' | 'senior_master' | 'master' | null
  position_uk?: string | null
  position_en?: string | null
  title_uk?: string | null
  title_en?: string | null
  slug?: string
  title?: string
  description: string | null
  description_uk?: string | null
  description_en?: string | null
  bio?: string | null
  bio_uk?: string | null
  bio_en?: string | null
  photo?: string | UploadAssetDto | null
  photo_url?: string | null
  avatar?: string | UploadAssetDto | null
  avatar_url?: string | null
  status?: string
  is_active?: boolean
  showOnMasterBlock?: boolean
  show_on_master_block?: boolean
  services?: ServiceDto[]
}

export interface CustomerDto {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  notes: string | null
}

export interface BookingDto {
  id: number
  status: string
  scheduled_at?: string
  start_at?: string
  end_at?: string
  note?: string | null
  customer_name?: string
  customer_phone?: string
  customer_comment?: string | null
  customer?: CustomerDto
  master?: MasterDto
  service?: ServiceDto
  master_id?: number
  service_id?: number
}

export interface AvailableSlotDto {
  start_at: string
  end_at: string
}

export interface OrderItemDto {
  id: number
  product_id: number
  product_name: string
  quantity: number
  unit_price: string
}

export interface OrderDto {
  id: number
  status: string
  total_amount: string
  currency: string
  shipping_address: string
  comment: string | null
  customer: CustomerDto
  items: OrderItemDto[]
}

export interface PageDto {
  id: number
  name: string
  title: string
  slug: string
  description: string | null
  content: string
  seo_title: string | null
  seo_description: string | null
  status: string
}

export interface GoogleBusinessReviewerDto {
  display_name: string | null
  profile_photo_url: string | null
  is_anonymous: boolean
}

export interface GoogleBusinessReviewReplyDto {
  comment: string | null
  update_time: string | null
}

export interface GoogleBusinessReviewDto {
  review_id: string
  name?: string
  reviewer: GoogleBusinessReviewerDto | null
  star_rating: number | null
  comment: string | null
  translations?: {
    uk?: string | null
    ua?: string | null
    en?: string | null
  } | null
  original_comment?: string | null
  original_text?: string | null
  source_comment?: string | null
  raw_comment?: string | null
  create_time: string | null
  update_time: string | null
  review_reply?: GoogleBusinessReviewReplyDto | null
}

export interface GoogleBusinessReviewsResponseDto {
  average_rating: number | null
  total_review_count: number
  fetched_at: string | null
  cache_expires_at: string | null
  stale: boolean
  items: GoogleBusinessReviewDto[]
}

export interface BannerDto {
  id: number
  name: string
  title: string
  slug: string
  description: string | null
  image: string
  link: string | null
  placement: string
  status: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface CurrentUser {
  id: number
  email: string
  full_name: string
  role: string
}
