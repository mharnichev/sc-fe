import type { CheckoutOrder, CheckoutOrderItem } from '~/types/order'

const key = (scope: string, id: number) => `shop-checkout-confirmation-v1:${scope}:${id}`
const money = (value: unknown): value is string => typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value)
const text = (value: unknown): string | null => typeof value === 'string' ? value.slice(0, 2048) : null
const itemSnapshot = (item: CheckoutOrderItem): CheckoutOrderItem => ({
  id: item.id, product_id: item.product_id, product_name: item.product_name,
  product_name_en: text(item.product_name_en), product_sku: text(item.product_sku),
  product_image_url: text(item.product_image_url), product_variant: text(item.product_variant),
  quantity: item.quantity, price: item.price, total_price: money(item.total_price) ? item.total_price : null,
})

// Receipt facts only. Tokens/contact details and mutable payment/fulfilment projections
// are deliberately excluded; OrderPayment re-reads the authoritative payment state.
export const saveCheckoutConfirmation = (storage: Pick<Storage, 'setItem'>, scope: string, order: CheckoutOrder) => {
  const snapshot: CheckoutOrder = { id: order.id, status: order.status, total_amount: order.total_amount,
    payment_method: order.payment_method, callback_requested: typeof order.callback_requested === 'boolean' ? order.callback_requested : null, items: order.items.map(itemSnapshot) }
  storage.setItem(key(scope, order.id), JSON.stringify(snapshot))
}

export const readCheckoutConfirmation = (storage: Pick<Storage, 'getItem'>, scope: string, id: number): CheckoutOrder | null => {
  if (!Number.isSafeInteger(id) || id <= 0) return null
  try {
    const value = JSON.parse(storage.getItem(key(scope, id)) || 'null') as CheckoutOrder | null
    if (!value || value.id !== id || typeof value.status !== 'string' || !money(value.total_amount)
      || !Array.isArray(value.items) || !value.items.length || value.items.length > 500) return null
    if (!value.items.every(item => item && Number.isSafeInteger(item.id) && Number.isSafeInteger(item.product_id)
      && typeof item.product_name === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0 && money(item.price))) return null
    return { id: value.id, status: value.status, total_amount: value.total_amount,
      payment_method: text(value.payment_method) || undefined, callback_requested: typeof value.callback_requested === 'boolean' ? value.callback_requested : null, items: value.items.map(itemSnapshot) }
  } catch { return null }
}
