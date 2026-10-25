import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, options: { fail?: boolean; refreshFail?: boolean; hold?: boolean; master?: boolean } = {}) {
  const user = { id: 1, email: 'review-admin@example.test', role: options.master ? 'barber' : 'admin', is_superuser: false, is_active: true }
  let items = ['pending', 'approved', 'rejected'].map((status, index) => ({ id: index + 1, master_id: 13, master: { id: 13, full_name_uk: 'Тест Майстер' }, booking_reference: `REV-${index + 1}`, rating: 5, moderation_status: status, submitted_at: '2026-10-25T10:00:00Z', request_state: 'submitted' }))
  const writes: string[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture', refreshToken: '', user })), user)
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort()
  })
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (req.method() === 'POST' && path.endsWith('/reviews/1/approve')) {
      writes.push(path)
      if (options.hold) await gate
      if (options.fail) return route.fulfill({ status: 500, json: { detail: 'Не вдалося схвалити відгук.' } })
      items = items.map(item => item.id === 1 ? { ...item, moderation_status: 'approved' } : item)
      return route.fulfill({ json: { ...items[0], moderation_history: [], request_history: [] } })
    }
    if (req.method() !== 'GET') return route.fulfill({ status: 403, json: { detail: 'Unexpected mutation' } })
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (options.refreshFail && writes.length && /\/reviews(?:\/metrics)?$/.test(path)) return route.fulfill({ status: 503, json: { detail: 'Refresh failed' } })
    if (path.endsWith('/reviews/metrics')) return route.fulfill({ json: { average_rating_by_master: [], review_form_opens_status: 'unavailable' } })
    if (path.endsWith('/reviews')) return route.fulfill({ json: { items, total: items.length, page: 1, page_size: 20 } })
    return route.fulfill({ json: [] })
  })
  await page.goto('/reviews')
  return { writes, release }
}

const approve = (page: Page) => page.getByRole('button', { name: /^Схвалити відгук / })

test('approve a pending review directly, no button for approved or rejected', async ({ page }) => {
  const { writes } = await setup(page)
  await expect(approve(page)).toHaveCount(1)
  const row = page.getByRole('row').filter({ hasText: 'REV-1' })
  await approve(page).click()
  await expect(approve(page)).toHaveCount(0)
  await expect(row).toContainText('Схвалено')
  await expect(page).toHaveURL(/\/reviews$/)
  expect(writes).toHaveLength(1)
})

test('failed approval keeps pending review and allows a deliberate retry', async ({ page }) => {
  const { writes } = await setup(page, { fail: true })
  const row = page.getByRole('row').filter({ hasText: 'REV-1' })
  await approve(page).click()
  await expect(row.getByRole('alert')).toContainText('Не вдалося схвалити відгук.')
  await expect(approve(page)).toBeEnabled()
  expect(writes).toHaveLength(1)
})

test('pending approval blocks duplicate submissions and shows inherited loader', async ({ page }) => {
  const { writes, release } = await setup(page, { hold: true })
  await approve(page).click()
  await expect(approve(page)).toBeDisabled()
  await expect(approve(page).locator('.base-loader--inherit')).toBeVisible()
  await approve(page).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  expect(writes).toHaveLength(1)
  release()
  await expect(approve(page)).toHaveCount(0)
})

test('refresh failure is not reported as failed approval and never resends mutation', async ({ page }) => {
  const { writes } = await setup(page, { refreshFail: true })
  await approve(page).click()
  await expect(page.getByText('Відгук схвалено, але не вдалося оновити список або метрики. Оновіть дані.')).toBeVisible()
  expect(writes).toHaveLength(1)
  await expect(page.getByText('Не вдалося схвалити відгук.', { exact: true })).toHaveCount(0)
})

test('late mutation response after unmount cannot display success toast', async ({ page }) => {
  const { writes, release } = await setup(page, { hold: true })
  await approve(page).click()
  await expect(approve(page)).toBeDisabled()
  await page.locator('a[href="/masters"]').first().click()
  await expect(page).toHaveURL(/\/masters$/)
  release()
  await page.waitForTimeout(200)
  await expect(page.getByText('Відгук схвалено.', { exact: true })).toHaveCount(0)
  expect(writes).toHaveLength(1)
})

test('master cannot use administrator approval', async ({ page }) => {
  const { writes } = await setup(page, { master: true })
  await expect(page).not.toHaveURL(/\/reviews$/)
  await expect(approve(page)).toHaveCount(0)
  expect(writes).toEqual([])
})

test('login pending state is stable, disabled and single-request', async ({ page }) => {
  let writes = 0, release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'POST') { writes++; await gate }
    return route.fulfill({ status: 503, json: { detail: 'Fixture login failure' } })
  })
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('fixture@example.test')
  await page.getByLabel('Пароль', { exact: true }).fill('fixture-only')
  const button = page.getByRole('button', { name: 'Увійти в backoffice', exact: true })
  const height = await button.evaluate(el => el.getBoundingClientRect().height)
  await button.click()
  await expect(page.getByLabel('Email', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Пароль', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Показати пароль', exact: true })).toBeDisabled()
  const loading = page.locator('button[type="submit"]')
  await expect(loading).toBeDisabled()
  expect(await loading.evaluate(el => el.getBoundingClientRect().height)).toBe(height)
  await page.locator('form').evaluate(el => { el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(writes).toBe(1)
  release()
  await expect(page.getByText('Fixture login failure', { exact: true })).toBeVisible()
  await expect(button).toBeEnabled()
})
