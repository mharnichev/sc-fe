import { expect, test } from '@playwright/test'

// Every API request is intercepted. These tests never create backend orders or touch inventory.
const body = {
  firstName: 'Fixture', lastName: 'Customer', email: 'fixture@example.test', phoneNumber: '+380990000001',
  shippingCompany: 'novaPost', shippingMethod: 'warehouse', shippingArea: 'Test', shippingCity: 'Test',
  shippingWarehouseNumber: '1', shippingStreet: '', buildingNumber: '', shippingApartment: '',
  paymentMethod: 'cashOnDelivery', comment: '', items: [{ product_id: 123, quantity: 1 }],
  shippingSettlementRef: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  shippingWarehouseRef: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
}
const key = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

test('uncertain checkout survives reload and retries exact intent without a cart', async ({ page }) => {
  let attempts = 0
  const requests: Array<{ key: string | undefined, body: unknown }> = []
  await page.route('**/api/v1/**', async route => {
    if (route.request().url().endsWith('/public/orders') && route.request().method() === 'POST') {
      requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
      attempts++
      if (attempts === 1) { await route.fulfill({ status: 503, json: { detail: 'unknown outcome' } }); return }
      await route.fulfill({ status: 201, json: {
        id: 987, total_amount: '100.00', status: 'pending', payment_status: 'unpaid',
        fulfillment_status: 'reserved', fiscal_status: 'not_requested', items: [{ id: 1, product_name: 'Fixture', quantity: 1 }],
        preliminary_documents: [{ id: 1, number: 'SC-987-1', version: 1, document_kind: 'preliminary', created_at: '2026-10-17T00:00:00Z', print_url: '/api/v1/public/order-documents/safe-token' }],
      } }); return
    }
    if (route.request().url().endsWith('/public/order-documents/safe-token')) {
      expect(route.request().headers().authorization).toBeUndefined()
      await route.fulfill({ contentType: 'text/html', body: '<html><body><h1>SC-987-1</h1><p>Попереднє замовлення. Не є фіскальним чеком</p></body></html>' }); return
    }
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/checkout/purchase')
  await page.evaluate(({ key, body }) => {
    sessionStorage.setItem('shop-checkout-intent-v1', JSON.stringify({ key, body, scope: 'guest' }))
    const product = { id: 123, name: 'Fixture', price: '100.00', slug: 'fixture', images: [], brand: { name: 'Fixture' }, stock_quantity: 10, is_available_for_purchase: true, is_effectively_visible: true }
    localStorage.setItem('shop-cart', JSON.stringify({ items: [{ product, quantity: 2 }, { product: { ...product, id: 456, name: 'Added after timeout' }, quantity: 1 }] }))
  }, { key, body })
  await page.reload()
  await page.getByRole('button', { name: 'Перевірити / повторити попереднє замовлення' }).click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  expect(attempts).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'Перевірити / повторити попереднє замовлення' }).click()
  await expect(page.getByTestId('order-confirmation')).toBeVisible()
  await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Попереднє замовлення. Не є фіскальним чеком', { exact: true })).toBeVisible()
  expect(requests).toEqual([{ key, body }, { key, body }])
  expect(await page.evaluate(() => sessionStorage.getItem('shop-checkout-intent-v1'))).toBeNull()
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('shop-cart') || '{}').items?.map((item: { product: { id: number }, quantity: number }) => [item.product.id, item.quantity]))).toEqual([[123, 2], [456, 1]])
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'SC-987-1 · версія 1 · Перегляд / друк' }).click()
  const popup = await popupPromise
  await expect(popup.getByRole('heading', { name: 'SC-987-1' })).toBeVisible()
  await expect(popup.getByText('Попереднє замовлення. Не є фіскальним чеком')).toBeVisible()

})


test('authenticated pending intent restores after persisted auth hydration and survives 401', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/public/orders') && route.request().method() === 'POST') {
      attempts++
      expect(route.request().headers()['idempotency-key']).toBe(key)
      await route.fulfill({ status: 401, json: { detail: 'expired fixture credential' } }); return
    }
    if (path.endsWith('/public/customers/me')) { await route.fulfill({ json: { id: 42, name: 'Fixture', phone: '+380990000001' } }); return }
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/checkout/purchase')
  await page.evaluate(({ key, body }) => {
    sessionStorage.setItem('shop-checkout-intent-v1', JSON.stringify({ key, body, scope: 'customer:42' }))
    localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'fixture-only', tokenType: 'Bearer', customer: { id: 42, name: 'Fixture', phone: '+380990000001' } }))
  }, { key, body })
  await page.reload()
  const retry = page.getByRole('button', { name: 'Перевірити / повторити попереднє замовлення' })
  await expect(retry).toBeVisible()
  await retry.click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  expect(attempts).toBe(1)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('shop-checkout-intent-v1') || '{}').key)).toBe(key)
  await page.reload()
  await expect(retry).toBeVisible()
})


for (const conclusive of [true, false]) {
  test(`409 ${conclusive ? 'stock rejection allows a corrected intent' : 'idempotency conflict preserves intent'}`, async ({ page }) => {
    await page.route('**/api/v1/**', async route => {
      if (route.request().url().endsWith('/public/orders') && route.request().method() === 'POST') {
        await route.fulfill({ status: 409, json: { detail: conclusive ? 'Insufficient stock for product 123; backorders are disabled' : { code: 'idempotency_conflict', message: 'Different payload' } } }); return
      }
      await route.fulfill({ json: { items: [], total: 0 } })
    })
    await page.goto('/checkout/purchase')
    await page.evaluate(({ key, body }) => sessionStorage.setItem('shop-checkout-intent-v1', JSON.stringify({ key, body, scope: 'guest' })), { key, body })
    await page.reload()
    const retry = page.getByRole('button', { name: 'Перевірити / повторити попереднє замовлення' })
    await retry.click()
    await expect(page.getByRole('alert').first()).toBeVisible()
    if (conclusive) {
      await expect(retry).toHaveCount(0)
      expect(await page.evaluate(() => sessionStorage.getItem('shop-checkout-intent-v1'))).toBeNull()
    }
    else {
      await expect(retry).toBeVisible()
      expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('shop-checkout-intent-v1') || '{}').key)).toBe(key)
    }
  })
}
