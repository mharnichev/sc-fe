import { expect, test } from '@playwright/test'
const token = 'x'.repeat(30)
test('public mock display is minimal escaped unauthenticated and a revoked refresh clears all document data', async ({ page }) => {
 let revoked = false
 const calls: Record<string,string>[] = []
 await page.addInitScript(() => localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'private-customer-session', tokenType: 'Bearer', customer: { id: 8 } })))
 await page.route('**/api/v1/**', route => {
  if (new URL(route.request().url()).pathname.includes('/public/mock-fiscal-documents/')) {
   calls.push(route.request().headers())
   return revoked ? route.fulfill({ status: 404, json: { detail: 'not found' } }) : route.fulfill({ json: { kind: 'return', simulation: true, is_sent_dps: false, currency: 'UAH', notice: 'MOCK only', items: [{ name: '<img src=x onerror=alert(1)>', quantity: 1, total_minor: 1234, product_id: 888 }], amount_minor: 1234, customer: 'PRIVATE_CUSTOMER', phone: 'PRIVATE_PHONE', order_id: 321, provider_uuid: 'PRIVATE_PROVIDER' } })
  }
  return route.fulfill({ json: { items: [], total: 0 } })
 })
 const response = await page.goto('/mock-fiscal-documents/'+token)
 expect(response?.headers()['referrer-policy']).toBe('no-referrer')
 await expect(page.getByRole('heading', { name: 'Тестовий документ MOCK', exact: true })).toBeVisible()
 await expect(page.getByText('Сума MOCK: 12.34 грн', { exact: true })).toBeVisible()
 await expect(page.getByText('<img src=x onerror=alert(1)> · 1 · 12.34 грн', { exact: true })).toBeVisible()
 await expect(page.locator('main img')).toHaveCount(0); await expect(page.getByText(/PRIVATE_/)).toHaveCount(0)
 expect(calls[0].authorization).toBeUndefined(); expect(calls[0].referer).toBeUndefined()
 await expect(page.locator('meta[name=referrer]')).toHaveAttribute('content','no-referrer')
 revoked = true; await page.getByRole('button', { name: 'Оновити MOCK документ', exact: true }).click()
 await expect(page.getByRole('alert')).toContainText('відкликане'); await expect(page.getByText('Сума MOCK: 12.34 грн', { exact: true })).toHaveCount(0)
})
test('expired capability exposes no order or document details', async ({ page }) => {
 await page.route('**/api/v1/**', route => route.fulfill({ status: 404, json: { detail: 'not found' } }))
 await page.goto('/mock-fiscal-documents/'+token)
 await expect(page.getByRole('alert')).toContainText('строк його дії закінчився')
 await expect(page.locator('article')).toHaveCount(0)
})
