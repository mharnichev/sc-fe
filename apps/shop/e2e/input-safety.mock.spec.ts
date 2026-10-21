import { expect, test } from '@playwright/test'

test('contact input limits, plain text sanitation and repeated submit protection', async ({ page }) => {
  let feedbackRequests = 0
  await page.route('https://**', route => route.abort())
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'POST' && route.request().url().includes('/feedback/email')) {
      feedbackRequests++
      expect(route.request().postDataJSON()).toMatchObject({ name: 'Мар’яна', text: 'Доброго дня! Допоможіть із замовленням.' })
      await route.fulfill({ json: { message: 'Feedback accepted' } })
      return
    }
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/contacts')
  const form = page.locator('form.contact-page__box')
  const name = form.locator('input').first()
  const email = form.locator('input[type=email]')
  const message = form.locator('textarea')
  await expect(name).toHaveAttribute('maxlength', '80')
  await expect(email).toHaveAttribute('maxlength', '254')
  await expect(message).toHaveAttribute('maxlength', '2000')
  await name.fill('<b>Мар’яна</b>123')
  await expect(name).toHaveValue('Мар’яна')
  await email.fill('buyer@example.test')
  await message.fill('<b>Доброго дня!</b> Допоможіть із замовленням.')
  await expect(message).toHaveValue('Доброго дня! Допоможіть із замовленням.')
  await form.locator('button[type=submit]').click()
  await expect.poll(() => feedbackRequests).toBe(1)
  await expect(message).toHaveValue('')
  await name.fill('Мар’яна')
  await email.fill('buyer@example.test')
  await message.fill('Доброго дня! Допоможіть із замовленням.')
  await form.locator('button[type=submit]').click()
  await expect(form.locator('.contact-page__error')).toBeVisible()
  expect(feedbackRequests).toBe(1)
})

test('fractional quantity and empty drafts cannot remove a guest cart item', async ({ page }) => {
  const product = { id: 123, name: 'Synthetic pomade', slug: 'synthetic-pomade', price: '100.00', images: [], brand: { id: 1, name: 'Synthetic', slug: 'synthetic' }, stock: 10, is_available_for_purchase: true, is_effectively_visible: true, hidden_reason: null }
  await page.route('https://**', route => route.abort())
  await page.route('**/api/v1/**', async route => {
    expect(route.request().method()).toBe('GET')
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.addInitScript(product => localStorage.setItem('shop-cart', JSON.stringify({ items: [{ product, quantity: 3 }] })), product)
  await page.goto('/checkout/purchase')
  const quantity = page.locator('.base-quantity-stepper__input').filter({ visible: true }).first()
  await expect(quantity).toHaveValue('3')
  for (const draft of ['0.5', '4.5', '']) {
    await quantity.fill(draft)
    await quantity.blur()
    await expect(quantity).toHaveValue('3')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shop-cart') || '{}').items[0].quantity)).toBe(3)
  }
})

test('email input retains malformed recipient instead of rewriting it', async ({ page }) => {
  let feedbackRequests = 0
  await page.route('https://**', route => route.abort())
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'POST') feedbackRequests++
    await route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/contacts')
  const form = page.locator('form.contact-page__box')
  await form.locator('input').first().fill('Synthetic')
  await form.locator('textarea').fill('Please help with my synthetic order.')
  const email = form.locator('input[type=email]')
  for (const value of ['first last@example.test', '<b>buyer</b>@example.test']) {
    await email.fill(value)
    await expect(email).toHaveValue(value)
    await form.locator('button[type=submit]').click()
    expect(feedbackRequests).toBe(0)
  }
})
