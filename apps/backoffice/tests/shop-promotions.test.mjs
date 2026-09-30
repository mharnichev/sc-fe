import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
const apiSource = await read('composables/useBackofficeApi.ts')
const formattingSource = await read('composables/useBookingFormatting.ts')
const formSource = await read('components/ShopPromotionFormModal.vue')
const pageSource = await read('pages/shop-promotions.vue')
const productSource = await read('pages/products/[id].vue')
const orderSource = await read('pages/orders/[id].vue')
const sidebarSource = await read('components/AppSidebar.vue')

test('shop promotions use a separate backend domain and expose CRUD plus preview methods', () => {
  assert.match(apiSource, /export type ShopPromotionDiscountType = 'percent' \| 'fixed_amount' \| 'fixed_price'/)
  assert.match(apiSource, /export type ShopPromotionTrigger = 'automatic' \| 'promocode'/)
  for (const method of ['adminGetShopPromotions', 'adminGetShopPromotion', 'adminCreateShopPromotion', 'adminUpdateShopPromotion', 'adminDeleteShopPromotion']) {
    assert.match(apiSource, new RegExp(`const ${method}`))
    assert.match(apiSource, new RegExp(`${method},`))
  }
  assert.match(apiSource, /'\/backoffice\/shop-promotions'/)
  assert.match(apiSource, /adminPreviewShopPromotion/)
  assert.match(sidebarSource, /label: 'Акції товарів', to: '\/shop-promotions'/)
  assert.doesNotMatch(pageSource, /<PromotionFormModal\b/)
  assert.match(apiSource, /adminGetShopPromotionProducts/)
  assert.match(pageSource, /adminGetShopPromotionProducts\(promotion\.id\)/)
  assert.match(pageSource, /affectedProducts\.value = result\.products/)
  assert.match(pageSource, /Товари акції/)
  assert.match(pageSource, /EyeIcon/)
  assert.match(pageSource, /NoSymbolIcon/)
  assert.doesNotMatch(pageSource, /TrashIcon/)
})

test('shop promotion form keeps scope, code, dates, and pricing server-authoritative', () => {
  assert.match(formSource, /form\.trigger === 'promocode'/)
  assert.match(formSource, /form\.trigger === 'automatic'/)
  assert.match(formSource, /form\.product_ids = \[\]/)
  assert.match(formSource, /form\.category_ids = \[\]/)
  assert.match(formSource, /form\.brand_ids = \[\]/)
  assert.match(formSource, /Виберіть товари, категорії або бренди/)
  assert.match(formSource, /form\.ends_at <= form\.starts_at/)
  assert.match(formSource, /const toIsoOrNull = \(value: string\) => value \? `\$\{value\}:00` : null/)
  assert.match(formSource, /adminPreviewShopPromotion\(promotionPayload\(\)\)/)
  assert.match(formSource, /Нова ціна: \{\{ formatMoney\(item\.new_price\) \}\}/)
  assert.doesNotMatch(formSource, /base_price.*\*.*discount|discount.*base_price.*-/)
})

test('backoffice surfaces structured backend validation details', () => {
  assert.match(formattingSource, /const formatDetail = \(detail: unknown\): string \| null =>/)
  assert.match(formattingSource, /value\.msg/)
  assert.match(formattingSource, /messages\.join\('; '\)/)
  assert.ok(
    formattingSource.indexOf("const detail = formatDetail(data?.detail)") <
      formattingSource.indexOf("if (status === 409)"),
    'structured API details must be checked before status fallbacks',
  )
})

test('product and order pages preserve product promotion scope and historical snapshots', () => {
  assert.match(productSource, /api\.adminGetShopPromotions\(1, 100, \{ product_id: Number\(productId\.value\) \}\)/)
  assert.match(productSource, /Акції товара/)
  assert.match(productSource, /Создати акцію для цього товару|Створити акцію для цього товару/)
  assert.match(productSource, /:initial-product-ids="\[product\.id\]"/)
  assert.match(orderSource, /item\.base_price/)
  assert.match(orderSource, /item\.shop_promotion_id/)
  assert.doesNotMatch(orderSource, /Number\(item\.price\) \* item\.quantity/)
})
