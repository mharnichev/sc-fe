# Shop app: контракт `sc-be` и план доработки storefront

Дата: 2026-07-07.

Этот файл описывает, как `apps/shop` должен работать с новым shop API в `sc-be`.
Backend реализован в `sc-be` миграцией `0035_shop_ecommerce_api` и расширяет текущий namespace `/api/v1/public/*`.

Не переносим legacy `/be/v2/*` из `opt_fe`. Для `apps/shop` целевой контракт - `/api/v1/public/*`.

## Где сейчас frontend

Ключевые файлы:

- `apps/shop/composables/useApi.ts` - тонкий `$fetch.create({ baseURL: config.public.apiBase })`.
- `apps/shop/domain/catalog.ts` - текущий mapper public DTO в `@shared-types`.
- `apps/shop/stores/cart.ts` - local cart в Pinia/localStorage.
- `apps/shop/stores/favorites.ts` - local favorite product ids.
- `apps/shop/pages/catalog.vue` - простой каталог по `category_id`, `brand_id`, `q`, `sort`.
- `apps/shop/pages/products/[slug].vue` - detail page, сейчас reviews локальные/mock.
- `apps/shop/pages/checkout.vue` - простой checkout без Nova Poshta.

Главный текущий bug: `domain.getProduct(slug)` вызывает `/public/products/${slug}`, а backend route `/{product_id}` ожидает integer. Нужно перейти на `/public/products/by-slug/{slug}`.

## Backend base

`NUXT_PUBLIC_API_BASE` / `config.public.apiBase` должен указывать на `/api/v1`, например:

```env
NUXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api/v1
```

Тогда frontend routes вызываются как `/public/products`, `/public/orders`, etc.

## Product DTO

Public product теперь возвращается как расширенный shop DTO. Поля остаются в snake_case.

Важные поля:

```ts
interface ShopProductResponse {
  id: number
  name: string
  slug: string
  description: string | null
  short_description: string | null
  price: string
  recommended_retail_price: string | null
  compare_at_price: string | null
  discount_percent: string | null
  sku: string | null
  stock_quantity: number
  is_active: boolean
  image_url: string | null
  attributes_json: Record<string, unknown> | null
  brand_id: number | null
  category_id: number | null
  brand: PublicBrandDto | null
  category: PublicCategoryDto | null
  images: string[]
  category_tree: Array<{ id: number, name: string, slug: string }>
  average_rating: string | null
  reviews_count: number
}
```

Important mismatch: current `ProductDto.images` expects `ProductImageDto[]`, while backend `ShopProductResponse.images` is `string[]`.
Update `apps/shop/domain/catalog.ts` so `mapProductImages()` accepts both:

```ts
type PublicProductImage = string | { id?: number, image?: string, image_url?: string, alt?: string | null, sort_order?: number }
```

Fallback order should be:

1. `product.images` from backend.
2. `product.image_url`.
3. `product.attributes_json.image_urls`.

## Catalog endpoints

### Products list

`GET /public/products`

Supported query:

- `page`, `page_size` - existing pagination.
- `limit`, `offset` - opt-like aliases.
- `search` or `q`.
- `sort` or `ordering`.
- `category_id`, `brand_id`.
- `category_slug`, `brand_slug`.

Sort values:

- `newest`
- `price_asc`, `price`, `cheaper`
- `price_desc`, `-price`, `expensive`
- `name`, `name_asc`
- `name_desc`, `-name`

Response:

```ts
interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}
```

Current `domain.getProducts()` already maps `items`, but it ignores `total/page`. Keep returning array for existing pages or add a second method:

```ts
getProductsPage(query): Promise<PaginatedResponse<ProductDto>>
```

### Product by slug

`GET /public/products/by-slug/{slug}`

Use this in `domain.getProduct(slug)`.

### Search suggestions

`GET /public/products/search?q={term}&limit=8`

Minimum `q` length: 3.

Response:

```ts
{
  suggestions: string[]
  products: ShopProductResponse[]
  categories: PublicCategoryDto[]
}
```

Use for header/search overlay. Keep debounced client calls.

## Category tree, category products and filters

### Public category tree

`GET /public/categories/tree`

Returns active category tree pruned to categories that have active products or non-empty children.
Backend sends `ETag`; browser/fetch can pass `If-None-Match`, but app can work without manual ETag handling.

Use this for navigation/breadcrumb-aware catalog.

### Products by category slug

`GET /public/categories/{category_slug}/products`

Supported query:

- `page`, `page_size`, `limit`, `offset`.
- `sort`, `ordering`.
- `priceMin`, `priceMax`.
- `price_min`, `price_max`.
- Dynamic filters as query params by filter group slug.

Example:

```text
/public/categories/trimmers/products?sort=price_asc&priceMin=500&brand=wahl&voltage=18v
```

### Category facets

`GET /public/categories/{category_slug}/filters`

Response:

```ts
{
  price: { min: string | null, max: string | null },
  filters: {
    [groupSlug: string]: {
      slug: string
      name: string
      values: Array<{ slug: string, name: string, count: number }>
    }
  }
}
```

Backend builds facets from:

- Brand as built-in group `brand`.
- `Product.attributes_json.filters`, if present.
- Otherwise top-level `attributes_json` keys except media/internal keys.

Recommended URL state in `catalog.vue`:

- `category` - category slug.
- `q` - search query.
- `sort`.
- `priceMin`, `priceMax`.
- Dynamic filter groups by slug.

## Customer auth

Backend already has customer OTP auth:

- `POST /public/customers/auth/request-otp`
- `POST /public/customers/auth/verify-otp`
- `GET /public/customers/me`
- `PATCH /public/customers/me`

Verify response returns:

```ts
{
  access_token: string
  token_type: "bearer"
  customer: CustomerResponse
  is_new_customer: boolean
  attempts_left_today: number
}
```

There is no customer refresh-token endpoint yet. Treat customer access token as long-lived according to backend setting `CUSTOMER_ACCESS_TOKEN_EXPIRE_DAYS`.

Needed frontend work:

1. Add `apps/shop/stores/customerAuth.ts`.
2. Persist `access_token` and customer in localStorage.
3. Extend `apps/shop/composables/useApi.ts` to set `Authorization: Bearer ${customerAuth.accessToken}` for customer endpoints.
4. Add OTP modal or page with request/verify/resend states.

## Server cart

Auth required.

- `GET /public/customers/cart`
- `POST /public/customers/cart`
- `DELETE /public/customers/cart/{product_id}`

POST payload:

```json
{ "product_id": 123, "quantity": 2 }
```

Response item:

```ts
{
  id: number
  product_id: number
  quantity: number
  product: ShopProductResponse
  created_at: string
  updated_at: string
}
```

Recommended frontend behavior:

1. Anonymous cart stays local in `stores/cart.ts`.
2. After login, merge local items into server cart by POSTing each `{ product_id, quantity }`.
3. Then replace local cart with server response mapped to `ProductDto`.
4. When authenticated:
   - `cart.add()` should update local state optimistically and POST server item.
   - `cart.update()` should either POST delta or delete/recreate until backend exposes PATCH.
   - `cart.remove()` calls DELETE.
5. On order success backend deletes ordered server cart items automatically for authenticated customer.

## Wishlist/favorites

Auth required.

- `GET /public/customers/wishlist`
- `POST /public/customers/wishlist`
- `DELETE /public/customers/wishlist/{product_id}`

POST payload:

```json
{ "product_id": 123 }
```

Current `stores/favorites.ts` stores only local ids. Keep anonymous behavior, then sync on login the same way as cart.

## Checkout

`POST /public/orders`

Backend accepts old simple payload and new opt-like checkout payload.

Recommended shop payload:

```json
{
  "firstName": "Іван",
  "lastName": "Чікунов",
  "phoneNumber": "+380990635700",
  "email": "user@example.com",
  "shippingCompany": "novaPost",
  "shippingMethod": "warehouse",
  "shippingArea": "Одеська",
  "shippingCity": "Одеса",
  "shippingWarehouseNumber": "24",
  "shippingStreet": "Дерибасівська",
  "buildingNumber": "12",
  "shippingApartment": "45",
  "paymentMethod": "cashOnDelivery",
  "comment": "Зателефонуйте перед доставкою",
  "items": [
    { "product_id": 123, "quantity": 2 }
  ]
}
```

Backend behavior:

- Auth and anonymous checkout supported.
- Anonymous customer cannot order more than 10 units of one product.
- Product stock is validated and decreased.
- Order items get product snapshot fields.
- Authenticated order is linked to customer.
- Authenticated order cleans matching server cart items.
- CRM export is not implemented; `external_sync_status` is currently `disabled`.

Current `checkout.vue` sends `first_name`, `last_name`, `phone`, `shipping_address`.
Change it to camelCase checkout payload above. Keep `items: cart.items.map(item => ({ product_id, quantity }))`.

## Nova Poshta delivery

- `GET /public/delivery/np/cities?q=Одеса`
- `GET /public/delivery/np/warehouses?city_ref={Ref}`
- `GET /public/delivery/np/warehouse-types`

Response:

```ts
{
  items: Array<Record<string, unknown>>
  cached: boolean
  updated_at: string | null
}
```

If `NOVA_POSHTA_API_KEY` is empty, backend returns empty `items` instead of failing.

Frontend checkout should:

1. Search cities after 2+ chars.
2. Store selected city `Ref` and display name.
3. Load warehouses by `city_ref`.
4. Submit selected warehouse number/name in `shippingWarehouseNumber`.

## Reviews

- `GET /public/products/{product_id}/reviews`
- `POST /public/products/{product_id}/reviews`
- `DELETE /public/products/{product_id}/reviews/{review_id}`
- `GET /public/products/reviews/{review_id}/comments`
- `POST /public/products/reviews/{review_id}/comments`
- `DELETE /public/products/reviews/{review_id}/comments/{comment_id}`

Review POST auth required:

```json
{ "rating": 5, "comment": "..." }
```

Current product page reviews are local mock data. Replace with backend reviews:

1. Load reviews by `product.id`, not slug.
2. Require customer auth for submit/delete.
3. Re-fetch product detail or update `average_rating` / `reviews_count` after review submit.

## Feedback

`POST /public/feedback/email`

Payload:

```json
{ "name": "Іван", "email": "user@example.com", "text": "..." }
```

Current backend accepts and validates payload. Actual SMTP send can be added later.

## Suggested implementation order

1. Update `packages/shared-types/src/index.ts` with shop DTO fields and flexible image source.
2. Update `apps/shop/domain/catalog.ts`:
   - `getProduct()` -> `/public/products/by-slug/{slug}`.
   - Add `getCategoryTree()`, `getCategoryProducts()`, `getCategoryFilters()`, `searchProducts()`.
   - Map `images: string[]` to `ProductImageDto[]`.
   - Map `category_tree`, `average_rating`, `reviews_count`.
3. Add customer auth store and Authorization header in `useApi()`.
4. Add server cart/wishlist methods and sync logic.
5. Rework `catalog.vue` to use category slug + facets + price range.
6. Rework product detail:
   - gallery from `images`.
   - breadcrumbs from `category_tree`.
   - backend reviews.
7. Rework checkout:
   - Nova Poshta city/warehouse flow.
   - opt-like order payload.
8. Add manual QA:
   - anonymous cart/order.
   - login + cart merge + order cleanup.
   - category filters and price range.
   - product review submit/delete.

## Known backend limitations

- No customer refresh/logout endpoints yet.
- No CRM export provider yet.
- Feedback endpoint accepts request but does not send SMTP yet.
- ProductImage table exists, but public product response currently exposes `images` as URL strings.
- Cart update has GET/POST/DELETE, no PATCH quantity endpoint yet.
