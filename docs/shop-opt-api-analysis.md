# Анализ `lehko/opt_be`, `lehko/opt_fe` и план переноса shop-функционала

Дата анализа: 2026-07-07.

Источники:

- Backend-референс: `/Users/markgarnicev/lehko/opt_be`, remote `mharnichev/opt_be`.
- Frontend-референс: `/Users/markgarnicev/lehko/opt_fe`, remote `mharnichev/opt_fe`.
- Целевой backend: `/Users/markgarnicev/sc/sc-be`.
- Целевой frontend: `/Users/markgarnicev/sc/sc-fe/apps/shop` и существующий admin UI в `/Users/markgarnicev/sc/sc-fe/apps/backoffice`.

## Краткий вывод

`opt_be` - Django/DRF backend интернет-магазина с каталогом, деревом категорий, динамическими фильтрами, поиском, отзывами, OTP-auth, server-side cart/wishlist, оформлением заказа, Nova Poshta proxy и CRM export в SalesDrive.

`opt_fe` - Vue 3/Vite storefront, который фактически задает более удобный frontend contract, но не полностью совпадает с текущими URLs в `opt_be`. Поэтому переносить нужно не буквально все Django paths, а функциональные возможности и нормализованный контракт.

В `sc-be` уже есть FastAPI-основа для продуктов, категорий, брендов, заказов, customers и OTP-auth. В `sc-fe/apps/backoffice` уже есть управление products/categories/brands/orders и store dashboard. Значит план должен расширять текущий `sc-be`, не ломая существующий backoffice contract.

## Фактически реализованное API в `opt_be`

### URL wiring

Основные версионированные endpoints подключены через:

- `/v1/`: version + products.
- `/v2/`: version + users + products + orders + delivery.
- Неверсионированные legacy endpoints также активны: `/products/`, `/orders/`, `/delivery/`, `/users/`, `/feedback/`.
- Swagger/OpenAPI: `/api/schema/`, `/swagger/`, `/redoc/`, `/api/docs/`.

Важно: `opt_fe` ожидает `/be/v2/...`, но часть endpoints в текущем `opt_be` называется иначе или не находится под `/v2`.

### Products API

Активный v2 модуль: `/v2/products/`.

Реализованные endpoints:

- `GET /v2/products/all/`
  - Возвращает paginated product list в формате `{ count, results }`.
  - Поддерживает `limit`, `offset`, `ordering`.
  - В коде список фильтруется по `stock > 0` и исключает `language="ru"`.
  - Карточка товара содержит `id`, `name`, `slug`, `price`, `discount`, `oldPrice`, `image`, `stock`, `categoryTree`, `sku`, `averageRating`, `reviewsCount`.

- `POST /v2/products/all/`
  - Payload: `{ "cart_item_ids": [1, 2, 3] }`.
  - Возвращает базовые карточки товаров по массиву id. Используется как backend helper для корзины.

- `GET /v2/products/productdetail/{slug}/`
  - Детальная карточка по slug.
  - Возвращает описание, цену, скидку, stock, barcode, sku, currency, pageUrl, averageRating, category, images, reviewsCount, reviews, parameters.
  - Встраивает reviews с `limit/offset`.

- `GET /v2/products/categories/`
  - Возвращает дерево категорий.
  - Поддерживает `ETag` и `If-None-Match`, также `Last-Modified`.
  - Дерево фильтруется: остаются категории с товарами или непустыми дочерними ветками.

- `GET /v2/products/category/{category_slug}/products/`
  - Возвращает товары категории и всех подкатегорий через recursive SQL.
  - Поддерживает `limit`, `offset`, `ordering=price|-price|name|-name`.
  - Поддерживает `price_min`, `price_max`.
  - Поддерживает dynamic attribute filters через query params, где имя query param соответствует имени параметра товара.

- `GET /v2/products/category/{category_slug}/filters/`
  - Возвращает доступные значения параметров по категории и подкатегориям.
  - В текущем backend фактически возвращает плоский объект вроде `{ "Виробник": ["Bosch", "Makita"] }`.
  - `opt_fe` при этом ожидает более структурный объект `{ filters, price }`. Это нужно исправить при переносе.

- `GET /v2/products/search/?q=...`
  - Минимум 3 символа.
  - Возвращает `{ suggestions, products, categories }`.
  - Products используют тот же simple product DTO, categories содержат `id`, `name`, `slug`, `image`, `categoryTree`.

- `GET/POST /v2/products/{product_id}/reviews/`
  - List/create reviews.
  - POST требует auth, но read разрешен всем.
  - Один user может иметь один review на product; повторный POST обновляет rating/comment.

- `DELETE /v2/products/{product_id}/reviews/{review_id}/delete/`
  - Удаление review только автором.

- `GET/POST /v2/products/reviews/{review_id}/comments/`
  - List/create comments к review.

- `DELETE /v2/products/reviews/{review_id}/comments/{pk}/delete/`
  - Удаление comment только автором.

### Product data model

Ключевые сущности:

- `Product`
  - `language`, `product_type`, `sku`, `slug`, `name`, `document_name`, `description`, `page_url`, `category`, `stock`, `price`, `barcode`, `crm_id`, `currency`, `average_rating`.
- `ProductImage`
  - External `image_url`, optional local `image_file`, `order`.
- `ProductPrice`
  - История цены: `price`, `discount`, `discounted_price`, `cost_price`, `discount_start`, `discount_end`.
- `Parameter`, `ParameterValue`, `ProductParameter`
  - Нормализованные характеристики для динамических фильтров.
- `ProductReview`, `ReviewComment`
  - Отзывы и комментарии с auth ownership.
- `Category`
  - `crm_id`, `slug`, `name`, recursive `parent`, `position`, `image`, `image_file`, `is_active`.

### Users/Auth/Cart/Wishlist API

Активный v2 модуль: `/v2/users/`.

Endpoints:

- `POST /v2/users/register/`
  - Payload: `phone`, optional `firstName`, `lastName`.
  - Создает или находит пользователя по телефону, отправляет OTP через SMS Club.
  - Лимит отправок: 3, далее timeout на 24 часа.

- `POST /v2/users/register/verification/`
  - Payload: `phone`, `otp`.
  - Возвращает `refresh_token` и `access_token`.

- `POST /v2/users/me/token/refresh/`
  - Refresh token из body или cookie `refresh_token`.
  - Возвращает `{ access }`.

- `POST /v2/users/me/logout/`
  - Blacklist refresh token, удаляет cookie.

- `GET /v2/users/me/getuser/`
  - Текущий пользователь по access token.
  - В `opt_fe` вызов называется `/me/get-user/`, есть mismatch.

- `PUT /v2/users/me/`
  - Обновление профиля: `name`, `firstName`, `lastName`, `email`, password fields.

- Password/phone/account flows:
  - `POST /v2/users/me/passwordreset/`
  - `PUT /v2/users/me/passwordresetoldpassword/`
  - `PUT /v2/users/me/passwordresetconfirm/`
  - `POST /v2/users/me/changephone/`
  - `POST /v2/users/me/changephone/confirm/`
  - `DELETE /v2/users/me/delete/`

- `GET /v2/users/cart/`
  - Auth required.
  - Возвращает paginated `{ count, results }`.
  - Item содержит `quantity`, `productId` и поля simple product.

- `POST /v2/users/cart/`
  - Payload: `{ product, quantity }`.
  - Если item уже есть, quantity увеличивается на delta.
  - Если новый quantity <= 0, item удаляется.

- `DELETE /v2/users/cart/{product_id}/`
  - Удаляет product из cart текущего user.

- `GET /v2/users/wishlist/`
  - Auth required.
  - Возвращает paginated wishlist item cards.

- `POST /v2/users/wishlist/`
  - Payload: `{ product }`.
  - Ошибка, если уже в wishlist.

- `DELETE /v2/users/wishlist/{product_id}/`
  - Удаляет product из wishlist.

### Orders API

Активный endpoint:

- `POST /v2/orders/create/`

Основной payload, который ожидает `opt_fe`:

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
  "comment": "Зателефонуйте перед доставкою",
  "items": [
    { "product_id": 123, "quantity": 2 }
  ]
}
```

Behavior:

- Создает order для auth и anonymous users.
- Anonymous users не могут заказать больше 10 units одного товара.
- Проверяет наличие товаров и stock.
- Считает `total_amount` по `Product.price`.
- Создает `OrderItem` snapshots: `name`, `quantity`, `price`, `discount`, `total_price`, `sku`, `crm_id`.
- Уменьшает stock.
- Отправляет заказ в SalesDrive CRM.
- Если CRM response не 200, удаляет order.
- Если user авторизован, уменьшает или удаляет cart items.

Замеченные проблемы в `opt_be`, которые не надо копировать:

- Для UkrPost используются разные значения: `urkPost`, `ukrPost`, `UkrPost`.
- Serializer требует поля `ServiceType`/`type` для некоторых shipping companies, но они не объявлены как serializer fields.
- `paymentMethod` используется во view, но не описан в serializer fields.
- CRM request синхронный; ошибка CRM откатывает локальный заказ удалением.

### Delivery API

Активный v2 модуль: `/v2/delivery/np/`.

- `GET /v2/delivery/np/cities/?q=...`
  - Proxy to Nova Poshta `Address.getCities`.
  - Cache key `np:cities:{query}` на 24 часа.

- `GET /v2/delivery/np/warehouses/?city_ref=...`
  - Proxy to Nova Poshta `AddressGeneral.getWarehouses`.
  - Скачивает все страницы по 1000.
  - Cache key `np:warehouses:{city_ref}` на 24 часа.

- `GET /v2/delivery/np/warehouse-types/`
  - Proxy to Nova Poshta `AddressGeneral.getWarehouseTypes`.
  - Cache 24 часа.

### Feedback и feeds

- Фактически подключен `POST /feedback/emailsend/`, не `/v2/feedback/email-send/`.
- Payload: `name`, `email`, `text`.
- Есть basic anti-script validation и throttle.
- `yml_exporter` есть в коде, но не подключен в `config/urls.py`; публичным API его считать нельзя.

## Связь `opt_fe` с backend

### HTTP слой

`opt_fe` использует `HttpService`:

- В production URL `/be/...` переписывается в `VITE_API_BASE + pathWithoutBe`.
- По умолчанию добавляется `Authorization: Bearer ${localStorage.access_token}`.
- Refresh flow обрабатывает 401 через `AuthService.getRefreshTokens()`.
- Tokens хранятся в `localStorage`: `access_token`, `refresh_token`, `token_expires_at`.
- Попытка поставить `httpOnly` cookie из browser JS не работает как настоящий httpOnly cookie; для нового frontend лучше либо использовать server-set cookies, либо честно хранить refresh в storage.

### Frontend services и ожидаемые endpoints

`opt_fe` ожидает такие paths:

- Catalog:
  - `GET /be/v2/catalog/categories-tree/`
  - Backend в `opt_be` фактически имеет `/v2/products/categories/`.

- Products:
  - `GET /be/v2/products/all/?limit=&offset=`
  - `GET /be/v2/products/category/{slug}/products/?limit=&offset=&ordering=&priceMin=&priceMax=&filters`
  - `GET /be/v2/products/category/{slug}/filters/`
  - `GET /be/v2/products/product-detail/{slug}/`
  - `GET /be/v2/products/search/?q=`
  - Backend в `opt_be` фактически имеет `productdetail`, не `product-detail`.

- Auth/user:
  - `POST /be/v2/users/register/`
  - `POST /be/v2/users/register/verification/`
  - `POST /be/v2/users/me/logout/`
  - `POST /be/v2/users/me/token/refresh/`
  - `GET /be/v2/users/me/get-user/`
  - `PUT /be/v2/users/me/`
  - Backend в `opt_be` фактически имеет `me/getuser/`.

- Cart/wishlist:
  - `GET/POST /be/v2/users/cart/`
  - `DELETE /be/v2/users/cart/{product_id}/`
  - `GET/POST /be/v2/users/wishlist/`
  - `DELETE /be/v2/users/wishlist/{product_id}/`

- Checkout/delivery:
  - `POST /be/v2/orders/create/`
  - `GET /be/v2/delivery/np/cities/?q=`
  - `GET /be/v2/delivery/np/warehouses/?city_ref=`

- Feedback:
  - `POST /be/v2/feedback/email-send/`
  - Backend в `opt_be` фактически имеет `/feedback/emailsend/`.

### UI flows в `opt_fe`

Реализованные frontend capabilities:

- Home:
  - Hero/category banner.
  - Popular goods через products list.
  - Static promoted banners.

- Catalog/category:
  - URL строится как `/:slug+/goods/`.
  - Category slug берется из последнего segment.
  - Загружает categories для breadcrumbs.
  - Загружает products категории и filters.
  - Sort tabs: cheaper/more expensive.
  - Mobile/desktop filter panels.
  - Price range filter.
  - Filter chips.
  - Pagination через limit/offset.

- Search:
  - Search overlay в header.
  - Debounced request после 3 символов.
  - Показывает categories и goods.
  - Навигация на товар через `categoryTree + goodSlug`.

- Product detail:
  - URL `/:slug+/goods/:goodSlug`.
  - Product gallery.
  - Buy/favorite box.
  - Delivery info block.
  - Description/parameters.
  - Reviews list UI.
  - schema.org Product metadata.

- Cart/favorites:
  - Anonymous cart хранится в `localStorage`.
  - Если user авторизован, add/remove дополнительно синхронизируется с backend cart/wishlist.
  - При login frontend подтягивает server cart/wishlist и кладет их в stores.

- Auth:
  - Login/registration через phone + OTP.
  - OTP resend countdown.
  - Temporary block UI.
  - User modal.

- Checkout:
  - Contact info: firstName, lastName, phoneNumber.
  - Delivery: только Nova Poshta в текущем UI.
  - Methods: department, postomat, courier.
  - City search + warehouse list.
  - Payment: только payment upon receipt.
  - Comment.
  - Order summary.
  - Submit order.

- Cabinet:
  - Settings: firstName, lastName, phone.
  - Favorites list.
  - Purchase history page есть, но полноценная API-интеграция не просматривается в текущем наборе.

## Текущее состояние `sc-be`

Существующий FastAPI backend уже покрывает часть shop:

- `/api/v1/public/products`
  - `GET` list with `category_id`, `brand_id`, `search`, page/page_size.
  - `GET /{product_id}` detail только по integer id.
  - Возвращает `ProductResponse` в snake_case.

- `/api/v1/backoffice/products`
  - Full CRUD.
  - Используется `apps/backoffice`.

- Product model:
  - `name`, `slug`, `description`, `short_description`, `price`, `recommended_retail_price`, `sku`, `stock_quantity`, `is_active`, `image_url`, `external_url`, `availability_status`, `attributes_json`, `brand_id`, `category_id`.

- `/api/v1/public/categories`
  - Paginated flat list и detail by id.
  - Public tree отсутствует.

- `/api/v1/backoffice/categories/tree`
  - Tree есть только для backoffice.

- `/api/v1/public/brands`
  - List/detail.

- `/api/v1/public/orders`
  - Simple order create.
  - Payload: `customer_name`, `customer_phone`, optional `customer_email`, `comment`, `items`.
  - Проверяет stock, уменьшает stock, линкует существующего customer по phone.
  - Нет shipping model, delivery provider fields, payment method, CRM export, cart cleanup.

- `/api/v1/public/customers/auth/request-otp`
  - Уже есть хороший OTP request flow.
  - OTP хранится отдельно и хешируется.
  - Есть daily send/verify limits.

- `/api/v1/public/customers/auth/verify-otp`
  - Возвращает scoped customer access token и customer.

- `/api/v1/public/customers/me`
  - Read/update current customer.

Ключевые gaps относительно `opt_be`/`opt_fe`:

- Нет public product detail по slug.
- Нет `categoryTree` на product DTO.
- Нет public category tree с ETag.
- Нет recursive category products by slug.
- Нет динамических facets/filters и price range.
- Нет search suggestions endpoint.
- Нет product reviews/comments.
- Нет product images table; gallery сейчас берется из `image_url` и `attributes_json.image_urls` на frontend.
- Нет server-side cart/wishlist.
- Нет customer refresh token flow для shop.
- Нет Nova Poshta delivery proxy/cache.
- Order model не хранит shipping/payment provider details.
- Нет feedback endpoint для shop.

## Текущее состояние `sc-fe/apps/backoffice`

Backoffice уже работает с текущим `sc-be` contract:

- Products:
  - `/backoffice/products`
  - filters: `search`, `category_id`, `brand_id`, `is_active`, `availability_status`.
  - product detail/edit поддерживает `image_url`, `attributes_json.image_urls`, `recommended_retail_price`, `stock_quantity`, `availability_status`, `brand_id`, `category_id`.

- Categories/brands:
  - Используются как option lists.

- Orders:
  - `/backoffice/orders` list.
  - Сейчас видит `id`, customer, contacts, total, status, created_at.

- Store dashboard:
  - Считает products quality: без фото, SKU, категории, бренда.
  - Считает stock, low/out of stock, catalog value, recent orders.

Вывод: нельзя менять существующие backoffice DTO. Для public shop лучше добавить отдельные public DTO/schemas с camelCase или сделать frontend mapping в `apps/shop/domain`.

## Текущее состояние `sc-fe/apps/shop`

Shop app уже имеет MVP:

- `domain/catalog.ts`
  - Мапит public FastAPI DTO в `@shared-types`.
  - Использует `/public/products`, `/public/categories`, `/public/brands`, `/public/orders`.
  - Сейчас вызывает product detail как `/public/products/{slug}`, но `sc-be` ожидает integer id. Это текущий bug.
  - Catalog отправляет `q` и `sort`, но `sc-be` ожидает `search` и не обрабатывает sort. Это текущий mismatch.

- Pages:
  - `/`: homepage + 6 products.
  - `/catalog`: simple filters by category/brand/search/sort.
  - `/products/[slug]`: product detail + local reviews UI.
  - `/favorites`: local favorite ids.
  - `/checkout`: simple order form with shipping address text.

- Stores:
  - `cart.ts`: local Pinia cart persisted to `localStorage`.
  - `favorites.ts`: local favorite product ids persisted to `localStorage`.

## Рекомендуемый целевой контракт для `sc-be`

Не переносить Django paths один-в-один. Лучше расширить текущий `/api/v1/public` и `/api/v1/backoffice` стиль.

### Catalog/products

Добавить или расширить:

- `GET /api/v1/public/products`
  - Backward compatible с текущим response.
  - Добавить query aliases:
    - `q` как alias для `search`.
    - `sort`: `newest`, `price_asc`, `price_desc`, `name`.
    - `limit`/`offset` как альтернативу `page`/`page_size`, если frontend будет ближе к opt.
    - `category_slug`, `brand_slug`.
  - Для `apps/shop` можно оставить mapping в domain, но backend должен реально сортировать и искать.

- `GET /api/v1/public/products/by-slug/{slug}`
  - Явный endpoint, чтобы не конфликтовать с текущим `/{product_id}`.
  - Возвращает shop product detail.

- `GET /api/v1/public/products/search`
  - Query `q`.
  - Response: `{ suggestions, products, categories }`.

- `GET /api/v1/public/categories/tree`
  - Public tree.
  - С ETag/If-None-Match.
  - Только active categories с active products или непустыми active children.

- `GET /api/v1/public/categories/{slug}/products`
  - Recursive products by category slug.
  - Query: pagination, sort, `priceMin`/`priceMax`, dynamic filters.

- `GET /api/v1/public/categories/{slug}/filters`
  - Response должен быть frontend-friendly:

```json
{
  "price": { "min": 100, "max": 2500 },
  "filters": {
    "brand": {
      "slug": "brand",
      "name": "Бренд",
      "values": [
        { "slug": "bosch", "name": "Bosch", "count": 12 }
      ]
    }
  }
}
```

### Product data

Минимальный перенос с учетом текущей модели `sc-be`:

1. Оставить existing `Product` fields, чтобы backoffice не сломался.
2. Добавить `ProductImage` table:
   - `id`, `product_id`, `image_url` или `upload_id`, `alt`, `sort_order`, `is_active`.
   - На первом этапе можно продолжать читать `image_url` и `attributes_json.image_urls` как fallback.
3. Для фильтров выбрать один из вариантов:
   - MVP: договориться о форме `attributes_json`, например `{ "filters": { "manufacturer": "Bosch", "voltage": "18V" }, "image_urls": [] }`, и строить facets из JSON.
   - Надежный вариант: добавить `ProductParameter`, `ProductParameterValue`, `ProductParameterAssignment` как в `opt_be`.
4. Добавить computed response fields:
   - `oldPrice`/`compareAtPrice` из `recommended_retail_price`.
   - `discount` как percentage, если retail price выше price.
   - `images`.
   - `categoryTree`.
   - `reviewsCount`, `averageRating` после reviews phase.

### Customer auth/cart/wishlist

Использовать существующий `CustomerAuthService`, не переносить Django `User` model.

Добавить:

- `GET /api/v1/public/customers/me`
  - Уже есть.
  - Для shop mapping добавить поля `firstName`/`lastName` на frontend или backend aliases из `name`/`surname`.

- `POST /api/v1/public/customers/auth/request-otp`
  - Уже есть. Frontend auth modal должен использовать его вместо `/users/register/`.

- `POST /api/v1/public/customers/auth/verify-otp`
  - Уже есть.
  - Добавить refresh token flow только если нужен long-lived login:
    - `POST /api/v1/public/customers/auth/refresh`
    - `POST /api/v1/public/customers/auth/logout`

- `GET /api/v1/public/customers/cart`
- `POST /api/v1/public/customers/cart`
- `DELETE /api/v1/public/customers/cart/{product_id}`

- `GET /api/v1/public/customers/wishlist`
- `POST /api/v1/public/customers/wishlist`
- `DELETE /api/v1/public/customers/wishlist/{product_id}`

Новые tables:

- `customer_cart_items`: `customer_id`, `product_id`, `quantity`, unique customer/product.
- `customer_wishlist_items`: `customer_id`, `product_id`, unique customer/product.

### Checkout/orders/delivery

Расширить текущие orders без поломки existing simple order:

- `POST /api/v1/public/orders`
  - Принять current simple payload и новый shop payload.
  - Нормализовать в один internal command.
  - Поддержать:
    - `firstName`, `lastName`, `phoneNumber`.
    - `shippingCompany`, `shippingMethod`.
    - `shippingArea`, `shippingCity`, `shippingWarehouseNumber`.
    - `shippingStreet`, `buildingNumber`, `shippingApartment`.
    - `paymentMethod`.
    - `items`.

Добавить к `Order`:

- `first_name`, `last_name` или сохранять full `customer_name` плюс raw contact JSON.
- `shipping_company`, `shipping_method`, `delivery_address`.
- `shipping_payload_json`.
- `payment_method`.
- `tracking_number`.
- `external_id`, `error_message` для будущих integrations.

Nova Poshta:

- `GET /api/v1/public/delivery/np/cities?q=`
- `GET /api/v1/public/delivery/np/warehouses?city_ref=`
- `GET /api/v1/public/delivery/np/warehouse-types`

Кеш:

- Использовать Redis, если он уже есть в deployment, иначе DB/cache abstraction.
- TTL 24 часа.
- External calls через async HTTP client, retry/backoff.

CRM:

- Не вшивать SalesDrive URL в order flow.
- Сделать `OrderExportProvider` interface и background task.
- MVP: создать локальный order даже если export provider выключен.
- При ошибке export не удалять order, а выставлять `external_sync_status=failed`.

### Product reviews

Добавить позже, после catalog/order MVP:

- `GET /api/v1/public/products/{product_id}/reviews`
- `POST /api/v1/public/products/{product_id}/reviews`
- `DELETE /api/v1/public/products/{product_id}/reviews/{review_id}`
- `GET/POST /api/v1/public/product-reviews/{review_id}/comments`

Tables:

- `product_reviews`: product, customer, rating, comment, created_at, unique product/customer.
- `product_review_comments`: review, customer, comment, created_at.

### Feedback

Добавить:

- `POST /api/v1/public/feedback/email`
  - Payload: `name`, `email`, `text`.
  - Rate limit.
  - Basic HTML/script sanitation.
  - SMTP provider через settings.

## План реализации

### Phase 0. Зафиксировать контракт

1. Решить casing:
   - Backoffice остается snake_case.
   - Public shop может быть camelCase, но тогда сделать отдельные response schemas.
   - Более простой вариант для Nuxt: backend остается snake_case, `apps/shop/domain` мапит в camelCase/shared DTO.
2. Решить namespace:
   - Рекомендация: расширять `/api/v1/public/*`, не добавлять `/v2/users/*`.
3. Добавить contract tests для текущих backoffice endpoints, чтобы не сломать `apps/backoffice`.

### Phase 1. Catalog API в `sc-be`

1. Добавить product detail by slug endpoint.
2. Добавить real `q`/`search` alias и `sort` в product list.
3. Добавить recursive category service:
   - получить active descendants;
   - получить products этих categories;
   - поддержать sort/pagination.
4. Добавить public category tree:
   - active-only;
   - filter empty branches;
   - ETag.
5. Добавить search endpoint:
   - suggestions по product names;
   - products top N;
   - categories top N.
6. Добавить filter facets:
   - MVP из `attributes_json`;
   - price min/max;
   - response `{ price, filters }`.
7. Добавить tests:
   - slug detail;
   - recursive category products;
   - filter facets;
   - search min length;
   - ETag 304.

### Phase 2. Product media/attributes

1. Добавить `ProductImage` model + migration.
2. Добавить backoffice API для images или расширить product payload.
3. Временно поддержать fallback из `image_url` и `attributes_json.image_urls`.
4. Если нужен robust filtering, добавить normalized parameters tables.
5. Обновить seed/import script, чтобы products имели image gallery и filter attributes.

### Phase 3. Customer auth + cart/wishlist

1. Использовать existing `/public/customers/auth/request-otp` и `/verify-otp`.
2. Добавить Nuxt shop auth store/composables.
3. Добавить cart/wishlist models, schemas, routes.
4. Реализовать merge local cart to server cart after login.
5. Добавить tests:
   - cart add/update/delete;
   - wishlist duplicate protection;
   - auth required;
   - product inactive/stock handling.

### Phase 4. Checkout/orders/delivery

1. Расширить order schemas под opt-like checkout payload.
2. Добавить shipping/payment fields в model.
3. Поддержать anonymous и authenticated order create.
4. При authenticated order link `customer_id` и после success уменьшать server cart.
5. Добавить Nova Poshta proxy/cache.
6. Сделать stock deduction транзакционно.
7. Добавить order detail в backoffice, если нужен просмотр shipping/payment/items.
8. Добавить tests:
   - order stock validation;
   - duplicate product handling;
   - anonymous limits;
   - cart cleanup;
   - NP service fallback/cache.

### Phase 5. Reviews/feedback

1. Добавить product reviews/comments.
2. Подключить product detail UI к API вместо local mock reviews.
3. Добавить feedback endpoint и support/contact form.
4. Добавить moderation или backoffice read-only list, если нужно управлять reviews.

### Phase 6. `sc-fe/apps/shop` integration

1. Обновить `apps/shop/domain/catalog.ts`:
   - product detail перейти на `/public/products/by-slug/{slug}`;
   - `q`/`sort` приводить к backend contract;
   - добавить category tree, category products, filters, search.
2. Перестроить catalog page:
   - recursive category URL или текущий `/catalog` с query;
   - filters panel;
   - price range;
   - sort;
   - pagination;
   - loading/empty/error states.
3. Добавить category navigation/header search:
   - взять идею `CategoryList` и `BaseSearchInput` из `opt_fe`, но адаптировать под дизайн `apps/shop`.
4. Product page:
   - gallery;
   - category breadcrumbs;
   - price/compare price/discount;
   - attributes;
   - reviews API;
   - schema.org Product.
5. Auth:
   - customer OTP modal;
   - token persistence;
   - protected customer endpoints.
6. Cart/favorites:
   - оставить anonymous local store;
   - при auth синхронизировать server cart/wishlist;
   - добавить product-card favorite state.
7. Checkout:
   - split contact/delivery/payment/comment/order summary;
   - Nova Poshta city/warehouse selects;
   - submit opt-like order payload to `/public/orders`.
8. Cabinet:
   - profile settings через `/public/customers/me`;
   - wishlist;
   - order history, если добавить endpoint.

### Phase 7. Backoffice additions

1. Product form:
   - structured editor для images, если добавляем `ProductImage`.
   - structured editor для filter attributes.
2. Orders:
   - detail page;
   - shipping/payment fields;
   - status update;
   - external sync status.
3. Store dashboard:
   - добавить metrics по wishlist/cart/order conversion позже.

## Основные риски

- Route collision: текущий `GET /public/products/{product_id}` нельзя использовать для slug. Нужен явный `/by-slug/{slug}` или аккуратный роутинг.
- Contract mismatch: `opt_fe` и `opt_be` уже расходятся. Новый контракт надо описать до реализации.
- Casing mismatch: backoffice snake_case, opt frontend camelCase. Не смешивать в одном DTO без явной стратегии.
- Filters: произвольные украинские имена параметров как query keys неудобны. Лучше slugs для filter groups/values.
- Stock race conditions: order create должен блокировать или атомарно обновлять stock.
- External services: Nova Poshta/SMS/CRM должны иметь graceful fallback и не удалять локальный order при ошибке интеграции.
- Auth storage: refresh token в localStorage проще, но хуже по безопасности. Если нужен cookie flow, cookie должен ставить backend.

## Рекомендуемый первый рабочий пакет

1. `sc-be`: product detail by slug, real search/sort aliases, category tree, search endpoint.
2. `sc-fe/apps/shop`: исправить `domain/catalog.ts` под эти endpoints и починить product detail route.
3. `sc-be`: category products + filters response.
4. `sc-fe/apps/shop`: заменить простой catalog на opt-like filters/search UX.
5. `sc-be`: cart/wishlist models + endpoints.
6. `sc-fe/apps/shop`: auth + cart/wishlist sync.
7. `sc-be`: extended order + Nova Poshta.
8. `sc-fe/apps/shop`: checkout delivery flow.

