import { expect, test, type Page } from '@playwright/test'

const actor = { id: 11, email: 'fixture@example.test', is_active: true, is_superuser: true, role: 'admin' }
const orderId = 321
const orderPath = `/backoffice/orders/${orderId}`
const cancellationPath = `/backoffice/shop-payments/orders/${orderId}/online-payment/cancellation`
const order = {
  id: orderId, status: 'pending', channel: 'shop', simulation: false, fulfillment_method: 'nova_poshta',
  payment_method: 'onlineCard', total_amount: '1049.00', subtotal_amount: '1049.00', discount_amount: '0.00',
  items: [], shipments: [], payments: [], revision: 7, payment_status: 'unpaid', fulfillment_status: 'reserved',
}
const failedPayment = {
  payment_status: 'failed',
  payment_failure: {
    code: 'invoice_result_unconfirmed', missing: ['invoice_id', 'bank_dispatch_result'], reconciliation_required: true,
  },
}
const available = { order_id: orderId, revision: 7, order_status: 'pending', status: 'available', reason: 'invoice_not_dispatched' }
const unknown = { ...available, status: 'reconciliation_required', reason: 'invoice_dispatch_unconfirmed' }
const cancelled = { ...available, revision: 8, order_status: 'cancelled', status: 'cancelled', reason: 'order_cancelled' }

type Scenario = 'lost-request' | 'lost-response' | 'unknown' | 'conflict' | 'revision' | 'idempotency' | 'forbidden' | 'old-backend'

async function fixture(page: Page, scenario: Scenario) {
  let cancellation = scenario === 'unknown' ? unknown : available
  let current = scenario === 'unknown' ? { ...order, ...failedPayment } : order
  const commands: Array<{ key?: string, body: { expected_revision: number } }> = []
  const reads: number[] = []
  const unexpectedWrites: string[] = []
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', user })), actor)
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, '')
    if (path === cancellationPath && request.method() === 'GET') {
      reads.push(cancellation.revision)
      if (scenario === 'old-backend' || scenario === 'forbidden') {
        return route.fulfill({ status: scenario === 'old-backend' ? 404 : 403, json: { detail: 'Unavailable' } })
      }
      return route.fulfill({ json: cancellation })
    }
    if (path === cancellationPath && request.method() === 'POST') {
      commands.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() })
      const first = commands.length === 1
      if (first && scenario === 'lost-request') return route.abort('failed')
      if (first && scenario === 'conflict') {
        cancellation = unknown
        return route.fulfill({ status: 409, json: { detail: { code: unknown.reason, cancellation: unknown } } })
      }
      if (first && (scenario === 'revision' || scenario === 'idempotency')) {
        cancellation = { ...available, revision: 8 }
        current = { ...current, revision: 8 }
        return route.fulfill({ status: 409, json: { detail: { code: scenario === 'revision' ? 'revision_conflict' : 'idempotency_conflict' } } })
      }
      cancellation = { ...cancelled, revision: cancellation.revision + 1 }
      current = { ...order, status: 'cancelled', revision: cancellation.revision }
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
    if (path.endsWith(`/orders/${orderId}/profile`)) return route.fulfill({ json: { order_id: orderId, fiscal_profile: 'unavailable' } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(cancellationPath) && response.request().method() === 'GET'),
    page.goto(`/orders/${orderId}`),
  ])
  expect(response.status()).toBe(scenario === 'old-backend' ? 404 : scenario === 'forbidden' ? 403 : 200)
  await expect(page.getByRole('heading', { name: `Замовлення #${orderId}`, exact: true })).toBeVisible()
  expect(reads).toEqual([7])
  return { commands, reads, unexpectedWrites }
}

const cancelAction = (page: Page) => page.getByRole('button', { name: 'Скасувати замовлення', exact: true })
const cancelDialog = (page: Page) => page.getByRole('dialog', { name: 'Скасувати замовлення', exact: true })
const confirm = (page: Page) => cancelDialog(page).getByRole('button', { name: 'Підтвердити скасування', exact: true })
const headerStatus = (page: Page) => page.locator('header').getByText('Скасовано', { exact: true })

test('network retry after reload replays the original cancellation revision and idempotency key', async ({ page }) => {
  const { commands, unexpectedWrites } = await fixture(page, 'lost-request')
  await cancelAction(page).click()
  expect(commands).toEqual([])
  await confirm(page).click()
  await expect(cancelDialog(page).getByRole('alert')).toContainText('Результат не підтверджено')
  expect(commands).toHaveLength(1)
  expect(commands[0]).toEqual({ key: expect.stringMatching(/^[0-9a-f-]{36}$/), body: { expected_revision: 7 } })

  await page.reload()
  await page.getByRole('button', { name: 'Повторити скасування', exact: true }).click()
  await cancelDialog(page).getByRole('button', { name: 'Повторити запит', exact: true }).click()
  await expect(headerStatus(page)).toBeVisible()
  await expect(cancelDialog(page)).toBeHidden()
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
  await expect(page.getByRole('button', { name: /Скасувати замовлення|Повторити скасування/ })).toHaveCount(0)
  expect(commands).toHaveLength(1)
  expect(unexpectedWrites).toEqual([])
})

test('an unknown invoice dispatch shows the reason and offers reconciliation without cancelling', async ({ page }) => {
  const { commands, unexpectedWrites } = await fixture(page, 'unknown')
  await expect(page.getByText('Невідомо, чи mono отримав запит на рахунок.', { exact: false })).toBeVisible()
  await expect(page.getByText('Перевірити: ідентифікатор рахунку, результат надсилання до mono.', { exact: true })).toBeVisible()
  await expect(cancelAction(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Перейти до звірки', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Оплата магазину', exact: true })).toBeVisible()
  expect(commands).toEqual([])
  expect(unexpectedWrites).toEqual([])
})

test('a structured 409 replaces the stale action with the server reconciliation state', async ({ page }) => {
  const { commands, reads, unexpectedWrites } = await fixture(page, 'conflict')
  await cancelAction(page).click()
  await confirm(page).click()
  await expect(cancelDialog(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Перейти до звірки', exact: true })).toBeVisible()
  await expect(cancelAction(page)).toHaveCount(0)
  expect(commands).toHaveLength(1)
  expect(reads).toEqual([7])
  expect(unexpectedWrites).toEqual([])
})

for (const scenario of ['revision', 'idempotency'] as const) {
  test(`${scenario} conflict rereads and requires confirmation before a fresh command`, async ({ page }) => {
    const { commands, reads, unexpectedWrites } = await fixture(page, scenario)
    await cancelAction(page).click()
    await confirm(page).click()
    await expect(cancelDialog(page)).toBeHidden()
    await expect(cancelAction(page)).toBeVisible()
    expect(reads).toEqual([7, 8])
    expect(commands).toHaveLength(1)

    await cancelAction(page).click()
    expect(commands).toHaveLength(1)
    await confirm(page).click()
    await expect(headerStatus(page)).toBeVisible()
    expect(commands.map(command => command.body)).toEqual([{ expected_revision: 7 }, { expected_revision: 8 }])
    expect(commands[1].key).toBeTruthy()
    expect(commands[1].key).not.toBe(commands[0].key)
    expect(unexpectedWrites).toEqual([])
  })
}

for (const scenario of ['old-backend', 'forbidden'] as const) {
  test(`${scenario} leaves no online cancellation action or generic PATCH fallback`, async ({ page }) => {
    const { commands, unexpectedWrites } = await fixture(page, scenario)
    await expect(cancelAction(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Змінити статус', exact: true }).click()
    const statuses = page.getByRole('combobox', { name: 'Новий статус' })
    await expect(statuses).toHaveValue('pending')
    await expect(statuses.locator('option[value="cancelled"]')).toHaveCount(0)
    expect(commands).toEqual([])
    expect(unexpectedWrites).toEqual([])
  })
}
