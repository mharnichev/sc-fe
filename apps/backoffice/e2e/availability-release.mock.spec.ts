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

test('closed slot opens the multi-day picker with its exact time and no mutation', async ({ page }) => {
  const writes = await fixture(page, false)
  await page.goto('/bookings')
  const slot = page.locator('button[data-slot-id]:enabled').first()
  const interval = await slot.getAttribute('aria-label')
  await slot.click()
  const dialog = page.getByRole('dialog', { name: 'Відкрити для запису', exact: true })
  await expect(dialog).toBeVisible()
  const [start, end] = interval!.split('-')
  await expect(dialog.getByLabel('Початок для всіх', { exact: true })).toHaveValue(start)
  await expect(dialog.getByLabel('Завершення для всіх', { exact: true })).toHaveValue(end)
  await expect(dialog.locator('[data-selected-date]')).toHaveCount(1)
  expect(writes).toHaveLength(0)
})

test('manual booking open-time tab transfers the draft, never creates an interval implicitly', async ({ page }) => {
  const writes = await fixture(page, false)
  await page.route(/\/masters\/me\/availability(?:\?|$)/, route => route.fulfill({ json: [{ id: 1, master_id: 13, start_at: '2026-10-25T07:30:00Z', end_at: '2026-10-25T18:00:00Z' }] }))
  await page.goto('/bookings')
  await page.locator('button[data-slot-id*="2026-10-25"]:enabled').first().click()
  await expect(page.getByRole('heading', { name: 'Новий інтервал', exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'Відкрити', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Відкрити для запису', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-selected-date]')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Новий інтервал', exact: true })).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test('mobile master navigation exposes availability with a fitting label', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  const writes = await fixture(page, false)
  await page.goto('/bookings')
  const nav = page.locator('.backoffice-bottom-nav')
  const availability = nav.getByRole('link', { name: 'Моя доступність', exact: true })
  await expect(availability).toBeVisible()
  await expect(availability).toHaveAttribute('href', '/my-time-blocks')
  expect(await availability.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true)
  await availability.click()
  await expect(page).toHaveURL(/\/my-time-blocks$/)
  await expect(page.getByRole('button', { name: 'Відкрити час', exact: true })).toBeVisible()
  expect(writes).toHaveLength(0)
})
