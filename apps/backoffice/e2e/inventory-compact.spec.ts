import { expect, test } from '@playwright/test'

// The local dev server compiles inventory routes on first access.
test.setTimeout(60_000)

const user = { id: 5, email: 'compact@example.test', role: 'admin', is_superuser: true, is_active: true, can_post_inventory: true }
const product = { id: 42, name: 'Шампунь для щоденного догляду', sku: 'SHAMPOO-250', barcode: '0012345678905', price: '100.00', on_hand: 3, reserved: 1, available: 2, stock_quantity: 3, reserved_quantity: 1, available_quantity: 2, allow_backorder: false, is_active: true, images: [] }
const receipt = { id: 12, reason: 'Поставка товару', comment: null, status: 'draft', created_at: '2026-10-17T07:00:00Z', updated_at: '2026-10-17T07:00:00Z', posted_at: null, items: [{ id: 1, product_id: 42, barcode: product.barcode, quantity: 2, purchase_unit_cost: '10.00', allocations: [] }] }
const routes = ['/inventory', '/inventory/procurement', '/inventory/receiving', '/inventory/receiving?id=12', '/inventory/counts', '/inventory/counts?id=15', '/inventory/movements?product_id=42', '/inventory/operations']

test.beforeEach(async ({ page }) => {
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'compact-test', user })), user)
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue()
    const path = new URL(route.request().url()).pathname
    if (!path.includes('/backoffice/')) return route.continue()
    let body: unknown = { total: 0, items: [] }
    if (path.endsWith('/auth/me')) body = user
    else if (path.endsWith('/procurement')) body = [{ product_id: 42, product_name: product.name, sku: product.sku, barcode: product.barcode, total_quantity_required: 2, requirements: [{ order_id: 1, order_item_id: 2, quantity_required: 2, quantity_ordered: 0, quantity_received: 0, procurement_status: 'to_order' }] }]
    else if (path.endsWith('/stock')) body = { total: 1, page: 1, page_size: 20, items: [product] }
    else if (path.endsWith('/receipts')) body = { total: 1, page: 1, page_size: 20, items: [receipt] }
    else if (path.endsWith('/receipts/12')) body = receipt
    else if (path.endsWith('/counts/15')) body = { ...receipt, id: 15, reason: 'Інвентаризація', items: [{ id: 1, product_id: 42, barcode: product.barcode, expected_quantity: 3, counted_quantity: 4, difference: 1 }] }
    else if (path.endsWith('/movements')) body = { total: 1, page: 1, page_size: 30, items: [{ id: 1, product_id: 42, movement_type: 'receipt', quantity: 2, on_hand_delta: 2, reserved_delta: 0, reason: 'Поставка', created_at: receipt.created_at }] }
    else if (path.endsWith('/products/42')) body = product
    else if (path.endsWith('/orders/1')) body = { id: 1, customer_name: 'Тестовий клієнт', items: [{ id: 2, quantity: 2, quantity_from_stock: 0 }] }
    await route.fulfill({ json: body })
  })
})

for (const width of [320, 390]) {
  for (const path of routes) {
    test(`compact ${width}px ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(path)
      await expect(page.locator('.inventory-page h1')).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('.inventory-page .base-card').first()).toBeVisible()
      if (path === '/inventory/procurement') {
        await page.getByRole('button', { name: 'Позиції', exact: true }).click()
        await expect(page.getByText('Замовлення #1', { exact: false }).first()).toBeVisible()
      }
      if (path === '/inventory/receiving?id=12') await page.locator('summary').filter({ hasText: 'Партія та термін придатності' }).click()
      if (path === '/inventory/operations') await page.locator('summary').filter({ hasText: 'Зв’язок із замовленням' }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const metrics = await page.locator('.inventory-page').evaluate(root => {
        const visible = (el: Element) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
        const card = root.querySelector('.base-card')!
        const inputs = [...root.querySelectorAll('input:not([type=checkbox]):not([type=radio]), .base-select__trigger')].filter(visible)
        const buttons = [...root.querySelectorAll('.base-button')].filter(visible)
        const height = root.getBoundingClientRect().height
        root.classList.remove('inventory-page')
        const spaciousHeight = root.getBoundingClientRect().height
        root.classList.add('inventory-page')
        return {
          heading: getComputedStyle(root.querySelector('h1')!).fontSize,
          padding: getComputedStyle(card).paddingTop,
          inputs: inputs.map(el => ({ font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height })),
          buttons: buttons.map(el => el.getBoundingClientRect().height),
          height, spaciousHeight,
        }
      })
      expect(metrics.heading).toBe('20px')
      expect(metrics.padding).toBe('10px')
      for (const input of metrics.inputs) { expect(input.font).toBeGreaterThanOrEqual(16); expect(input.height).toBeGreaterThanOrEqual(44) }
      for (const height of metrics.buttons) expect(height).toBeGreaterThanOrEqual(44)
      expect(metrics.height).toBeLessThan(metrics.spaciousHeight)
      if (width === 390) await page.screenshot({ path: `/tmp/inventory-compact-${path.replace(/[^a-z0-9]/gi, '-')}.png`, fullPage: true })
    })
  }
}

test('desktop inventory keeps its spacious sizing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/inventory/receiving?id=12')
  await expect(page.locator('.inventory-page .base-card').first()).toBeVisible()
  expect(await page.locator('.inventory-page h1').evaluate(el => getComputedStyle(el).fontSize)).toBe('30px')
  expect(await page.locator('.inventory-page .base-card').first().evaluate(el => getComputedStyle(el).paddingTop)).toBe('16px')
})

test('inventory field help opens by tap, preserves labels, closes on Escape and outside press', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/inventory/receiving')
  const field = page.getByRole('textbox', { name: 'Причина', exact: true })
  await expect(field).toBeVisible()
  const help = page.getByRole('button', { name: 'Пояснення: Причина', exact: true })
  await help.click()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toContainText('Назва поставки')
  await expect(help).toHaveAttribute('aria-expanded', 'true')
  await expect(help).toBeFocused()
  const box = await tooltip.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Escape')
  await expect(tooltip).toBeHidden()
  await help.click()
  await expect(tooltip).toBeVisible()
  await page.getByRole('heading', { name: 'Приймання товару', exact: true }).click()
  await expect(tooltip).toBeHidden()
  const describedBy = await field.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveClass(/sr-only/)
  expect(await field.inputValue()).toBe('Поставка товару')
  await page.screenshot({ path: '/tmp/inventory-field-help-mobile.png', fullPage: true })
})

test('inventory help supports mouse hover and keyboard focus on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/inventory')
  const help = page.getByRole('button', { name: 'Пояснення: Є на складі', exact: true })
  await help.hover()
  await expect(page.getByRole('tooltip')).toContainText('включно з резервом')
  await page.mouse.move(0, 0)
  await expect(page.getByRole('tooltip')).toBeHidden()
  await help.focus()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toBeHidden()
})

