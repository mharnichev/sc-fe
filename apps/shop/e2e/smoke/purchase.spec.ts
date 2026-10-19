import { expect, test } from '@playwright/test'
import {
  TEST_PRODUCT,
  addTestProductFromPdp,
  clearShopStorage,
  fillCheckout,
  goToCheckout,
  installRuntimeDiagnostics,
  createInventoryFixture,
} from '../support/shop'

test.describe('P0 store purchase', () => {
  test('SMOKE-01..07 user can complete the real purchase journey', async ({ page, isMobile }, testInfo) => {
    const inventory = await createInventoryFixture()
    await inventory.setAvailable(TEST_PRODUCT.id, 20)
    const diagnostics = installRuntimeDiagnostics(page)

    try {
      await clearShopStorage(page)
      await expect(page).toHaveTitle(/Atelier Supply/)

      await page.getByRole('link', { name: 'Каталог', exact: true }).last().click()
      await expect(page).toHaveURL(/\/catalog/)
      await expect(page.getByRole('link', { name: TEST_PRODUCT.name }).first()).toBeVisible()

      await addTestProductFromPdp(page)
      await goToCheckout(page)

      const quantity = page.getByRole('spinbutton', { name: `Кількість для ${TEST_PRODUCT.name}` }).last()
      await expect(quantity).toHaveValue('1')
      await page.getByRole('button', { name: 'Збільшити кількість' }).last().click()
      await expect(quantity).toHaveValue('2')
      await expect(page.getByText('700,00 грн', { exact: true }).filter({ visible: true }).last()).toBeVisible()

      await expect(page.getByRole('button', { name: 'ОФОРМИТИ ЗАМОВЛЕННЯ' }).last()).toBeDisabled()
      await fillCheckout(page)
      await page.getByText('Карткою при отриманні', { exact: true }).click()
      await expect(page.getByLabel('Карткою при отриманні')).toBeChecked()

      const orderResponse = page.waitForResponse(response =>
        response.url().endsWith('/api/v1/public/orders')
        && response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: 'ОФОРМИТИ ЗАМОВЛЕННЯ' }).last().click()
      const response = await orderResponse
      expect(response.status()).toBe(201)
      const order = await response.json() as { id: number, total_amount: string, items: Array<{ product_name: string, quantity: number }> }
      inventory.orderIds.push(order.id)
      expect(response.request().postDataJSON().items).toContainEqual({ product_id: TEST_PRODUCT.id, quantity: 2 })
      expect(order.id).toBeGreaterThan(0)
      expect(Number(order.total_amount)).toBe(TEST_PRODUCT.unitPrice * 2)
      expect(order.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ product_name: expect.stringContaining('BlueBeards Revenge'), quantity: 2 }),
      ]))

      const confirmation = page.getByTestId('order-confirmation')
      await expect(confirmation).toBeVisible()
      await expect(confirmation).toContainText('Замовлення успішно оформлено.')
      await expect(page.getByTestId('order-number')).toContainText(String(order.id))
      await expect(page.getByTestId('confirmed-order-items')).toContainText(TEST_PRODUCT.name)
      await expect(page.getByTestId('confirmed-order-total')).toHaveText('700,00 грн')
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
        await page.screenshot({ path: testInfo.outputPath('mobile-smoke-order.png'), fullPage: true })
      }
      diagnostics.assertClean()
    }
    finally {
      await inventory.restore()
    }
  })
})
