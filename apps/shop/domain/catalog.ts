import type { BrandDto, CategoryDto, OrderDto, ProductDto } from '@shared-types'

export const useCatalogDomain = () => {
  const api = useApi()

  const getProducts = (query: Record<string, string | number | undefined> = {}) =>
    api<ProductDto[]>('/public/products', { query })

  const getProduct = (slug: string) => api<ProductDto>(`/public/products/${slug}`)
  const getCategories = () => api<CategoryDto[]>('/public/categories')
  const getBrands = () => api<BrandDto[]>('/public/brands')
  const createOrder = (body: Record<string, unknown>) => api<OrderDto>('/public/orders', { method: 'POST', body })

  return { getProducts, getProduct, getCategories, getBrands, createOrder }
}
