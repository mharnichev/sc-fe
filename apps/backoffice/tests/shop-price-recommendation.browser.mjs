import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const appRequire = createRequire(path.join(appRoot, 'package.json'))
const nuxtRoot = path.dirname(appRequire.resolve('nuxt/package.json'))
const builderRequire = createRequire(path.resolve(nuxtRoot, '../@nuxt/vite-builder/package.json'))
const { default: vue } = await import(pathToFileURL(builderRequire.resolve('@vitejs/plugin-vue')))
const tailwindRequire = createRequire(appRequire.resolve('@nuxtjs/tailwindcss'))
const tailwind = tailwindRequire('tailwindcss')
const postcss = tailwindRequire('postcss')
const componentNames = ['BaseInput', 'BaseField', 'BaseButton', 'BaseCard', 'BaseFieldHelp', 'BaseSelect', 'BaseTextarea', 'BaseToggle', 'BaseLoader', 'TrashIcon']
const autoImports = ['ref', 'reactive', 'computed', 'watch', 'provide', 'useAttrs', 'inject', 'useId', 'nextTick', 'onMounted', 'onBeforeUnmount']

test('production ProductForm price recommendation remains optional through real browser interactions', { timeout: 60_000 }, async () => {
  const fixtureRoot = await mkdtemp(path.join(appRoot, '.shop-price-browser-'))
  let server, browser
  try {
    const fixture = `<script setup>
import { ref, reactive } from 'vue'
import ProductForm from '${appRoot}components/ProductForm.vue'
const initial = ref({ name: 'Browser product', slug: 'browser-product', price: 500, shop_price: 500 })
const loading = ref(false)
const submitted = ref(null)
window.fixture = { initial, loading, submitted }
</script><template><main style="max-width:1200px;margin:16px"><ProductForm :categories="[]" :brands="[]" :initial-value="initial" :loading="loading" @submit="submitted = $event" /></main></template>`
    const css = await postcss([tailwind({ content: [path.join(appRoot, 'components/ProductForm.vue'), ...componentNames.map(name => path.join(appRoot, 'components', name + '.vue'))], corePlugins: { preflight: true } })]).process(await readFile(path.join(appRoot, 'assets/css/main.css'), 'utf8'), { from: undefined })
    await writeFile(path.join(fixtureRoot, 'Fixture.vue'), fixture)
    await writeFile(path.join(fixtureRoot, 'style.css'), css.css)
    await writeFile(path.join(fixtureRoot, 'services.js'), `import { reactive } from 'vue'; export const auth = reactive({ user: { role: 'admin' } }); window.fixtureAuth = auth; export const useAuthStore = () => auth; export const useBaseToastNotification = () => ({ warning() {} });`)
    await writeFile(path.join(fixtureRoot, 'shared.js'), `export const slugify = value => value.toLowerCase().replace(/ +/g, '-');`)
    await writeFile(path.join(fixtureRoot, 'index.html'), '<div id="app"></div><script type="module" src="/main.js"></script>')
    await writeFile(path.join(fixtureRoot, 'main.js'), `import { createApp } from 'vue'; import Fixture from './Fixture.vue'; import './style.css'; ${componentNames.map(name => `import ${name} from '${appRoot}components/${name}.vue';`).join('\n')} const app = createApp(Fixture); ${componentNames.map(name => `app.component('${name}', ${name});`).join('\n')} app.mount('#app');`)
    server = await createServer({ configFile: false, root: fixtureRoot, logLevel: 'error', optimizeDeps: { noDiscovery: true },
      resolve: { alias: { '~': appRoot, '@shared-utils': path.join(fixtureRoot, 'shared.js'), vue: builderRequire.resolve('vue/dist/vue.runtime.esm-bundler.js'), '@heroicons/vue/24/outline': appRequire.resolve('@heroicons/vue/24/outline').replace('/outline/index.js', '/outline/esm/index.js') } },
      server: { host: '127.0.0.1', port: 0, fs: { allow: [fixtureRoot, path.resolve(appRoot, '../..')] } },
      plugins: [{ name: 'fixture-autoimports', enforce: 'pre', transform(source, id) {
        if (!id.endsWith('.vue') || !id.startsWith(path.join(appRoot, 'components/'))) return
        const names = autoImports.filter(name => !(name === 'useId' && source.includes("import { useId }")))
        const services = id.endsWith('/ProductForm.vue') ? `import { useAuthStore, useBaseToastNotification } from '${fixtureRoot}/services.js'\n` : ''
        return source.replace(/(<script setup[^>]*>)/, `$1\nimport { ${names.join(', ')} } from 'vue'\n${services}`)
      } }, vue()] })
    await server.listen()
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
    const errors = []
    const externalRequests = []
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin === new URL(server.resolvedUrls.local[0]).origin) return route.continue()
      externalRequests.push(url.href)
      return route.abort()
    })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0])
    const input = page.getByRole('spinbutton', { name: 'Наша ціна в магазині', exact: true })
    const apply = page.getByRole('button', { name: /^Застосувати/ })
    await input.fill('500')
    await input.blur()
    await expect(input).toHaveValue('500')
    await expect(apply).toHaveText('Застосувати 499 грн')
    const described = await input.getAttribute('aria-describedby')
    assert.ok(described.includes('-shop-price-policy') && described.includes('-shop-price-recommendation'))
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => document.documentElement.dataset.backofficeTheme = theme, theme)
        await input.scrollIntoViewIfNeeded()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow at ${width}px / ${theme}`)
        const policy = page.locator('[id$="-shop-price-policy"]')
        assert.equal(await policy.evaluate(el => getComputedStyle(el).color), await page.locator('h2').first().evaluate(el => getComputedStyle(el).getPropertyValue('--bo-text-muted').trim()).then(value => value.replace(/\s+/g, ' ')))
        await page.screenshot({ path: path.join(appRoot, `../../pricing-${width}-${theme}.png`), animations: 'disabled', fullPage: true })
      }
    }
    await apply.click()
    await expect(input).toHaveValue('499')
    await expect(apply).toHaveCount(0)
    await input.fill('500')
    await page.locator('button[type="submit"]').click()
    await expect(input).toHaveValue('500')
    assert.equal(await page.evaluate(() => window.fixture.submitted.value.shop_price), 500)
    for (const value of ['115', '145', '0', '', '500.001']) {
      await input.fill(value)
      await input.blur()
      await expect(apply).toHaveCount(0)
      await expect(input).toHaveValue(value)
    }
    await input.fill('555')
    await expect(apply).toHaveText('Застосувати 549 грн')
    await page.evaluate(() => { window.fixture.loading.value = true })
    await expect(apply).toBeDisabled()
    await expect(input).toHaveValue('555')
    await page.evaluate(() => { window.fixture.loading.value = false; window.fixtureAuth.user = { role: 'master' } })
    await expect(input).toHaveCount(0)
    await expect(apply).toHaveCount(0)
    assert.deepEqual(errors, [])
    assert.deepEqual(externalRequests, [], 'fixture must never contact a backend or external service')
  } finally {
    await browser?.close()
    await server?.close()
    await rm(fixtureRoot, { recursive: true, force: true })
  }
})
