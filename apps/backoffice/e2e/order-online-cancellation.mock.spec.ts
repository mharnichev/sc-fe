import { expect, test, type Page } from '@playwright/test'

const actor = { id: 11, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const orderId = 321
const orderPath = `/backoffice/orders/${orderId}`
const cancellationPath = `${orderPath}/cancellation`
const order = {
  id: orderId, status: 'pending', archived: false, channel: 'shop', simulation: false, fulfillment_method: 'nova_poshta',
  customer_name: 'Тестовий клієнт', payment_method: 'onlineCard', total_amount: '1049.00', subtotal_amount: '1049.00',
  discount_amount: '0.00', items: [], shipments: [], payments: [], revision: 7, payment_status: 'unpaid',
  fulfillment_status: 'reserved', fiscal_status: 'not_requested', created_at: '2026-11-10T12:00:00Z',
}
const available = {
  order_id: orderId, revision: 7, order_status: 'pending', archived: false, can_cancel: true,
  payment_status: 'unpaid', fiscal_status: 'not_requested', fulfillment_status: 'reserved',
  active_reservation_quantity: 2, released_reservation_quantity: 0, cancelled_at: null as string | null,
  cancelled_by_user_id: null as number | null, comment: null as string | null, late_payment_verified: false,
  reconciliation: { payment: false, receipt: false, inventory: false },
}

type Scenario = 'paid' | 'unknown' | 'late-payment' | 'lost-response' | 'server-error' | 'revision' | 'idempotency' | 'forbidden' | 'old-backend'

async function fixture(page: Page, scenario: Scenario) {
  let cancellation = { ...available }
  if (scenario === 'paid') cancellation = {
    ...available, order_status: 'completed', payment_status: 'paid_production', fiscal_status: 'mono_checkbox_external_accepted',
    fulfillment_status: 'fulfilled', active_reservation_quantity: 0,
    reconciliation: { payment: true, receipt: true, inventory: true },
  }
  if (scenario === 'unknown' || scenario === 'late-payment') cancellation = {
    ...available, payment_status: 'failed', reconciliation: { payment: true, receipt: false, inventory: false },
  }
  let current = { ...order, status: cancellation.order_status, payment_status: cancellation.payment_status,
    fiscal_status: cancellation.fiscal_status, fulfillment_status: cancellation.fulfillment_status }
  const commands: Array<{ key?: string, body: { expected_revision: number, comment?: string } }> = []
  const reads: number[] = []
  const listReads: Array<{ archive: string | null, search: string | null }> = []
  const unexpectedWrites: string[] = []
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), actor)
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api\/v1/, '')
    if (path === cancellationPath && request.method() === 'GET') {
      if (scenario === 'late-payment' && cancellation.archived && !cancellation.late_payment_verified) {
        cancellation = { ...cancellation, revision: cancellation.revision + 1, payment_status: 'paid', late_payment_verified: true }
      }
      reads.push(cancellation.revision)
      if (scenario === 'old-backend' || scenario === 'forbidden') {
        return route.fulfill({ status: scenario === 'old-backend' ? 404 : 403, json: { detail: 'Unavailable' } })
      }
      return route.fulfill({ json: cancellation })
    }
    if (path === cancellationPath && request.method() === 'POST') {
      commands.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() })
      const first = commands.length === 1
      if (first && scenario === 'server-error') return route.fulfill({ status: 503, json: { detail: 'Fixture unavailable' } })
      if (first && (scenario === 'revision' || scenario === 'idempotency')) {
        cancellation = { ...cancellation, revision: 8, payment_status: 'paid' }
        current = { ...current, revision: 8, payment_status: 'paid' }
        return route.fulfill({ status: 409, json: { detail: scenario === 'revision'
          ? { code: 'revision_conflict', cancellation }
          : { code: 'idempotency_conflict' },
        } })
      }
      if (!cancellation.archived) {
        cancellation = { ...cancellation, revision: cancellation.revision + 1, order_status: 'cancelled',
          archived: true, can_cancel: false, released_reservation_quantity: cancellation.active_reservation_quantity,
          active_reservation_quantity: 0, cancelled_at: '2026-11-10T12:05:00Z', cancelled_by_user_id: actor.id,
          comment: commands[commands.length - 1].body.comment ?? null }
        current = { ...current, status: 'cancelled', archived: true, revision: cancellation.revision }
      }
      if (first && scenario === 'lost-response') return route.abort('failed')
      return route.fulfill({ json: cancellation })
    }
    if (request.method() !== 'GET') {
      unexpectedWrites.push(`${request.method()} ${path}`)
      return route.fulfill({ status: 405, json: { detail: 'Unexpected write' } })
    }
    if (path.endsWith('/auth/me')) return route.fulfill({ json: actor })
    if (path === orderPath) return route.fulfill({ json: current })
    if (path === `${orderPath}/fulfillment`) return route.fulfill({ json: { items: [] } })
    if (path === '/backoffice/orders') {
      const archive = url.searchParams.get('archive'), search = url.searchParams.get('search')
      listReads.push({ archive, search })
      const items = (archive === 'archived') === current.archived && (!search || search === String(orderId)) ? [current] : []
      return route.fulfill({ json: { items, total: items.length } })
    }
    if (path.endsWith(`/orders/${orderId}/profile`)) return route.fulfill({ json: { order_id: orderId, fiscal_profile: 'unavailable' } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(cancellationPath) && response.request().method() === 'GET'),
    page.goto(`/orders/${orderId}`),
  ])
  expect(response.status()).toBe(scenario === 'old-backend' ? 404 : scenario === 'forbidden' ? 403 : 200)
  return { commands, reads, listReads, unexpectedWrites }
}

const cancelAction = (page: Page) => page.getByRole('button', { name: 'Скасувати й архівувати', exact: true })
const cancelDialog = (page: Page) => page.getByRole('dialog', { name: 'Скасувати й архівувати замовлення' })
const confirm = (page: Page) => cancelDialog(page).getByRole('button', { name: 'Підтвердити скасування', exact: true })
const headerStatus = (page: Page) => page.locator('header').getByText('Скасовано', { exact: true })
const orderLink = (page: Page) => page.getByRole('link', { name: '#321', exact: true })

test('paid and handed-over order is archived once while retaining payment and direct access', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { commands, listReads, unexpectedWrites } = await fixture(page, 'paid')
  await cancelAction(page).click()
  await expect(cancelDialog(page).getByText('Замовлення оплачене. Кошти автоматично не повернуться.')).toBeVisible()
  await expect(cancelDialog(page).getByText('Переданий товар потрібно повернути окремо.')).toBeVisible()
  await expect(cancelDialog(page).getByText('Чек повернення оформлюється окремо.')).toBeVisible()
  await confirm(page).dblclick()
  await expect(headerStatus(page)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Стан замовлення' }).getByText('Оплачено', { exact: true })).toBeVisible()
  await expect(page.getByText('Потрібна звірка: Оплата, Чек, Товар')).toBeVisible()
  expect(commands).toHaveLength(1)

  await page.getByRole('link', { name: 'До архіву' }).click()
  await expect(orderLink(page)).toBeVisible()
  await page.getByRole('button', { name: 'Активні' }).click()
  await expect.poll(() => listReads.at(-1)?.archive).toBe('active')
  await expect(orderLink(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Архів', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Пошук замовлень' }).fill('321')
  await page.getByRole('button', { name: 'Знайти', exact: true }).click()
  await expect.poll(() => listReads.at(-1)).toEqual({ archive: 'archived', search: '321' })
  expect(new URL(page.url()).searchParams.has('q')).toBe(false)
  await orderLink(page).click()
  await expect(headerStatus(page)).toBeVisible()
  await expect(cancelAction(page)).toHaveCount(0)
  expect(unexpectedWrites).toEqual([])
})

test('unknown payment can be archived on mobile and keeps the reconciliation warning', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { commands, unexpectedWrites } = await fixture(page, 'unknown')
  await page.getByRole('button', { name: 'Змінити статус', exact: true }).click()
  const statusDialog = page.getByRole('dialog', { name: 'Змінити статус замовлення' })
  await statusDialog.getByRole('button', { name: 'Новий статус' }).press('ArrowDown')
  await statusDialog.getByRole('option', { name: 'Відмова', exact: true }).press('Enter')
  await statusDialog.getByRole('button', { name: 'Продовжити', exact: true }).click()
  expect(commands).toHaveLength(0)
  await expect(cancelDialog(page).getByText('Статус платежу потребує перевірки.', { exact: false })).toBeVisible()
  await expect(cancelDialog(page).getByText('Буде знято активний резерв: 2 шт.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await confirm(page).click()
  await expect(headerStatus(page)).toBeVisible()
  await expect(page.getByText('Знято резерв: 2 шт.')).toBeVisible()
  await expect(page.getByText('Потрібна звірка: Оплата')).toBeVisible()
  expect(commands).toHaveLength(1)
  expect(unexpectedWrites).toEqual([])
})

test('fresh archive facts show a verified late payment without reopening the order', async ({ page }) => {
  const { commands } = await fixture(page, 'late-payment')
  await cancelAction(page).click()
  await confirm(page).click()
  await expect(headerStatus(page)).toBeVisible()
  await expect(page.getByText('Оплату підтверджено після скасування.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Стан замовлення' }).getByText('Оплачено', { exact: true })).toBeVisible()
  await expect(cancelAction(page)).toHaveCount(0)
  expect(commands).toHaveLength(1)
})

test('API failure allows exact retry after reload without a false success', async ({ page }) => {
  const { commands, unexpectedWrites } = await fixture(page, 'server-error')
  await cancelAction(page).click()
  expect(commands).toEqual([])
  await cancelDialog(page).getByLabel('Коментар адміністратора (необов’язково)').fill('Тестова причина')
  await confirm(page).click()
  await expect(cancelDialog(page).getByRole('alert')).toContainText('Результат не підтверджено')
  await expect(headerStatus(page)).toHaveCount(0)
  expect(commands[0]).toEqual({ key: expect.stringMatching(/^[0-9a-f-]{36}$/), body: { expected_revision: 7, comment: 'Тестова причина' } })

  await page.reload()
  await page.getByRole('button', { name: 'Повторити скасування', exact: true }).click()
  await expect(cancelDialog(page).getByLabel('Коментар адміністратора (необов’язково)')).toBeDisabled()
  await cancelDialog(page).getByRole('button', { name: 'Повторити запит', exact: true }).click()
  await expect(headerStatus(page)).toBeVisible()
  expect(commands).toEqual([commands[0], commands[0]])
  expect(unexpectedWrites).toEqual([])
})

test('a committed cancellation with a lost response is recovered by GET without another POST', async ({ page }) => {
  const { commands, reads, unexpectedWrites } = await fixture(page, 'lost-response')
  await cancelAction(page).click()
  await confirm(page).click()
  await expect(cancelDialog(page).getByRole('alert')).toBeVisible()
  await page.reload()
  await expect(headerStatus(page)).toBeVisible()
  await expect.poll(() => reads).toEqual([7, 8])
  await expect(page.getByRole('button', { name: /Скасувати й архівувати|Повторити скасування/ })).toHaveCount(0)
  expect(commands).toHaveLength(1)
  expect(unexpectedWrites).toEqual([])
})

for (const scenario of ['revision', 'idempotency'] as const) {
  test(`${scenario} conflict requires a new confirmation with fresh payment facts`, async ({ page }) => {
    const { commands, reads, unexpectedWrites } = await fixture(page, scenario)
    await cancelAction(page).click()
    await confirm(page).click()
    await expect(cancelDialog(page)).toBeHidden()
    await expect(page.getByText('Замовлення змінилося.', { exact: false })).toBeVisible()
    expect(reads).toEqual(scenario === 'revision' ? [7] : [7, 8])
    expect(commands).toHaveLength(1)
    await cancelAction(page).click()
    await expect(cancelDialog(page).getByText('Замовлення оплачене. Кошти автоматично не повернуться.')).toBeVisible()
    await confirm(page).click()
    await expect(headerStatus(page)).toBeVisible()
    expect(commands.map(command => command.body)).toEqual([{ expected_revision: 7 }, { expected_revision: 8 }])
    expect(commands[1].key).not.toBe(commands[0].key)
    expect(unexpectedWrites).toEqual([])
  })
}

for (const scenario of ['old-backend', 'forbidden'] as const) {
  test(`${scenario} leaves no cancellation action or generic PATCH fallback`, async ({ page }) => {
    const { commands, unexpectedWrites } = await fixture(page, scenario)
    await expect(cancelAction(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Змінити статус', exact: true }).click()
    const statuses = page.getByRole('button', { name: 'Новий статус' })
    await expect(statuses).toHaveText('Очікує')
    await statuses.click()
    await expect(page.getByRole('option', { name: 'Підтверджено', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Відмова', exact: true })).toHaveCount(0)
    expect(commands).toEqual([])
    expect(unexpectedWrites).toEqual([])
  })
}
