import { expect, test } from '@playwright/test'
import {
  cartBadge,
  TEST_PRODUCT, addTestProductFromPdp, clearShopStorage,
  goToCheckout, installRuntimeDiagnostics, waitForNuxtHydration, openCart, selectRealNovaPoshta, createInventoryFixture,
} from '../support/shop'

// Real local backend and real Nova Poshta directories. No request interception.
let inventory: Awaited<ReturnType<typeof createInventoryFixture>>
test.beforeEach(async () => {
  inventory = await createInventoryFixture([1153, 1151])
  await inventory.setAvailable(1153, 10)
  await inventory.setAvailable(1151, 10)
})
test.afterEach(async () => { await inventory?.restore() })

for (const authenticated of [false, true]) {
  for (const scenario of [{ productCount: 1, quantity: 1 }, { productCount: 1, quantity: 2 }, { productCount: 2, quantity: 2 }]) {
    const { productCount, quantity } = scenario
    test(`Nova Poshta: ${authenticated ? 'authenticated' : 'guest'}, ${productCount} distinct products, first SKU quantity ${quantity}`, async ({ page, isMobile }, testInfo) => {
      const diagnostics = installRuntimeDiagnostics(page)
      await clearShopStorage(page)

      if (authenticated) {
        await page.goto('/cabinet')
        await page.getByLabel('ТЕЛЕФОН').fill(`+38067${String(Date.now()).slice(-7)}`)
        const otpResponse = page.waitForResponse(r => r.url().endsWith('/customers/auth/request-otp') && r.request().method() === 'POST')
        await page.getByRole('button', { name: 'НАДІСЛАТИ КОД' }).click()
        const response = await otpResponse
        expect(response.status()).toBe(202)
        const otp = await response.json()
        expect(otp.debug_otp_code).toMatch(/^\d{6}$/)
        await page.getByLabel('OTP КОД').fill(otp.debug_otp_code)
        await expect(page.getByRole('heading', { name: 'Мій акаунт' })).toBeVisible()
        await page.reload()
        await expect(page.getByRole('heading', { name: 'Мій акаунт' })).toBeVisible()
      }

      await addTestProductFromPdp(page)
      if (productCount === 2) {
        await page.goto('/products/pinka-dlia-volossia-reuzel-grooming-tonic-texture-foam-70ml-850064164794')
        await waitForNuxtHydration(page)
        await expect(page.getByRole('heading', { name: 'REUZEL GROOMING TONIC TEXTURE FOAM' })).toBeVisible()
        await page.getByRole('button', { name: 'ДОДАТИ В КОШИК' }).click()
        await expect(cartBadge(page)).toHaveText('2')
      }
      if (quantity === 2) {
        await openCart(page)
        const firstQuantity = page.getByRole('spinbutton', { name: `Кількість для ${TEST_PRODUCT.name}` })
        const item = firstQuantity.locator('..')
        await expect(item.getByRole('button', { name: 'Збільшити кількість' })).toBeEnabled()
        await item.getByRole('button', { name: 'Збільшити кількість' }).click()
        await expect(firstQuantity).toHaveValue('2')
        await expect(page.locator('.basket-sidebar__total strong')).toHaveText(productCount === 2 ? /1\s?184,00 грн/ : '700,00 грн')
        await page.reload()
        await waitForNuxtHydration(page)
      }
      await goToCheckout(page)
      const firstQuantity = page.getByRole('spinbutton', { name: `Кількість для ${TEST_PRODUCT.name}` }).last()
      await expect(firstQuantity).toHaveValue(String(quantity))
      if (quantity === 2) {
        const item = firstQuantity.locator('..')
        const deleted = authenticated
          ? page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith(`/public/customers/cart/${TEST_PRODUCT.id}`))
          : null
        await item.getByRole('button', { name: 'Зменшити кількість' }).click()
        if (deleted) expect((await deleted).status()).toBe(204)
        await expect(firstQuantity).toHaveValue('1')
        await item.getByRole('button', { name: 'Збільшити кількість' }).click()
        await expect(firstQuantity).toHaveValue('2')
        await page.reload()
        await waitForNuxtHydration(page)
        await expect(firstQuantity).toHaveValue('2')
      }
      await expect(page.locator('.checkout-total strong').filter({ visible: true }).last()).toHaveText(productCount === 2 ? /1\s?184,00 грн/ : quantity === 2 ? '700,00 грн' : '350,00 грн')
      await expect(page.getByRole('button', { name: 'ОФОРМИТИ ЗАМОВЛЕННЯ' }).last()).toBeDisabled()
      await page.getByLabel('ІМʼЯ').fill('E2E')
      await page.getByLabel('ПРІЗВИЩЕ').fill('Customer')
      await page.getByLabel('EMAIL').fill('e2e@example.com')
      if (!authenticated) await page.getByLabel('ТЕЛЕФОН').fill('+380990001234')
      const { city, branch } = await selectRealNovaPoshta(page)

      const orderResponse = page.waitForResponse(r => r.url().endsWith('/api/v1/public/orders') && r.request().method() === 'POST')
      await page.getByRole('button', { name: 'ОФОРМИТИ ЗАМОВЛЕННЯ' }).last().click()
      const response = await orderResponse
      expect(response.status()).toBe(201)
      const order = await response.json()
      inventory.orderIds.push(order.id)
      const payload = response.request().postDataJSON()
      expect(Boolean(response.request().headers().authorization)).toBe(authenticated)
      expect(payload).toMatchObject({ shippingCompany: 'novaPost', shippingMethod: 'warehouse', shippingCity: 'Одеса', shippingWarehouseNumber: branch.number })
      expect(payload.items).toHaveLength(productCount)
      expect(payload.items).toContainEqual({ product_id: TEST_PRODUCT.id, quantity })
      expect(payload).toMatchObject({ shippingSettlementRef: city.ref, shippingWarehouseRef: branch.ref })
      console.info(`Created local order #${order.id}: ${authenticated ? 'authenticated' : 'guest'}, ${productCount} products; Nova Poshta ${city.label}, ${branch.label}`)
      expect(order.items).toHaveLength(productCount)
      expect(order.items).toEqual(expect.arrayContaining([expect.objectContaining({ product_id: TEST_PRODUCT.id, quantity })]))
      if (productCount === 2) {
        expect(payload.items).toContainEqual({ product_id: 1151, quantity: 1 })
        expect(order.items).toEqual(expect.arrayContaining([expect.objectContaining({ product_id: 1151, quantity: 1 })]))
      }
      expect(Number(order.total_amount)).toBe(350 * quantity + (productCount === 2 ? 484 : 0))
      await expect(page.getByTestId('order-confirmation')).toBeVisible()
      await expect(page.getByTestId('order-number')).toContainText(String(order.id))
      await expect(cartBadge(page)).toHaveCount(0)

      if (isMobile) {
        expect(page.viewportSize()!.width).toBeLessThan(768)
        await expect(page.getByTestId('order-number')).toBeInViewport({ ratio: 1 })
        await expect(page.getByTestId('order-number')).toBeFocused()
        await expect(page.locator('.checkout-page__success')).toBeInViewport({ ratio: 1 })
        const confirmationViewport = await page.getByTestId('order-number').evaluate(element => {
          const rect = element.getBoundingClientRect()
          return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight, scrollY, inViewport: rect.bottom > 0 && rect.top < innerHeight }
        })
        console.info('Mobile confirmation viewport:', JSON.stringify(confirmationViewport))
        await testInfo.attach('mobile-confirmation-viewport', { body: JSON.stringify(confirmationViewport), contentType: 'application/json' })
        await page.screenshot({ path: testInfo.outputPath('mobile-order-confirmation.png'), fullPage: true })
      }
      if (authenticated) {
        await page.goto('/cabinet/purchase-history')
        await expect(page.getByRole('link').filter({ hasText: `#${order.id}` })).toBeVisible()
      }
      diagnostics.assertClean()
    })
  }
}
