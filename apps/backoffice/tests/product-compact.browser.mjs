import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'
import ts from 'typescript'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const appRequire = createRequire(path.join(appRoot, 'package.json'))
const nuxtRoot = path.dirname(appRequire.resolve('nuxt/package.json'))
const builderRequire = createRequire(path.resolve(nuxtRoot, '../@nuxt/vite-builder/package.json'))
const { default: vue } = await import(pathToFileURL(builderRequire.resolve('@vitejs/plugin-vue')))
const tailwindRequire = createRequire(appRequire.resolve('@nuxtjs/tailwindcss'))
const tailwind = tailwindRequire('tailwindcss')
const postcss = tailwindRequire('postcss')
const components = ['ProductForm', 'BaseCard', 'BaseInput', 'BaseTextarea', 'BaseSelect', 'BaseField', 'BaseFieldHelp', 'BaseButton', 'BaseToggle', 'TrashIcon']
const imports = ['ref', 'reactive', 'computed', 'watch', 'nextTick', 'onMounted', 'onBeforeUnmount', 'useAttrs', 'inject', 'provide', 'useId']

test('compact product form preserves prices and supports help in mobile dark mode', { timeout: 60_000 }, async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'product-compact-browser-')))
  let server, browser
  try {
    const fixture = `<script setup>
import { ref } from 'vue'
const initial = ref({ name: 'Product', slug: 'product', price: 100, shop_price: 180, recommended_retail_price: 200, stock_quantity: 3, is_active: true })
const version = ref(0)
const payload = ref(null)
window.fixture = { reset(value) { initial.value = { ...initial.value, shop_price: value }; version.value++; payload.value = null } }
</script>
<template><main style="max-width:1100px;margin:16px"><ProductForm :key="version" :initial-value="initial" :categories="[]" :brands="[]" @submit="payload = $event"/><output id="payload" hidden>{{ JSON.stringify(payload) }}</output></main></template>`
    const css = await postcss([tailwind({ content: [
      ...components.map(name => path.join(appRoot, 'components', `${name}.vue`)),
      { raw: fixture, extension: 'vue' },
    ], corePlugins: { preflight: true } })]).process(await readFile(path.join(appRoot, 'assets/css/main.css'), 'utf8'), { from: undefined })
    await writeFile(path.join(root, 'Fixture.vue'), fixture)
    await writeFile(path.join(root, 'style.css'), css.css)
    await writeFile(path.join(root, 'index.html'), '<div id="app"></div><script type="module" src="/main.js"></script>')
    // Isolate SFC compilation from Nuxt's generated tsconfig, not production code.
    for (const name of components) await writeFile(path.join(root, `${name}.vue`), await readFile(path.join(appRoot, 'components', `${name}.vue`), 'utf8'))
    for (const name of ['catalogAccess', 'categoryPaths']) {
      const source = await readFile(path.join(appRoot, 'utils', `${name}.ts`), 'utf8')
      await writeFile(path.join(root, `${name}.mjs`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText)
    }
    await writeFile(path.join(root, 'main.js'), `import { createApp } from 'vue'; import Fixture from './Fixture.vue'; import './style.css'; ${components.map(name => `import ${name} from './${name}.vue';`).join('\n')} const app = createApp(Fixture); ${components.map(name => `app.component('${name}', ${name});`).join('\n')} app.mount('#app');`)
    server = await createServer({
      configFile: false, root, logLevel: 'error', optimizeDeps: { noDiscovery: true },
      esbuild: { tsconfigRaw: { compilerOptions: {} } },
      resolve: { alias: { '~': appRoot, vue: builderRequire.resolve('vue/dist/vue.runtime.esm-bundler.js'), '@heroicons/vue/24/outline': appRequire.resolve('@heroicons/vue/24/outline').replace('/outline/index.js', '/outline/esm/index.js') } },
      server: { host: '127.0.0.1', port: 0, fs: { allow: [root, path.resolve(appRoot, '../..')] } },
      plugins: [{ name: 'product-fixture-autoimports', enforce: 'pre', transform(source, id) {
        if (!id.endsWith('.vue') || !id.startsWith(root) || id.endsWith('/Fixture.vue')) return
        const names = imports.filter(name => !(name === 'useId' && source.includes("import { useId }")))
        let result = source.replace(/(<script setup[^>]*>)/, `$1\nimport { ${names.join(', ')} } from 'vue'\n`)
        if (id.endsWith('/ProductForm.vue')) {
          result = result.replace('~/utils/catalogAccess', './catalogAccess.mjs').replace('~/utils/categoryPaths', './categoryPaths.mjs')
          result = result.replace("import { slugify } from '@shared-utils'", "const slugify = value => value.toLowerCase().replaceAll(' ', '-')")
          result = result.replace(/(<script setup[^>]*>)/, `$1\nconst useAuthStore = () => ({ user: { role: 'admin' } }); const useBaseToastNotification = () => ({ warning: message => { throw new Error(message) } })\n`)
        }
        return result
      } }, vue()],
    })
    await server.listen()
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0])
    await page.evaluate(() => document.documentElement.dataset.backofficeTheme = 'light')
    const price = page.getByLabel('Наша ціна в магазині', { exact: true })
    const save = page.getByRole('button', { name: 'Зберегти товар', exact: true })
    const payload = async () => JSON.parse(await page.locator('#payload').textContent())
    await expect(price).toHaveValue('180')
    await page.getByLabel('Назва', { exact: true }).fill('Updated product')
    await page.getByRole('button', { name: 'Пояснення: Наша ціна в магазині', exact: true }).click()
    await expect(page.getByRole('tooltip')).toBeVisible()
    assert.equal(await payload(), null, 'help must not submit')
    await page.keyboard.press('Escape')
    await save.click()
    assert.equal((await payload()).shop_price, 180)
    assert.equal((await payload()).price, 100)
    await page.screenshot({ path: '/tmp/sc-product-compact-desktop.png', animations: 'disabled' })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.evaluate(() => document.documentElement.dataset.backofficeTheme = 'dark')
    await page.getByLabel('Назва', { exact: true }).fill('A'.repeat(100))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await price.scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Пояснення: Наша ціна в магазині', exact: true }).click()
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    const bounds = await tooltip.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 375)
    const colors = await price.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }))
    assert.notEqual(colors.color, colors.background)
    await page.screenshot({ path: '/tmp/sc-product-compact-mobile-dark.png', animations: 'disabled' })
    await page.keyboard.press('Escape')
    for (const value of [null, 0, 829]) {
      await page.evaluate(value => window.fixture.reset(value), value)
      await expect(price).toHaveValue(value == null ? '' : String(value))
      // Existing min=0.01 policy blocks saving zero in the browser; invoke the
      // submit event to verify unchanged zero mapping without changing policy.
      await page.locator('form').evaluate(el => el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
      assert.equal((await payload()).shop_price, value)
    }
    await price.fill('145.25')
    await save.click()
    assert.equal((await payload()).shop_price, 145.25)
    await price.fill('')
    await save.click()
    assert.equal((await payload()).shop_price, null)
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
})
