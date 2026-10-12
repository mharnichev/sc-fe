import { expect, test } from '@playwright/test'

const user = { id: 5, email: 'receipts@example.test', role: 'admin', is_superuser: true, is_active: true, can_post_inventory: true }
const receipt = (id: number, status = 'draft') => ({ id, status, reason: `Поставка ${id}`, comment: null, posted_at: status === 'posted' ? '2026-10-12T08:00:00Z' : null, created_at: '2026-10-12T07:00:00Z', updated_at: '2026-10-12T07:00:00Z', items: [] })

for (const width of [390, 1440]) {
  test(`receipt list includes drafts and posted documents at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'receipts-test', user })), user)
    let fail = true
    let empty = false
    const listPages: string[] = []
    await page.route('**/*', async route => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue()
      const url = new URL(route.request().url())
      if (!url.pathname.includes('/backoffice/')) return route.continue()
      if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: user })
      if (url.pathname.endsWith('/inventory/receipts')) {
        listPages.push(url.searchParams.get('page') || '1')
        expect(route.request().method()).toBe('GET')
        if (fail) return route.fulfill({ status: 500, json: { detail: 'List unavailable' } })
        const current = Number(url.searchParams.get('page') || '1')
        return route.fulfill({ json: { total: empty ? 0 : 21, page: current, page_size: 20, items: empty ? [] : current === 1 ? [receipt(21), receipt(20, 'posted')] : [receipt(1)] } })
      }
      if (url.pathname.endsWith('/inventory/receipts/21')) return route.fulfill({ json: receipt(21) })
      return route.fulfill({ json: { items: [], total: 0 } })
    })
    await page.goto('/inventory/receiving')
    await expect(page.getByRole('alert')).toContainText('List unavailable', { timeout: 20_000 })
    fail = false
    await page.getByRole('button', { name: 'Оновити список' }).click()
    const list = page.locator('section[aria-labelledby="receipt-list-title"]')
    await expect(list.getByText('Чернетка', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(list.getByText('Проведено', { exact: true }).filter({ visible: true })).toBeVisible()
    await page.screenshot({ path: `/tmp/receipts-${width}.png` })
    await list.getByRole('button', { name: 'Наступна' }).click()
    await expect(list.getByRole('link', { name: /Приймання #1\b/ }).filter({ visible: true })).toBeVisible()
    await list.getByRole('button', { name: 'Попередня' }).click()
    await list.getByRole('link', { name: /Приймання #21/ }).filter({ visible: true }).click()
    await expect(page).toHaveURL(/id=21/)
    await expect(page.getByText('Приймання #21 · Поставка 21')).toBeVisible()
    await page.getByRole('link', { name: '← До списку приймань' }).click()
    await expect(page).toHaveURL(/\/inventory\/receiving$/)
    await expect(page.locator('section[aria-labelledby="receipt-list-title"]')).toBeVisible()
    expect(listPages).toContain('2')
    empty = true
    await page.getByRole('button', { name: 'Оновити список' }).click()
    await expect(page.getByText('Приймань ще немає', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Нове приймання', exact: true })).toBeVisible()
  })
}
