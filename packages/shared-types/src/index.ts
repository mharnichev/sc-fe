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

export interface ServiceDto {
  id: number
  name: string
  slug: string
  description: string | null
  price: string
  duration_minutes: number
  status: string
}

export interface MasterDto {
  id: number
  name: string
  slug: string
  title: string
  description: string | null
  bio: string | null
  photo: string | null
  status: string
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
  scheduled_at: string
  note: string | null
  customer: CustomerDto
  master: MasterDto
  service: ServiceDto
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
