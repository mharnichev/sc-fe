import { expect, test } from '@playwright/test'

// All API requests are intercepted; unknown mutations fail the test.
const customer = { id: 42, name: 'Synthetic', surname: 'Customer', phone: '+380990001234' }
const product = { id: 123, name: 'Mock pomade', slug: 'mock-pomade', price: '100.00', images: [], brand: { id: 1, name: 'Mock', slug: 'mock' }, stock: 10, is_available_for_purchase: true, is_effectively_visible: true, hidden_reason: null }
const city = { ref: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', city_ref: null, name: 'Київ', label: 'Київ, тестова область', area: 'Тестова', region: '', delivery_available: true }
const branch = { ref: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', settlement_ref: city.ref, city_ref: null, number: '1', label: 'Тестове відділення №1', name: 'Тестове відділення №1', address: 'Тестова, 1', type: 'warehouse', status: 'Working' }

for (const authenticated of [false, true]) {
 for (const courier of [false, true]) {
  test(`${authenticated ? 'customer' : 'guest'} ${courier ? 'courier/card-on-delivery' : 'branch/cash-on-delivery'} completes checkout with canonical delivery and unpaid preliminary document`, async ({ page }) => {
    const posts: Array<{ body: Record<string, unknown>, key?: string }> = []
    let ordered = false
    await page.route('https://**', route => route.abort())
    await page.addInitScript(({ product, customer, authenticated }) => {
      localStorage.setItem('shop-cart', JSON.stringify({ items: [{ product, quantity: 2 }] }))
      if (authenticated) localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'mock-customer-only', tokenType: 'Bearer', customer }))
    }, { product, customer, authenticated })
    await page.route('**/api/v1/**', async route => {
      const req = route.request()
      const path = new URL(req.url()).pathname
      if (path.endsWith('/public/orders') && req.method() === 'POST') {
        expect(req.headers().authorization).toBe(authenticated ? 'Bearer mock-customer-only' : undefined)
        posts.push({ body: req.postDataJSON(), key: req.headers()['idempotency-key'] })
        ordered = true
        await route.fulfill({ status: 201, json: {
          id: 987, total_amount: '180.00', subtotal_amount: '200.00', discount_amount: '20.00', status: 'pending',
          payment_status: 'unpaid', payment_method: courier ? 'cardOnDelivery' : 'cashOnDelivery', fulfillment_status: 'reserved', fiscal_status: 'not_requested',
          items: [{ id: 1, product_id: 123, product_name: product.name, quantity: 2, price: '90.00', total_price: '180.00' }],
          preliminary_documents: [{ id: 1, number: 'SC-987-1', version: 1, document_kind: 'preliminary', created_at: '2026-10-18T00:00:00Z', print_url: '/api/v1/public/order-documents/mock-only' }],
        } }); return
      }
      expect(req.method(), `Unexpected mutation ${path}`).toBe('GET')
      if (path.endsWith('/customers/me')) { await route.fulfill({ json: customer }); return }
      if (path.endsWith('/customers/cart')) { await route.fulfill({ json: { items: ordered ? [] : [{ id: 1, product_id: 123, product, quantity: 2 }], total: ordered ? 0 : 1 } }); return }
      if (path.endsWith('/np/settlements')) { await route.fulfill({ json: { items: [city], cached: true, stale: false } }); return }
      if (path.endsWith('/np/streets')) { await route.fulfill({ json: { items: [{ ref: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Тестова', label: 'вул. Тестова' }], cached: true, stale: false } }); return }
      if (path.endsWith('/np/branches')) { await route.fulfill({ json: { items: [branch], cached: true, stale: false } }); return }
      await route.fulfill({ json: { items: [], total: 0 } })
    })
    await page.goto('/checkout/purchase')
    await expect(page.getByRole('heading', { name: product.name }).last()).toBeVisible()
    await page.getByLabel('ІМʼЯ').fill('Synthetic')
    await page.getByLabel('ПРІЗВИЩЕ').fill('Customer')
    await page.getByLabel('ТЕЛЕФОН').fill(customer.phone)
    await page.getByRole('button', { name: 'Київ', exact: true }).click()
    await expect(page.getByRole('combobox', { name: /^Місто$/i })).toHaveValue(city.label)
    if (courier) {
      await page.locator('label[for=shipping-method-courier]').click()
      await page.getByRole('combobox', { name: /^Вулиця$/i }).fill('Тес')
      await page.getByRole('option', { name: 'вул. Тестова' }).click()
      await page.getByRole('textbox', { name: /^Будинок/i }).fill('12')
      await page.locator('label[for=payment-method-cardOnDelivery]').click()
    }
    else {
      await page.getByRole('combobox', { name: /^Відділення$/i }).focus()
      await page.getByRole('option', { name: branch.label }).click()
    }
    const submit = page.getByRole('button', { name: 'ОФОРМИТИ ЗАМОВЛЕННЯ' }).last()
    await expect(submit).toBeEnabled()
    // Desktop button must honor the same native validation as mobile form submission.
    await page.getByLabel('Email', { exact: true }).fill('invalid-email')
    await submit.click()
    expect(posts).toHaveLength(0)
    expect(await page.locator('input[type=email]').evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true)
    await page.getByLabel('Email', { exact: true }).fill('synthetic@example.test')
    await submit.click()
    await expect(page.getByTestId('order-confirmation')).toBeVisible()
    await expect(page.getByTestId('confirmed-order-total')).toContainText('180')
    await expect(page.getByText('Попереднє замовлення. Не є фіскальним чеком', { exact: true })).toBeVisible()
    expect(posts).toHaveLength(1)
    expect(posts[0]!.key).toMatch(/^[a-f0-9-]{36}$/i)
    expect(posts[0]!.body).toMatchObject({ items: [{ product_id: 123, quantity: 2 }], shippingSettlementRef: city.ref, shippingMethod: courier ? 'courier' : 'warehouse', paymentMethod: courier ? 'cardOnDelivery' : 'cashOnDelivery' })
    if (courier) expect(posts[0]!.body).toMatchObject({ shippingStreetRef: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', buildingNumber: '12' })
    else expect(posts[0]!.body.shippingWarehouseRef).toBe(branch.ref)
    expect(posts[0]!.body).not.toHaveProperty('total_amount')
    expect(await page.evaluate(() => sessionStorage.getItem('shop-checkout-intent-v1'))).toBeNull()
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shop-cart') || '{}').items)).toEqual([])
    if (authenticated) {
      await page.evaluate(() => {
        const app = (document.querySelector('#__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { logout: () => void }> } } } } }).__vue_app__
        app.config.globalProperties.$pinia._s.get('customer-auth')!.logout()
      })
      await expect(page.getByTestId('order-confirmation')).toHaveCount(0)
      await expect(page.getByLabel('ІМʼЯ')).toHaveValue('')
      await expect(page.getByLabel('ПРІЗВИЩЕ')).toHaveValue('')
      await expect(page.getByLabel('Email', { exact: true })).toHaveValue('')
      await expect(page.getByRole('combobox', { name: /^Місто$/i })).toHaveValue('')
    }
  })
}
}
