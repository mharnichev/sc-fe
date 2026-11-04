import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`selection, photo gallery and editable review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const user = { id: 5, role: 'admin', is_superuser: true, is_active: true, can_post_inventory: true }
    const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="teal"/></svg>')
    const product = { id: 42, name: 'Test shampoo', sku: 'PHOTO', package_size: '250 мл', purchase_unit_cost: '19.75', barcode: '123', on_hand: 4, reserved: 0, available: 4, allow_backorder: false, display_image_urls: [photo, photo + '#second'] }
    const draft = { id: 12, reason: 'Test receipt', status: 'draft', items: [], created_at: '2026-11-03T00:00:00Z', posted_at: null }
    let added: Record<string, unknown> | undefined
    await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'test', user })), user)
    await page.route('**/*', async route => {
      const request = route.request()
      if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue()
      const path = new URL(request.url()).pathname
      if (path.endsWith('/public/masters')) return route.fulfill({ json: [] })
      if (!path.includes('/backoffice/')) return route.continue()
      if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
      if (path.endsWith('/receipts/12/items')) {
        added = request.postDataJSON()
        return route.fulfill({ json: { ...draft, items: [{ id: 1, ...added, allocations: [] }] } })
      }
      if (path.endsWith('/receipts/12')) return route.fulfill({ json: draft })
      if (path.endsWith('/stock')) return route.fulfill({ json: { items: [product], total: 1 } })
      if (path.endsWith('/products/42')) return route.fulfill({ json: product })
      return route.fulfill({ json: { items: [], total: 0 } })
    })
    await page.goto('/inventory/receiving?id=12')
    await page.getByLabel('Назва або артикул', { exact: true }).fill('shampoo')
    await page.getByRole('button', { name: 'Пошук', exact: true }).click()
    await page.getByRole('button', { name: 'Переглянути всі фото: Test shampoo' }).click()
    const gallery = page.getByRole('dialog', { name: 'Фото: Test shampoo' })
    await expect(gallery).toBeVisible()
    await gallery.getByRole('button', { name: 'Фото 2', exact: true }).click()
    await expect(gallery.getByRole('img', { name: 'Test shampoo — фото 2' })).toBeVisible()
    await gallery.getByRole('button', { name: 'Закрити' }).click()
    await expect(page.getByText('Об’єм / упаковка: 250 мл', { exact: true })).toBeVisible()
    const choose = page.getByRole('button', { name: 'Вибрати цей товар', exact: true })
    expect(await choose.evaluate(button => Math.abs(button.getBoundingClientRect().width - button.closest('article')!.getBoundingClientRect().width) < 2)).toBe(true)
    await choose.click()
    await expect(page.getByRole('button', { name: 'Вибрано ✓', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.locator('.inventory-receipt-quantity-fields').evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return bounds.top >= 0 && bounds.bottom <= window.innerHeight
    })).toBe(true)
    await expect(page.getByRole('spinbutton', { name: 'Закупівля, грн/од. (Закупівельна вартість за одиницю, грн)', exact: true })).toHaveValue('19.75')
    await page.getByRole('button', { name: 'Перевірити та додати' }).click()
    const review = page.getByRole('dialog', { name: 'Перевірка позиції' })
    await review.getByLabel('Кількість, од.', { exact: true }).fill('3')
    await review.getByLabel('Закупівля за одиницю, грн', { exact: true }).fill('25.50')
    await expect(review.getByText('Разом: 76.50 грн')).toBeVisible()
    await expect(review).toHaveCSS('opacity', '1')
    await page.screenshot({ animations: 'disabled', path: `/tmp/inventory-review-${width}.png` })
    await review.getByRole('button', { name: 'Додати до приймання', exact: true }).click()
    await expect(review).toBeHidden()
    const items = width < 768 ? page.locator('div[aria-label="Позиції приймання"]') : page.getByRole('table', { name: 'Позиції приймання', exact: true })
    await expect(items.getByText('Test shampoo', { exact: true })).toBeVisible()
    await expect(items.getByText('76.50 грн', { exact: true })).toBeVisible()
    await items.getByRole('button', { name: 'Переглянути всі фото: Test shampoo' }).click()
    await expect(gallery).toBeVisible()
    await gallery.getByRole('button', { name: 'Фото 2', exact: true }).click()
    await expect(gallery.getByRole('img', { name: 'Test shampoo — фото 2' })).toBeVisible()
    await gallery.getByRole('button', { name: 'Закрити' }).click()
    await items.screenshot({ path: `/tmp/inventory-items-${width}.png`, animations: 'disabled' })
    expect(added).toMatchObject({ product_id: 42, quantity: 3, purchase_unit_cost: '25.50' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
