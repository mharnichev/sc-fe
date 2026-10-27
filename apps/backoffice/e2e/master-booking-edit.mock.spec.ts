import { expect, test, type Page } from '@playwright/test'

test.use({ timezoneId: 'Europe/Kyiv', locale: 'uk-UA' })

async function setup(page: Page, path: string, options: { completed?: boolean; foreign?: boolean; admin?: boolean } = {}) {
  const user = { id: 7, email: 'barber@example.test', role: options.admin ? 'admin' : 'barber', master_id: options.admin ? null : 7, is_superuser: Boolean(options.admin), is_active: true }
  const services = [{ id: 11, title_uk: 'Стрижка', name: 'Стрижка', price: 500, duration_minutes: 60 }, { id: 12, title_uk: 'Борода', name: 'Борода', price: 250, duration_minutes: 30 }]
  let booking = { id: 901, master_id: options.foreign ? 8 : 7, customer_name: 'Тест редагування', customer_phone: '+380500000000', status: options.completed ? 'completed' : 'confirmed', start_at: '2026-10-27T10:00:00+02:00', end_at: '2026-10-27T11:00:00+02:00', service_id: 11, service_ids: [11], service_prices: { 11: 500 } as Record<number, number>, services: [services[0]], subtotal_amount: 500, total_amount: 500 }
  const writes: Array<{ path: string; body: Record<string, unknown> }> = []
  await page.clock.install({ time: new Date('2026-10-26T06:00:00Z') })
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture', refreshToken: '', user })), user)
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON()
      writes.push({ path: pathname, body })
      booking = { ...booking, ...body }
      if (body.service_prices) booking.service_prices = Object.fromEntries(body.service_prices.map((item: { service_id: number; price_amount: number }) => [item.service_id, item.price_amount]))
      if (body.service_ids) booking.services = services.filter(service => body.service_ids.includes(service.id))
      return route.fulfill({ json: booking })
    }
    if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { detail: 'Unexpected mutation' } })
    if (pathname.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (pathname.endsWith('/bookings/901')) return route.fulfill({ json: booking })
    if (pathname.endsWith('/bookings') || pathname.endsWith('/masters/me/calendar')) return route.fulfill({ json: [booking] })
    if (pathname.endsWith('/services')) return route.fulfill({ json: services })
    if (pathname.endsWith('/masters')) return route.fulfill({ json: [{ id: 7, admin_user_id: 7, first_name_uk: 'Тест', last_name_uk: 'Майстер' }, { id: 8, admin_user_id: 8, first_name_uk: 'Інший', last_name_uk: 'Майстер' }] })
    return route.fulfill({ json: [] })
  })
  await page.goto(path)
  if (path === '/my-bookings') await page.getByRole('button', { name: 'Переглянути бронювання', exact: true }).first().click()
  else await page.getByRole('button', { name: /Тест редагування/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Перевіряємо актуальність запису…')).toHaveCount(0)
  return writes
}

for (const path of ['/my-bookings', '/bookings']) {
  for (const width of [390, 1440]) {
    test(`master edits price, time and services ${path} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      const writes = await setup(page, path)
      const dialog = page.getByRole('dialog')
      await page.evaluate(theme => { document.documentElement.dataset.backofficeTheme = theme }, path === '/my-bookings' ? 'light' : 'dark')
      await expect(dialog.locator('.booking-edit-icon')).toHaveCount(3)
      expect((await dialog.locator('.booking-edit-icon').allTextContents()).map(text => text.trim())).toEqual(['', '', ''])
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await page.screenshot({ path: `output/booking-details/compact-${width}-${path === '/my-bookings' ? 'light' : 'dark'}.png`, animations: 'disabled' })
      await dialog.getByRole('button', { name: 'Редагувати ціну бронювання', exact: true }).click()
      const price = dialog.getByRole('spinbutton', { name: /Ціна.*Стрижка/ })
      await expect(dialog.getByLabel('Акція бронювання')).toHaveCount(0)
      await price.fill('650')
      await price.locator('xpath=ancestor::form').getByRole('button', { name: 'Зберегти', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Редагувати ціну бронювання', exact: true })).toBeVisible()
      expect(writes[0]).toEqual({ path: '/api/v1/backoffice/bookings/901', body: { service_prices: [{ service_id: 11, price_amount: 650 }] } })
      await dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true }).click()
      await dialog.getByLabel('Початок', { exact: true }).fill('12:00')
      const duration = dialog.getByLabel('Тривалість, хв', { exact: true })
      await duration.fill('45')
      await duration.locator('xpath=ancestor::form').getByRole('button', { name: 'Зберегти', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true })).toBeVisible()
      expect(writes[1]).toEqual({ path: '/api/v1/backoffice/masters/me/bookings/901', body: { start_at: '2026-10-27T10:00:00.000Z', end_at: '2026-10-27T10:45:00.000Z' } })
      await dialog.getByRole('button', { name: 'Редагувати послуги бронювання', exact: true }).click()
      const trigger = dialog.locator('[data-multiselect-trigger]')
      await trigger.click()
      await dialog.getByRole('checkbox', { name: /Борода/ }).click()
      await dialog.getByRole('button', { name: 'Закрити список', exact: true }).click()
      await trigger.locator('xpath=ancestor::form').getByRole('button', { name: 'Зберегти', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Редагувати послуги бронювання', exact: true })).toBeVisible()
      expect(writes[2]).toEqual({ path: '/api/v1/backoffice/masters/me/bookings/901', body: { service_ids: [11, 12] } })
    })
  }
}

for (const options of [{ completed: true }, { foreign: true }]) {
  test(`master cannot edit ${options.completed ? 'completed' : 'foreign'} booking`, async ({ page }) => {
    const writes = await setup(page, '/bookings', options)
    await expect(page.getByRole('dialog').getByRole('button', { name: /Редагувати (ціну|час|послуги)/ })).toHaveCount(0)
    expect(writes).toEqual([])
  })
}

test('admin retains completed booking pricing and promotions', async ({ page }) => {
  await setup(page, '/bookings', { admin: true, completed: true })
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Редагувати ціни та акцію бронювання', exact: true }).click()
  await expect(dialog.getByLabel('Акція бронювання')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true })).toHaveCount(0)
})

for (const width of [390, 1440]) {
  test(`shared time edit and inline actions ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setup(page, '/bookings')
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('.booking-tone--time')).toHaveCount(1)
    await expect(dialog.locator('.booking-tone--time').getByRole('button', { name: 'Редагувати час бронювання', exact: true })).toHaveCount(1)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.backofficeTheme = theme }, theme)
      const edit = dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true })
      await expect(edit).toHaveCSS('color', 'rgb(255, 255, 255)')
      await expect(edit.locator('svg')).toHaveCSS('color', 'rgb(255, 255, 255)')
      await edit.focus()
      await edit.press('Enter')
      const form = dialog.getByLabel('Тривалість, хв', { exact: true }).locator('xpath=ancestor::form')
      const save = form.getByRole('button', { name: 'Зберегти', exact: true })
      const cancel = form.getByRole('button', { name: 'Скасувати', exact: true })
      await cancel.scrollIntoViewIfNeeded()
      const saveBox = await save.boundingBox(), cancelBox = await cancel.boundingBox()
      expect(Math.abs(saveBox!.y - cancelBox!.y)).toBeLessThan(1)
      expect(cancelBox!.x).toBeGreaterThan(saveBox!.x)
      await expect(cancel).toHaveClass(/base-button--danger/)
      await expect(save).toHaveCSS('color', 'rgb(255, 255, 255)')
      await expect(save.locator('svg')).toHaveCSS('color', 'rgb(255, 255, 255)')
      await page.screenshot({ path: `output/booking-details/shared-time-${width}-${theme}.png`, animations: 'disabled' })
      await cancel.click()
    }
    await page.emulateMedia({ forcedColors: 'active' })
    const edit = dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true })
    await edit.focus()
    await expect(edit).toBeFocused()
    await expect(edit).toBeVisible()
  })
}

for (const path of ['/my-bookings', '/bookings']) {
  for (const width of [390, 1440]) {
    test(`linked start end duration persists ${path} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      const writes = await setup(page, path)
      let dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true }).click()
      const start = dialog.getByLabel('Початок', { exact: true })
      const end = dialog.getByLabel('Завершення', { exact: true })
      const duration = dialog.getByLabel('Тривалість, хв', { exact: true })
      await expect(start).toHaveValue('10:00')
      await expect(end).toHaveValue('11:00')
      await end.fill('12:00')
      await expect(duration).toHaveValue('120')
      await duration.fill('90')
      await expect(end).toHaveValue('11:30')
      await start.fill('12:00')
      await expect(end).toHaveValue('13:30')
      const form = duration.locator('xpath=ancestor::form')
      const [a, b] = await form.locator('input[placeholder="ГГ:ХХ"]').evaluateAll(inputs => inputs.map(input => {
        const { x, y } = input.getBoundingClientRect()
        return { x, y }
      }))
      expect(Math.abs(a.y - b.y)).toBeLessThan(1)
      expect(b.x).toBeGreaterThan(a.x)
      await end.fill('11:00')
      await form.getByRole('button', { name: 'Зберегти', exact: true }).click()
      await expect(form.getByRole('alert')).toContainText('Завершення має бути пізніше')
      expect(writes).toHaveLength(0)
      await end.fill('13:15')
      await expect(duration).toHaveValue('75')
      await page.screenshot({ path: `output/booking-details/linked-time-${width}-${path === '/my-bookings' ? 'list' : 'calendar'}.png`, animations: 'disabled' })
      await form.getByRole('button', { name: 'Зберегти', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true })).toBeVisible()
      expect(writes[0]).toEqual({ path: '/api/v1/backoffice/masters/me/bookings/901', body: { start_at: '2026-10-27T10:00:00.000Z', end_at: '2026-10-27T11:15:00.000Z' } })
      await dialog.getByRole('button', { name: 'Закрити', exact: true }).click()
      if (path === '/my-bookings') await page.getByRole('button', { name: 'Переглянути бронювання', exact: true }).first().click()
      else await page.getByRole('button', { name: /Тест редагування/ }).first().click()
      dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true }).click()
      await expect(dialog.getByLabel('Початок', { exact: true })).toHaveValue('12:00')
      await expect(dialog.getByLabel('Завершення', { exact: true })).toHaveValue('13:15')
      await expect(dialog.getByLabel('Тривалість, хв', { exact: true })).toHaveValue('75')
    })
  }
}

for (const path of ['/my-bookings', '/bookings']) {
  test(`failed schedule save retains draft and shows reason ${path}`, async ({ page }) => {
    await setup(page, path)
    let patches = 0
    await page.route('**/masters/me/bookings/901', async route => {
      if (route.request().method() !== 'PATCH') return route.fallback()
      patches++
      return route.fulfill({ status: 400, json: { detail: 'Slot is in the past' } })
    })
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Редагувати час бронювання', exact: true }).click()
    const start = dialog.getByLabel('Початок', { exact: true })
    const end = dialog.getByLabel('Завершення', { exact: true })
    await start.fill('12:00')
    await end.fill('13:15')
    const form = start.locator('xpath=ancestor::form')
    await form.getByRole('button', { name: 'Зберегти', exact: true }).click()
    await expect(form.getByRole('alert')).toContainText('Новий час початку вже минув')
    await expect(start).toHaveValue('12:00')
    await expect(end).toHaveValue('13:15')
    await expect(dialog.getByLabel('Тривалість, хв', { exact: true })).toHaveValue('75')
    await expect(form.getByRole('button', { name: 'Зберегти', exact: true })).toBeEnabled()
    expect(patches).toBe(1)
  })
}

for (const path of ['/my-bookings', '/bookings']) {
  for (const width of [390, 1440]) {
    test(`master replaces service and reopens persisted selection ${path} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      const writes = await setup(page, path)
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Редагувати послуги бронювання', exact: true }).click()
      const trigger = dialog.locator('[data-multiselect-trigger]')
      const initialForm = trigger.locator('xpath=ancestor::form')
      await initialForm.getByRole('button', { name: 'Зберегти', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Редагувати послуги бронювання', exact: true })).toBeVisible()
      expect(writes).toEqual([])
      await dialog.getByRole('button', { name: 'Редагувати послуги бронювання', exact: true }).click()
      await trigger.click()
      await dialog.getByRole('checkbox', { name: /Стрижка/ }).click()
      await dialog.getByRole('checkbox', { name: /Борода/ }).click()
      await dialog.getByRole('button', { name: 'Закрити список', exact: true }).click()
      const form = trigger.locator('xpath=ancestor::form')
      await form.getByRole('button', { name: 'Зберегти', exact: true }).click()
      await expect(dialog.getByRole('button', { name: 'Редагувати послуги бронювання', exact: true })).toBeVisible()
      expect(writes).toEqual([{ path: '/api/v1/backoffice/masters/me/bookings/901', body: { service_ids: [12] } }])
      await dialog.getByRole('button', { name: 'Редагувати послуги бронювання', exact: true }).click()
      await expect(dialog.getByRole('group', { name: 'Вибрані значення: 1', exact: true })).toContainText('Борода')
      await expect(dialog.getByRole('button', { name: 'Прибрати Стрижка', exact: true })).toHaveCount(0)
    })
  }
  test(`rejected service change keeps draft with inline reason ${path}`, async ({ page }) => {
    await setup(page, path)
    let patches = 0
    await page.route('**/masters/me/bookings/901', async route => {
      if (route.request().method() !== 'PATCH') return route.fallback()
      patches++
      return route.fulfill({ status: 409, json: { detail: "Booking slot is outside master's open availability" } })
    })
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Редагувати послуги бронювання', exact: true }).click()
    const trigger = dialog.locator('[data-multiselect-trigger]')
    await trigger.click()
    await dialog.getByRole('checkbox', { name: /Борода/ }).click()
    await dialog.getByRole('button', { name: 'Закрити список', exact: true }).click()
    const form = trigger.locator('xpath=ancestor::form')
    await form.getByRole('button', { name: 'Зберегти', exact: true }).click()
    await expect(form.getByRole('alert')).toContainText('відкриту доступність')
    await expect(form.getByRole('group', { name: 'Вибрані значення: 2', exact: true })).toContainText('Борода')
    await expect(form.getByRole('button', { name: 'Зберегти', exact: true })).toBeEnabled()
    expect(patches).toBe(1)
  })
}
