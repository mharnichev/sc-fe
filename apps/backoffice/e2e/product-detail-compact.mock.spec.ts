import { expect, test, type Page } from '@playwright/test'
import { Buffer } from 'node:buffer'

const staff = { id: 1, email: 'fixture@example.test', is_active: true, is_superuser: false, role: 'admin', master_id: null }
const initialProduct = {
  id: 238, name: 'Fixture shampoo 250 ml', slug: 'fixture-shampoo', price: '320.00', shop_price: '300.00', recommended_retail_price: '350.00',
  sku: 'SKU-238', barcode: '4820000000238', stock_quantity: 12, reserved_quantity: 2, available_quantity: 10,
  on_hand: 12, reserved: 2, available: 10, allow_backorder: false, is_active: true, is_effectively_visible: true,
  short_description: 'Короткий опис fixture', description: 'Повний опис fixture для щоденного догляду.', ingredients: 'Aqua, fixture ingredients',
  brand_id: 3, category_id: 4, brand: { id: 3, name: 'Fixture brand' }, category: { id: 4, name: 'Шампуні' },
  availability_status: 'in_stock', external_url: 'https://example.test/product', image_url: '/fixture-original.png',
  images: [{ id: 11, sort_order: 0, is_active: true, image_url: '/fixture-original.png', alt: 'Fixture product photo' }],
  display_image_url: '/fixture-processed.webp', display_image_urls: ['/fixture-processed.webp'],
  attributes_json: { custom: 'preserved', image_urls: ['https://example.test/gallery.png'] }, created_at: '2026-10-21T12:00:00Z', updated_at: '2026-10-21T13:00:00Z',
}

async function fixture(page: Page) {
  let product = structuredClone(initialProduct)
  const writes: Array<{ method: string; path: string; body: Record<string, unknown> }> = []
  await page.addInitScript(user => localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'fixture-only', refreshToken: '', user })), staff)
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)
      ? route.continue()
      : route.abort('blockedbyclient')
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') {
      const body = request.postDataJSON()
      writes.push({ method: request.method(), path, body })
      if (request.method() === 'PUT' && path.endsWith('/backoffice/products/238')) {
        product = { ...product, ...body }
        return route.fulfill({ json: product })
      }
      if (request.method() === 'POST' && path.endsWith('/backoffice/products')) {
        product = { ...product, ...body, id: 239 }
        return route.fulfill({ json: product })
      }
      return route.fulfill({ status: 403, json: { detail: 'Fixture blocks unexpected mutations' } })
    }
    if (path.endsWith('/auth/me')) return route.fulfill({ json: staff })
    if (/\/backoffice\/products\/(238|239)$/.test(path)) return route.fulfill({ json: product })
    if (/\/backoffice\/products\/\d+\/images$/.test(path)) return route.fulfill({ json: product.images })
    if (path.endsWith('/backoffice/categories')) return route.fulfill({ json: { items: [{ id: 4, name: 'Шампуні', slug: 'shampoo', parent_id: null }], total: 1 } })
    if (path.endsWith('/backoffice/brands')) return route.fulfill({ json: { items: [{ id: 3, name: 'Fixture brand', slug: 'fixture' }], total: 1 } })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  // Offline image fixture: no external service is needed to render the gallery.
  await page.route(/fixture-(?:original\.png|processed\.webp)|example\.test\/gallery\.png/, route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#eef2f6"/><rect x="65" y="25" width="50" height="135" rx="12" fill="#426576"/><text x="90" y="95" text-anchor="middle" fill="white">FIXTURE</text></svg>',
  }))
  return writes
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
}

for (const size of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`compact product detail and editor: ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size)
    const writes = await fixture(page)
    await page.goto('/products/238')
    await expect(page.getByRole('heading', { name: initialProduct.name, exact: true })).toBeVisible()
    await expect(page.getByText(initialProduct.short_description, { exact: true })).toBeVisible()
    await expect(page.getByText(initialProduct.description, { exact: true })).toBeVisible()
    await expect(page.getByText(initialProduct.ingredients, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Додати фото|Видалити фотографію|Перемістити вліво|Перемістити вправо|Зберегти alt/ })).toHaveCount(0)
    await expect(page.getByText('Alt-текст', { exact: true })).toBeHidden()
    await expect(page.locator('a[href$="fixture-processed.webp"]:visible').first()).toBeVisible()
    const metrics = page.locator('.product-detail dl').first().locator('dd')
    await expect(metrics).toHaveText(['UAH 320.00', 'UAH 300.00', 'UAH 350.00', '12', '2', '10'])
    for (const metric of ['Ціна', 'Ціна магазину', 'Рекомендована', 'На складі', 'У резерві', 'Доступно']) {
      await expect(page.getByRole('button', { name: `Пояснення: ${metric}`, exact: true })).toBeVisible()
    }
    await noOverflow(page)
    await page.screenshot({ path: `output/product-detail-preview/${size.name}-view.png`, fullPage: true, animations: 'disabled' })
    const help = page.getByRole('button', { name: 'Пояснення: Ціна', exact: true })
    if (size.name === 'desktop') {
      await help.hover()
      await expect(page.getByRole('tooltip')).toHaveText('Базова ціна товару в каталозі.')
      await page.screenshot({ path: 'output/product-detail-preview/desktop-help.png', animations: 'disabled' })
      await page.mouse.move(0, 0)
      await expect(page.getByRole('tooltip')).toHaveCount(0)
      await help.focus()
      await expect(page.getByRole('tooltip')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('tooltip')).toHaveCount(0)
    } else {
      await help.click()
      await expect(page.getByRole('tooltip')).toBeVisible()
      const box = await page.getByRole('tooltip').boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width)
      await page.screenshot({ path: 'output/product-detail-preview/mobile-help.png', animations: 'disabled' })
      await page.getByRole('heading', { name: initialProduct.name, exact: true }).click()
      await expect(page.getByRole('tooltip')).toHaveCount(0)
    }
    await page.getByRole('button', { name: 'Редагувати товар', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Назва', exact: true })).toHaveValue(initialProduct.name)
    await expect(page.getByRole('spinbutton', { name: 'Ціна', exact: true })).toHaveValue('320')
    await expect(page.getByRole('textbox', { name: 'Опис', exact: true })).toHaveValue(initialProduct.description)
    await expect(page.getByRole('combobox', { name: 'Категорія', exact: true })).toHaveValue('4')
    await expect(page.getByRole('combobox', { name: 'Бренд', exact: true })).toHaveValue('3')
    await expect(page.getByRole('button', { name: 'Додати фото', exact: true })).toBeVisible()
    await expect(page.locator('img[src$="fixture-processed.webp"]').first()).toBeVisible()
    await expect(page.locator('a[href$="fixture-processed.webp"]:visible').first()).toBeVisible()
    await noOverflow(page)
    await page.screenshot({ path: `output/product-detail-preview/${size.name}-edit.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('textbox', { name: 'Назва', exact: true }).fill('Updated fixture shampoo')
    await page.getByRole('spinbutton', { name: 'Наша ціна в магазині', exact: true }).fill('299.5')
    await page.getByRole('button', { name: 'Зберегти зміни', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Updated fixture shampoo', exact: true })).toBeVisible()
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ method: 'PUT', path: '/api/v1/backoffice/products/238', body: {
      name: 'Updated fixture shampoo', slug: initialProduct.slug, price: 320, shop_price: 299.5,
      description: initialProduct.description, ingredients: initialProduct.ingredients, short_description: initialProduct.short_description,
      stock_quantity: 12, brand_id: 3, category_id: 4, image_url: initialProduct.image_url, attributes_json: initialProduct.attributes_json,
    } })
    await expect(page.getByRole('button', { name: 'Додати фото', exact: true })).toHaveCount(0)
    await expect(page.locator('a[href$="fixture-processed.webp"]:visible').first()).toBeVisible()
    await noOverflow(page)
  })
}

test('compact new-product editor creates the product before showing image manager', async ({ page }) => {
  const writes = await fixture(page)
  await page.goto('/products/new')
  await expect(page.getByRole('heading', { name: 'Новий товар', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Додати фото', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Назва', exact: true }).fill('New fixture product')
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill('new-fixture-product')
  await page.getByRole('spinbutton', { name: 'Ціна', exact: true }).fill('125')
  await page.getByRole('button', { name: 'Створити товар', exact: true }).click()
  await expect(page).toHaveURL(/\/products\/239$/)
  await expect(page.getByRole('heading', { name: 'New fixture product', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Додати фото', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Редагувати товар', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Додати фото', exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ method: 'POST', path: '/api/v1/backoffice/products', body: { name: 'New fixture product', slug: 'new-fixture-product', price: 125 } })
})

test('compact inventory settings retain validation, pending lock and exact saved values', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await fixture(page)
  const requests: unknown[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/backoffice/inventory/products/238/settings', async route => {
    const body = route.request().postDataJSON()
    requests.push(body)
    if (requests.length === 1) return route.fulfill({ status: 409, json: { detail: 'Штрихкод уже використовується.' } })
    await gate
    await route.fulfill({ json: { ...initialProduct, ...body } })
  })
  await page.goto('/products/238')
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Налаштування товару/ }) })
  const barcode = panel.getByRole('textbox', { name: 'Штрихкод', exact: true })
  const backorder = panel.getByRole('switch', { name: 'Замовляти під закупівлю', exact: true })
  const save = panel.getByRole('button', { name: 'Зберегти налаштування', exact: true })
  await barcode.fill('duplicate')
  await save.click()
  await expect(panel.getByRole('alert')).toContainText('Штрихкод уже використовується.')
  await expect(save).toBeEnabled()
  await barcode.fill(' unique-fixture ')
  await panel.getByText('Замовляти під закупівлю', { exact: true }).click()
  await save.click()
  await expect(save).toBeDisabled()
  await expect(barcode).toBeDisabled()
  await expect(backorder).toBeDisabled()
  expect(requests).toEqual([
    { barcode: 'duplicate', allow_backorder: false },
    { barcode: 'unique-fixture', allow_backorder: true },
  ])
  release()
  await expect(save).toBeEnabled()
  await expect(page.getByText('Налаштування складу збережено.', { exact: true })).toBeVisible()
  await noOverflow(page)
})

test('closing the product editor preserves a pending two-photo upload queue', async ({ page }) => {
  await fixture(page)
  let uploads = 0, release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const uploaded = [...initialProduct.images]
  await page.route('**/backoffice/products/238', route => route.fulfill({ json: { ...initialProduct, images: uploaded } }))
  await page.route('**/backoffice/products/238/images', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: uploaded })
    expect(route.request().method()).toBe('POST')
    uploads++
    if (uploads === 1) await gate
    const image = { id: 11 + uploads, sort_order: uploads, is_active: true, image_url: `/fixture-upload-${uploads}.png`, alt: `Uploaded ${uploads}` }
    uploaded.push(image)
    await route.fulfill({ json: image })
  })
  await page.goto('/products/238')
  await page.getByRole('button', { name: 'Редагувати товар', exact: true }).click()
  await page.locator('input[type="file"][multiple]').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: Buffer.from('fixture-first') },
    { name: 'second.png', mimeType: 'image/png', buffer: Buffer.from('fixture-second') },
  ])
  await expect.poll(() => uploads).toBe(1)
  await page.getByRole('button', { name: 'Закрити редагування', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Додати фото', exact: true })).toHaveCount(0)
  release()
  await expect.poll(() => uploads).toBe(2)
  await page.getByRole('button', { name: 'Редагувати товар', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Зберегти alt', exact: true })).toHaveCount(3)
})
