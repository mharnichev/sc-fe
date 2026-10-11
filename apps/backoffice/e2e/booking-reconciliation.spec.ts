import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  for (const lostArchiveResponse of [false, true]) {
  test(`stale booking recovers inside modal at ${width}px${lostArchiveResponse ? ' after lost archive response' : ''}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const user = { id: 7, email: 'barber@test.invalid', role: 'barber', master_id: 7, is_active: true, is_superuser: false }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date())
    const booking = { id: 901, master_id: 7, customer_name: 'Тест актуальності', customer_phone: '+380500000000', status: 'confirmed', start_at: `${today}T10:00:00+03:00`, end_at: `${today}T11:00:00+03:00`, service_id: 11, service_ids: [11], service_prices: {}, services: [] }
    let archived = false
    let deletes = 0
    let completed = false
    let reads = 0
    let mutations = 0
    let listReads = 0
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
    })
    await page.addInitScript(user => {
      localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'test', refreshToken: 'test', user }))
    }, user)
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/masters/me/bookings/901') && route.request().method() === 'DELETE') {
        archived = true
        deletes++
        if (lostArchiveResponse) return route.abort('failed')
        return route.fulfill({ status: 204 })
      }
      if (path.endsWith('/bookings/901/status')) {
        completed = true
        mutations++
        return route.fulfill({ status: 400, json: { detail: 'Completed bookings cannot be modified' } })
      }
      let json: unknown = []
      if (path.endsWith('/auth/me')) json = user
      else if (path.endsWith('/masters/me/bookings/901')) {
        reads++
        if (archived) return route.fulfill({ status: 404, json: { detail: 'Booking not found' } })
        json = { ...booking, status: completed ? 'completed' : 'confirmed', completed_at: completed ? `${today}T20:00:00+03:00` : null }
      }
      else if (path.endsWith('/masters/me/bookings')) { listReads++; json = archived ? [] : [booking] }
      else if (path.endsWith('/services')) json = [{ id: 11, name_uk: 'Стрижка', price: 500, duration_minutes: 60, is_active: true }]
      else if (path.endsWith('/masters')) json = [{ id: 7, full_name: 'Тест Майстер', is_active: true }]
      await route.fulfill({ json })
    })
    await page.goto('/my-bookings')
    await page.getByRole('button', { name: 'Переглянути бронювання' }).first().click()
    const modal = page.getByRole('dialog').first()
    const complete = modal.getByRole('button', { name: 'Завершено', exact: true })
    await expect(complete).toBeEnabled()
    expect(reads).toBe(1)
    const listsBefore = listReads
    await complete.click()
    await expect(modal.getByText(/Цей запис уже завершено/)).toBeVisible()
    await expect(complete).toHaveCount(0)
    await expect(modal.getByRole('button', { name: 'Видалити', exact: true })).toBeEnabled()
    await expect(modal).toBeVisible()
    await expect(page.getByText('Completed bookings cannot be modified')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`reconciled-${width}.png`) })
    expect(mutations).toBe(1)
    expect(reads).toBe(2)
    expect(listReads).toBe(listsBefore)
    await expect(modal.getByText('Перевіряємо актуальність запису…')).toHaveCount(0)
    await modal.getByRole('button', { name: 'Видалити', exact: true }).click()
    const confirmation = page.getByRole('dialog').last()
    await expect(confirmation.getByText(/Запис буде збережено в архіві/)).toBeVisible()
    await confirmation.getByRole('button', { name: 'Видалити', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Переглянути бронювання' })).toHaveCount(0)
    expect(deletes).toBe(1)
    expect(reads).toBe(lostArchiveResponse ? 3 : 2)
  })
  }
}
