import { expect, test } from '@playwright/test'
import { clearShopStorage, installRuntimeDiagnostics } from '../support/shop'

test('SMOKE-08 OTP login, persistence, protected route and logout', async ({ page }) => {
  const diagnostics = installRuntimeDiagnostics(page)
  await clearShopStorage(page)

  await page.goto('/cabinet')
  await expect(page.getByRole('heading', { name: 'Увійти' })).toBeVisible()
  const phone = page.getByLabel('ТЕЛЕФОН')
  await phone.fill('123')
  const invalidOtpResponsePromise = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/public/customers/auth/request-otp')
    && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'НАДІСЛАТИ КОД' }).click()
  expect((await invalidOtpResponsePromise).status()).toBe(422)
  await expect(page.getByText('Could not send OTP code.')).toBeVisible()

  const uniqueSuffix = String(Date.now()).slice(-7)
  const syntheticPhone = `+38067${uniqueSuffix}`
  await phone.fill(syntheticPhone)
  const otpResponsePromise = page.waitForResponse(response =>
    response.url().endsWith('/api/v1/public/customers/auth/request-otp')
    && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'НАДІСЛАТИ КОД' }).click()
  const otpResponse = await otpResponsePromise
  expect(otpResponse.status()).toBe(202)
  const otp = await otpResponse.json() as { debug_otp_code: string }
  expect(otp.debug_otp_code).toMatch(/^\d{6}$/)

  await page.getByLabel('OTP КОД').fill(otp.debug_otp_code)
  await expect(page).toHaveURL(/\/cabinet$/)
  await expect(page.getByRole('heading', { name: 'Мій акаунт' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Мій акаунт' })).toBeVisible()

  await page.getByRole('button', { name: 'Акаунт' }).click()
  await page.getByRole('button', { name: 'ВИЙТИ' }).click()
  await page.goto('/cabinet/purchase-history')
  await expect(page.getByRole('heading', { name: 'Увійти' })).toBeVisible()
  diagnostics.assertClean(
    [/422 POST .*\/public\/customers\/auth\/request-otp/],
    [/Failed to load resource: the server responded with a status of 422/],
  )
})
