import { expect, test } from '@playwright/test'

test('expired code and exhausted send budget block further OTP requests', async ({ page }) => {
  const customer = { id: 8, phone: '+380990009999', name: '', surname: '', email: '', birthday: '' }
  let sends = 0
  let confirms = 0
  await page.addInitScript(snapshot => {
    localStorage.setItem('shop-customer-auth', JSON.stringify(snapshot))
    document.cookie = 'shop-locale=en; path=/'
  }, { accessToken: 'retained-jwt', tokenType: 'Bearer', customer })
  await page.route('**/api/v1/public/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/request-otp')) {
      sends++
      return route.fulfill({ status: 202, json: { expires_in_seconds: 1, retry_after_seconds: 0, sends_left_today: 0 } })
    }
    if (path.endsWith('/confirm')) confirms++
    return route.fulfill({ json: path.endsWith('/customers/me') ? customer : { items: [], products: [], total: 0 } })
  })
  await page.goto('/cabinet/settings')
  const form = page.locator('.cabinet-settings')
  await expect(form.getByLabel('Phone', { exact: true })).toHaveValue(customer.phone)
  await form.getByLabel('Phone', { exact: true }).fill('+380990001234')
  await form.getByRole('button', { name: 'Send code', exact: true }).click()
  await expect(form.getByRole('button', { name: 'Resend code', exact: true })).toBeDisabled()
  await expect(form.getByText('The code expired. Request a new code.', { exact: true })).toBeVisible()
  await expect(form.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled()
  await form.getByLabel('Phone', { exact: true }).fill('+380990005555')
  await expect(form.getByLabel('OTP code')).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Send code', exact: true })).toBeDisabled()
  expect(sends).toBe(1)
  expect(confirms).toBe(0)
})

for (const status of [409, 429]) {
  test(`phone request ${status} shows actionable error without ending session`, async ({ page }) => {
    const customer = { id: 8, phone: '+380990009999', name: '', surname: '', email: '', birthday: '' }
    await page.addInitScript(snapshot => {
      localStorage.setItem('shop-customer-auth', JSON.stringify(snapshot))
      document.cookie = 'shop-locale=en; path=/'
    }, { accessToken: 'retained-jwt', tokenType: 'Bearer', customer })
    await page.route('**/api/v1/public/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/request-otp')) return route.fulfill({ status, json: { detail: status === 429 ? 'Daily OTP limit reached' : 'Phone already associated' } })
      return route.fulfill({ json: path.endsWith('/customers/me') ? customer : { items: [], products: [], total: 0 } })
    })
    await page.goto('/cabinet/settings')
    const form = page.locator('.cabinet-settings')
    await expect(form.getByLabel('Phone', { exact: true })).toHaveValue(customer.phone)
    await form.getByLabel('Phone', { exact: true }).fill('+380990001234')
    await form.getByRole('button', { name: 'Send code', exact: true }).click()
    await expect(form.getByRole('alert')).toContainText(status === 429 ? 'daily limit' : 'already in use')
    if (status === 429) await expect(form.getByRole('button', { name: 'Send code', exact: true })).toBeDisabled()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shop-customer-auth') || '{}').accessToken)).toBe('retained-jwt')
  })
}

test('phone OTP preserves JWT and dirty profile; PATCH never changes phone', async ({ page }) => {
  let customer = { id: 7, phone: '+380990009999', name: 'Original', surname: '', email: 'reader@example.com', birthday: '', notes: '' }
  let confirms = 0
  const requests: { path: string, body: Record<string, unknown>, authorization: string | undefined }[] = []
  await page.addInitScript(snapshot => {
    localStorage.setItem('shop-customer-auth', JSON.stringify(snapshot))
    document.cookie = 'shop-locale=en; path=/'
  }, { accessToken: 'retained-jwt', tokenType: 'Bearer', customer })
  await page.route('**/api/v1/public/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body = request.method() === 'GET' ? {} : request.postDataJSON()
    if (path.includes('/customers/me')) {
      requests.push({ path, body, authorization: request.headers().authorization })
      if (path.endsWith('/request-otp')) return route.fulfill({ status: 202, json: { expires_in_seconds: 60, retry_after_seconds: 30, sends_left_today: 1 } })
      if (path.endsWith('/confirm')) {
        confirms++
        if (confirms === 1) return route.fulfill({ status: 400, json: { detail: 'Invalid OTP code' } })
        customer = { ...customer, phone: String(body.phone) }
      }
      if (request.method() === 'PATCH') customer = { ...customer, ...body }
      return route.fulfill({ json: customer })
    }
    return route.fulfill({ json: { items: [], products: [], total: 0 } })
  })
  await page.goto('/cabinet/settings')
  const form = page.locator('.cabinet-settings')
  await expect(form.getByLabel('Phone', { exact: true })).toHaveValue(customer.phone)
  await form.getByLabel('First name').fill('Unsaved')
  await form.getByLabel('Phone', { exact: true }).fill('+380990001234')
  await form.getByRole('button', { name: 'Send code', exact: true }).click()
  await expect(form.getByRole('button', { name: /Resend in/ })).toBeDisabled()
  await form.getByLabel('OTP code').fill('000000')
  await form.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('incorrect or expired')
  await form.getByLabel('OTP code').fill('123456')
  await form.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(form.getByLabel('Phone', { exact: true })).toHaveValue('+380990001234')
  await expect(form.getByLabel('First name')).toHaveValue('Unsaved')
  await form.locator('button[type=submit]').click()
  await expect.poll(() => requests.filter(request => request.path.endsWith('/me') && 'name' in request.body).length).toBe(1)
  const patch = requests.find(request => 'name' in request.body)!
  expect(patch.body).not.toHaveProperty('phone')
  expect(requests.every(request => request.authorization === 'Bearer retained-jwt')).toBeTruthy()
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('shop-customer-auth') || '{}'))
  expect(session.accessToken).toBe('retained-jwt')
  expect(session.customer.phone).toBe('+380990001234')
})
