import { expect, test } from '@playwright/test'

test('preliminary document recovers stale revision and prints through authenticated API', async ({ page }) => {
  const user = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
  const document = { id: 21, number: 'SC-123-1', version: 1, document_kind: 'preliminary', created_at: '2026-10-17T00:00:00Z', print_url: '/api/v1/backoffice/orders/123/preliminary-documents/21/print' }
  let revision = 1
  let created = false
  const commands: Array<{ key?: string, revision: number }> = []
  let authenticatedPrint = false
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), user)
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'GET' && (path.endsWith('/returns') || path.endsWith('/fiscal-documents'))) return route.fulfill({ json: [] })
    if (path.endsWith('/backoffice/auth/me')) { await route.fulfill({ json: user }); return }
    if (path.endsWith('/preliminary-documents') && route.request().method() === 'POST') {
      commands.push({ key: route.request().headers()['idempotency-key'], revision: route.request().postDataJSON().expected_revision })
      if (commands.length === 1) {
        revision = 2
        await route.fulfill({ status: 409, json: { detail: { code: 'revision_conflict', message: 'Reload order' } } }); return
      }
      created = true
      await route.fulfill({ status: 201, json: document }); return
    }
    if (path.endsWith('/preliminary-documents/21/print')) {
      authenticatedPrint = route.request().headers().authorization === 'Bearer fixture-only'
      await route.fulfill({ contentType: 'text/html', body: '<html><body><h1>SC-123-1</h1><p>Попереднє замовлення. Не є фіскальним чеком</p></body></html>' }); return
    }
    if (path.endsWith('/backoffice/orders/123')) {
      await route.fulfill({ json: { id: 123, status: 'pending', customer_name: 'Fixture', total_amount: '100.00', subtotal_amount: '100.00', discount_amount: '0.00', revision, items: [], payment_status: 'unpaid', fulfillment_status: 'reserved', fiscal_status: 'not_requested', preliminary_documents: created ? [document] : [] } }); return
    }
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/orders/123')
  await page.getByText('Документи та чеки', { exact: true }).click()
  const create = page.getByRole('button', { name: 'Створити нову версію документа' })
  await expect(create).toBeVisible()
  await expect(page.getByText('Не оплачено', { exact: true })).toBeVisible()
  await create.click()
  await expect(page.getByRole('alert')).toContainText('Reload order')
  await create.click()
  const print = page.getByRole('button', { name: 'SC-123-1 · v1 · Перегляд / друк' })
  await expect(print).toBeVisible()
  expect(commands).toHaveLength(2)
  expect(commands[0]?.revision).toBe(1)
  expect(commands[1]?.revision).toBe(2)
  expect(commands[0]?.key).not.toBe(commands[1]?.key)
  const popupPromise = page.waitForEvent('popup')
  await print.click()
  const popup = await popupPromise
  await expect(popup.getByRole('heading', { name: 'SC-123-1' })).toBeVisible()
  expect(authenticatedPrint).toBe(true)
  await expect(popup.getByText('Попереднє замовлення. Не є фіскальним чеком')).toBeVisible()
})
