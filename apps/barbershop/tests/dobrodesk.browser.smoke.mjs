import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../backoffice/package.json', import.meta.url))
const { chromium, expect } = require('@playwright/test')
const origin = process.env.DOBRODESK_ORIGIN || 'http://127.0.0.1:4184'
const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
    const context = await browser.newContext({ viewport })
    const requests = []
    const errors = []
    await context.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === 'https://www.soulcuts.com.ua' && url.pathname === '/support-widget' && new URL(origin).hostname === '127.0.0.1') {
        const response = await route.fetch({ url: `${origin}/support-widget`, headers: { ...request.headers(), host: 'www.soulcuts.com.ua' } })
        return route.fulfill({ response })
      }
      if (url.hostname === 'widget.dobrodesk.com') {
        requests.push(url.pathname)
        if (process.env.DOBRODESK_REAL === 'true') return route.continue()
        if (url.pathname.endsWith('.js')) return route.fulfill({ contentType: 'application/javascript', body: `
          const id = document.currentScript.dataset.dobrodeskIntegration;
          const frame = document.createElement('iframe'); frame.id = 'dobrodesk-widget-frame';
          frame.style.cssText = 'position:fixed;width:320px;height:480px;display:none';
          document.body.append(frame);
          window.DobroDeskWidget = (command) => {
            if (command === 'open') frame.style.display = 'block';
            if (command === 'hide' || command === 'close') frame.style.display = 'none';
            if (command === 'destroy') frame.remove();
          };
          window.dispatchEvent(new CustomEvent('dobrodesk:ready', {detail:{integrationId:id}}));
        ` })
        return route.abort()
      }
      if (request.method() !== 'GET' || ![new URL(origin).hostname, 'api.soulcuts.com.ua'].includes(url.hostname)) return route.abort()
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    if (process.env.DOBRODESK_DEBUG === 'true') {
      page.on('console', message => { if (message.type() === 'error') console.log(message.text()) })
      page.on('response', response => { if (response.url().includes('dobrodesk.com')) console.log(response.status(), new URL(response.url()).pathname) })
      page.on('requestfailed', request => { if (request.url().includes('dobrodesk.com')) console.log(request.failure()) })
    }
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.mouse.click(20, 20)
    await page.waitForTimeout(500)
    const consent = page.getByRole('button', { name: /Лише необхідні|Only necessary/i })
    if (await consent.isVisible()) await consent.click()
    const launcher = page.getByRole('button', { name: /Відкрити чат підтримки|Open support chat/ })
    await expect(launcher).toBeVisible()
    await page.mouse.click(20, 20)
    assert.equal(requests.length, 0, 'General input must not load support')
    await launcher.click()
    await expect(page.locator('#dobrodesk-support-sandbox')).toBeVisible({ timeout: 25000 })
    const box = await page.locator('#dobrodesk-support-sandbox').boundingBox()
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, JSON.stringify(box))
    await page.screenshot({ path: `/tmp/dobrodesk-${viewport.width}.png` })
    const isolated = page.frames().find(frame => frame.url().startsWith('https://www.soulcuts.com.ua/support-widget'))
    assert.ok(isolated)
    assert.equal(await isolated.evaluate(() => { try { return !!parent.document.body } catch { return false } }), false, 'SDK must not read parent DOM')
    assert.equal(await isolated.evaluate(() => { try { return parent.location.href } catch { return null } }), null, 'SDK must not read parent URL')
    assert.equal(await isolated.evaluate(() => document.baseURI), 'https://www.soulcuts.com.ua/support-widget')
    if (process.env.DOBRODESK_REAL === 'true') {
      const runtime = page.frames().find(frame => frame.url().includes('widget.dobrodesk.com/widget/runtime/'))
      assert.ok(runtime, 'Provider runtime must render')
      await runtime.getByRole('button', { name: /Закрити|Close/i }).first().click()
      await expect(page.locator('#dobrodesk-support-sandbox')).toBeHidden()
      await launcher.click()
      await expect(page.locator('#dobrodesk-support-sandbox')).toBeVisible()
    }
    await page.evaluate(() => { window.__documentMarker = true })
    // Use the actual Nuxt router; isolation must hold even across SPA history.
    await page.evaluate(() => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push('/terms?token=smoke-private'))
    await page.waitForURL('**/terms?token=smoke-private')
    await page.waitForLoadState('networkidle')
    assert.equal(await page.evaluate(() => window.__documentMarker), true)
    await expect(page.locator('#dobrodesk-support-sandbox')).toBeHidden()
    await isolated.evaluate(() => parent.postMessage({source:'soulcuts-support',type:'presentation',open:true}, '*'))
    await page.waitForTimeout(100)
    await expect(page.locator('#dobrodesk-support-sandbox')).toBeHidden()
    assert.equal(await isolated.evaluate(() => document.baseURI), 'https://www.soulcuts.com.ua/support-widget', 'Private query must not leak into frame URL')
    await expect(page.getByRole('button', { name: /Відкрити чат підтримки|Open support chat/ })).toHaveCount(0)
    await page.goBack()
    await expect(launcher).toBeVisible()
    await expect(page.locator('#dobrodesk-support-sandbox')).toBeHidden()
    await page.evaluate(() => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push('/#smoke-private'))
    await expect(launcher).toHaveCount(0)
    await expect(page.locator('#dobrodesk-support-sandbox')).toBeHidden()
    assert.deepEqual(errors, [])
    console.log(`PASS Dobrodesk ${viewport.width}x${viewport.height}: click, frame bounds, sandbox DOM/URL isolation, private navigation, no page errors`)
    await context.close()
  }
} finally { await browser.close() }
