import { expect, test } from '@playwright/test'
import {
  cartBadge,
  TEST_PRODUCT,
  addTestProductFromPdp,
  clearShopStorage,
  fillCheckout,
  goToCheckout,
  installRuntimeDiagnostics,
  createInventoryFixture,
  openCart,
  waitForNuxtHydration,
} from '../support/shop'

let inventory: Awaited<ReturnType<typeof createInventoryFixture>>

test.beforeEach(async ({ page }) => {
  inventory = await createInventoryFixture()
  await inventory.setAvailable(TEST_PRODUCT.id, 20)
  await clearShopStorage(page)
})

test.afterEach(async () => {
  await inventory?.restore()
})

test('guest cart persists, recalculates totals and removes products', async ({ page }) => {
  const diagnostics = installRuntimeDiagnostics(page)
  await addTestProductFromPdp(page)
  await page.reload()
  await expect(cartBadge(page)).toHaveText('1')
  await openCart(page)
  await page.getByRole('button', { name: 'Збільшити кількість' }).click()
  await expect(page.getByRole('spinbutton', { name: `Кількість для ${TEST_PRODUCT.name}` })).toHaveValue('2')
  await expect(page.locator('.basket-sidebar__total')).toHaveText(/До доставки\s*700,00 грн/)
  await page.getByRole('button', { name: 'Видалити' }).click()
  await expect(page.getByText('Додайте товари з каталогу')).toBeVisible()
  diagnostics.assertClean()
})

test('checkout keeps cart state and shows an actionable error when order creation fails', async ({ page }) => {
  const diagnostics = installRuntimeDiagnostics(page)
  await addTestProductFromPdp(page)
  await goToCheckout(page)
  await fillCheckout(page)
  const attempts: Array<{ key: string | undefined, body: unknown }> = []
  await page.route('**/api/v1/public/orders', async route => {
    attempts.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON(),
    })
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Synthetic E2E failure' }),
    })
  })

  const submit = page.getByRole('button', { name: 'ОФОРМИТИ ЗАМОВЛЕННЯ' }).last()
  const retry = page.getByRole('button', { name: 'Перевірити / повторити попереднє замовлення', exact: true })
  const failedOrderResponse = () => page.waitForResponse(response =>
    response.url().endsWith('/api/v1/public/orders') && response.request().method() === 'POST' && response.status() === 503,
  )
  await Promise.all([failedOrderResponse(), submit.click()])
  await expect(page.getByText(/Не вдалося оформити замовлення/).filter({ visible: true }).last()).toBeVisible()
  await expect(page.getByRole('heading', { name: TEST_PRODUCT.name })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: `Кількість для ${TEST_PRODUCT.name}` }).last()).toHaveValue('1')
  await expect(submit).toBeDisabled()
  await expect(retry).toBeEnabled()
  expect(attempts).toHaveLength(1)
  expect(attempts[0]!.key).toMatch(/^[0-9a-f-]{36}$/i)
  expect(attempts[0]!.body).toMatchObject({ items: [{ product_id: TEST_PRODUCT.id, quantity: 1 }] })

  await Promise.all([failedOrderResponse(), retry.click()])
  await expect(page.getByText(/Не вдалося оформити замовлення/).filter({ visible: true }).last()).toBeVisible()
  await expect(retry).toBeEnabled()
  await expect(submit).toBeDisabled()
  expect(attempts).toHaveLength(2)
  expect(attempts[1]).toEqual(attempts[0])
  await expect(page.getByRole('heading', { name: TEST_PRODUCT.name })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: `Кількість для ${TEST_PRODUCT.name}` }).last()).toHaveValue('1')
  await expect(cartBadge(page)).toHaveText('1')
  diagnostics.assertClean(
    [/503 POST .*\/public\/orders/],
    [
      /Failed to load resource: the server responded with a status of 503/,
      /Synthetic E2E failure/,
      /FetchError:[\s\S]*\/public\/orders[\s\S]*503 Service Unavailable/,
    ],
  )
})


test('stale available PDP rechecks real availability before adding to guest cart', async ({ page }) => {
  await inventory.setBackorder(TEST_PRODUCT.id, false)
  await page.goto(`/products/${TEST_PRODUCT.slug}`)
  await waitForNuxtHydration(page)
  const add = page.getByRole('button', { name: 'ДОДАТИ В КОШИК' })
  await expect(add).toBeEnabled()
  await inventory.setAvailable(TEST_PRODUCT.id, 0)
  const recheck = page.waitForResponse(r => r.url().includes(`/public/products/by-slug/${TEST_PRODUCT.slug}`) && r.request().method() === 'GET')
  await add.click()
  await recheck
  await expect(page.getByText('Товар більше недоступний', { exact: true })).toBeVisible()
  await expect(cartBadge(page)).toHaveCount(0)
  await openCart(page)
  await expect(page.getByText('Додайте товари з каталогу')).toBeVisible()
})

test('stale cart rechecks availability before increasing and still permits removal', async ({ page }) => {
  await inventory.setBackorder(TEST_PRODUCT.id, false)
  await addTestProductFromPdp(page)
  await openCart(page)
  const quantity = page.getByRole('spinbutton', { name: `Кількість для ${TEST_PRODUCT.name}` })
  const increase = quantity.locator('..').getByRole('button', { name: 'Збільшити кількість' })
  await expect(increase).toBeEnabled()
  await inventory.setAvailable(TEST_PRODUCT.id, 0)
  const recheck = page.waitForResponse(r => r.url().includes(`/public/products/by-slug/${TEST_PRODUCT.slug}`) && r.request().method() === 'GET')
  await increase.click()
  await recheck
  await expect(quantity).toHaveValue('1')
  await expect(increase).toBeDisabled()
  await expect(page.getByText('Товар більше недоступний', { exact: true }).last()).toBeVisible()
  await page.getByRole('button', { name: 'Видалити' }).click()
  await expect(page.getByText('Додайте товари з каталогу')).toBeVisible()
})
