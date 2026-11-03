import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`physical calendar statistics and day clipping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.clock.install({ time: new Date('2026-11-03T10:00:00Z') })
    const user = { id: 91001, role: 'admin', is_superuser: true, is_active: true }
    await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), user)
    const masters = [
      { id: 91001, first_name_uk: 'Гліб', last_name_uk: 'Фізичний', is_active: true },
      { id: 91002, first_name_uk: 'Для клієнтів', last_name_uk: 'Soulcuts', booking_redirect_master_id: 91001, is_active: true },
      { id: 91003, first_name_uk: 'Олександр', last_name_uk: 'Без графіка', is_active: true },
    ]
    const start = Date.parse('2026-11-01T00:00:00+02:00'), hour = 3600000
    const windows = [{ id: 91001, master_id: 91001, start_at: new Date(start).toISOString(), end_at: new Date(start + 178.5 * hour).toISOString() }]
    const bookings = [
      { id: 91001, master_id: 91001, status: 'confirmed', start_at: new Date(start).toISOString(), end_at: new Date(start + 5.5 * hour).toISOString() },
      { id: 91002, master_id: 91001, redirected_from_master_id: 91002, status: 'completed', start_at: new Date(start + 5.5 * hour).toISOString(), end_at: new Date(start + 12.5 * hour).toISOString() },
      { id: 91003, master_id: 91002, status: 'pending', start_at: new Date(start).toISOString(), end_at: new Date(start + hour).toISOString() },
      { id: 91004, master_id: 91001, status: 'cancelled', start_at: new Date(start + 15 * hour).toISOString(), end_at: new Date(start + 16 * hour).toISOString() },
    ]
    const writes: string[] = []
    await page.route('**/api/v1/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname
      if (request.method() !== 'GET') { writes.push(path); return route.fulfill({ status: 403, json: {} }) }
      if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
      if (path.endsWith('/masters')) return route.fulfill({ json: masters })
      if (path.endsWith('/availability')) { expect(url.searchParams.has('master_id')).toBe(false); return route.fulfill({ json: windows }) }
      if (path.endsWith('/calendar/bookings')) return route.fulfill({ json: bookings })
      return route.fulfill({ json: [] })
    })
    await page.goto('/time-blocks')
    await expect(page.getByRole('heading', { name: 'Завантаження майстрів за місяць' })).toBeVisible()
    const card = page.locator('article').filter({ hasText: 'Спільний календар: Фізичний Гліб / Soulcuts Для клієнтів' })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('12,5 год')
    await expect(card).toContainText('Залишок 166 год з 178,5 год')
    await expect(card).toContainText('7%')
    const empty = page.locator('article').filter({ hasText: 'Без графіка Олександр' })
    await expect(empty).toContainText('Немає графіка')
    await expect(empty).not.toContainText('0%')
    await expect(page.locator('tbody tr')).toHaveCount(2)
    // One window crosses 8 Kyiv dates; every overlapping date gets a cell.
    await expect(page.locator('tbody tr').first().getByRole('button', { name: /, доступно / })).toHaveCount(8)
    if (width < 768) await page.getByRole('button', { name: /^Фільтри/ }).click()
    await page.getByRole('button', { name: 'Статус записів', exact: true }).click()
    await page.getByRole('option', { name: 'Підтверджені', exact: true }).click()
    await expect(card).toContainText('Залишок 173 год з 178,5 год')
    await expect(card).toContainText('3%')
    await page.screenshot({ path: `output/booking-statistics/physical-${width}.png`, fullPage: true })
    expect(writes).toEqual([])
  })
}

test('before-month multi-day source is clipped for display but deletion discloses full impact', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T10:00:00Z') })
  const user = { id: 91001, role: 'admin', is_superuser: true, is_active: true }
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), user)
  const master = { id: 91001, first_name_uk: 'Тест', last_name_uk: 'Календар', is_active: true }
  const start_at = '2026-10-31T23:00:00+02:00', end_at = '2026-11-03T13:00:00+02:00'
  const source = { id: 91991, master_id: 91001, start_at, end_at }
  const writes: string[] = []
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (req.method() !== 'GET') { writes.push(path); return route.fulfill({ status: 403, json: {} }) }
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/masters')) return route.fulfill({ json: [master] })
    if (path.endsWith('/availability')) return route.fulfill({ json: [source] })
    if (path.endsWith('/calendar/time-blocks')) return route.fulfill({ json: [{ ...source, id: 91992, start_at: '2026-11-01T01:00:00+02:00', reason: 'Многоденний тест' }] })
    return route.fulfill({ json: [] })
  })
  await page.goto('/time-blocks')
  await expect(page.locator('tbody tr').getByRole('button', { name: /, блокування / })).toHaveCount(3)
  const deleteBlock = page.getByRole('button', { name: /Видалити блокування / }).nth(1)
  await deleteBlock.click()
  let dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('#91992: 01.11.2026')
  await expect(dialog).toContainText('03.11.2026')
  await expect(dialog).toContainText('на всіх їхніх датах')
  await dialog.getByRole('button', { name: /Скасувати/ }).click()
  await page.locator('tbody tr details summary').first().click()
  const sourceControl = page.getByRole('button', { name: /Закрити весь інтервал #91991:/ })
  await expect(sourceControl).toHaveAttribute('aria-label', /31.10.2026.*03.11.2026/)
  await sourceControl.click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('31.10.2026')
  await expect(dialog).toContainText('03.11.2026')
  await expect(dialog).toContainText('весь інтервал на всіх його датах')
  await dialog.getByRole('button', { name: /Скасувати/ }).click()
  expect(writes).toEqual([])
})

for (const width of [390, 1440]) {
  test(`pending or failed month is explained outside closed filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.clock.install({ time: new Date('2026-11-03T10:00:00Z') })
    const user = { id: 91001, role: 'admin', is_superuser: true, is_active: true }
    await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), user)
    let finish!: () => void
    const hold = new Promise<void>(resolve => { finish = resolve })
    await page.route('**/api/v1/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname
      if (req.method() !== 'GET') return route.fulfill({ status: 403, json: {} })
      if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
      if (path.endsWith('/masters')) return route.fulfill({ json: [{ id: 91001, first_name_uk: 'Фікстура', is_active: true }] })
      if (path.endsWith('/availability') || path.includes('/calendar/')) {
        await hold
        return route.fulfill({ status: 503, json: { detail: 'Fixture load failed' } })
      }
      return route.fulfill({ json: [] })
    })
    await page.goto('/time-blocks')
    await expect(page.getByRole('status').filter({ hasText: 'Оновлюємо розрахунок…' })).toBeVisible()
    await expect(page.locator('table')).toHaveCount(0)
    await expect(page.locator('article')).toHaveCount(0)
    await expect(page.getByText('Немає графіка', { exact: true })).toHaveCount(0)
    finish()
    await expect(page.getByRole('alert').filter({ hasText: 'Розрахунок недоступний.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Спробувати ще раз', exact: true })).toBeVisible()
    await expect(page.locator('table')).toHaveCount(0)
    await expect(page.locator('article')).toHaveCount(0)
  })
}
