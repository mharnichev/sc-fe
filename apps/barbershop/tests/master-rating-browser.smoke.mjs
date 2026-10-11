import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

// Start with --api, point Nuxt's upstream at port 4181, then run against localhost:4180.
const masters = [1, 2].map(id => ({
  id, name: `Review Master ${id}`, full_name: `Review Master ${id}`, slug: `review-master-${id}`,
  photo: 'http://127.0.0.1:4180/_nuxt/assets/images/main/sc-open-img.webp',
  is_active: true, status: 'active', show_on_master_block: true,
  description_en: `Master ${id} biography`, description_uk: `Master ${id} biography`,
  services: [{ id: id * 10, barber_id: id, base_service_id: 1, name: 'Review haircut',
    price: 500, duration_minutes: 30, is_active: true, status: 'active' }],
}))
const catalog = [{
  catalog_id: 'base:1', base_service_id: 1, source_type: 'base', name: 'Review haircut',
  title_en: 'Review haircut', title_uk: 'Review haircut', description: 'Fixture haircut',
  price: 500, duration_minutes: 30, barber_ids: [1, 2], barber_service_ids: [10, 20],
  barber_services: masters.flatMap(master => master.services),
}]
const fixture = url => {
  const path = url.pathname
  if (path.endsWith('/public/masters')) return masters
  if (path.endsWith('/public/service-catalog')) return catalog
  if (path.endsWith('/public/services')) return masters.flatMap(master => master.services)
  if (path.endsWith('/summary')) return { master_id: Number(path.split('/').at(-2)), average_rating: 4.8, approved_review_count: 25 }
  const match = path.match(/\/public\/reviews\/masters\/(\d+)$/)
  if (match) {
    const id = Number(match[1])
    const page = Number(url.searchParams.get('page') || 1)
    const size = Number(url.searchParams.get('page_size') || 20)
    const start = (page - 1) * size
    return { page, page_size: size, total: 25, items: Array.from({ length: Math.max(0, Math.min(size, 25 - start)) }, (_, index) => ({
      id: id * 100 + start + index, rating: 5, author_name: `Guest ${start + index + 1}`,
      comment: `Master ${id} review ${start + index + 1}`, published_at: '2026-10-10T12:00:00Z',
    })) }
  }
  if (path.endsWith('/public/reviews')) return { items: [], average_rating: null, total_review_count: 0 }
  if (path.endsWith('/public/brands')) return { items: [], total: 0, page: 1, page_size: 200 }
  if (path.endsWith('/availability-range')) return { days: [] }
  return []
}

if (process.argv.includes('--api')) {
  createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    if (request.method !== 'GET') { response.writeHead(405); response.end('{}'); return }
    response.end(JSON.stringify(fixture(new URL(request.url, 'http://127.0.0.1:4181'))))
  }).listen(4181, '127.0.0.1', () => console.log('Fixture API listening on 4181; mutations disabled'))
}
else {
  const require = createRequire(new URL('../../backoffice/package.json', import.meta.url))
  const { chromium, expect } = require('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, locale: 'en-US' })
      const page = await context.newPage()
      page.setDefaultTimeout(10_000)
      const mutations = []
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await context.route('**/*', async route => {
        const request = route.request()
        const url = new URL(request.url())
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
        if (!url.pathname.startsWith('/api/')) return route.continue()
        if (request.method() !== 'GET') {
          mutations.push(url.pathname)
          return route.fulfill({ status: 405, json: {} })
        }
        return route.fulfill({ json: fixture(url) })
      })
      await page.goto('http://127.0.0.1:4180', { waitUntil: 'networkidle' })
      console.log(`Loaded ${viewport.width}px homepage`)
      // Floating actions intentionally mount only after the first user interaction.
      await page.keyboard.press('Shift')
      await page.locator('.booking-trigger-button').click()
      const drawer = page.locator('#floating-booking-drawer')
      await expect(drawer).toBeVisible()
      await drawer.locator('.booking-service__item button[aria-pressed]').first().click()
      await drawer.locator('.booking-step-tab').nth(1).click()
      await drawer.locator('.booking-master-rating button').first().click()
      const dialog = page.locator('.base-modal [role="dialog"]')
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('article')).toHaveCount(20)
      await expect.poll(async () => (await dialog.boundingBox())?.y).toBeLessThan(viewport.height * 0.15)
      await page.screenshot({ path: `/tmp/barbershop-reviews-${viewport.width}.png`, fullPage: false })
      await dialog.getByRole('button', { name: /Load more|Показати ще/ }).click()
      await expect(dialog.locator('article')).toHaveCount(25)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(drawer).toBeVisible()
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await drawer.locator('.booking-master-rating button').first().click()
      await expect(dialog.locator('article')).toHaveCount(25)
      await dialog.locator('.modal-close-button').click()
      await expect(dialog).toBeHidden()
      await expect(drawer).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      assert.equal(mutations.some(path => /\/bookings?$|\/sms|\/waitlist$/.test(path)), false)
      assert.deepEqual(errors, [])
      console.log(`PASS Chromium ${viewport.width}x${viewport.height}: nested close/Escape, pagination, cached reopen, body lock; screenshot /tmp/barbershop-reviews-${viewport.width}.png`)
      await context.close()
    }
  }
  finally { await browser.close() }
}
