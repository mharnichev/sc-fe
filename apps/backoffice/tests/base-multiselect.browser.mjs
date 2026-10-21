import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

// Mount production SFCs without requiring Nuxt, authentication, or the API.
const appRoot = fileURLToPath(new URL('../', import.meta.url))
const appRequire = createRequire(path.join(appRoot, 'package.json'))
const nuxtRoot = path.dirname(appRequire.resolve('nuxt/package.json'))
const builderRequire = createRequire(path.resolve(nuxtRoot, '../@nuxt/vite-builder/package.json'))
const { default: vue } = await import(pathToFileURL(builderRequire.resolve('@vitejs/plugin-vue')))
const tailwindRequire = createRequire(appRequire.resolve('@nuxtjs/tailwindcss'))
const tailwind = tailwindRequire('tailwindcss')
const postcss = tailwindRequire('postcss')
const componentNames = ['BaseMultiSelect', 'BaseField', 'BaseButton', 'BaseInput', 'TrashIcon']
const autoImports = ['ref', 'computed', 'watch', 'nextTick', 'onMounted', 'onBeforeUnmount', 'useAttrs', 'inject', 'useId']

test('mounted BaseMultiSelect interactions, scrolling, and thumbnails', { timeout: 60_000 }, async t => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'base-multiselect-browser-'))
  let server
  let browser
  try {
    const fixture = `<script setup>
import { ref } from 'vue'
import BaseMultiSelect from '${appRoot}components/BaseMultiSelect.vue'
const selected = ref([])
const options = Array.from({ length: 40 }, (_, index) => ({ value: index + 1, label: 'Product ' + String(index + 1).padStart(2, '0'), description: index < 3 ? 'Filtered' : 'Other', disabled: index === 2,
  imageUrl: index === 0 ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="red"/%3E%3C/svg%3E' : index === 1 ? '/broken-image.png' : '' }))
const limited = ref(false)
const disabled = ref(false)
const customSummary = ref(false)
window.fixture = { selected, limited, disabled, customSummary }
</script>
<template><main style="width:min(360px,calc(100vw - 32px));margin:16px"><BaseMultiSelect v-model="selected" :options="options" label="Products" :show-limit="limited" :max-selected="2" :disabled="disabled" :show-selected-chips="!customSummary"><template v-if="customSummary" #summary="{ selectedOptions }">{{ selectedOptions.length }} masters</template></BaseMultiSelect><button id="outside" style="position:fixed;right:16px;bottom:16px">Outside</button><output id="values" hidden>{{ JSON.stringify(selected) }}</output></main></template>`
    const css = await postcss([tailwind({ content: [
      ...componentNames.map(name => path.join(appRoot, 'components', `${name}.vue`)),
      { raw: fixture, extension: 'vue' },
    ], corePlugins: { preflight: true } })]).process(await readFile(path.join(appRoot, 'assets/css/main.css'), 'utf8'), { from: undefined })
    await writeFile(path.join(fixtureRoot, 'Fixture.vue'), fixture)
    await writeFile(path.join(fixtureRoot, 'style.css'), css.css)
    await writeFile(path.join(fixtureRoot, 'index.html'), '<div id="app"></div><script type="module" src="/main.js"></script>')
    await writeFile(path.join(fixtureRoot, 'main.js'), `import { createApp } from 'vue'; import Fixture from './Fixture.vue'; import './style.css'; ${componentNames.slice(1).map(name => `import ${name} from '${appRoot}components/${name}.vue';`).join('\n')} const app = createApp(Fixture); ${componentNames.slice(1).map(name => `app.component('${name}', ${name});`).join('\n')} app.mount('#app');`)
    server = await createServer({
      configFile: false, root: fixtureRoot, logLevel: 'error', optimizeDeps: { noDiscovery: true },
      resolve: { alias: { vue: builderRequire.resolve('vue/dist/vue.runtime.esm-bundler.js'), '@heroicons/vue/24/outline': appRequire.resolve('@heroicons/vue/24/outline').replace('/outline/index.js', '/outline/esm/index.js') } },
      server: { host: '127.0.0.1', port: 0, fs: { allow: [fixtureRoot, path.resolve(appRoot, '../..')] } },
      plugins: [{ name: 'nuxt-vue-autoimports-for-fixture', enforce: 'pre', transform(source, id) {
        if (!id.endsWith('.vue') || !id.startsWith(appRoot)) return
        const names = autoImports.filter(name => !(name === 'useId' && source.includes("import { useId }")))
        return source.replace(/(<script setup[^>]*>)/, `$1\nimport { ${names.join(', ')} } from 'vue'\n`)
      } }, vue()],
    })
    await server.listen()
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } })
    page.setDefaultTimeout(10_000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0])
    await page.evaluate(() => document.documentElement.dataset.backofficeTheme = 'light')
    const trigger = page.locator('[data-multiselect-trigger]')
    const search = page.getByRole('searchbox')
    const menu = page.getByRole('group', { name: 'Products', exact: true })
    const values = () => page.locator('#values').textContent().then(JSON.parse)
    const setState = state => page.evaluate(state => {
      for (const [key, value] of Object.entries(state)) window.fixture[key].value = value
    }, state)

    await t.test('done closes without changing selection and restores trigger focus', async () => {
      await trigger.click()
      await expect(search).toBeFocused()
      await page.getByRole('checkbox', { name: 'Product 01', exact: false }).click()
      assert.deepEqual(await values(), [1])
      const done = page.getByRole('button', { name: 'Закрити список', exact: true })
      assert.equal((await done.textContent()).trim(), '')
      await expect(done.locator('svg')).toHaveCount(1)
      const bulk = page.locator('.multi-select-bulk')
      await expect(bulk.locator('svg')).toHaveCount(2)
      const [selectBox, clearBox] = await Promise.all([bulk.nth(0).boundingBox(), bulk.nth(1).boundingBox()])
      assert.ok(Math.abs(selectBox.width - clearBox.width) < 1)
      const triggerBox = await trigger.boundingBox()
      assert.ok(selectBox.width + clearBox.width >= triggerBox.width - 30)
      await done.hover()
      const colors = await done.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el).color, icon: getComputedStyle(el.querySelector('svg')).color }))
      assert.notEqual(colors.background, colors.text, JSON.stringify(colors))
      assert.equal(colors.icon, colors.text, JSON.stringify(colors))
      await done.click()
      await expect(menu).toHaveCount(0)
      await expect(trigger).toBeFocused()
      assert.deepEqual(await values(), [1])
    })
    await t.test('accessible trigger name includes the label and default or custom selection summary', async () => {
      await expect(trigger).toHaveAccessibleName('Products: 1 вибрано')
      await setState({ selected: [1, 2], customSummary: true })
      await expect(trigger).toHaveAccessibleName('Products: 2 masters')
      await setState({ selected: [], customSummary: false })
      await expect(trigger).toHaveAccessibleName('Products: Виберіть значення')
    })
    await t.test('filtered bulk selection retains outside selections and skips disabled options; clear is global', async () => {
      await setState({ selected: [4] })
      await trigger.click()
      await search.fill('Filtered')
      await page.getByRole('button', { name: 'Вибрати всі знайдені', exact: true }).click()
      assert.deepEqual(await values(), [4, 1, 2])
      await expect(menu).toBeVisible()
      await expect(search).toHaveValue('Filtered')
      await page.getByRole('button', { name: 'Прибрати всі', exact: true }).click()
      assert.deepEqual(await values(), [])
      await expect(menu).toBeVisible()
      await expect(search).toHaveValue('Filtered')
      await search.fill('not a matching product')
      await expect(page.getByText('Нічого не знайдено.', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Вибрати всі знайдені', exact: true })).toBeDisabled()
      await search.press('Escape')
    })
    await t.test('bulk selection respects the limit and disabled selections survive clear', async () => {
      await setState({ selected: [3], limited: true })
      await trigger.click()
      await page.getByRole('button', { name: 'Вибрати всі', exact: true }).click()
      assert.deepEqual(await values(), [3, 1])
      await expect(page.getByRole('checkbox', { name: 'Product 02', exact: false })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Вибрати всі', exact: true })).toBeDisabled()
      await page.getByRole('button', { name: 'Прибрати всі', exact: true }).click()
      assert.deepEqual(await values(), [3])
      await search.press('Escape')
    })
    await t.test('keyboard opening, Enter selection, and Escape preserve focus', async () => {
      await setState({ selected: [], limited: false })
      await trigger.focus()
      await trigger.press('ArrowDown')
      await expect(search).toBeFocused()
      await search.fill('Product 04')
      await search.press('Enter')
      assert.deepEqual(await values(), [4])
      await search.press('Escape')
      await expect(menu).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await trigger.click()
      await expect(search).toHaveValue('')
      await page.getByRole('button', { name: 'Закрити список', exact: true }).click()
    })
    await t.test('Tab and outside pointer close the menu without changing selection', async () => {
      await trigger.click()
      await search.fill('Product 04')
      await search.press('Shift+Tab')
      await trigger.press('Shift+Tab')
      await expect(menu).toHaveCount(0)
      await trigger.click()
      await page.locator('#outside').click()
      await expect(menu).toHaveCount(0)
      assert.deepEqual(await values(), [4])
    })
    await t.test('disabled control blocks opening and chip removal', async () => {
      await setState({ selected: [1], disabled: true })
      await expect(trigger).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Прибрати Product 01', exact: true })).toBeDisabled()
      await trigger.press('ArrowDown')
      await expect(menu).toHaveCount(0)
      assert.deepEqual(await values(), [1])
      await setState({ disabled: false })
    })
    await t.test('many chips scroll within a bounded region and do not move the absolute menu', async () => {
      await setState({ selected: Array.from({ length: 40 }, (_, index) => index + 1) })
      const chips = page.locator('.multi-select-chips')
      await expect(chips).toHaveCount(1)
      const geometry = await chips.evaluate(el => ({ height: el.clientHeight, scrollHeight: el.scrollHeight, overflow: getComputedStyle(el).overflowY }))
      assert.ok(geometry.height <= 96, JSON.stringify(geometry))
      assert.ok(geometry.scrollHeight > geometry.height, JSON.stringify(geometry))
      assert.equal(geometry.overflow, 'auto')
      await trigger.click()
      const triggerBox = await trigger.boundingBox()
      const menuBox = await menu.boundingBox()
      assert.ok(Math.abs(menuBox.y - (triggerBox.y + triggerBox.height + 8)) < 2)
      await page.screenshot({ path: '/tmp/sc-multiselect-desktop.png', animations: 'disabled' })
      await page.setViewportSize({ width: 375, height: 667 })
      await page.evaluate(() => document.documentElement.dataset.backofficeTheme = 'dark')
      await expect(menu).toBeVisible()
      await search.fill('Product')
      await expect(page.getByRole('button', { name: 'Вибрати всі', exact: true })).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Вибрати всі знайдені', exact: true })).toHaveCount(0)
      const mobileBox = await menu.boundingBox()
      assert.ok(mobileBox.x >= 0 && mobileBox.x + mobileBox.width <= 375, JSON.stringify(mobileBox))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path: '/tmp/sc-multiselect-mobile.png', animations: 'disabled' })
      const themeColors = await page.evaluate(() => Object.fromEntries(['.multi-select-option', '.backoffice-select-trigger', '.multi-select-done'].map(selector => { const el = document.querySelector(selector); const style = getComputedStyle(el); return [selector, { color: style.color, background: style.backgroundColor, textVariable: style.getPropertyValue('--text-primary') }]})))
      assert.equal(themeColors['.multi-select-option'].color, 'rgb(255, 255, 255)')
      assert.equal(themeColors['.backoffice-select-trigger'].color, 'rgb(255, 255, 255)')
      assert.notEqual(themeColors['.multi-select-done'].color, themeColors['.multi-select-done'].background)
      await writeFile('/tmp/sc-multiselect-theme-colors.json', JSON.stringify(themeColors, null, 2))
      await page.getByRole('button', { name: 'Закрити список', exact: true }).click()
    })
    await t.test('valid thumbnails render and broken or missing images use option and chip fallbacks', async () => {
      await setState({ selected: [1, 2, 3] })
      await trigger.click()
      const valid = page.getByRole('checkbox', { name: 'Product 01', exact: false })
      await expect(valid.locator('img')).toBeVisible()
      assert.equal(await valid.locator('img').evaluate(el => el.complete && el.naturalWidth > 0), true)
      const broken = page.getByRole('checkbox', { name: 'Product 02', exact: false })
      await expect(broken.locator('img')).toHaveCount(0)
      await expect(broken.locator('span > svg').last()).toBeVisible()
      await expect(page.getByRole('checkbox', { name: 'Product 03', exact: false }).locator('img')).toHaveCount(0)
      const chips = page.locator('.service-selection-chip')
      await expect(chips.nth(0).locator('img')).toHaveCount(1)
      await expect(chips.nth(1).locator('img')).toHaveCount(0)
      await expect(chips.nth(2).locator('img')).toHaveCount(0)
    })
    assert.deepEqual(errors, [], 'mounted production components must not emit browser errors')
  } finally {
    await browser?.close()
    await server?.close()
    await rm(fixtureRoot, { recursive: true, force: true })
  }
})
