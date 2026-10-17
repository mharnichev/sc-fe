import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

// Run `node tests/home-seo.browser.smoke.mjs --api` alongside a Nuxt server
// using NUXT_API_UPSTREAM_BASE=http://127.0.0.1:4183/api/v1, then run this
// script without --api. HOME_SEO_ORIGIN defaults to http://127.0.0.1:4182.
// Recovery run: restart the API with HOME_SEO_API_DELAY_MS=6000 and run --recovery.
const origin = process.env.HOME_SEO_ORIGIN || 'http://127.0.0.1:4182'
const apiDelayMs = Number(process.env.HOME_SEO_API_DELAY_MS || 0)
const builtAssets = readdirSync(new URL('../.output/public/_nuxt/', import.meta.url), { withFileTypes: true })
const fixturePhoto = builtAssets.find(entry => entry.isFile() && /^sc-hero-barber-1\..+\.webp$/.test(entry.name))?.name
assert.ok(fixturePhoto, 'Build barbershop before running the homepage SEO fixture')
const masters = [1, 2, 3, 4].map(id => ({
  id,
  name: `SEO Master ${id}`,
  full_name: `SEO Master ${id}`,
  slug: `seo-master-${id}`,
  photo: `${origin}/_nuxt/${fixturePhoto}`,
  is_active: true,
  status: 'active',
  show_on_master_block: true,
  description_en: `Biography for SEO Master ${id}`,
  description_uk: `Biography for SEO Master ${id}`,
  services: [{
    id: id * 10,
    barber_id: id,
    base_service_id: 1,
    name: 'SEO haircut',
    price: 640,
    duration_minutes: 45,
    is_active: true,
    status: 'active',
  }],
}))
const catalog = [{
  catalog_id: 'base:1',
  base_service_id: 1,
  source_type: 'base',
  slug: 'seo-haircut',
  name: 'SEO haircut',
  title_en: 'SEO haircut',
  title_uk: 'SEO haircut',
  description: 'Fixture haircut description',
  price: 640,
  duration_minutes: 45,
  barber_ids: masters.map(master => master.id),
  barber_service_ids: masters.map(master => master.id * 10),
  barber_services: masters.flatMap(master => master.services),
}]
const reviews = Array.from({ length: 4 }, (_, index) => ({
  review_id: `seo-review-${index + 1}`,
  reviewer: { display_name: `SEO Guest ${index + 1}`, profile_photo_url: null, is_anonymous: false },
  star_rating: 5,
  comment: index === 3
    ? `Excellent SEO review ${index + 1} about the visit. ${'The service was thoughtful and precise. '.repeat(6)}Long review ending.`
    : `Excellent SEO review ${index + 1} about the visit`,
  translations: index === 3 ? null : {
    en: `Excellent SEO review ${index + 1} about the visit`,
    uk: `Excellent SEO review ${index + 1} about the visit`,
  },
  create_time: index === 0 ? '2026-01-31T23:30:00Z' : '2026-10-10T12:00:00Z',
  update_time: index === 0 ? '2026-01-31T23:30:00Z' : '2026-10-10T12:00:00Z',
}))
const reviewResponse = {
  average_rating: 4.9,
  total_review_count: reviews.length,
  fetched_at: '2026-10-10T12:00:00Z',
  cache_expires_at: '2026-10-20T12:00:00Z',
  stale: false,
  items: reviews,
}

const fixture = url => {
  const path = url.pathname
  if (path.endsWith('/public/masters')) return masters
  if (path.endsWith('/public/service-catalog')) return catalog
  if (path.endsWith('/public/services')) return masters.flatMap(master => master.services)
  if (path.endsWith('/public/reviews')) return reviewResponse
  if (path.endsWith('/public/booking-promotions')) return []
  if (path.endsWith('/public/brands')) return { items: [], total: 0, page: 1, page_size: 100 }
  if (path.endsWith('/summary')) return { master_id: Number(path.split('/').at(-2)), average_rating: 4.8, approved_review_count: 2 }
  const masterReviews = path.match(/\/public\/reviews\/masters\/(\d+)$/)
  if (masterReviews) return { page: 1, page_size: 5, total: 0, items: [] }
  if (path.endsWith('/availability-range')) return { days: [] }
  return []
}

if (process.argv.includes('--api')) {
  const delayedPaths = new Set()
  createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    if (request.method !== 'GET') {
      response.writeHead(405)
      response.end('{}')
      return
    }
    const url = new URL(request.url, 'http://127.0.0.1:4183')
    const delayKey = ['/public/service-catalog', '/public/masters', '/public/reviews']
      .find(path => url.pathname.endsWith(path))
    const respond = () => response.end(JSON.stringify(fixture(url)))
    if (delayKey && apiDelayMs > 0 && !delayedPaths.has(delayKey)) {
      delayedPaths.add(delayKey)
      setTimeout(respond, apiDelayMs)
    } else {
      respond()
    }
  }).listen(4183, '127.0.0.1', () => console.log(`Homepage SEO fixture API listening on 4183; first data requests delayed ${apiDelayMs}ms; mutations disabled`))
} else {
  const require = createRequire(new URL('../../backoffice/package.json', import.meta.url))
  const { chromium, expect } = require('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  const recovery = process.argv.includes('--recovery')
  const localOnly = async (route, apiRequests = []) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    apiRequests.push({ method: request.method(), path: url.pathname })
    if (request.method() !== 'GET') return route.fulfill({ status: 405, json: {} })
    return route.fulfill({ json: fixture(url) })
  }

  try {
    for (const viewport of recovery
      ? [{ width: 1440, height: 1000 }]
      : [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      if (recovery) {
        const context = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'Europe/Kyiv' })
        const page = await context.newPage()
        page.setDefaultTimeout(20_000)
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await context.route('**/*', route => localOnly(route))
        const startedAt = Date.now()
        const response = await page.goto(origin, { waitUntil: 'domcontentloaded' })
        const elapsedMs = Date.now() - startedAt
        assert.equal(response?.status(), 200, 'SSR should return a page when upstream times out')
        assert.ok(elapsedMs < 4500, `SSR timeout should bound response near four seconds; took ${elapsedMs}ms`)
        const responseHtml = await response.text()
        assert.doesNotMatch(responseHtml.split('</head>')[0], /<link[^>]+rel="stylesheet"[^>]+(?:BaseModal|MasterRatingBlock)/, 'Closed review widgets must not add render-blocking styles')
        const markup = responseHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        assert.equal(markup.includes('SEO haircut'), false, 'Slow fixture should time out during SSR; restart API with HOME_SEO_API_DELAY_MS=6000')
        await expect(page.locator('#services')).toContainText('SEO haircut', { timeout: 20_000 })
        await expect(page.locator('#team')).toContainText(masters.at(-1).full_name, { timeout: 20_000 })
        await expect(page.locator('#reviews')).toContainText(reviews[0].comment, { timeout: 20_000 })
        assert.deepEqual(errors, [], 'Recovery should not produce browser exceptions')
        console.log(`PASS homepage SEO recovery ${viewport.width}x${viewport.height}: bounded SSR ${elapsedMs}ms, client retry populated all sections`)
        await context.close()
        continue
      }

      const noScriptContext = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'Europe/Kyiv', javaScriptEnabled: false })
      const noScriptPage = await noScriptContext.newPage()
      noScriptPage.setDefaultTimeout(15_000)
      await noScriptContext.route('**/*', route => localOnly(route))
      const response = await noScriptPage.goto(origin, { waitUntil: 'domcontentloaded' })
      assert.equal(response?.status(), 200, 'Homepage SSR response should succeed')

      // Payload JSON can contain every fixture string even when the page itself is empty.
      // These checks inspect only server-emitted markup and the DOM with JS disabled.
      const responseHtml = await response.text()
      assert.doesNotMatch(responseHtml.split('</head>')[0], /<link[^>]+rel="stylesheet"[^>]+(?:BaseModal|MasterRatingBlock)/, 'Closed review widgets must not add render-blocking styles')
      const markup = responseHtml
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '')
      for (const content of ['SEO haircut', '640', 'seo-haircut', reviews[0].comment, ...masters.map(master => master.full_name)]) {
        assert.ok(markup.includes(content), `SSR markup missing ${content}`)
      }
      await expect(noScriptPage.locator('#services')).toContainText('SEO haircut')
      await expect(noScriptPage.locator('#services')).toBeVisible()
      await expect(noScriptPage.locator('#services')).toContainText('640')
      await expect(noScriptPage.locator('#services a[href="/services/seo-haircut"]')).toHaveCount(1)
      await expect(noScriptPage.locator('#team')).toBeVisible()
      for (const master of masters) {
        await expect(noScriptPage.locator('#team')).toContainText(master.full_name)
        await expect(noScriptPage.locator(`#team a[href="/masters/${master.slug}"]`).first()).toHaveCount(1)
      }
      await expect(noScriptPage.locator('#reviews')).toBeVisible()
      for (const review of reviews.slice(0, 3)) await expect(noScriptPage.locator('#reviews')).toContainText(review.comment)
      await expect(noScriptPage.locator('#reviews')).toContainText('Excellent SEO review 4')
      await expect(noScriptPage.locator('#reviews')).toContainText('Long review ending.')
      const serverReviewDate = await noScriptPage.locator('#reviews article').first().locator('.type-meta').innerText()
      assert.match(serverReviewDate, /(?:ЛЮТ\.|FEB) 2026/i, 'Review boundary date should render in Kyiv time during SSR')
      let noScriptTeamHeight = 0
      if (viewport.width < 768) {
        noScriptTeamHeight = (await noScriptPage.locator('#team').boundingBox())?.height || 0
        assert.ok(Math.abs(noScriptTeamHeight - viewport.height) < 3, `No-JS mobile team should be one viewport tall; got ${noScriptTeamHeight}`)
      }
      await noScriptContext.close()

      const context = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'Europe/Kyiv' })
      const page = await context.newPage()
      page.setDefaultTimeout(15_000)
      const errors = []
      const apiRequests = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type()) && /hydration|mismatch/i.test(message.text())) {
          errors.push(message.text())
        }
      })
      await context.route('**/*', route => localOnly(route, apiRequests))
      await page.goto(origin, { waitUntil: 'networkidle' })
      const duplicated = apiRequests.filter(request => request.method === 'GET'
        && /\/public\/(service-catalog|masters|reviews)$/.test(request.path))
      assert.deepEqual(duplicated, [], `Hydration fetched SSR resources again: ${JSON.stringify(duplicated)}`)
      await expect(page.locator('#services')).toContainText('SEO haircut')
      await expect(page.locator('#team')).toContainText(masters.at(-1).full_name)
      await expect(page.locator('#reviews article').first()).toContainText(reviews[0].comment)
      const clientReviewDate = await page.locator('#reviews article').first().locator('.type-meta').innerText()
      assert.equal(clientReviewDate, serverReviewDate, 'Review date must not change across hydration')
      if (viewport.width < 768) {
        const clientTeamHeight = (await page.locator('#team').boundingBox())?.height || 0
        assert.ok(Math.abs(clientTeamHeight - viewport.height) < 3, `Hydrated mobile team should be one viewport tall; got ${clientTeamHeight}`)
        assert.ok(Math.abs(clientTeamHeight - noScriptTeamHeight) < 3, 'Team height must remain stable across hydration')
      }

      await page.locator('#reviews').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
      await page.getByRole('button', { name: /Лише необхідні|Only necessary/i }).click()
      await page.locator('#reviews button[aria-haspopup="dialog"]').click()
      const googleDialog = page.getByRole('dialog', { name: /Відгуки Google|Google reviews/ })
      await expect(googleDialog).toBeVisible()
      await expect(googleDialog.locator('article')).toHaveCount(reviews.length)
      await page.keyboard.press('Escape')
      await expect(googleDialog).toBeHidden()

      const reviewTrack = page.locator('#reviews .transition-transform').first()
      const before = await reviewTrack.getAttribute('style')
      await page.locator('#reviews button[aria-label]').last().click()
      await expect.poll(() => reviewTrack.getAttribute('style')).not.toBe(before)

      await page.locator('#team').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
      if (viewport.width < 768) {
        const slider = page.locator('#team .team-mobile-slider')
        await page.locator('#team button[aria-label="Show SEO Master 2"]').click()
        await expect.poll(() => slider.evaluate(element => Math.abs(element.scrollLeft - element.clientWidth))).toBeLessThan(2)
        await expect(slider.locator('article').nth(1).locator('h3')).toBeInViewport()
      } else {
        const memberButton = page.locator('#team nav button', { hasText: 'SEO Master 2' })
        await memberButton.click()
        await expect(memberButton).toHaveAttribute('aria-current', 'true')
      }

      for (const section of ['services', 'team', 'reviews']) {
        await page.locator(`#${section}`).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
        await page.waitForTimeout(1100) // Let existing reveal and copy transitions finish for visual QA.
        await page.screenshot({ path: `/tmp/sc-home-${viewport.width}-${section}.png` })
      }

      await page.goto(`${origin}/#booking`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('section#booking')).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('#booking-stepper')).toBeVisible()

      for (const anchor of ['team', 'reviews']) {
        const deepPage = await context.newPage()
        deepPage.setDefaultTimeout(15_000)
        deepPage.on('pageerror', error => errors.push(error.message))
        await deepPage.goto(`${origin}/#${anchor}`, { waitUntil: 'domcontentloaded' })
        await expect(deepPage.locator(`#${anchor}`)).toBeVisible()
        // The booking section can be inserted above the target after hydration.
        // A fresh deep link must remain aligned once the layout has settled.
        await deepPage.waitForTimeout(1200)
        await expect.poll(async () => {
          const top = await deepPage.locator(`#${anchor}`).evaluate(element => element.getBoundingClientRect().top)
          return Math.abs(top)
        }).toBeLessThan(160)
        if (anchor === 'reviews') await expect(deepPage.locator('section#booking')).toHaveCount(0)
        await deepPage.close()
      }
      assert.deepEqual(errors, [], `Hydration/browser errors at ${viewport.width}px`)
      assert.equal(apiRequests.some(request => request.method !== 'GET'), false, 'Smoke must not mutate API state')
      console.log(`PASS homepage SEO Chromium ${viewport.width}x${viewport.height}: SSR, no-JS DOM, sliders, booking anchor, hydration`)
      await context.close()
    }
  } finally {
    await browser.close()
  }
}
