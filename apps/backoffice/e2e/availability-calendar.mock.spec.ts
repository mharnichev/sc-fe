import { expect, test, type Page } from '@playwright/test'

test.use({ locale: 'uk-UA', timezoneId: 'Europe/Kyiv' })

const staff = { id: 13, email: 'calendar@example.test', role: 'barber', master_id: 13, is_active: true, is_superuser: false }

type ScheduleWindow = { id: number; master_id: number; start_at: string; end_at: string }
type ScheduleOptions = { masters?: Array<{ id: number; first_name_uk: string; last_name_uk: string }>; existing?: ScheduleWindow[]; deletes?: string[]; failLoad?: boolean; failedDeletes?: number[] }

async function setup(page: Page, failures: string[] = [], admin = false, fromBookings = false, options: ScheduleOptions = {}) {
  const windows = [...(options.existing || [])]
  const writes: Array<{ start_at: string; end_at: string }> = []
  await page.clock.install({ time: new Date('2026-10-24T09:00:00Z') })
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), admin ? { ...staff, role: 'admin', master_id: null } : staff)
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'GET' && path.endsWith('/availability')) {
      if (options.failLoad) return route.fulfill({ status: 500, json: { detail: 'Schedule unavailable' } })
      const masterId = Number(new URL(request.url()).searchParams.get('master_id') || 13)
      return route.fulfill({ json: windows.filter(w => w.master_id === masterId) })
    }
    if (request.method() === 'DELETE' && /\/availability\/\d+$/.test(path)) {
      options.deletes?.push(path)
      const id = Number(path.split('/').at(-1))
      if (options.failedDeletes?.includes(id)) return route.fulfill({ status: 409, json: { detail: 'Availability window has active bookings' } })
      const index = windows.findIndex(w => w.id === id)
      if (index >= 0) windows.splice(index, 1)
      return route.fulfill({ status: 204 })
    }
    if (request.method() === 'POST' && path.endsWith('/availability/windows')) {
      const body = request.postDataJSON()
      writes.push(body)
      if (failures.includes(body.start_at.slice(0, 10))) return route.fulfill({ status: 409, json: { detail: 'Цей інтервал уже відкритий.' } })
      const window = { id: 100 + writes.length, master_id: body.master_id || 13, ...body }
      windows.push(window)
      return route.fulfill({ json: window })
    }
    if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { detail: 'Unexpected fixture mutation' } })
    if (path.endsWith('/auth/me')) return route.fulfill({ json: admin ? { ...staff, role: 'admin', master_id: null } : staff })
    if (path.endsWith('/masters')) return route.fulfill({ json: options.masters || [{ id: 13, first_name_uk: 'Тест', last_name_uk: 'Майстер' }] })
    return route.fulfill({ json: [] })
  })
  await page.goto(fromBookings ? '/bookings' : admin ? '/time-blocks' : '/my-time-blocks')
  if (fromBookings) await page.getByRole('button', { name: 'Відкрити день для запису', exact: true }).first().click()
  else await page.getByRole('button', { name: 'Відкрити час', exact: true }).click()
  await expect(dialogFor(page)).toBeVisible()
  return writes
}

const dialogFor = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('.availability-form') })
async function select(page: Page, date: string) {
  await dialogFor(page).locator(`[data-date="${date}"]`).click()
}

for (const viewport of [{ name: 'mobile', width: 320, height: 844 }, { name: 'desktop', width: 1440, height: 1000 }]) {
  for (const theme of ['light', 'dark']) {
    test(`month selection preview ${viewport.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await setup(page)
      await page.evaluate(value => { document.documentElement.dataset.backofficeTheme = value }, theme)
      for (const date of ['2026-10-25', '2026-10-27', '2026-10-30']) await select(page, date)
      await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(3)
      await page.screenshot({ path: `output/availability-calendar/${viewport.name}-${theme}-calendar.png`, animations: 'disabled' })
      await dialogFor(page).getByLabel('Початок для всіх', { exact: true }).fill('10:00')
      await dialogFor(page).getByLabel('Завершення для всіх', { exact: true }).fill('18:00')
      await dialogFor(page).getByRole('button', { name: 'Застосувати до обраних', exact: true }).click()
      await dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true }).fill('11:00')
      await expect(dialogFor(page).getByLabel('Початок 2026-10-25', { exact: true })).toHaveValue('10:00')
      await expect(dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true })).toHaveValue('11:00')
      await expect(dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true })).toHaveAttribute('type', 'text')
      await expect(dialogFor(page).getByLabel('Завершення 2026-10-27', { exact: true })).toHaveValue('18:00')
      expect(await dialogFor(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      const cards = dialogFor(page).locator('[data-selected-date]')
      expect(await cards.first().locator('input').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(10)
      expect(await cards.first().locator('input').first().evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgba(0, 0, 0, 0)')
      const firstCard = await cards.nth(0).boundingBox(), secondCard = await cards.nth(1).boundingBox()
      expect(secondCard!.y).toBe(firstCard!.y)
      expect(secondCard!.x).toBeGreaterThan(firstCard!.x + firstCard!.width)
      const calendarBox = await dialogFor(page).locator('.availability-calendar').boundingBox()
      const timeBox = await dialogFor(page).getByRole('heading', { name: 'Спільний час', exact: true }).boundingBox()
      if (viewport.name === 'desktop') {
        expect(timeBox!.x).toBeGreaterThan(calendarBox!.x + calendarBox!.width)
        expect(Math.abs(timeBox!.y - calendarBox!.y)).toBeLessThan(30)
      } else {
        expect(timeBox!.y).toBeGreaterThan(calendarBox!.y + calendarBox!.height)
        const row = await dialogFor(page).locator('[data-selected-date]').first().boundingBox()
        expect(row!.height).toBeLessThanOrEqual(44)
      }

      await page.screenshot({ path: `output/availability-calendar/${viewport.name}-${theme}.png`, animations: 'disabled' })
    })
  }
}

test('save arbitrary days with common time and a per-day override in Kyiv time', async ({ page }) => {
  const writes = await setup(page)
  await expect(dialogFor(page).locator('[data-date="2026-10-23"]')).toBeDisabled()
  await select(page, '2026-10-25')
  await select(page, '2026-10-27')
  await select(page, '2026-10-30')
  await select(page, '2026-10-30') // deselect
  await dialogFor(page).getByLabel('Початок для всіх', { exact: true }).fill('10:00')
  await dialogFor(page).getByLabel('Завершення для всіх', { exact: true }).fill('18:00')
  await dialogFor(page).getByRole('button', { name: 'Застосувати до обраних', exact: true }).click()
  await dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true }).fill('11:00')
  await dialogFor(page).getByRole('button', { name: /Відкрити 2/ }).click()
  await expect(dialogFor(page)).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes.map(w => new Date(w.start_at).toISOString())).toEqual(['2026-10-25T08:00:00.000Z', '2026-10-27T09:00:00.000Z'])
  expect(writes.map(w => new Date(w.end_at).toISOString())).toEqual(['2026-10-25T16:00:00.000Z', '2026-10-27T16:00:00.000Z'])
})

test('partial failure retains only failed days for retry', async ({ page }) => {
  const failures = ['2026-10-27']
  const writes = await setup(page, failures)
  await select(page, '2026-10-25')
  await select(page, '2026-10-27')
  await dialogFor(page).getByRole('button', { name: /Відкрити 2/ }).click()
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(1)
  await expect(dialogFor(page).locator('[data-selected-date="2026-10-27"]')).toBeVisible()
  await expect(dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true })).toBeFocused()
  failures.length = 0
  await dialogFor(page).getByRole('button', { name: /Відкрити 1/ }).click()
  await expect(dialogFor(page)).toHaveCount(0)
  expect(writes.map(w => w.start_at.slice(0, 10))).toEqual(['2026-10-25', '2026-10-27', '2026-10-27'])
})

test('invalid individual time prevents every write', async ({ page }) => {
  const writes = await setup(page)
  await select(page, '2026-10-25')
  await select(page, '2026-10-27')
  await dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true }).fill('19:00')
  await dialogFor(page).getByLabel('Завершення 2026-10-27', { exact: true }).fill('18:00')
  await dialogFor(page).getByRole('button', { name: /Відкрити 2/ }).click()
  await expect(dialogFor(page).getByRole('alert').first()).toBeVisible()
  expect(writes).toHaveLength(0)
})

test('selection persists across months and horizon blocks later dates', async ({ page }) => {
  await setup(page)
  await select(page, '2026-10-27')
  await dialogFor(page).getByRole('button', { name: 'Наступний місяць', exact: true }).click()
  await select(page, '2026-11-02')
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(2)
  await dialogFor(page).getByRole('button', { name: 'Наступний місяць', exact: true }).click()
  await expect(dialogFor(page).locator('[data-date="2026-12-25"]')).toBeDisabled()
  await expect(dialogFor(page).getByRole('button', { name: 'Наступний місяць', exact: true })).toBeDisabled()
})

test('pending save blocks edits and closing the dialog', async ({ page }) => {
  await setup(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/masters/me/availability/windows', async route => {
    await gate
    await route.fulfill({ json: { id: 100, ...route.request().postDataJSON() } })
  })
  await select(page, '2026-10-27')
  await dialogFor(page).getByRole('button', { name: /Відкрити 1/ }).click()
  await expect(dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialogFor(page)).toBeVisible()
  release()
  await expect(dialogFor(page)).toHaveCount(0)
})

test('bulk weekdays and clear retain explicit selection behavior', async ({ page }) => {
  const writes = await setup(page)
  await dialogFor(page).getByRole('button', { name: 'Будні', exact: true }).click()
  const dates = await dialogFor(page).locator('[data-selected-date]').evaluateAll(es => es.map(e => e.getAttribute('data-selected-date')))
  expect(dates).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
  await dialogFor(page).getByRole('button', { name: 'Увесь місяць', exact: true }).click()
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(8)
  await dialogFor(page).getByRole('button', { name: 'Очистити', exact: true }).click()
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test('admin selects master and saves through the admin API', async ({ page }) => {
  const writes = await setup(page, [], true)
  await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).toBeDisabled()
  expect(writes).toHaveLength(0)
  await dialogFor(page).getByRole('button', { name: /Виберіть майстра/ }).click()
  await dialogFor(page).getByRole('button', { name: /Тест Майстер/ }).click()
  await select(page, '2026-10-27')
  await dialogFor(page).getByRole('button', { name: /Відкрити 1/ }).click()
  await expect(dialogFor(page)).toHaveCount(0)
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ master_id: 13 })
})


test('bookings calendar header opens multi-day draft without saving immediately', async ({ page }) => {
  const writes = await setup(page, [], false, true)
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(1)
  expect(writes).toHaveLength(0)
  await select(page, '2026-10-27')
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(2)
  await dialogFor(page).getByRole('button', { name: /Відкрити 2/ }).click()
  await expect(dialogFor(page)).toHaveCount(0)
  expect(writes).toHaveLength(2)
})


test('many selected days scroll inside a bounded list on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await setup(page)
  await dialogFor(page).getByRole('button', { name: 'Наступний місяць', exact: true }).click()
  await dialogFor(page).getByRole('button', { name: 'Увесь місяць', exact: true }).click()
  const list = dialogFor(page).locator('.availability-drafts')
  await expect(list.locator('[data-selected-date]')).toHaveCount(30)
  const metrics = await list.evaluate(el => {
    el.scrollTop = el.scrollHeight
    return { height: el.clientHeight, content: el.scrollHeight, scroll: el.scrollTop }
  })
  expect(metrics.height).toBeLessThanOrEqual(144)
  expect(metrics.content).toBeGreaterThan(metrics.height)
  expect(metrics.scroll).toBeGreaterThan(0)
  await page.screenshot({ path: 'output/availability-calendar/mobile-many-days.png', animations: 'disabled' })
})

test('closed calendar slot opens the new picker with selected time', async ({ page }) => {
  const writes = await setup(page, [], false, true)
  await dialogFor(page).getByRole('button', { name: 'Закрити', exact: true }).click()
  const slot = page.locator('button[data-slot-id]:enabled').first()
  const interval = await slot.getAttribute('aria-label')
  await slot.click()
  await expect(dialogFor(page)).toBeVisible()
  const [start, end] = interval!.split('-')
  await expect(dialogFor(page).getByLabel('Початок для всіх', { exact: true })).toHaveValue(start)
  await expect(dialogFor(page).getByLabel('Завершення для всіх', { exact: true })).toHaveValue(end)
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(1)
  expect(writes).toHaveLength(0)
})

test('open tab embeds the shared picker and returns to other tabs', async ({ page }) => {
  const writes = await setup(page, [], false, true)
  await dialogFor(page).getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.route(/\/masters\/me\/availability(?:\?|$)/, route => route.fulfill({ json: [{ id: 1, master_id: 13, start_at: '2026-10-25T07:30:00Z', end_at: '2026-10-25T18:00:00Z' }] }))
  await page.goto('/bookings')
  await page.locator('button[data-slot-id*="2026-10-25"]:enabled').first().click()
  await expect(page.getByRole('heading', { name: 'Новий інтервал', exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'Відкрити', exact: true }).click()
  await expect(dialogFor(page)).toBeVisible()
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(0)
  await expect(dialogFor(page).locator('[data-existing-date="2026-10-25"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Новий інтервал', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await page.getByRole('radio', { name: 'Блокування часу', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Блокування часу', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: 'Відкрити', exact: true }).click()
  await expect(dialogFor(page).locator('[data-existing-date="2026-10-25"]')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  expect(writes).toHaveLength(0)
})

test('mobile preview with nine selected days in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await dialogFor(page).getByRole('button', { name: 'Наступний місяць', exact: true }).click()
  for (const day of [2, 3, 5, 7, 10, 12, 17, 21, 26]) await select(page, `2026-11-${String(day).padStart(2, '0')}`)
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(9)
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.backofficeTheme = value }, theme)
    await page.screenshot({ path: `output/availability-calendar/mobile-nine-days-${theme}.png`, animations: 'disabled' })
  }
})

const existingDayWindows: ScheduleWindow[] = [
  { id: 71, master_id: 13, start_at: '2026-10-27T07:30:00Z', end_at: '2026-10-27T11:00:00Z' },
  { id: 72, master_id: 13, start_at: '2026-10-27T12:00:00Z', end_at: '2026-10-27T18:00:00Z' },
]

test('existing working day is visible and cannot be added again, including bulk selection', async ({ page }) => {
  const writes = await setup(page, [], false, false, { existing: existingDayWindows })
  const date = dialogFor(page).locator('[data-date="2026-10-27"]')
  await expect(date).toHaveClass(/is-existing/)
  await dialogFor(page).getByRole('button', { name: 'Закрити інтервали', exact: true }).click()
  await expect(dialogFor(page).locator('[data-existing-date="2026-10-27"]')).toBeVisible()
  await expect(dialogFor(page).locator('[data-selected-date="2026-10-27"]')).toHaveCount(0)
  await dialogFor(page).getByRole('button', { name: 'Увесь місяць', exact: true }).click()
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(7)
  await expect(dialogFor(page).locator('[data-selected-date="2026-10-27"]')).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test('close an existing day, then allow opening it again without deleting bookings', async ({ page }) => {
  const deletes: string[] = []
  const writes = await setup(page, [], false, false, { existing: existingDayWindows, deletes })
  await select(page, '2026-10-27')
  await dialogFor(page).getByRole('button', { name: 'Закрити день', exact: true }).click()
  await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).not.toHaveClass(/is-existing/)
  expect(deletes).toEqual(['/api/v1/backoffice/masters/me/availability/71', '/api/v1/backoffice/masters/me/availability/72'])
  expect(writes).toHaveLength(0)
  await select(page, '2026-10-27')
  await expect(dialogFor(page).locator('[data-selected-date="2026-10-27"]')).toBeVisible()
})

test('booked day closure reports the conflict and preserves the remaining schedule', async ({ page }) => {
  const deletes: string[] = []
  await setup(page, [], false, false, { existing: existingDayWindows, deletes, failedDeletes: [72] })
  await select(page, '2026-10-27')
  await dialogFor(page).getByRole('button', { name: 'Закрити день', exact: true }).click()
  await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).toHaveClass(/is-existing/)
  await expect(dialogFor(page).getByRole('alert').filter({ hasText: /бронюван/ }).first()).toBeVisible()
  expect(deletes).toHaveLength(2)
})

test('schedule load error prevents selecting unknown days until retry succeeds', async ({ page }) => {
  const options: ScheduleOptions = { failLoad: true }
  await setup(page, [], false, false, options)
  await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).toBeDisabled()
  options.failLoad = false
  await dialogFor(page).getByRole('button', { name: /Спробувати ще раз|Повторити/, exact: false }).click()
  await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).toBeEnabled()
  await select(page, '2026-10-27')
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(1)
})

test('invalid time identifies its date, describes the issue and moves focus to the problem', async ({ page }) => {
  const writes = await setup(page)
  await select(page, '2026-10-25')
  await select(page, '2026-10-27')
  await dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true }).fill('19:00')
  await dialogFor(page).getByLabel('Завершення 2026-10-27', { exact: true }).fill('18:00')
  await dialogFor(page).getByRole('button', { name: /Відкрити 2/ }).click()
  const input = dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true })
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-describedby', /.+/)
  await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).toHaveClass(/is-error/)
  await input.fill('11:00')
  await input.blur()
  await expect(input).not.toHaveAttribute('aria-invalid', 'true')
  expect(writes).toHaveLength(0)
})

test('common time validation stays beside its fields and never overwrites valid drafts', async ({ page }) => {
  await setup(page)
  await select(page, '2026-10-27')
  const input = dialogFor(page).getByLabel('Початок для всіх', { exact: true })
  await input.fill('25:00')
  await dialogFor(page).getByRole('button', { name: 'Застосувати до обраних', exact: true }).click()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true })).toHaveValue('09:30')
})

test('bookings has an obvious entry to the monthly schedule', async ({ page }) => {
  const writes = await setup(page, [], false, true)
  await dialogFor(page).getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.getByRole('button', { name: 'Мій графік', exact: true }).click()
  await expect(dialogFor(page)).toBeVisible()
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

for (const viewport of [{ name: 'mobile', width: 320, height: 844 }, { name: 'desktop', width: 1440, height: 1000 }]) {
  for (const theme of ['light', 'dark']) {
    test(`distinct calendar states and visible errors ${viewport.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      const writes = await setup(page, [], false, false, { existing: existingDayWindows })
      await page.evaluate(value => { document.documentElement.dataset.backofficeTheme = value }, theme)
      for (const date of ['2026-10-24', '2026-10-25', '2026-10-30']) await select(page, date)
      const today = dialogFor(page).locator('[data-date="2026-10-24"]')
      await expect(today).toHaveAttribute('aria-current', 'date')
      await expect(today).toHaveClass(/is-selected/)
      await expect(today.locator('.availability-today-dot')).toBeVisible()
      const input = dialogFor(page).getByLabel('Початок 2026-10-25', { exact: true })
      await input.focus()
      await expect(dialogFor(page).locator('[data-date="2026-10-25"]')).toHaveClass(/is-editing/)
      await expect(dialogFor(page).locator('[data-selected-date="2026-10-25"]')).toHaveClass(/is-editing/)
      await expect(today).not.toHaveClass(/is-editing/)
      await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).toHaveClass(/is-existing/)
      await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).not.toHaveClass(/is-selected/)
      await page.screenshot({ path: `output/availability-calendar/${viewport.name}-${theme}-states.png`, animations: 'disabled' })
      await input.fill('19:00')
      await dialogFor(page).getByLabel('Завершення 2026-10-25', { exact: true }).fill('18:00')
      await dialogFor(page).getByRole('button', { name: /Відкрити 3/ }).click()
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      await expect(input).toBeFocused()
      await expect(dialogFor(page).locator('[data-date="2026-10-25"]')).toHaveClass(/is-error/)
      const describedBy = await input.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      await expect(page.locator(`[id="${describedBy}"]`)).toContainText('Початок має бути раніше завершення.')
      await page.screenshot({ path: `output/availability-calendar/${viewport.name}-${theme}-error.png`, animations: 'disabled' })
      expect(await dialogFor(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect(writes).toHaveLength(0)
    })
  }
}

test('stale admin schedule cannot replace a different selected master', async ({ page }) => {
  await setup(page, [], true, false, { masters: [{ id: 13, first_name_uk: 'Тест', last_name_uk: 'Майстер' }, { id: 14, first_name_uk: 'Інший', last_name_uk: 'Майстер' }] })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(/\/backoffice\/availability(?:\?|$)/, async route => {
    const id = Number(new URL(route.request().url()).searchParams.get('master_id'))
    if (id === 13) await gate
    await route.fulfill({ json: id === 13 ? existingDayWindows : [{ id: 81, master_id: 14, start_at: '2026-10-29T07:30:00Z', end_at: '2026-10-29T18:00:00Z' }] })
  })
  try {
    const firstRequest = page.waitForRequest(r => /\/backoffice\/availability\?/.test(r.url()) && new URL(r.url()).searchParams.get('master_id') === '13')
    await dialogFor(page).getByRole('button', { name: /Виберіть майстра/ }).click()
    await dialogFor(page).getByRole('button', { name: /Тест Майстер/ }).click()
    await firstRequest
    await dialogFor(page).getByRole('button', { name: /Тест Майстер/ }).click()
    await dialogFor(page).getByRole('button', { name: /Інший Майстер/ }).click()
    await expect(dialogFor(page).locator('[data-date="2026-10-29"]')).toHaveClass(/is-existing/)
    const firstResponse = page.waitForResponse(r => /\/backoffice\/availability\?/.test(r.url()) && new URL(r.url()).searchParams.get('master_id') === '13')
    release()
    await firstResponse
    await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).not.toHaveClass(/is-existing/)
    await expect(dialogFor(page).locator('[data-date="2026-10-29"]')).toHaveClass(/is-existing/)
  } finally { release() }
})

test('fresh server schedule removes conflicting drafts before any save', async ({ page }) => {
  const writes = await setup(page)
  await select(page, '2026-10-25')
  await select(page, '2026-10-27')
  await page.route(/\/masters\/me\/availability(?:\?|$)/, route => route.fulfill({ json: existingDayWindows }))
  await dialogFor(page).getByRole('button', { name: /Відкрити 2/ }).click()
  await expect(dialogFor(page).locator('[data-selected-date="2026-10-27"]')).toHaveCount(0)
  await expect(dialogFor(page).locator('[data-selected-date="2026-10-25"]')).toBeVisible()
  await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).toHaveClass(/is-existing/)
  await expect(dialogFor(page).getByRole('alert').filter({ hasText: /уже є у графіку/ })).toBeVisible()
  expect(writes).toHaveLength(0)
})

test('mobile content variants with existing schedule in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page, [], false, false, { existing: existingDayWindows })
  await expect(dialogFor(page).locator('[data-date="2026-10-27"]')).toHaveClass(/is-existing/)
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.backofficeTheme = value }, theme)
    await page.screenshot({ path: `output/availability-calendar/mobile-${theme}-empty.png`, animations: 'disabled' })
  }
  await select(page, '2026-10-27')
  await expect(dialogFor(page).locator('[data-existing-date="2026-10-27"]')).toBeVisible()
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.backofficeTheme = value }, theme)
    await page.screenshot({ path: `output/availability-calendar/mobile-${theme}-existing.png`, animations: 'disabled' })
  }
  await select(page, '2026-10-25')
  await select(page, '2026-10-30')
  await dialogFor(page).getByLabel('Початок 2026-10-30', { exact: true }).fill('11:00')
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.backofficeTheme = value }, theme)
    await page.screenshot({ path: `output/availability-calendar/mobile-${theme}-two-days.png`, animations: 'disabled' })
  }
})

test('embedded planner preserves selected days and time while switching tabs', async ({ page }) => {
  await setup(page, [], false, true)
  await dialogFor(page).getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.locator('button[data-slot-id]:enabled').first().click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await select(page, '2026-10-27')
  await dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true }).fill('11:00')
  const count = await dialogFor(page).locator('[data-selected-date]').count()
  await page.getByRole('radio', { name: 'Ручне бронювання', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Ручне бронювання', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.availability-form')).toBeHidden()
  await page.getByRole('radio', { name: 'Блокування часу', exact: true }).click()
  await page.getByRole('radio', { name: 'Відкрити', exact: true }).click()
  await expect(page.locator('.availability-form')).toBeVisible()
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(count)
  await expect(dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true })).toHaveValue('11:00')
  await expect(page.getByRole('dialog')).toHaveCount(1)
})

test('mobile BaseModal stays at 95 percent height for calendar and block forms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  const targetHeight = 844 * 0.95
  await expect.poll(async () => Math.abs((await dialogFor(page).boundingBox())!.height - targetHeight)).toBeLessThanOrEqual(1)
  await dialogFor(page).getByRole('button', { name: 'Наступний місяць', exact: true }).click()
  await dialogFor(page).getByRole('button', { name: 'Увесь місяць', exact: true }).click()
  await expect(dialogFor(page).locator('[data-selected-date]')).toHaveCount(30)
  expect(Math.abs((await dialogFor(page).boundingBox())!.height - targetHeight)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Блокування', exact: true }).click()
  await expect.poll(async () => Math.abs((await page.getByRole('dialog').boundingBox())!.height - targetHeight)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('embedded saving locks tabs, Escape and backdrop until completion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page, [], false, true)
  await dialogFor(page).getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.locator('button[data-slot-id]:enabled').first().click()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/masters/me/availability/windows', async route => {
    await gate
    await route.fulfill({ json: { id: 100, master_id: 13, ...route.request().postDataJSON() } })
  })
  try {
    await dialogFor(page).getByRole('button', { name: /Відкрити 1/ }).click()
    await expect(page.getByRole('radio', { name: 'Ручне бронювання', exact: true })).toBeDisabled()
    await expect(dialogFor(page).getByRole('button', { name: 'Закрити', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await page.mouse.click(10, 10)
    await expect(page.getByRole('dialog')).toHaveCount(1)
    release()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  } finally { release() }
})

test('short mobile viewport retains modal height and reachable actions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await select(page, '2026-10-27')
  await dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true }).focus()
  await page.setViewportSize({ width: 390, height: 500 })
  await expect.poll(async () => Math.abs((await dialogFor(page).boundingBox())!.height - 475)).toBeLessThanOrEqual(1)
  const save = dialogFor(page).getByRole('button', { name: /Відкрити 1/ })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport()
  expect(await dialogFor(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: 'output/availability-calendar/mobile-short-viewport.png', animations: 'disabled' })
})

test('embedded invalid interval focuses the field on the first save click', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await setup(page, [], false, true)
  await dialogFor(page).getByRole('button', { name: 'Закрити', exact: true }).click()
  await page.locator('button[data-slot-id]:enabled').first().click()
  await select(page, '2026-10-27')
  const input = dialogFor(page).getByLabel('Початок 2026-10-27', { exact: true })
  await input.fill('19:00')
  await dialogFor(page).getByLabel('Завершення 2026-10-27', { exact: true }).fill('18:00')
  await dialogFor(page).getByRole('button', { name: /Відкрити 2/ }).click()
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('dialog')).toHaveCount(1)
})

for (const width of [320, 1440]) {
  test(`interval tabs remain visible above the scrolling planner ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 650 })
    await setup(page, [], false, true)
    await dialogFor(page).getByRole('button', { name: 'Закрити', exact: true }).click()
    await page.locator('button[data-slot-id]:enabled').first().click()
    const dialog = dialogFor(page)
    await dialog.getByRole('radio', { name: 'Ручне бронювання', exact: true }).click()
    await dialog.getByRole('radio', { name: 'Відкрити', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Очистити', exact: true }).click()
    await dialog.getByRole('button', { name: 'Наступний місяць', exact: true }).click()
    await dialog.getByRole('button', { name: 'Увесь місяць', exact: true }).click()
    await dialog.getByRole('button', { name: /Відкрити 30/ }).scrollIntoViewIfNeeded()
    for (const name of ['Відкрити', 'Ручне бронювання', 'Блокування часу']) {
      const tab = dialog.getByRole('radio', { name, exact: true })
      await expect(tab).toBeInViewport()
      expect((await tab.boundingBox())!.width).toBeGreaterThan(70)
    }
    await dialog.getByRole('radio', { name: 'Блокування часу', exact: true }).click()
    await dialog.getByRole('radio', { name: 'Відкрити', exact: true }).click()
    await expect(dialog.locator('[data-selected-date]')).toHaveCount(30)
    await page.screenshot({ path: `output/availability-calendar/fixed-tabs-${width}.png`, animations: 'disabled' })
  })
}
