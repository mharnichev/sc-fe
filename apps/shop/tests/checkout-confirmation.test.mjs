import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { sourceModule } from './runtime-localization-harness.mjs'
const { readCheckoutConfirmation, saveCheckoutConfirmation } = await sourceModule(await readFile(new URL('../utils/checkoutConfirmation.ts', import.meta.url), 'utf8'))
const memory = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } }
const order = { id: 987, status: 'pending', total_amount: '210.00', payment_method: 'onlineCard', guest_payment_token: 'secret-capability', customer: { phone: 'private' }, payment_status: 'paid_provider', fiscal_status: 'issued', items: [{ id: 1, product_id: 123, product_name: 'Historical name', product_name_en: 'Historical name EN', product_image_url: '/media/order-image.webp', product_variant: '100 ml', product_sku: 'SKU-SNAPSHOT', quantity: 2, price: '110.00', total_price: '210.00' }] }
for (const scope of ['guest', 'customer:42']) test(`${scope}: receipt reload retains immutable returned items and totals, excludes contacts/capabilities/payment projections`, () => {
 const storage = memory(); saveCheckoutConfirmation(storage, scope, order)
 const restored = readCheckoutConfirmation(storage, scope, 987)
 assert.deepEqual(restored.items, order.items)
 assert.equal(restored.total_amount, '210.00')
 assert.equal(restored.items[0].price, '110.00') // server total may reflect a discount; never recalculate over it
 assert.equal(restored.items[0].total_price, '210.00')
 const raw = [...storage.values.values()][0]
 for (const forbidden of ['guest_payment_token', 'secret-capability', 'customer', 'phone', 'payment_status', 'paid_provider', 'fiscal_status']) assert.ok(!raw.includes(forbidden), forbidden)
 assert.equal(readCheckoutConfirmation(storage, scope === 'guest' ? 'customer:42' : 'customer:43', 987), null)
 assert.equal(readCheckoutConfirmation(storage, scope, 988), null)
})
test('invalid receipt identity/price/quantity never restores a different or malformed order', () => {
 for (const change of [{ id: 988 }, { total_amount: 'NaN' }, { items: [] }, { items: [{ ...order.items[0], quantity: -1 }] }, { items: [{ ...order.items[0], price: 'catalog-price' }] }]) {
  const storage = memory(); storage.setItem('shop-checkout-confirmation-v1:guest:987', JSON.stringify({ ...order, ...change }))
  assert.equal(readCheckoutConfirmation(storage, 'guest', 987), null)
 }
 for (const id of [0, -1, NaN, Infinity, 1.5]) assert.equal(readCheckoutConfirmation(memory(), 'guest', id), null)
})
test('historical items without photo/variant retain snapshot price and explicit missing image', () => {
 const storage = memory();saveCheckoutConfirmation(storage, 'guest', { ...order, items: [{ id: 1, product_id: 123, product_name: 'Old item', quantity: 1, price: '75.00' }] })
 const item = readCheckoutConfirmation(storage, 'guest', 987).items[0]
 assert.equal(item.product_image_url, null); assert.equal(item.product_variant, null); assert.equal(item.price, '75.00'); assert.equal(item.total_price, null)
})

test('callback preference survives receipt reload without inventing a historical choice', () => {
 for (const callback_requested of [true, false, null, undefined]) {
  const storage = memory();saveCheckoutConfirmation(storage, 'guest', { ...order, callback_requested })
  assert.equal(readCheckoutConfirmation(storage, 'guest', 987).callback_requested, typeof callback_requested === 'boolean' ? callback_requested : null)
 }
})
