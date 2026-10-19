import { expect, test, type Page } from '@playwright/test'
const me = '/public/orders/me/321'
const item = { id: 42, product_id: 5, product_name: 'Історична помада', product_sku: 'OLD-1', quantity: 2, price: '100', total_price: '200', discount_amount: '0' }
const real = { id: 71, tracking_number: '20450000000001', status: 'delivered', simulation: false, carrier: 'nova_poshta', last_checked_at: '2026-10-17T12:00:00Z', last_successful_check_at: '2026-10-17T12:00:00Z', delivery_status: 'ready_for_pickup', stale: true, last_attempt_status: 'error', items: [{ order_item_id: 42, quantity: 1 }], events: [{ raw_status: '7', normalized_status: 'ready_for_pickup', event_at: null, observed_at: '2026-10-17T12:00:00Z' }], raw_payload: { secret: 'INTERNAL-SECRET' } }
const order = { id: 321, status: 'completed', created_at: '2026-10-17T12:00:00Z', subtotal_amount: '200', total_amount: '200', discount_amount: '0', item_count: 2, items: [item], payment_status: 'unpaid', payment_method: 'cashOnDelivery', shipments: [real, { ...real, id: 72, delivery_status: 'returning', tracking_number: '20450000000002', return_of_shipment_id: 71, items: null, events: [{ raw_status: '102', normalized_status: 'returning', event_at: '2026-10-17T13:00:00Z', observed_at: '2026-10-17T13:05:00Z' }] }], delivery_summary: { ready_for_pickup: 1, returning: 1 } }
async function setup(page: Page, refresh: (route: import('@playwright/test').Route) => unknown, detail = () => order) {
  await page.addInitScript(() => localStorage.setItem('shop-customer-auth', JSON.stringify({ accessToken: 'fixture-only', tokenType: 'Bearer', customer: { id: 42, phone: '+380990000001' } })))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith(`${me}/shipments/refresh`)) return refresh(route)
    const json = path.endsWith(me) ? detail() : path.endsWith('/public/orders/me') ? { items: [detail()], total: 11, page: Number(new URL(route.request().url()).searchParams.get('page')) || 1, page_size: 10 } : path.endsWith('/public/customers/me') ? { id: 42, phone: '+380990000001' } : { items: [], total: 0 }
    return route.fulfill({ json })
  })
}

test('history shows delivery independently of completed order and preserves pagination', async ({ page }) => {
  let posts = 0
  await setup(page, route => { posts++; return route.fulfill({ json: {} }) })
  await page.goto('/cabinet/purchase-history')
  const summary = page.getByLabel('Зведення доставки')
  await expect(summary).toContainText('Є повернення')
  await expect(summary.locator('.base-icon svg')).toHaveCount(1)
  await expect(page.locator('.purchase-history__status')).toHaveCount(1)
  await expect(page.locator('.purchase-history__status').filter({ hasText: 'Є повернення' })).toBeVisible()
  await expect(summary).not.toContainText('Доставлено')
  await page.locator('.purchase-history__card').screenshot({ path: '/tmp/sc-fe-real-tracking/history.png' })
  await page.getByRole('button', { name: 'Далі', exact: true }).click()
  await expect(page).toHaveURL(/purchase-history/)
  await expect(page.getByRole('button', { name: 'Сторінка 2', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(posts).toBe(0)
})

test('details show multiple shipments, events, unknown contents and separate unpaid state', async ({ page }) => {
  let posts = 0
  await setup(page, route => { posts++; return route.fulfill({ json: {} }) })
  await page.goto('/cabinet/orders/321')
  const shipments = page.getByRole('region', { name: 'Відправлення', exact: true })
  await expect(shipments.locator('article')).toHaveCount(2)
  await expect(shipments.getByText('Отримано', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
  for (const disclosure of await page.locator('.shipments__card summary').all()) await disclosure.click()
  await expect(shipments.getByText('Історична помада · 1 шт.', { exact: true })).toBeVisible()
  await expect(shipments.getByText(/Склад відправлення не уточнено/)).toBeVisible()
  await expect(shipments.getByText('Час події не передано перевізником')).toBeVisible()
  await expect(shipments.getByText('Повернення відправлення #71')).toBeVisible()
  await expect(shipments.getByText(/Дані можуть бути застарілими/)).toHaveCount(2)
  await expect(page.getByText('INTERNAL-SECRET')).toHaveCount(0)
  expect(posts).toBe(0)
  await shipments.screenshot({ path: '/tmp/sc-fe-real-tracking/desktop.png' })
})

test('explicit refresh queues once, observes cooldown, then rereads without another POST', async ({ page }) => {
  await page.clock.install()
  let posts = 0
  let delivered = false
  await setup(page, route => { posts++; return route.fulfill({ json: { status: 'queued', retry_after_seconds: 60 } }) }, () => delivered ? { ...order, shipments: [{ ...real, delivery_status: 'delivered', stale: false, last_attempt_status: 'success' }] } : order)
  await page.goto('/cabinet/orders/321')
  const button = page.getByRole('button', { name: 'Оновити статус', exact: true })
  await button.click()
  await expect(page.getByRole('status')).toContainText('Перевірку заплановано')
  await expect(page.getByRole('button', { name: /Оновити через/ })).toBeDisabled()
  delivered = true
  await page.clock.fastForward(61000)
  await expect(page.getByRole('region', { name: 'Відправлення', exact: true }).getByText('Отримано', { exact: true })).toBeVisible()
  await expect(page.getByText('Не оплачено', { exact: true })).toHaveCount(0)
  expect(posts).toBe(1)
})

test('server cooldown survives reload and never retries POST automatically', async ({ page }) => {
  await page.clock.install()
  let posts = 0
  await setup(page, route => { posts++; return route.fulfill({ json: { status: 'cooldown', retry_after_seconds: 120 } }) })
  await page.goto('/cabinet/orders/321')
  await page.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  await expect(page.getByRole('button', { name: /Оновити через/ })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('button', { name: /Оновити через/ })).toBeDisabled()
  expect(posts).toBe(1)
})

test('429 without Retry-After uses safe fallback and retains last data', async ({ page }) => {
  await page.clock.install()
  let posts = 0
  await setup(page, route => { posts++; return route.fulfill({ status: 429, json: { detail: 'INTERNAL-SECRET' } }) })
  await page.goto('/cabinet/orders/321')
  await page.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Забагато запитів')
  await page.clock.fastForward(3000)
  await expect(page.getByRole('button', { name: /Оновити через/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: '20450000000001', exact: true })).toBeVisible()
  await expect(page.getByText('INTERNAL-SECRET')).toHaveCount(0)
  expect(posts).toBe(1)
})

test('temporary error keeps events and disables repeated refresh', async ({ page }) => {
  await setup(page, route => route.fulfill({ status: 503, json: { detail: 'INTERNAL-SECRET' } }))
  await page.goto('/cabinet/orders/321')
  await page.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Попередні дані збережено')
  for (const disclosure of await page.locator('.shipments__card summary').all()) await disclosure.click()
  await expect(page.getByText('Час події не передано перевізником')).toBeVisible()
  await expect(page.getByRole('button', { name: /Оновити через/ })).toBeDisabled()
  await expect(page.getByText('INTERNAL-SECRET')).toHaveCount(0)
})

test('unavailable order hides prior details after refresh rejects access', async ({ page }) => {
  await setup(page, route => route.fulfill({ status: 404, json: { detail: 'INTERNAL-SECRET' } }))
  await page.goto('/cabinet/orders/321')
  await page.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  await expect(page.getByRole('button', { name: '20450000000001', exact: true })).toHaveCount(0)
  await expect(page.getByText('INTERNAL-SECRET')).toHaveCount(0)
})

test('mobile shipments fit viewport and refresh disabled mode is clear', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page, route => route.fulfill({ json: { status: 'disabled', retry_after_seconds: 0 } }))
  await page.goto('/cabinet/orders/321')
  await page.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Оновлення доставки зараз недоступне')
  await expect(page.getByRole('button', { name: 'Оновити статус', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('region', { name: 'Відправлення', exact: true }).screenshot({ path: '/tmp/sc-fe-real-tracking/mobile.png' })
})

test('429 respects the server Retry-After duration', async ({ page }) => {
  await page.clock.install()
  await setup(page, route => route.fulfill({ status: 429, headers: { 'Retry-After': '120', 'Access-Control-Expose-Headers': 'Retry-After' }, json: { detail: 'INTERNAL-SECRET' } }))
  await page.goto('/cabinet/orders/321')
  await page.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  const button = page.getByRole('button', { name: /Оновити через/ })
  await expect(button).toBeDisabled()
  expect(Number((await button.innerText()).match(/\d+/)?.[0])).toBeGreaterThan(100)
})

test('logout discards an in-flight tracking response', async ({ page }) => {
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  let started = false
  await setup(page, async route => {
    started = true
    await wait
    await route.fulfill({ json: { status: 'queued', retry_after_seconds: 60 } })
  })
  await page.goto('/cabinet/orders/321')
  await page.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  await expect.poll(() => started).toBe(true)
  const logout = page.getByRole('button', { name: 'Вийти', exact: true })
  if (!await logout.isVisible()) await page.locator('.base-bottom-bar').getByRole('button', { name: 'Акаунт', exact: true }).click()
  await logout.click()
  release()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: '20450000000001', exact: true })).toHaveCount(0)
  await expect(page.getByText('Перевірку заплановано', { exact: false })).toHaveCount(0)
})

test('idle persistence cannot replace the restored session during an in-flight tracking refresh', async ({ page }) => {
  await page.addInitScript(() => {
    let nextId = 0
    const callbacks = new Map<number, IdleRequestCallback>()
    window.requestIdleCallback = callback => { callbacks.set(++nextId, callback); return nextId }
    window.cancelIdleCallback = id => { callbacks.delete(id) }
    Reflect.set(window, '__pendingNuxtReady', () => callbacks.size)
    Reflect.set(window, '__flushNuxtReady', () => {
      const queued = [...callbacks.values()]
      callbacks.clear()
      queued.forEach(callback => callback({ didTimeout: false, timeRemaining: () => 50 }))
    })
  })
  let release!: () => void
  const response = new Promise<void>(resolve => { release = resolve })
  let posts = 0, orderReads = 0
  await setup(page, async route => { posts++; await response; return route.fulfill({ json: { status: 'queued', retry_after_seconds: 60 } }) }, () => { orderReads++; return order })
  await page.goto('/cabinet/orders/321')
  const shipments = page.getByRole('region', { name: 'Відправлення', exact: true })
  await shipments.getByRole('button', { name: 'Оновити статус', exact: true }).click()
  await expect.poll(() => posts).toBe(1)
  expect(await page.evaluate(() => Reflect.get(window, '__pendingNuxtReady')())).toBeGreaterThan(0)
  await page.evaluate(() => Reflect.get(window, '__flushNuxtReady')())
  release()
  await expect(shipments.getByRole('status')).toContainText('Перевірку заплановано')
  await expect(shipments.getByRole('button', { name: /Оновити через/ })).toBeDisabled()
  expect(orderReads).toBe(1)
  expect(posts).toBe(1)
})
