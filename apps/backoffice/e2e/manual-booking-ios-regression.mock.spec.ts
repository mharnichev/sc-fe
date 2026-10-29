import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ isMobile: true, hasTouch: true })

async function openManualBooking(page: Page, mode: 'browser' | 'standalone', height = 844) {
  await page.setViewportSize({ width: 390, height })
  await page.clock.install({ time: new Date('2026-10-25T06:00:00Z') })
  const user = { id: 13, email: 'fixture@example.test', role: 'barber', master_id: 13, is_active: true, is_superuser: false }
  await page.addInitScript(({ user, mode }) => {
    // The isolated runtime has no external network; all API reads are local fixtures.
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true })
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture', refreshToken: '', user }))
    if (mode === 'standalone') {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
      const original = window.matchMedia.bind(window)
      window.matchMedia = query => {
        const result = original(query)
        if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true })
        return result
      }
    }
  }, { user, mode })
  const localServer = new URL(test.info().project.use.baseURL || 'http://127.0.0.1:4040')
  if (localServer.hostname !== '127.0.0.1') throw new Error('Manual service mocks require a local test server')
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== localServer.origin) return route.abort()
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.fulfill({ status: 403, json: { detail: 'Unexpected mutation' } })
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    const path = url.pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/masters')) return route.fulfill({ json: [{ id: 13, admin_user_id: 13, first_name_uk: 'Тест', last_name_uk: 'Майстер' }] })
    if (path.endsWith('/services')) return route.fulfill({ json: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Послуга ${i + 1}`, title_uk: `Послуга ${i + 1}`, duration_minutes: 15, price: 200 })) })
    if (path.endsWith('/availability')) return route.fulfill({ json: [{ id: 1, master_id: 13, start_at: '2026-10-25T07:30:00Z', end_at: '2026-10-25T18:00:00Z' }] })
    return route.fulfill({ json: [] })
  })
  await page.goto('/bookings')
  await page.locator('button[data-slot-id*="2026-10-25"]:enabled').first().tap()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: 'Ручне бронювання', exact: true }).tap()
  return dialog
}

async function expectReachable(locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  await expect.poll(() => locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const hit = document.elementFromPoint(x, y)
    return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !!hit && (element === hit || element.contains(hit))
  })).toBe(true)
}

for (const mode of ['browser', 'standalone'] as const) {
  test(`${mode}: touch open does not autofocus search`, async ({ page }) => {
    const dialog = await openManualBooking(page, mode)
    const trigger = dialog.locator('[data-multiselect-trigger]')
    await trigger.tap()
    const search = dialog.getByPlaceholder('Пошук послуг')
    await expect(search).toBeVisible()
    await expect(search).not.toBeFocused()
    await search.tap()
    await expect(search).toBeFocused()
    await search.fill('Послуга 20')
    await dialog.getByRole('checkbox', { name: /Послуга 20/ }).tap()
    await expect(dialog.getByRole('checkbox', { name: /Послуга 20/ })).toBeChecked()
    await expect(dialog.getByRole('spinbutton')).toHaveValue('15')
    await expect.poll(async () => {
      const times = await dialog.locator('input[type="time"]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))
      const minutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
      return times.length === 2 ? minutes(times[1]) - minutes(times[0]) : null
    }).toBe(15)
    await dialog.getByRole('button', { name: 'Закрити список', exact: true }).tap()
    await expect(trigger).toContainText('1/5')
  })

  test(`${mode}: touch bulk controls leave search unfocused`, async ({ page }) => {
    const dialog = await openManualBooking(page, mode)
    await dialog.locator('[data-multiselect-trigger]').tap()
    const search = dialog.getByPlaceholder('Пошук послуг')
    await dialog.getByRole('button', { name: 'Вибрати всі', exact: true }).tap()
    await expect(search).not.toBeFocused()
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(5)
    await expect(dialog.getByRole('spinbutton')).toHaveValue('75')
    await dialog.getByRole('button', { name: 'Прибрати всі', exact: true }).tap()
    await expect(search).not.toBeFocused()
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(0)
  })
}

test('ArrowDown opens and focuses search; Tab and Escape preserve keyboard access', async ({ page }) => {
  const dialog = await openManualBooking(page, 'browser')
  const trigger = dialog.locator('[data-multiselect-trigger]')
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  const search = dialog.getByPlaceholder('Пошук послуг')
  await expect(search).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Закрити список', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(search).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(dialog).toBeVisible()
})

test('mouse on a touch-capable device opens and focuses search', async ({ page }) => {
  const dialog = await openManualBooking(page, 'browser')
  await dialog.locator('[data-multiselect-trigger]').click()
  await expect(dialog.getByPlaceholder('Пошук послуг')).toBeFocused()
})

for (const pointerType of ['touch', 'pen'] as const) {
  test(`${pointerType} pointer takes precedence over click detail and resets`, async ({ page }) => {
    const dialog = await openManualBooking(page, 'browser')
    const trigger = dialog.locator('[data-multiselect-trigger]')
    await trigger.dispatchEvent('pointerdown', { pointerType, bubbles: true })
    await trigger.dispatchEvent('click', { detail: 0, bubbles: true })
    const search = dialog.getByPlaceholder('Пошук послуг')
    await expect(search).toBeVisible()
    await expect(search).not.toBeFocused()
    await trigger.focus()
    await page.keyboard.press('Escape')
    await trigger.dispatchEvent('pointerdown', { pointerType, bubbles: true })
    await trigger.dispatchEvent('pointercancel', { pointerType, bubbles: true })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(search).toBeFocused()
  })
}

test('short touch viewport keeps menu controls and scrolling reachable', async ({ page }) => {
  const dialog = await openManualBooking(page, 'browser', 480)
  const trigger = dialog.locator('[data-multiselect-trigger]')
  await trigger.tap()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const group = dialog.getByRole('group', { name: 'Виберіть послуги' })
  await expect(group).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-controls', await group.getAttribute('id') || '')
  await expectReachable(dialog.getByPlaceholder('Пошук послуг'))
  await expectReachable(dialog.getByRole('button', { name: 'Закрити список', exact: true }))
  const first = dialog.getByRole('checkbox', { name: /^Послуга 1\b/ })
  await expectReachable(first)
  await first.tap()
  await expect(first).toBeChecked()
  const last = dialog.getByRole('checkbox', { name: /^Послуга 20\b/ })
  await expectReachable(last)
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(1)
  await last.tap()
  await expect(last).toBeChecked()
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
})

test('shrinking the emulated viewport while open keeps menu controls reachable', async ({ page }) => {
  const dialog = await openManualBooking(page, 'browser')
  await dialog.locator('[data-multiselect-trigger]').tap()
  await page.setViewportSize({ width: 390, height: 480 })
  await expectReachable(dialog.getByPlaceholder('Пошук послуг'))
  await expectReachable(dialog.getByRole('button', { name: 'Закрити список', exact: true }))
  const last = dialog.getByRole('checkbox', { name: /^Послуга 20\b/ })
  await expectReachable(last)
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(0)
  await last.tap()
  await expect(last).toBeChecked()
})
