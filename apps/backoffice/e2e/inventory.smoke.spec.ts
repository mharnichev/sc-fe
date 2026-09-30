import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const sandboxURL = env.INVENTORY_SANDBOX_URL || ''
test.skip(!sandboxURL, 'Requires the disposable real FastAPI/PostgreSQL inventory sandbox; no configured-backend fallback.')

type SeedProduct = {
  id: number
  name: string
  sku: string
  barcode: string | null
  on_hand: number
  reserved: number
}

type SandboxState = {
  sandbox: true
  schema: string
  access_token: string
  inactive_access_token: string
  user: Record<string, unknown>
  seed: {
    products: Record<'available' | 'out_of_stock' | 'missing_barcode' | 'backorder', SeedProduct>
    order_id: number
    order_item_id: number
  }
}

let state: SandboxState

async function json(response: APIResponse) {
  const body = await response.text()
  expect(response.ok(), `${response.status()} ${response.url()}: ${body}`).toBeTruthy()
  return body ? JSON.parse(body) : null
}

async function resetAndConnect(page: Page, request: APIRequestContext) {
  const parsed = new URL(sandboxURL)
  expect(parsed.hostname).toMatch(/^(127\.0\.0\.1|localhost)$/)
  expect(parsed.port).toBe('58002')
  state = await json(await request.post(`${sandboxURL}/__sandbox/reset`)) as SandboxState
  expect(state.sandbox).toBe(true)
  expect(state.schema).toMatch(/^inventory_browser_test_/)
  await page.addInitScript(sandbox => {
    localStorage.setItem('soulcuts-backoffice-theme', 'light')
    localStorage.setItem('backoffice-auth', JSON.stringify({
      accessToken: sandbox.access_token,
      refreshToken: 'sandbox-unused',
      user: sandbox.user,
    }))
  }, state)
}

function authHeaders() {
  return { Authorization: `Bearer ${state.access_token}` }
}

function inventoryRoot() {
  return `${sandboxURL}/api/v1/backoffice/inventory`
}

async function choose(page: Page, controlName: string | RegExp, optionName: string | RegExp) {
  await page.getByRole('button', { name: controlName }).click()
  await page.getByRole('option', { name: optionName, exact: typeof optionName === 'string' }).click()
}

test.beforeEach(async ({ page, request }) => {
  await resetAndConnect(page, request)
})

test('admin session, permissions and private inventory fields stay protected', async ({ page, context, request }) => {
  const anonymous = await request.get(`${inventoryRoot()}/stock`)
  expect(anonymous.status()).toBe(401)
  const inactive = await request.get(`${inventoryRoot()}/stock`, {
    headers: { Authorization: `Bearer ${state.inactive_access_token}` },
  })
  expect(inactive.status()).toBe(401)

  const publicProduct = await json(await request.get(
    `${sandboxURL}/api/v1/public/products/${state.seed.products.available.id}`,
  ))
  for (const privateField of ['stock_quantity', 'reserved_quantity', 'available_quantity', 'barcode', 'allow_backorder']) {
    expect(publicProduct).not.toHaveProperty(privateField)
  }

  // This second page has no page-scoped bootstrap init script, so it proves
  // the route guard behavior before the authenticated page stores a session.
  const guest = await context.newPage()
  await guest.goto('/inventory')
  await expect(guest).toHaveURL(/\/login(?:\?|$)/)
  await guest.close()

  await page.goto('/inventory')
  await expect(page.getByRole('heading', { name: 'Склад', exact: true })).toBeVisible()
})

test('inventory section navigation consolidates the sidebar and adapts to desktop and mobile', async ({ page }, testInfo) => {
  const productId = state.seed.products.available.id

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/inventory/receiving?product_id=${productId}`)
  const desktopNavigation = page.getByRole('navigation', { name: 'Розділи складу' })
  await expect(desktopNavigation).toBeVisible()
  await expect(desktopNavigation.getByRole('link')).toHaveCount(6)
  await expect(desktopNavigation.getByRole('link', { name: /^Приймання/ })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveURL(new RegExp(`/inventory/receiving\\?product_id=${productId}$`))

  const desktopSidebar = page.locator('aside')
  await expect(desktopSidebar.getByRole('link', { name: 'Склад', exact: true })).toHaveClass(/bg-white\/14/)
  await expect(desktopSidebar.getByRole('link', { name: 'Приймання', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('inventory-navigation-desktop.png'), fullPage: true, animations: 'disabled' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/inventory/movements?product_id=${productId}`)
  await expect(desktopNavigation).toBeHidden()
  const sectionSelector = page.getByRole('button', { name: 'Розділ складу' })
  await expect(sectionSelector).toBeVisible()
  await expect(sectionSelector).toContainText('Рух товарів')
  await sectionSelector.click()
  await page.getByRole('option', { name: 'Операції', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory\/operations$/)
  await expect(page.getByRole('heading', { name: 'Ручна операція', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('inventory-navigation-mobile.png'), fullPage: true, animations: 'disabled' })
})

test('overview search and stock filters navigate to product settings and surface duplicate barcodes', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/inventory')
  await expect(page.getByText(state.seed.products.available.name, { exact: true })).toBeVisible()
  await expect(page.getByText(state.seed.products.missing_barcode.name, { exact: true })).toBeVisible()

  await choose(page, 'Фільтр складу', 'Без штрихкоду')
  await page.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await expect(page.getByText(state.seed.products.missing_barcode.name, { exact: true })).toBeVisible()
  await expect(page.getByText(state.seed.products.available.name, { exact: true })).toHaveCount(0)

  await page.getByLabel('Пошук на складі', { exact: true }).fill('QA Backorder')
  await choose(page, 'Фільтр складу', 'Усі товари на сторінці')
  await page.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await expect(page).toHaveURL(/search=QA(?:\+|%20)Backorder/)
  const productRow = page.getByRole('row').filter({ hasText: state.seed.products.backorder.name })
  await expect(productRow).toContainText('Потрібна закупівля')
  await productRow.getByRole('link', { name: 'Товар', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/products/${state.seed.products.backorder.id}$`))
  const productResponse = await json(await request.get(
    `${sandboxURL}/api/v1/backoffice/products/${state.seed.products.backorder.id}`,
    { headers: authHeaders() },
  ))
  expect(productResponse).toMatchObject({ allow_backorder: true })

  const settings = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Налаштування товару', exact: true }) })
  await expect.soft(settings.getByRole('switch', { name: 'Дозволити замовлення під закупівлю', exact: true })).toBeChecked()
  await settings.getByLabel('Штрихкод', { exact: true }).fill(state.seed.products.available.barcode!)
  await settings.getByRole('button', { name: 'Зберегти налаштування складу', exact: true }).click()
  await expect(settings.getByRole('alert')).toContainText('Barcode is already assigned to another product')
  await page.screenshot({ path: testInfo.outputPath('inventory-settings-duplicate-barcode.png'), fullPage: true, animations: 'disabled' })

  await settings.getByLabel('Штрихкод', { exact: true }).fill(' qa-backorder-updated-004 ')
  await settings.getByRole('button', { name: 'Зберегти налаштування складу', exact: true }).click()
  await expect(settings.getByRole('alert')).toHaveCount(0)
  await expect(settings.getByLabel('Штрихкод', { exact: true })).toHaveValue('QA-BACKORDER-UPDATED-004')
  const inspection = await json(await request.get(`${sandboxURL}/__sandbox/inspect`))
  await expect.soft(inspection.products.find((item: { id: number }) => item.id === state.seed.products.backorder.id))
    .toMatchObject({ allow_backorder: true })
  await settings.getByLabel('Штрихкод', { exact: true }).fill('')
  await settings.getByRole('button', { name: 'Зберегти налаштування складу', exact: true }).click()
  await expect(settings.getByRole('alert')).toHaveCount(0)
  const cleared = await json(await request.get(`${sandboxURL}/__sandbox/inspect`))
  expect(cleared.products.find((item: { id: number }) => item.id === state.seed.products.backorder.id))
    .toMatchObject({ barcode: null, allow_backorder: true })
})

test('procurement, order fulfillment and barcode receiving complete against the real backend', async ({ page, request }, testInfo) => {
  test.setTimeout(60_000)
  const product = state.seed.products.backorder
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/inventory/procurement')
  const productRow = page.getByRole('row').filter({ hasText: product.name }).first()
  await expect(productRow).toContainText('3 шт.')
  await productRow.getByRole('button', { name: 'Позиції', exact: true }).click()
  await page.getByRole('checkbox', { name: `Обрати позицію ${state.seed.order_item_id}`, exact: true }).check()
  await page.getByRole('button', { name: 'Позначити замовленими', exact: true }).click()
  await expect(page.getByText('Замовлено', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: new RegExp(`^Замовлення #${state.seed.order_id}`) }).click()
  const fulfillmentRow = page.getByRole('row').filter({ hasText: product.name })
  await expect(fulfillmentRow).toContainText('Замовлено')
  await page.goto('/inventory/procurement')
  await page.getByRole('row').filter({ hasText: product.name }).first().getByRole('button', { name: 'Прийняти', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/inventory/receiving\?.*product_id=${product.id}`))

  await page.getByRole('textbox', { name: 'Причина', exact: true }).fill('QA supplier receipt')
  await page.getByLabel('Коментар', { exact: true }).fill('Real browser and database')
  await page.getByRole('button', { name: 'Створити чернетку', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory\/receiving\?.*id=\d+/)

  const barcode = page.getByLabel('Штрихкод', { exact: true })
  await barcode.fill('QA-UNKNOWN-BARCODE')
  await expect(page.getByRole('button', { name: 'Знайти', exact: true }).first()).toBeEnabled()
  await barcode.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Додати до приймання', exact: true })).toBeDisabled()
  await barcode.fill(product.barcode!)
  await barcode.press('Enter')
  await expect(page.getByText(`Знайдено: ${product.name}`, { exact: false })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Кількість', exact: true })).toHaveValue('1')
  await barcode.press('Enter')
  await expect(page.getByRole('spinbutton', { name: 'Кількість', exact: true })).toHaveValue('1')
  await barcode.fill(product.barcode!)
  await barcode.press('Enter')
  await expect(page.getByRole('spinbutton', { name: 'Кількість', exact: true })).toHaveValue('2')
  await page.getByRole('spinbutton', { name: 'Кількість', exact: true }).fill('3')
  await page.getByRole('spinbutton', { name: 'Собівартість за одиницю', exact: true }).fill('250.50')
  await page.getByRole('textbox', { name: 'Партія', exact: true }).fill('QA-LOT-001')
  await page.getByRole('textbox', { name: 'Термін придатності', exact: true }).fill('2027-12-31')
  await page.getByRole('spinbutton', { name: 'Кількість розподілу', exact: true }).fill('3')
  await page.getByRole('button', { name: 'Додати до приймання', exact: true }).click()
  const receiptTable = page.getByRole('table', { name: 'Позиції приймання', exact: true })
  await expect(receiptTable).toContainText('QA-LOT-001')
  await expect(receiptTable).toContainText(`#${state.seed.order_item_id}: 3`)
  await page.screenshot({ path: testInfo.outputPath('inventory-receipt-draft.png'), fullPage: true, animations: 'disabled' })

  await page.getByRole('button', { name: 'Провести приймання', exact: true }).click()
  await page.getByRole('button', { name: 'Провести', exact: true }).click()
  await expect(page.getByText(/Приймання #\d+ проведено/)).toBeVisible()
  await expect(page.getByText('Оприбутковано 3 од. Виконано розподілів на замовлення: 1.', { exact: true })).toBeVisible()
  const postedURL = page.url()
  await page.reload()
  await expect(page).toHaveURL(postedURL)
  await expect(page.getByRole('button', { name: 'Додати до приймання', exact: true })).toBeDisabled()

  const inspection = await json(await request.get(`${sandboxURL}/__sandbox/inspect`))
  expect(inspection.products.find((item: { id: number }) => item.id === product.id)).toMatchObject({ on_hand: 3, reserved: 3 })
  expect(inspection.order_items.find((item: { id: number }) => item.id === state.seed.order_item_id)).toMatchObject({
    quantity_received: 3,
    procurement_status: 'received',
  })
  await page.goto(`/orders/${state.seed.order_id}`)
  await expect(page.getByRole('row').filter({ hasText: product.name })).toContainText('Отримано')
})

test('inventory count upserts a difference, posts once and reloads read-only', async ({ page, request }, testInfo) => {
  const product = state.seed.products.available
  await page.goto('/inventory/counts')
  await page.getByRole('textbox', { name: 'Причина', exact: true }).fill('QA cycle count')
  await page.getByRole('button', { name: 'Створити чернетку', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory\/counts\?id=\d+/)

  const barcode = page.getByLabel('Штрихкод', { exact: true })
  await barcode.fill(product.barcode!)
  await barcode.press('Enter')
  await expect(page.getByText(`Знайдено: ${product.name}`, { exact: false })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Фактична кількість', exact: true }).fill('11')
  await page.getByRole('button', { name: 'Зберегти кількість', exact: true }).click()
  let countRow = page.getByRole('table', { name: 'Рядки інвентаризації', exact: true }).getByRole('row').filter({ hasText: `Товар #${product.id}` })
  await expect(countRow).toContainText('+1')

  // A second scan selects the same product and the PUT endpoint updates the
  // existing count row instead of creating or summing another row.
  await barcode.fill(product.barcode!)
  await barcode.press('Enter')
  await page.getByRole('spinbutton', { name: 'Фактична кількість', exact: true }).fill('12')
  await page.getByRole('button', { name: 'Зберегти кількість', exact: true }).click()
  countRow = page.getByRole('table', { name: 'Рядки інвентаризації', exact: true }).getByRole('row').filter({ hasText: `Товар #${product.id}` })
  await expect(countRow).toContainText('+2')
  await expect(page.getByRole('table', { name: 'Рядки інвентаризації', exact: true }).getByRole('row')).toHaveCount(2)
  await page.screenshot({ path: testInfo.outputPath('inventory-count-difference.png'), fullPage: true, animations: 'disabled' })

  await page.getByRole('button', { name: 'Провести інвентаризацію', exact: true }).click()
  await page.getByRole('button', { name: 'Провести', exact: true }).click()
  await expect(page.getByText(/Інвентаризацію #\d+ проведено/)).toBeVisible()
  const countId = Number(new URL(page.url()).searchParams.get('id'))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Зберегти кількість', exact: true })).toBeDisabled()
  expect((await json(await request.get(`${sandboxURL}/__sandbox/inspect`))).products
    .find((item: { id: number }) => item.id === product.id)).toMatchObject({ on_hand: 12, reserved: 2 })

  const editPosted = await request.put(`${inventoryRoot()}/counts/${countId}/items`, {
    headers: authHeaders(),
    data: { product_id: product.id, counted_quantity: 13 },
  })
  expect(editPosted.status()).toBe(409)
})

test('manual operations, movement filters and idempotency protections use persisted ledger data', async ({ page, request }, testInfo) => {
  const product = state.seed.products.available
  const headers = authHeaders()
  const root = inventoryRoot()
  const firstReceipt = await json(await request.post(`${root}/operations/receipt`, {
    headers: { ...headers, 'Idempotency-Key': 'qa-receipt-once' },
    data: { product_id: product.id, quantity: 2, reason: 'QA receipt' },
  }))
  const repeatedReceipt = await json(await request.post(`${root}/operations/receipt`, {
    headers: { ...headers, 'Idempotency-Key': 'qa-receipt-once' },
    data: { product_id: product.id, quantity: 2, reason: 'QA receipt' },
  }))
  expect(repeatedReceipt.id).toBe(firstReceipt.id)

  const receiptKey = 'qa-receipt-create-once'
  const receiptPayload = { reason: 'QA idempotent receipt', comment: null }
  const receiptA = await json(await request.post(`${root}/receipts`, {
    headers: { ...headers, 'Idempotency-Key': receiptKey }, data: receiptPayload,
  }))
  const receiptB = await json(await request.post(`${root}/receipts`, {
    headers: { ...headers, 'Idempotency-Key': receiptKey }, data: receiptPayload,
  }))
  expect(receiptB.id).toBe(receiptA.id)
  const countA = await json(await request.post(`${root}/counts`, {
    headers: { ...headers, 'Idempotency-Key': 'qa-count-create-once' }, data: { reason: 'QA idempotent count' },
  }))
  const countB = await json(await request.post(`${root}/counts`, {
    headers: { ...headers, 'Idempotency-Key': 'qa-count-create-once' }, data: { reason: 'QA idempotent count' },
  }))
  expect(countB.id).toBe(countA.id)

  await page.goto(`/inventory/operations?product_id=${product.id}`)
  await expect(page.getByText(`Вибрано: ${product.name}`, { exact: false })).toBeVisible()
  await expect(page.getByText(/Для звірки залишків немає загальної операції коригування/)).toBeVisible()
  const uiOperations = [
    { current: 'Надходження', next: 'Початковий залишок', quantity: '2', reason: 'QA opening balance' },
    { current: 'Початковий залишок', next: 'Надходження', quantity: '2', reason: 'QA browser receipt' },
    { current: 'Надходження', next: 'Повернення від клієнта', quantity: '1', reason: 'QA customer return' },
  ] as const
  for (const operation of uiOperations) {
    await choose(page, operation.current, operation.next)
    await page.getByRole('spinbutton', { name: 'Кількість', exact: true }).fill(operation.quantity)
    await page.getByRole('textbox', { name: 'Причина', exact: true }).fill(operation.reason)
    await page.getByRole('button', { name: 'Продовжити до підтвердження', exact: true }).click()
    await page.getByRole('button', { name: 'Зафіксувати операцію', exact: true }).click()
    await expect(page.getByText(`${operation.next} зафіксовано.`, { exact: true })).toBeVisible()
  }
  await choose(page, 'Повернення від клієнта', 'Списання')
  await page.getByRole('spinbutton', { name: 'Кількість', exact: true }).fill('1')
  await choose(page, 'Оберіть значення', 'Тестер')
  await page.getByRole('button', { name: 'Продовжити до підтвердження', exact: true }).click()
  await page.getByRole('button', { name: 'Зафіксувати операцію', exact: true }).click()
  await expect(page.getByText('Списання зафіксовано.', { exact: true })).toBeVisible()

  await page.goto(`/inventory/movements?product_id=${product.id}`)
  const movementTable = page.getByRole('table', { name: 'Історія руху товару', exact: true })
  await expect(movementTable).toContainText('Початковий залишок')
  await expect(movementTable).toContainText('Надходження')
  await expect(movementTable).toContainText('Повернення від клієнта')
  await expect(movementTable).toContainText('Списання')
  await choose(page, 'Тип руху', 'Списання')
  await page.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await expect(movementTable).toContainText('Списання')
  await expect(movementTable).not.toContainText('Початковий залишок')
  await page.screenshot({ path: testInfo.outputPath('inventory-movements-filtered.png'), fullPage: true, animations: 'disabled' })

  const inspection = await json(await request.get(`${sandboxURL}/__sandbox/inspect`))
  expect(inspection.movement_count).toBe(5)
})
