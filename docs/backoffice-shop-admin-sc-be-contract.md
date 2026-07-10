# Backoffice: shop admin changes after `sc-be` ecommerce API

Дата: 2026-07-07.

Этот файл описывает, что изменилось в `sc-be` для ecommerce и как доработать `apps/backoffice`, не ломая текущий admin contract.

Backend package: `sc-be` migration `0035_shop_ecommerce_api`.
Frontend target: `apps/backoffice`.

## Главное правило

Backoffice endpoints остаются в namespace `/api/v1/backoffice/*`.
Public shop endpoints находятся в `/api/v1/public/*` и не должны использоваться как основной admin API.

Существующий backoffice contract не был намеренно сломан:

- `/backoffice/products` - list/create/update/delete products.
- `/backoffice/categories` и `/backoffice/categories/tree`.
- `/backoffice/brands`.
- `/backoffice/orders`.
- `/backoffice/customers/{id}/orders`.
- `/backoffice/admin/dashboards/store` frontend page продолжает работать через existing product/order summaries.

## Где сейчас backoffice

Ключевые файлы:

- `apps/backoffice/composables/useApi.ts` - `$fetch` wrapper с admin Bearer token и refresh flow.
- `apps/backoffice/composables/useBackofficeApi.ts` - typed methods для admin API.
- `apps/backoffice/pages/products/index.vue` - product table/filters.
- `apps/backoffice/pages/products/[id].vue` - product edit page.
- `apps/backoffice/components/ProductForm.vue` - product form, включая raw `attributes_json` textarea.
- `apps/backoffice/pages/orders.vue` - order list.
- `apps/backoffice/pages/admin/dashboards/store.vue` - store dashboard/quality metrics.

## What changed in backend

### New DB entities

Backend now has:

- `product_images`
- `customer_cart_items`
- `customer_wishlist_items`
- `product_reviews`
- `product_review_comments`
- `delivery_cache`

Only some of these have public endpoints today. Admin endpoints for `product_images`, reviews moderation, cart/wishlist inspection are not implemented yet.

### Product model

Existing backoffice product fields remain:

```ts
interface Product {
  id: number
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
```

No backoffice ProductImage CRUD endpoint exists yet. Public product response can use `product_images`, `image_url`, and `attributes_json.image_urls`, but backoffice can only edit `image_url` and `attributes_json` through the current API.

## Product attributes convention

Until normalized ProductParameter tables or ProductImage admin endpoints are added, use `attributes_json` as the editable source of shop metadata.

Recommended shape:

```json
{
  "image_urls": [
    "https://cdn.example.com/product-main.webp",
    "https://cdn.example.com/product-side.webp"
  ],
  "filters": {
    "manufacturer": "Wahl",
    "voltage": ["18V", "220V"],
    "color": { "slug": "black", "name": "Black" },
    "series": [
      { "slug": "professional", "name": "Professional" }
    ]
  },
  "display": {
    "country": "USA",
    "volume": "100 мл"
  }
}
```

How public facets are built:

- `brand` is always a built-in facet group.
- If `attributes_json.filters` exists and is an object, backend uses it for dynamic filter facets.
- If `attributes_json.filters` does not exist, backend uses top-level attributes except internal/media keys.
- Query params use slugified group/value names.

For admin UX this means:

1. Keep raw JSON editor as fallback.
2. Add a structured editor for `attributes_json.image_urls`.
3. Add a structured editor for `attributes_json.filters`.
4. Preserve unknown keys in `attributes_json` when saving.

## Product form work

Current `ProductForm.vue` already sends `ProductPayload.attributes_json`.

Suggested additions:

- Gallery block:
  - primary `image_url`.
  - repeatable `attributes_json.image_urls`.
  - preview thumbnails.
- Filters block:
  - rows with `group_slug`, `group_name`, `value_slug`, `value_name`.
  - save back to `attributes_json.filters`.
- Compare price:
  - keep using `recommended_retail_price`.
  - public shop maps it to `compare_at_price`.
- Stock status:
  - keep `stock_quantity`.
  - `availability_status` can be manual: `in_stock`, `low_stock`, `out_of_stock`, etc.
  - dashboard may also compute low/out of stock from `stock_quantity`.

Suggested frontend-only helper:

```ts
const normalizeProductAttributes = (attributes: Record<string, unknown> | null) => ({
  ...(attributes || {}),
  image_urls: Array.isArray(attributes?.image_urls) ? attributes.image_urls : [],
  filters: typeof attributes?.filters === 'object' && attributes?.filters ? attributes.filters : {},
})
```

## ProductImage table status

Backend has `ProductImage` model/table, but no admin endpoints yet.

Do not build UI that assumes these endpoints exist:

- `GET /backoffice/products/{id}/images`
- `POST /backoffice/products/{id}/images`
- `PUT /backoffice/products/{id}/images/{image_id}`
- `DELETE /backoffice/products/{id}/images/{image_id}`

If real image CRUD is needed, implement those in `sc-be` first or extend `ProductPayload` to accept image arrays.

## Orders changes

Backend `Order` now stores checkout shipping/payment fields:

```ts
interface OrderResponse {
  id: number
  customer_name: string
  customer_phone: string
  customer_email: string | null
  comment: string | null
  first_name: string | null
  last_name: string | null
  shipping_company: string | null
  shipping_method: string | null
  shipping_area: string | null
  shipping_city: string | null
  shipping_warehouse_number: string | null
  shipping_street: string | null
  building_number: string | null
  shipping_apartment: string | null
  delivery_address: string | null
  shipping_payload_json: Record<string, unknown> | null
  payment_method: string | null
  tracking_number: string | null
  external_id: string | null
  external_sync_status: string | null
  external_sync_error: string | null
  total_amount: string
  status: string
  items: OrderItemResponse[]
}
```

Order item now also has snapshot fields:

```ts
interface OrderItemResponse {
  id: number
  product_id: number
  quantity: number
  price: string
  product_name: string | null
  product_sku: string | null
  total_price: string | null
}
```

`OrderSummary` now may include:

```ts
shipping_company?: string | null
shipping_city?: string | null
payment_method?: string | null
```

Update `apps/backoffice/composables/useBackofficeApi.ts`:

1. Extend `OrderSummary`.
2. Add `OrderResponse` and `OrderItemResponse`.
3. Add methods:

```ts
const getOrder = (orderId: number | string) =>
  api<OrderResponse>(`/backoffice/orders/${orderId}`)

const updateOrderStatus = (orderId: number | string, status: string) =>
  api<OrderResponse>(`/backoffice/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status },
  })
```

## Orders page work

Current `apps/backoffice/pages/orders.vue` only lists summaries.

Recommended additions:

- Add table columns:
  - shipping city.
  - shipping company/method.
  - payment method.
  - sync status if external integrations are added later.
- Add route `apps/backoffice/pages/orders/[id].vue`.
- Detail page should show:
  - contact block.
  - shipping block.
  - payment block.
  - items with `product_name`, `product_sku`, `quantity`, `price`, `total_price`.
  - status selector using `PATCH /backoffice/orders/{id}/status`.

Status values are backend enum:

- `pending`
- `confirmed`
- `paid`
- `completed`
- `cancelled`

## Store dashboard work

`apps/backoffice/pages/admin/dashboards/store.vue` currently counts product quality issues.

Update image quality metric:

```ts
const productHasImage = (product: Product) =>
  Boolean(product.image_url)
  || Array.isArray(product.attributes_json?.image_urls)
    && product.attributes_json.image_urls.length > 0
```

Potential dashboard additions:

- Products missing filter attributes:
  - `!product.attributes_json?.filters`
- Products missing gallery:
  - no `image_url` and empty `attributes_json.image_urls`.
- Orders needing fulfillment:
  - `status in ['pending', 'confirmed', 'paid']`.
- Nova Poshta orders without warehouse/street data:
  - `shipping_company === 'novaPost'` and missing shipping fields.

## Reviews moderation

Backend public product reviews exist, but no backoffice review moderation endpoints exist yet.

Current public routes:

- `GET /public/products/{product_id}/reviews`
- `POST /public/products/{product_id}/reviews`
- `DELETE /public/products/{product_id}/reviews/{review_id}`
- comment routes under `/public/products/reviews/{review_id}/comments`

If backoffice needs moderation, implement backend admin endpoints first:

- `GET /backoffice/products/reviews`
- `DELETE /backoffice/products/reviews/{review_id}`
- `GET /backoffice/products/reviews/{review_id}/comments`
- `DELETE /backoffice/products/reviews/{review_id}/comments/{comment_id}`

Until then, do not add a moderation UI that calls public routes with admin token.

## Cart/wishlist visibility

Backend public customer cart/wishlist exists, but no admin endpoints exist.

Public routes:

- `/public/customers/cart`
- `/public/customers/wishlist`

If backoffice needs customer cart/wishlist support, add backend admin routes first:

- `GET /backoffice/customers/{customer_id}/cart`
- `GET /backoffice/customers/{customer_id}/wishlist`

## Nova Poshta admin settings

Backend settings:

```env
NOVA_POSHTA_API_KEY=
NOVA_POSHTA_API_URL=https://api.novaposhta.ua/v2.0/json/
NOVA_POSHTA_TIMEOUT_SECONDS=10
```

There is no backoffice settings UI for these yet. Configure via environment.

Delivery cache is backend-only table `delivery_cache`; no admin UI needed for MVP.

## Recommended implementation order

1. Update `useBackofficeApi.ts` types:
   - extend `OrderSummary`.
   - add `OrderResponse`, `OrderItemResponse`.
   - add `getOrder()` and `updateOrderStatus()`.
2. Add `pages/orders/[id].vue` detail page.
3. Update `pages/orders.vue` table to link to detail and show shipping/payment columns.
4. Update `ProductForm.vue`:
   - structured gallery editor for `attributes_json.image_urls`.
   - structured filters editor for `attributes_json.filters`.
   - keep raw JSON editor as advanced escape hatch.
5. Update `pages/products/[id].vue` preview helpers to use `image_url` + `attributes_json.image_urls`.
6. Update store dashboard image quality metric and add missing-filters metric.
7. Only after that, decide whether backend needs admin ProductImage CRUD/reviews moderation/cart visibility.

## Manual QA checklist

- Product edit preserves unknown `attributes_json` keys.
- Product with `attributes_json.filters` appears in public `/categories/{slug}/filters`.
- Product with `image_url` only appears in shop gallery.
- Product with only `attributes_json.image_urls` appears in shop gallery.
- Order list still loads after backend migration.
- Order detail shows Nova Poshta checkout fields.
- Status update persists through `PATCH /backoffice/orders/{id}/status`.
- Store dashboard does not mark products with `attributes_json.image_urls` as missing image.

## Known backend limitations for backoffice

- ProductImage table exists but has no admin CRUD route.
- Product reviews/comments have public routes but no admin moderation route.
- Cart/wishlist have public customer routes but no admin inspection route.
- CRM/export sync is represented by nullable fields but no provider is wired yet.
- Feedback endpoint is public-only and currently accepts payload without SMTP delivery.
