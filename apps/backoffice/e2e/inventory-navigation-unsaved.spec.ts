import { expect, test, type Page } from '@playwright/test'

const user = { id: 5, email: 'inventory-ui@example.test', role: 'admin', is_superuser: true, is_active: true, can_post_inventory: true }
const product = { id: 42, name: 'Test Shampoo', sku: 'SH-42', barcode: '0012345678905', price: '100.00', on_hand: 3, reserved: 0, available: 3, stock_quantity: 3, reserved_quantity: 0, available_quantity: 3, allow_backorder: false, is_active: true, images: [] }
const receiptDocument = (id: number) => ({ id, reason: 'Поставка товару', comment: null, status: 'draft', created_at: '2026-10-17T07:00:00Z', updated_at: '2026-10-17T07:00:00Z', posted_at: null, items: [] })
async function setup(page: Page) {
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'ui-test', user })), user)
  await page.route('**/*', async route => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue()
    const url = new URL(route.request().url())
    if (!url.pathname.includes('/backoffice/')) return route.continue()
    const path = url.pathname
    let body: unknown = { total: 0, page: 1, page_size: 20, items: [] }
    if (path.endsWith('/auth/me')) body = user
    else if (path.endsWith('/procurement')) body = []
    else if (path.includes('/products/barcode/') || path.endsWith('/products/42')) body = product
    else if (path.endsWith('/products')) body = { total: 1, page: 1, page_size: 20, items: [product] }
    else if (path.endsWith('/receipts') && route.request().method() === 'POST') body = receiptDocument(12)
    else if (path.endsWith('/counts') && route.request().method() === 'POST') body = { ...receiptDocument(15), reason: 'Інвентаризація' }
    else if (path.endsWith('/counts/15/items')) body = { ...receiptDocument(15), items: [{ id: 1, product_id: 42, barcode: product.barcode, expected_quantity: null, counted_quantity: 4, difference: null }] }
    else if (path.endsWith('/counts/15')) body = { ...receiptDocument(15), reason: 'Інвентаризація' }
    else if (/\/receipts\/\d+$/.test(path)) body = receiptDocument(Number(path.split('/').pop()))
    else if (path.endsWith('/receipts/12/items')) body = { ...receiptDocument(12), items: [{ id: 1, product_id: 42, barcode: product.barcode, quantity: 2, purchase_unit_cost: '10.00', allocations: [] }] }
    await route.fulfill({ json: body })
  })
}
const nav = (page: Page) => page.getByRole('navigation', { name: 'Розділи складу' })
const warning = (page: Page) => page.getByRole('heading', { name: 'Залишити сторінку?' })

test.beforeEach(async ({ page }) => { await setup(page) })

test('mobile tabs scroll horizontally and camera stays beside barcode field', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/inventory/receiving?id=12')
  await expect(nav(page).getByRole('link')).toHaveCount(6)
  await expect(nav(page).getByRole('link', { name: /^Приймання/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Розділ складу' })).toHaveCount(0)
  const camera = page.getByRole('button', { name: 'Сканувати', exact: true })
  await expect(camera).toBeVisible()
  expect((await camera.innerText()).trim()).toBe('')
  const [inputBox, cameraBox] = await Promise.all([page.getByRole('textbox', { name: 'Штрихкод', exact: true }).boundingBox(), camera.boundingBox()])
  expect(inputBox).toBeTruthy(); expect(cameraBox).toBeTruthy()
  expect(Math.abs(inputBox!.y - cameraBox!.y)).toBeLessThanOrEqual(3)
  expect(cameraBox!.x).toBeGreaterThan(inputBox!.x)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const scrolls = await nav(page).evaluate(el => el.scrollWidth > el.clientWidth)
  expect(scrolls).toBe(true)
  await page.screenshot({ path: '/tmp/inventory-tabs-camera-mobile.png' })
  await nav(page).getByRole('link', { name: /^Операції/ }).click()
  await expect(page).toHaveURL(/\/inventory\/operations$/)
  await expect(nav(page).getByRole('link', { name: /^Операції/ })).toBeInViewport()
})

test('new receipt warns on tab navigation, Escape/cancel retain fields, confirm leaves', async ({ page }) => {
  await page.goto('/inventory/receiving')
  await page.getByLabel('Причина', { exact: true }).fill('Незбережена поставка')
  await nav(page).getByRole('link', { name: /^Інвентаризація/ }).click()
  await expect(warning(page)).toBeVisible()
  await expect(page).toHaveURL(/\/inventory\/receiving$/)
  await page.keyboard.press('Escape')
  await expect(warning(page)).toBeHidden()
  await expect(page.getByLabel('Причина', { exact: true })).toHaveValue('Незбережена поставка')
  await nav(page).getByRole('link', { name: /^Інвентаризація/ }).click()
  await page.getByRole('button', { name: 'Залишитися', exact: true }).click()
  await expect(page.getByLabel('Причина', { exact: true })).toHaveValue('Незбережена поставка')
  await nav(page).getByRole('link', { name: /^Інвентаризація/ }).click()
  await page.getByRole('button', { name: 'Вийти без збереження', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory\/counts$/)
})

test('creating a receipt permits its ID update and saved draft leaves without warning', async ({ page }) => {
  await page.goto('/inventory/receiving')
  await page.getByLabel('Причина', { exact: true }).fill('Збережена поставка')
  await page.getByRole('button', { name: 'Створити чернетку', exact: true }).click()
  await expect(page).toHaveURL(/id=12/)
  await expect(warning(page)).toBeHidden()
  await nav(page).getByRole('link', { name: /^Залишки/ }).click()
  await expect(page).toHaveURL(/\/inventory$/)
})

test('receipt item edits warn on returning to list; saving the item clears warning', async ({ page }) => {
  await page.goto('/inventory/receiving?id=12')
  await page.getByLabel('Кількість', { exact: true }).fill('2')
  await page.getByRole('link', { name: '← До списку приймань' }).click()
  await expect(warning(page)).toBeVisible()
  await page.getByRole('button', { name: 'Залишитися', exact: true }).click()
  await page.getByRole('textbox', { name: 'Штрихкод', exact: true }).fill(product.barcode)
  await page.getByRole('textbox', { name: 'Штрихкод', exact: true }).press('Enter')
  await expect(page.getByText('Знайдено:', { exact: false })).toBeVisible()
  await page.getByRole('spinbutton', { name: /Закупівля, грн/ }).fill('10')
  await page.getByRole('button', { name: 'Додати до приймання', exact: true }).click()
  await expect(page.getByText('Позицію додано.', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: '← До списку приймань' }).click()
  await expect(page).toHaveURL(/\/inventory\/receiving$/)
  await expect(warning(page)).toBeHidden()
})

test('counted quantity warns on browser back and confirmation resumes back navigation', async ({ page }) => {
  await page.goto('/inventory/movements')
  await nav(page).getByRole('link', { name: /^Інвентаризація/ }).click()
  await page.getByRole('button', { name: 'Створити чернетку', exact: true }).click()
  await expect(page).toHaveURL(/id=15/)
  await page.getByLabel('Фактична кількість', { exact: true }).fill('4')
  await page.evaluate(() => history.back())
  await expect(warning(page)).toBeVisible()
  await page.getByRole('button', { name: 'Залишитися', exact: true }).click()
  await expect(page.getByLabel('Фактична кількість', { exact: true })).toHaveValue('4')
  await page.evaluate(() => history.back())
  await expect(warning(page)).toBeVisible()
  await page.getByRole('button', { name: 'Вийти без збереження', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory\/movements$/)
})

test('manual operation warns on unsaved quantity changes and pristine form leaves freely', async ({ page }) => {
  await page.goto('/inventory/operations')
  await nav(page).getByRole('link', { name: /^Залишки/ }).click()
  await expect(page).toHaveURL(/\/inventory$/)
  await nav(page).getByRole('link', { name: /^Операції/ }).click()
  await page.getByLabel('Кількість', { exact: true }).fill('3')
  await nav(page).getByRole('link', { name: /^Залишки/ }).click()
  await expect(warning(page)).toBeVisible()
  await page.getByRole('button', { name: 'Залишитися', exact: true }).click()
  await expect(page.getByLabel('Кількість', { exact: true })).toHaveValue('3')
})

test('typing only in receipt product picker is protected', async ({ page }) => {
  await page.goto('/inventory/receiving?id=12')
  await page.getByLabel('Назва або артикул', { exact: true }).fill('Незбережений пошук')
  await nav(page).getByRole('link', { name: /^Залишки/ }).click()
  await expect(warning(page)).toBeVisible()
  await page.getByRole('button', { name: 'Залишитися', exact: true }).click()
  await expect(page.getByLabel('Назва або артикул', { exact: true })).toHaveValue('Незбережений пошук')
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })).toBe(true)
})

test('automatically loaded operation product does not mark pristine form dirty', async ({ page }) => {
  await page.goto('/inventory/operations?product_id=42')
  await expect(page.getByText('Test Shampoo', { exact: true })).toBeVisible()
  await nav(page).getByRole('link', { name: /^Залишки/ }).click()
  await expect(page).toHaveURL(/\/inventory$/)
  await expect(warning(page)).toBeHidden()
})


test('discarding picker changes returns to a clean receipt list', async ({ page }) => {
  await page.goto('/inventory/receiving?id=12')
  await page.getByLabel('Назва або артикул', { exact: true }).fill('Незбережений пошук')
  await page.getByRole('link', { name: '← До списку приймань' }).click()
  await expect(warning(page)).toBeVisible()
  await page.getByRole('button', { name: 'Вийти без збереження', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory\/receiving$/)
  await nav(page).getByRole('link', { name: /^Залишки/ }).click()
  await expect(page).toHaveURL(/\/inventory$/)
  await expect(warning(page)).toBeHidden()
})

