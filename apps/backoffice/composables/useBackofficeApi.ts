interface TokenResponse {
  access_token: string
  token_type: string
}

interface AdminUser {
  id: number
  email: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
}

interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  is_active: boolean
}

interface Brand {
  id: number
  name: string
  slug: string
  description: string | null
}

interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  short_description: string | null
  price: string
  old_price: string | null
  sku: string | null
  stock_quantity: number
  is_active: boolean
  brand_id: number | null
  category_id: number | null
  brand?: Brand | null
  category?: Category | null
}

interface OrderSummary {
  id: number
  status: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  total_amount: string
  created_at: string
  updated_at: string
}

export const useBackofficeApi = () => {
  const api = useApi()
  const config = useRuntimeConfig()

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

  const getProducts = (page = 1, pageSize = 10) =>
    api<PaginatedResponse<Product>>('/backoffice/products', {
      query: { page, page_size: pageSize },
    })

  const getCategories = (page = 1, pageSize = 10) =>
    api<PaginatedResponse<Category>>('/backoffice/categories', {
      query: { page, page_size: pageSize },
    })

  const getBrands = (page = 1, pageSize = 10) =>
    api<PaginatedResponse<Brand>>('/backoffice/brands', {
      query: { page, page_size: pageSize },
    })

  const getOrders = (page = 1, pageSize = 10) =>
    api<PaginatedResponse<OrderSummary>>('/backoffice/orders', {
      query: { page, page_size: pageSize },
    })

  return {
    login,
    me,
    getProducts,
    getCategories,
    getBrands,
    getOrders,
  }
}
