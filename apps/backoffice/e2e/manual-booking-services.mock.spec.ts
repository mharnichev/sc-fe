import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`manual booking services ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.clock.install({ time: new Date('2026-10-25T06:00:00Z') })
      const user = { id: 13, email: 'fixture@example.test', role: 'barber', master_id: 13, is_active: true, is_superuser: false }
      await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture', refreshToken: '', user })), user)
      await page.route('**/api/v1/**', async route => {
        const path = new URL(route.request().url()).pathname
        if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { detail: 'Unexpected mutation' } })
        if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
        if (path.endsWith('/masters')) return route.fulfill({ json: [{ id: 13, admin_user_id: 13, first_name_uk: 'Тест', last_name_uk: 'Майстер' }] })
        if (path.endsWith('/services')) return route.fulfill({ json: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Послуга ${i + 1}`, title_uk: `Послуга ${i + 1}`, duration_minutes: 15, price: 200 })) })
        if (path.endsWith('/availability')) return route.fulfill({ json: [{ id: 1, master_id: 13, start_at: '2026-10-25T07:30:00Z', end_at: '2026-10-25T18:00:00Z' }] })
        return route.fulfill({ json: [] })
      })
      await page.goto('/bookings')
      await page.evaluate(theme => { document.documentElement.dataset.backofficeTheme = theme }, theme)
      await page.locator('button[data-slot-id*="2026-10-25"]:enabled').first().click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('radio', { name: 'Ручне бронювання', exact: true }).click()
      const trigger = dialog.locator('[data-multiselect-trigger]')
      await trigger.click()
      const search = dialog.getByPlaceholder('Пошук послуг')
      await search.fill('Послуга 20')
      // Safari/touch can report no next focus target between blur and the option click.
      await search.dispatchEvent('focusout', { relatedTarget: null })
      const option = dialog.getByRole('checkbox', { name: /Послуга 20/ })
      await option.click()
      await expect(option).toBeChecked()
      await search.fill('Послуга 19')
      await dialog.getByRole('checkbox', { name: /Послуга 19/ }).click()
      await dialog.getByRole('button', { name: 'Закрити список', exact: true }).click()
      await expect(trigger).toContainText('2/5')
      await expect(dialog.getByRole('spinbutton')).toHaveValue('30')
      await trigger.click()
      await dialog.getByRole('button', { name: 'Прибрати всі', exact: true }).click()
      await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(0)
      await dialog.getByRole('button', { name: 'Вибрати всі', exact: true }).click()
      await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(5)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('checkbox')).toHaveCount(0)
      await trigger.click()
      await dialog.getByPlaceholder('Пошук послуг').press('Tab')
      await expect(dialog.getByRole('button', { name: 'Закрити список', exact: true })).toBeFocused()
      await dialog.getByRole('heading', { name: 'Новий інтервал', exact: true }).click()
      await expect(dialog.getByRole('checkbox')).toHaveCount(0)
      expect(errors).toEqual([])
      await page.screenshot({ path: `output/service-select/manual-${width}-${theme}.png`, animations: 'disabled' })
    })
  }
}
