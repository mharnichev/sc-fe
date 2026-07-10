import type {
  BrandDto,
  CategoryDto,
  CategoryFiltersDto,
  CategoryTreeNodeDto,
  CustomerCartItemDto,
  CustomerWishlistItemDto,
  DeliveryListResponseDto,
  OrderDto,
  PaginatedResponse,
  ProductDto,
  ProductImageDto,
  ProductReviewDto,
  ProductReviewListDto,
  ProductSearchResponseDto,
} from '@shared-types'

type CatalogQueryValue = string | number | boolean | null | undefined
type CatalogQuery = Record<string, CatalogQueryValue | CatalogQueryValue[]> & {
  limit?: CatalogQueryValue
  page_size?: CatalogQueryValue
}
type PublicProductImage = string | {
  id?: number
  image?: string | null
  image_url?: string | null
  alt?: string | null
  sort_order?: number | null
}
type PublicProductParameters =
  | Record<string, string | number | null | undefined>
  | Array<{ name?: string | null, value?: string | number | null }>
  | null
  | undefined

interface PublicCategoryDto {
  id: number
  name: string
  slug: string
  description: string | null
  parent_id?: number | null
  status?: string
  is_active?: boolean
  children?: PublicCategoryDto[]
}

interface PublicBrandDto {
  id: number
  name: string
  slug: string
  description: string | null
  logo_url?: string | null
  website?: string | null
  status?: string
  is_active?: boolean
}

interface PublicProductDto {
  id: number
  category_id: number | null
  brand_id: number | null
  name: string
  slug: string
  sku: string | null
  short_description: string | null
  description: string | null
  price: string | number
  compare_at_price?: string | number | null
  recommended_retail_price?: string | number | null
  discount_percent?: string | number | null
  is_new?: boolean | null
  is_top?: boolean | null
  is_popular?: boolean | null
  stock?: number
  stock_quantity?: number
  status?: string
  is_active?: boolean
  seo_title?: string | null
  seo_description?: string | null
  meta_keywords?: string | null
  category: PublicCategoryDto | null
  brand: PublicBrandDto | null
  images?: PublicProductImage[]
  image_url?: string | null
  attributes_json?: Record<string, unknown> | null
  parameters?: PublicProductParameters
  category_tree?: Array<{ id: number, name: string, slug: string }>
  average_rating?: string | number | null
  reviews_count?: number
}

type ShopProductDto = ProductDto & {
  attributes_json: Record<string, unknown> | null
  is_new?: boolean | null
  is_top?: boolean | null
  is_popular?: boolean | null
}

interface PublicSearchResponse {
  suggestions: string[]
  products: PublicProductDto[]
  categories: PublicCategoryDto[]
}

interface PublicCartItem {
  id: number
  product_id: number
  quantity: number
  product: PublicProductDto
  created_at: string
  updated_at: string
}

interface PublicWishlistItem {
  id: number
  product_id: number
  product: PublicProductDto
  created_at: string
  updated_at: string
}

interface PublicReview {
  id: number
  product_id: number
  customer_id: number
  customer_name: string | null
  rating: number
  comment: string | null
  comments_count: number
  created_at: string
  updated_at: string
}

interface PublicReviewList {
  total: number
  average_rating: string | number | null
  items: PublicReview[]
}

interface PublicProductViewResponse {
  recorded: boolean
  viewed_on: string
}

interface PublicCategoryFilters {
  price: {
    min: string | number | null
    max: string | number | null
  }
  filters: CategoryFiltersDto['filters']
}

const emptyCategory: CategoryDto = {
  id: 0,
  name: 'Uncategorized',
  slug: 'uncategorized',
  description: null,
  status: 'active',
}

const emptyBrand: BrandDto = {
  id: 0,
  name: 'Unknown brand',
  slug: 'unknown-brand',
  description: null,
  logo_url: null,
  website: null,
  status: 'active',
}

const resolveStatus = (status: string | undefined, isActive: boolean | undefined) =>
  status ?? (isActive === false ? 'inactive' : 'active')

const decimalString = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : String(value)

const cleanQuery = (query: CatalogQuery) =>
  Object.fromEntries(
    Object.entries(query).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        const filtered = value.filter((item): item is string | number | boolean => item !== undefined && item !== null && item !== '')
        return filtered.length ? [[key, filtered.join(',')]] : []
      }
      if (value === undefined || value === null || value === '') return []
      return [[key, value]]
    }),
  )

const buildListQuery = (query: CatalogQuery) => {
  const { limit, ...rest } = query

  return cleanQuery({
    ...rest,
    page_size: rest.page_size ?? limit,
  })
}

const mapCategory = (category?: PublicCategoryDto | null): CategoryDto => {
  if (!category) return emptyCategory

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    status: resolveStatus(category.status, category.is_active),
  }
}

const mapCategoryTreeNode = (category: PublicCategoryDto): CategoryTreeNodeDto => ({
  ...mapCategory(category),
  parent_id: category.parent_id ?? null,
  children: (category.children ?? []).map(mapCategoryTreeNode),
})

const mapFlatCategoriesToTree = (categories: PublicCategoryDto[]): CategoryTreeNodeDto[] => {
  const nodes = new Map<number, CategoryTreeNodeDto>()
  const roots: CategoryTreeNodeDto[] = []

  categories.forEach(category => {
    nodes.set(category.id, {
      ...mapCategory(category),
      parent_id: category.parent_id ?? null,
      children: [],
    })
  })

  categories.forEach(category => {
    const node = nodes.get(category.id)
    if (!node) return

    const parent = category.parent_id ? nodes.get(category.parent_id) : null
    if (parent) {
      parent.children.push(node)
      return
    }

    roots.push(node)
  })

  return roots
}

const mapBrand = (brand?: PublicBrandDto | null): BrandDto => {
  if (!brand) return emptyBrand

  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    description: brand.description,
    logo_url: brand.logo_url ?? null,
    website: brand.website ?? null,
    status: resolveStatus(brand.status, brand.is_active),
  }
}

const imageUrlFromPublicImage = (image: PublicProductImage) =>
  typeof image === 'string' ? image : image.image ?? image.image_url ?? ''

const mapProductImages = (product: PublicProductDto): ProductImageDto[] => {
  if (product.images?.length) {
    const mappedImages: ProductImageDto[] = []
    product.images.forEach((image, index) => {
      const url = imageUrlFromPublicImage(image)
      if (!url) return

      mappedImages.push({
        id: typeof image === 'string' ? undefined : image.id,
        image: url,
        image_url: typeof image === 'string' ? url : image.image_url ?? url,
        alt: typeof image === 'string' ? product.name : image.alt ?? product.name,
        sort_order: typeof image === 'string' ? index : image.sort_order ?? index,
      })
    })

    return mappedImages
  }

  const attributeImages = product.attributes_json?.image_urls
  const imageUrls = [
    product.image_url,
    ...(Array.isArray(attributeImages) ? attributeImages : []),
  ].filter((imageUrl): imageUrl is string => typeof imageUrl === 'string' && imageUrl.length > 0)

  return [...new Set(imageUrls)].map((image, index) => ({
    image,
    image_url: image,
    alt: index === 0 ? product.name : null,
    sort_order: index,
  }))
}

const mapProductParameters = (parameters: PublicProductParameters): Record<string, string> => {
  if (!parameters) return {}

  if (Array.isArray(parameters)) {
    return Object.fromEntries(
      parameters.flatMap(parameter => {
        const name = String(parameter.name ?? '').trim()
        const value = parameter.value
        if (!name || value === null || value === undefined || value === '') return []
        return [[name, String(value)]]
      }),
    )
  }

  return Object.fromEntries(
    Object.entries(parameters).flatMap(([name, value]) => {
      if (!name || value === null || value === undefined || value === '') return []
      return [[name, String(value)]]
    }),
  )
}

const mapProduct = (product: PublicProductDto): ShopProductDto => ({
  id: product.id,
  category_id: product.category_id ?? product.category?.id ?? 0,
  brand_id: product.brand_id ?? product.brand?.id ?? 0,
  name: product.name,
  slug: product.slug,
  sku: product.sku ?? '',
  short_description: product.short_description,
  description: product.description ?? '',
  price: String(product.price),
  compare_at_price: decimalString(product.compare_at_price ?? product.recommended_retail_price),
  stock: product.stock ?? product.stock_quantity ?? 0,
  status: resolveStatus(product.status, product.is_active),
  seo_title: product.seo_title ?? null,
  seo_description: product.seo_description ?? null,
  meta_keywords: product.meta_keywords ?? null,
  category: mapCategory(product.category),
  brand: mapBrand(product.brand),
  images: mapProductImages(product),
  category_tree: product.category_tree ?? [],
  average_rating: decimalString(product.average_rating),
  reviews_count: product.reviews_count ?? 0,
  discount_percent: decimalString(product.discount_percent),
  attributes_json: product.attributes_json ?? null,
  is_new: product.is_new,
  is_top: product.is_top,
  is_popular: product.is_popular,
  parameters: mapProductParameters(product.parameters),
})

const mapProductPage = (response: PaginatedResponse<PublicProductDto>): PaginatedResponse<ProductDto> => ({
  total: response.total,
  page: response.page,
  page_size: response.page_size,
  items: response.items.map(mapProduct),
})

const mapCartItem = (item: PublicCartItem): CustomerCartItemDto => ({
  ...item,
  product: mapProduct(item.product),
})

const mapWishlistItem = (item: PublicWishlistItem): CustomerWishlistItemDto => ({
  ...item,
  product: mapProduct(item.product),
})

const mapReview = (review: PublicReview): ProductReviewDto => ({
  ...review,
})

const mapReviewList = (response: PublicReviewList): ProductReviewListDto => ({
  total: response.total,
  average_rating: decimalString(response.average_rating),
  items: response.items.map(mapReview),
})

const mapCategoryFilters = (response: PublicCategoryFilters): CategoryFiltersDto => ({
  price: {
    min: decimalString(response.price.min),
    max: decimalString(response.price.max),
  },
  filters: response.filters,
})

export const useCatalogDomain = () => {
  const api = useApi()

  const getProductsPage = async (query: CatalogQuery = {}) => {
    const response = await api<PaginatedResponse<PublicProductDto>>('/public/products', {
      query: buildListQuery(query),
    })

    return mapProductPage(response)
  }

  const getProducts = async (query: CatalogQuery = {}) => {
    const response = await getProductsPage(query)

    return response.items
  }

  const getProduct = async (slug: string) =>
    mapProduct(await api<PublicProductDto>(`/public/products/by-slug/${encodeURIComponent(slug)}`))

  const recordProductView = (productId: number) =>
    api<PublicProductViewResponse>(`/public/products/${productId}/view`, { method: 'POST' })

  const getCategoryList = async () => {
    const firstPage = await api<PaginatedResponse<PublicCategoryDto>>('/public/categories', {
      query: { page: 1, page_size: 100 },
    })
    const items = [...firstPage.items]
    let page = firstPage.page

    while (items.length < firstPage.total) {
      page += 1
      const response = await api<PaginatedResponse<PublicCategoryDto>>('/public/categories', {
        query: { page, page_size: firstPage.page_size },
      })
      if (!response.items.length) break
      items.push(...response.items)
    }

    return items
  }

  const getCategories = async () => {
    const categories = await getCategoryList()

    return categories.map(mapCategory)
  }

  const getCategoryTree = async () => {
    try {
      const tree = await api<PublicCategoryDto[]>('/public/categories/tree', {
        query: { includeEmpty: true },
      })

      if (tree.length) return tree.map(mapCategoryTreeNode)
    }
    catch (error) {
      console.error(error)
    }

    return mapFlatCategoriesToTree(await getCategoryList())
  }

  const getCategoryProducts = async (categorySlug: string, query: CatalogQuery = {}) => {
    const response = await api<PaginatedResponse<PublicProductDto>>(
      `/public/categories/${encodeURIComponent(categorySlug)}/products`,
      { query: cleanQuery(query) },
    )

    return mapProductPage(response)
  }

  const getCategoryFilters = async (categorySlug: string, query: CatalogQuery = {}) =>
    mapCategoryFilters(await api<PublicCategoryFilters>(
      `/public/categories/${encodeURIComponent(categorySlug)}/filters`,
      { query: cleanQuery(query) },
    ))

  const searchProducts = async (q: string, limit = 8): Promise<ProductSearchResponseDto> => {
    const term = q.trim()
    if (term.length < 3) {
      return { suggestions: [], products: [], categories: [] }
    }

    const response = await api<PublicSearchResponse>('/public/products/search', {
      query: { q: term, limit },
    })

    return {
      suggestions: response.suggestions,
      products: response.products.map(mapProduct),
      categories: response.categories.map(mapCategory),
    }
  }

  const getBrands = async (options: { hasActiveProducts?: boolean } = {}) => {
    const firstPage = await api<PaginatedResponse<PublicBrandDto>>('/public/brands', {
      query: {
        page: 1,
        page_size: 100,
        has_active_products: options.hasActiveProducts || undefined,
      },
    })
    const items = [...firstPage.items]
    let page = firstPage.page

    while (items.length < firstPage.total) {
      page += 1
      const response = await api<PaginatedResponse<PublicBrandDto>>('/public/brands', {
        query: {
          page,
          page_size: firstPage.page_size,
          has_active_products: options.hasActiveProducts || undefined,
        },
      })
      if (!response.items.length) break
      items.push(...response.items)
    }

    return items.map(mapBrand)
  }

  const getProductReviews = async (productId: number) =>
    mapReviewList(await api<PublicReviewList>(`/public/products/${productId}/reviews`))

  const createProductReview = async (productId: number, body: { rating: number, comment: string | null }) =>
    mapReview(await api<PublicReview>(`/public/products/${productId}/reviews`, { method: 'POST', body }))

  const deleteProductReview = (productId: number, reviewId: number) =>
    api<void>(`/public/products/${productId}/reviews/${reviewId}`, { method: 'DELETE' })

  const getServerCart = async () => {
    const response = await api<PaginatedResponse<PublicCartItem>>('/public/customers/cart', {
      query: { page_size: 100 },
    })

    return response.items.map(mapCartItem)
  }

  const addServerCartItem = async (productId: number, quantity = 1) =>
    mapCartItem(await api<PublicCartItem>('/public/customers/cart', {
      method: 'POST',
      body: { product_id: productId, quantity },
    }))

  const deleteServerCartItem = (productId: number) =>
    api<void>(`/public/customers/cart/${productId}`, { method: 'DELETE' })

  const getWishlist = async () => {
    const response = await api<PaginatedResponse<PublicWishlistItem>>('/public/customers/wishlist', {
      query: { page_size: 100 },
    })

    return response.items.map(mapWishlistItem)
  }

  const addWishlistItem = async (productId: number) =>
    mapWishlistItem(await api<PublicWishlistItem>('/public/customers/wishlist', {
      method: 'POST',
      body: { product_id: productId },
    }))

  const deleteWishlistItem = (productId: number) =>
    api<void>(`/public/customers/wishlist/${productId}`, { method: 'DELETE' })

  const searchNovaPoshtaCities = (q: string) =>
    api<DeliveryListResponseDto>('/public/delivery/np/cities', { query: { q } })

  const getNovaPoshtaWarehouses = (cityRef: string) =>
    api<DeliveryListResponseDto>('/public/delivery/np/warehouses', { query: { city_ref: cityRef } })

  const getNovaPoshtaWarehouseTypes = () =>
    api<DeliveryListResponseDto>('/public/delivery/np/warehouse-types')

  const createOrder = (body: Record<string, unknown>) => api<OrderDto>('/public/orders', { method: 'POST', body })

  const sendFeedback = (body: { name: string, email: string, text: string }) =>
    api<{ message: string }>('/public/feedback/email', { method: 'POST', body })

  return {
    getProducts,
    getProductsPage,
    getProduct,
    recordProductView,
    getCategories,
    getCategoryTree,
    getCategoryProducts,
    getCategoryFilters,
    searchProducts,
    getBrands,
    getProductReviews,
    createProductReview,
    deleteProductReview,
    getServerCart,
    addServerCartItem,
    deleteServerCartItem,
    getWishlist,
    addWishlistItem,
    deleteWishlistItem,
    searchNovaPoshtaCities,
    getNovaPoshtaWarehouses,
    getNovaPoshtaWarehouseTypes,
    createOrder,
    sendFeedback,
  }
}
