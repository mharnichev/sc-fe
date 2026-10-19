import { expect, test } from '@playwright/test'
import { TEST_PRODUCT, clearShopStorage, installRuntimeDiagnostics } from '../support/shop'

test('catalog search, no-results state and direct product navigation work', async ({ page }) => {
  const diagnostics = installRuntimeDiagnostics(page)
  await clearShopStorage(page)

  const search = page.getByRole('searchbox')
  await search.fill('BlueBeards Conditioner')
  await expect(page.getByRole('link', { name: TEST_PRODUCT.name }).first()).toBeVisible()
  await search.fill('no-such-e2e-product-zzzz')
  await expect(page.getByText(/нічого не знайдено/i)).toBeVisible()
  await search.fill('')

  await page.goto(`/products/${TEST_PRODUCT.slug}`)
  await expect(page.getByRole('heading', { name: TEST_PRODUCT.name.toUpperCase() })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: TEST_PRODUCT.name.toUpperCase() })).toBeVisible()
  diagnostics.assertClean()
})

test('unknown product URL presents a not-found state without crashing', async ({ page }) => {
  const diagnostics = installRuntimeDiagnostics(page)
  await page.goto('/products/not-a-real-e2e-product')
  await expect(page.getByText(/не знайден|not found/i).first()).toBeVisible()
  diagnostics.assertClean(
    [/404 GET .*\/public\/products\/by-slug\//],
    [/Failed to load resource: the server responded with a status of 404/],
  )
})
