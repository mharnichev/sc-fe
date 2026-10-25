import { expect, test, type Page } from '@playwright/test'

test.use({ locale: 'uk-UA', timezoneId: 'Europe/Kyiv' })

async function fixture(page: Page, admin: boolean) {
  const actor = { id: 13, email: 'calendar@example.test', role: admin ? 'admin' : 'barber', master_id: admin ? null : 13, is_active: true, is_superuser: false }
  const writes: Array<{ master_id?: number; start_at: string; end_at: string }> = []
  await page.clock.install({ time: new Date('2026-10-25T06:00:00Z') })
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture', refreshToken: '', user })), actor)
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (req.method() === 'POST' && path.endsWith('/availability/windows')) {
      expect(path).toBe(admin ? '/api/v1/backoffice/availability/windows' : '/api/v1/backoffice/masters/me/availability/windows')
      const body = req.postDataJSON(); writes.push(body)
      return route.fulfill({ json: { id: writes.length, master_id: 13, ...body } })
    }
    if (req.method() !== 'GET') return route.fulfill({ status: 403, json: { detail: 'Unexpected mutation' } })
    if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
    if (path.endsWith('/masters')) return route.fulfill({ json: [{ id: 13, admin_user_id: 13, first_name_uk: 'Тест', last_name_uk: 'Майстер', is_active: true, services: [] }] })
    return route.fulfill({ json: [] })
  })
  return writes
}

test('bookings header opens a draft, preserves selected day and saves independent times', async ({ page }) => {
  const writes = await fixture(page, false)
  await page.goto('/bookings')
  await page.getByRole('button', { name: 'Відкрити день для запису', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Відкрити для запису', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-selected-date]')).toHaveCount(1)
  expect(writes).toHaveLength(0)
  await dialog.locator('[data-date="2026-10-27"]').click()
  await dialog.getByLabel('Початок 2026-10-27', { exact: true }).fill('11:00')
  await dialog.getByRole('button', { name: /Відкрити 2/ }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1].start_at).toBe('2026-10-27T09:00:00.000Z')
  expect(writes.every(body => body.master_id === undefined)).toBe(true)
})

test('admin availability requires explicit master selection and uses admin endpoint', async ({ page }) => {
  const writes = await fixture(page, true)
  await page.goto('/time-blocks')
  await page.getByRole('button', { name: 'Відкрити час', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Відкрити для запису', exact: true })
  await dialog.locator('[data-date="2026-10-27"]').click()
  await dialog.getByRole('button', { name: /Відкрити 1/ }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Виберіть майстра.')
  expect(writes).toHaveLength(0)
  await dialog.getByRole('button', { name: /Виберіть майстра/ }).click()
  await dialog.getByRole('button', { name: /Тест Майстер/ }).click()
  await dialog.getByRole('button', { name: /Відкрити 1/ }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(1)
  expect(writes[0].master_id).toBe(13)
})
