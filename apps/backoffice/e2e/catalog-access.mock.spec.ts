import { expect, test, type Page } from '@playwright/test'
const staff = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: false, role: 'admin', master_id: null }
const product = { id: 8, name: 'Fixture shampoo', slug: 'fixture', price: '120', sku: 'SKU-8', barcode: 'known', stock_quantity: 2, reserved_quantity: 0, available_quantity: 2, on_hand: 2, reserved: 0, available: 2, allow_backorder: false, is_active: true, is_effectively_visible: true, image_url: '/original.png', images: [{ id: 1, sort_order: 0, is_active: true, image_url: '/original.png' }], display_image_url: '/processed.webp', display_image_urls: ['/processed.webp'], attributes_json: null }
async function fixture(page: Page, user: object) {
  const mutations: string[] = []
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), user)
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (req.method() !== 'GET') { mutations.push(path); return route.fulfill({ status: 403, json: { detail: 'fixture guard' } }) }
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/inventory/products/barcode/unknown')) return route.fulfill({ status: 404, json: { detail: 'fixture missing' } })
    if (path.endsWith('/inventory/receipts/1')) return route.fulfill({ json: { id: 1, status: 'draft', reason: 'Fixture receipt', items: [], created_at: '2026-10-19T12:00:00Z' } })
    if (path.endsWith('/backoffice/products/8')) return route.fulfill({ json: product })
    if (path.endsWith('/backoffice/products') || path.endsWith('/inventory/stock')) return route.fulfill({ json: { items: [product], total: 1 } })
    if (path.endsWith('/pos-capabilities')) return route.fulfill({ json: { mode: 'local_only', can_prepare: true, simulation_available: true, blocking_reasons: [] } })
    if (path.endsWith('/masters') || path.endsWith('/inventory/procurement')) return route.fulfill({ json: [] })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  return mutations
}
for (const identity of [{ role: 'master' }, { role: 'admin', master_id: 7 }]) {
  test(`master catalog direct links and inventory controls are blocked: ${JSON.stringify(identity)}`, async ({ page }) => {
    const mutations = await fixture(page, { ...staff, ...identity, can_record_sales: true, can_post_inventory: true })
    for (const path of ['/products', '/products/new', '/products/8', '/Products', '/PRODUCTS/8']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/(?:dashboard|admin\/dashboards\/barbershop)$/)
      await expect(page.getByRole('button', { name: /Редагувати товар|Додати фото|Зберегти налаштування/ })).toHaveCount(0)
    }
    await page.goto('/inventory')
    await expect(page.getByRole('heading', { name: /Склад|Залишки/ }).first()).toBeVisible()
    await expect(page.locator('a[href^="/products"]')).toHaveCount(0)
    await expect(page.locator('img[src$="processed.webp"]:visible').first()).toBeVisible()
    await page.goto('/inventory/receiving?id=1')
    await page.getByLabel('Штрихкод', { exact: true }).first().fill('unknown')
    await page.getByLabel('Штрихкод', { exact: true }).first().press('Enter')
    await page.getByRole('textbox', { name: 'Назва або артикул', exact: true }).fill('Fixture')
    await page.getByRole('button', { name: 'Пошук', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Вибрати', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Прив’язати|створити картку/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Вибрати', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Новий товар', exact: true })).toHaveCount(0)
    page.on('dialog', dialog => dialog.accept())
    await page.goto('/orders/pos')
    await expect(page.getByRole('heading', { name: 'Продати товар', exact: true })).toBeVisible()
    expect(mutations).toEqual([])
  })
}
test('staff and superuser master retain management and see processed photos while editing originals', async ({ page }) => {
  for (const user of [staff, { ...staff, role: 'master', master_id: 7, is_superuser: true }]) {
    await page.unrouteAll({ behavior: 'wait' })
    await fixture(page, user)
    await page.goto('/products')
    await expect(page.getByRole('link', { name: 'Додати товар', exact: true })).toBeVisible()
    await expect(page.locator('img[src$="processed.webp"]:visible').first()).toBeVisible()
    await page.goto('/products/8')
    await expect(page.getByRole('button', { name: 'Додати фото', exact: true })).toBeVisible()
    await expect(page.locator('img[src$="processed.webp"]:visible').first()).toBeVisible()
    await page.getByRole('button', { name: 'Редагувати товар', exact: true }).click()
    await page.getByText('Зовнішні URL / старі зображення', { exact: true }).click()
    await expect(page.getByLabel('URL зображення', { exact: true })).toHaveValue('/original.png')
  }
})
