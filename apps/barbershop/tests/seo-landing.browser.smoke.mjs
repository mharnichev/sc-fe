import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// Start home-seo.browser.smoke.mjs --api on 4183 and the production barbershop
// app on 4182 with NUXT_API_UPSTREAM_BASE=http://127.0.0.1:4183/api/v1.
// Run this file directly; HOME_SEO_ORIGIN can override the application origin.
const origin = (process.env.HOME_SEO_ORIGIN || 'http://127.0.0.1:4182').replace(/\/$/, '')
const appOrigin = new URL(origin).origin
const require = createRequire(new URL('../../backoffice/package.json', import.meta.url))
const { chromium, expect } = require('@playwright/test')
const browser = await chromium.launch({ headless: true })
const visualOnly = process.argv.includes('--visual-only')

const servicePath = '/services/seo-haircut'
const masterPath = '/masters/seo-master-2'
const serviceBooking = '/?service=seo-haircut#booking'
const masterBooking = '/?master=2#booking'
const offerBooking = '/?service=seo-haircut&master=2#booking'

const assertNoOverflow = async (page, width, label) => {
  if (width >= 768) return
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  assert.ok(dimensions.scrollWidth <= dimensions.innerWidth + 1,
    `${label} has horizontal overflow: ${JSON.stringify(dimensions)}`)
}

const assertBreadcrumbClearance = async (page, width, label) => {
  if (width >= 768) return
  const breadcrumb = page.locator('section').first().locator('nav').first()
  const languagePill = page.locator('header > div.fixed').first()
  await expect(breadcrumb).toBeVisible()
  await expect(languagePill).toBeVisible()
  const bounds = await Promise.all([breadcrumb.boundingBox(), languagePill.boundingBox()])
  assert.ok(bounds[0] && bounds[1], `${label} needs measurable breadcrumb and header`)
  assert.ok(bounds[0].y >= bounds[1].y + bounds[1].height + 2,
    `${label} breadcrumb overlaps fixed language/menu pill: breadcrumb=${JSON.stringify(bounds[0])}, pill=${JSON.stringify(bounds[1])}`)
}

const settleHeader = async (page, width) => {
  if (width >= 1024) {
    const button = page.locator('#desktop-nav > div > button')
    await expect(button).toHaveClass(/text-neutral-950/, { timeout: 10_000 })
    await expect(button).toHaveCSS('color', 'rgb(10, 10, 10)', { timeout: 10_000 })
  } else {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
}

const assertCanonical = async (page, pathname) => {
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  assert.ok(canonical, `${pathname} needs a canonical URL`)
  const url = new URL(canonical)
  assert.equal(url.pathname, pathname)
  assert.equal(url.search, '')
  assert.equal(url.hash, '')
}

const assertBooking = async (page, { step, service = false, master = false }) => {
  await expect(page.locator('section#booking')).toBeVisible({ timeout: 20_000 })
  const tabs = page.locator('#booking-stepper .booking-step-tab')
  await expect(tabs.nth(step)).toHaveAttribute('aria-current', 'step', { timeout: 20_000 })
  await expect(page.locator('.booking-step-panel--contact')).toHaveCount(0)

  // Inspect the existing selection controls. Opening earlier tabs does not
  // change a selection; it reveals the exact service, price and duration.
  await tabs.nth(0).click()
  const serviceButton = page.locator('#booking-stepper .booking-service__item', { hasText: 'SEO haircut' })
    .locator('button[aria-pressed]').first()
  await expect(serviceButton).toBeVisible()
  await expect(serviceButton).toHaveAttribute('aria-pressed', String(service))
  await expect(serviceButton).toContainText('640')
  await expect(serviceButton).toContainText('45')

  await tabs.nth(1).click()
  const selectedMaster = page.locator('#booking-stepper .booking-step-panel--master button[aria-pressed="true"]')
  if (master) {
    await expect(selectedMaster).toHaveCount(1)
    await expect(selectedMaster).toContainText('SEO Master 2')
  } else {
    await expect(selectedMaster).toHaveCount(0)
  }
}

const assertUsableFallback = async (page, { step, service = false, master = false }) => {
  await assertBooking(page, { step, service, master })
  await expect(page.locator('#booking-stepper .booking-step-tab')).toHaveCount(4)
  await page.locator('#booking-stepper .booking-step-tab').first().click()
  await expect(page.locator('#booking-stepper .booking-service__item').first()).toBeVisible()
}

const browserErrors = (page, errors) => {
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type()) && /hydration|mismatch/i.test(message.text())) {
      errors.push(message.text())
    }
  })
}

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'Europe/Kyiv' })
    const errors = []
    const rejectedMutations = []
    await context.route('**/*', route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== appOrigin) return route.abort()
      if (!['GET', 'HEAD'].includes(request.method())) {
        rejectedMutations.push(`${request.method()} ${url.pathname}`)
        return route.abort()
      }
      return route.continue()
    })

    const noScriptContext = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'Europe/Kyiv', javaScriptEnabled: false })
    await noScriptContext.route('**/*', route => {
      const request = route.request()
      const url = new URL(request.url())
      return url.origin === appOrigin && ['GET', 'HEAD'].includes(request.method())
        ? route.continue()
        : route.abort()
    })
    const noScriptPage = await noScriptContext.newPage()
    noScriptPage.setDefaultTimeout(15_000)

    let response = await noScriptPage.goto(`${origin}${servicePath}`, { waitUntil: 'domcontentloaded' })
    assert.equal(response?.status(), 200)
    await assertCanonical(noScriptPage, servicePath)
    await expect(noScriptPage.locator('h1')).toContainText('SEO haircut')
    await expect(noScriptPage.locator('body')).toContainText('640')
    await expect(noScriptPage.locator('body')).toContainText('45')
    await expect(noScriptPage.locator(`a[href="${serviceBooking}"]`)).toHaveCount(1)
    await expect(noScriptPage.locator(`section article a[href="${offerBooking}"]`)).toHaveCount(1)
    await expect(noScriptPage.locator(`section article a[href="${masterPath}"]`)).toHaveCount(1)
    await assertNoOverflow(noScriptPage, viewport.width, 'service landing without JS')
    await assertBreadcrumbClearance(noScriptPage, viewport.width, 'service landing without JS')

    response = await noScriptPage.goto(`${origin}${masterPath}`, { waitUntil: 'domcontentloaded' })
    assert.equal(response?.status(), 200)
    await assertCanonical(noScriptPage, masterPath)
    await expect(noScriptPage.locator('h1')).toContainText('SEO Master 2')
    await expect(noScriptPage.locator(`a[href="${masterBooking}"]`).first()).toBeVisible()
    await expect(noScriptPage.locator('#services')).toContainText('SEO haircut')
    await expect(noScriptPage.locator('#services')).toContainText('640')
    await expect(noScriptPage.locator('#services')).toContainText('45')
    await assertNoOverflow(noScriptPage, viewport.width, 'master landing without JS')
    await assertBreadcrumbClearance(noScriptPage, viewport.width, 'master landing without JS')
    await noScriptContext.close()

    const page = await context.newPage()
    page.setDefaultTimeout(20_000)
    browserErrors(page, errors)

    await page.goto(`${origin}${servicePath}`, { waitUntil: 'domcontentloaded' })
    const cookieDismiss = page.getByRole('button', { name: /Лише необхідні|Only necessary/i })
    await cookieDismiss.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
    if (await cookieDismiss.isVisible()) await cookieDismiss.click()
    await assertCanonical(page, servicePath)
    await assertNoOverflow(page, viewport.width, 'service landing')
    await settleHeader(page, viewport.width)
    await assertBreadcrumbClearance(page, viewport.width, 'service landing')
    await page.screenshot({ path: `/tmp/sc-stage2-${viewport.width}-service.png` })
    if (visualOnly) {
      await page.goto(`${origin}${masterPath}`, { waitUntil: 'domcontentloaded' })
      await assertCanonical(page, masterPath)
      await settleHeader(page, viewport.width)
      await assertBreadcrumbClearance(page, viewport.width, 'master landing')
      await page.screenshot({ path: `/tmp/sc-stage2-${viewport.width}-master.png` })
      console.log(`PASS SEO landing visual ${viewport.width}x${viewport.height}: service/master screenshots after header transition`)
      await context.close()
      continue
    }
    await page.locator(`a[href="${serviceBooking}"]`).click()
    await expect(page).toHaveURL(`${origin}${serviceBooking}`)
    await assertBooking(page, { step: 1, service: true })
    await assertNoOverflow(page, viewport.width, 'service booking')
    await page.screenshot({ path: `/tmp/sc-stage2-${viewport.width}-service-booking.png` })

    await page.goto(`${origin}${servicePath}`, { waitUntil: 'domcontentloaded' })
    await page.locator(`section article a[href="${offerBooking}"]`).click()
    await expect(page).toHaveURL(`${origin}${offerBooking}`)
    await assertBooking(page, { step: 2, service: true, master: true })
    await assertNoOverflow(page, viewport.width, 'service offer booking')
    await page.screenshot({ path: `/tmp/sc-stage2-${viewport.width}-offer-booking.png` })

    await page.goto(`${origin}${masterPath}`, { waitUntil: 'domcontentloaded' })
    await assertCanonical(page, masterPath)
    await assertNoOverflow(page, viewport.width, 'master landing')
    await settleHeader(page, viewport.width)
    await assertBreadcrumbClearance(page, viewport.width, 'master landing')
    await page.screenshot({ path: `/tmp/sc-stage2-${viewport.width}-master.png` })
    await page.locator(`a[href="${masterBooking}"]`).first().click()
    await expect(page).toHaveURL(`${origin}${masterBooking}`)
    await assertBooking(page, { step: 0, master: true })

    await page.goto(`${origin}${masterPath}`, { waitUntil: 'domcontentloaded' })
    await page.locator('#services .service-card__summary').first().click()
    await expect(page).toHaveURL(`${origin}${offerBooking}`)
    await assertBooking(page, { step: 2, service: true, master: true })

    for (const [path, expected] of [
      ['/?service=missing-service#booking', { step: 0 }],
      ['/?master=9999#booking', { step: 0 }],
      ['/?service=bad%2Fslug&master=02#booking', { step: 0 }],
      ['/?master=2&service_id=30#booking', { step: 0, master: true }],
      ['/?service=seo-haircut&master=9999#booking', { step: 1, service: true }],
    ]) {
      await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })
      await assertUsableFallback(page, expected)
      await assertNoOverflow(page, viewport.width, `fallback ${path}`)
    }

    assert.deepEqual(errors, [], `Browser or hydration errors at ${viewport.width}px`)
    assert.equal(rejectedMutations.some(path => /\/public\/(bookings|waitlist|sms)/.test(path)), false,
      `Smoke attempted a booking mutation: ${JSON.stringify(rejectedMutations)}`)
    console.log(`PASS SEO landing ${viewport.width}x${viewport.height}: no-JS pages, canonical links, CTA prefill, safe fallbacks, no overflow`)
    await context.close()
  }
} finally {
  await browser.close()
}
