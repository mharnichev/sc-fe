import { expect, test } from '@playwright/test'
import {
  TEST_PRODUCT,
  addTestProductFromPdp,
  clearShopStorage,
  goToCheckout,
  installRuntimeDiagnostics,
  setTestProductStock,
} from '../support/shop'

test('mobile customer can reach checkout from the catalog @mobile', async ({ page }) => {
  await setTestProductStock(20).then(context => context.dispose())
  try {
    const diagnostics = installRuntimeDiagnostics(page)
    await clearShopStorage(page)
    await page.goto('/catalog')
    await expect(page.getByRole('link', { name: TEST_PRODUCT.name }).first()).toBeVisible()
    await addTestProductFromPdp(page)
    await goToCheckout(page)
    await expect(page.getByRole('heading', { name: 'Контакти' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ОФОРМИТИ ЗАМОВЛЕННЯ' }).first()).toBeVisible()
    diagnostics.assertClean()
  }
  finally {
    await setTestProductStock(1).then(context => context.dispose())
  }
})
