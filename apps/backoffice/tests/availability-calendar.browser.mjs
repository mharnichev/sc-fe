import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { chromium, expect } from '@playwright/test'

const require = createRequire(import.meta.url)
const appRoot = fileURLToPath(new URL('../', import.meta.url))
const vueRequire = createRequire(require.resolve('nuxt/package.json'))
const { parse, compileScript, compileStyle } = vueRequire('@vue/compiler-sfc')
const { build } = createRequire(require.resolve('vite/package.json'))('esbuild')
const cssRequire = createRequire(require.resolve('@nuxtjs/tailwindcss'))
const components = ['AvailabilityWindowFormModal', 'AvailabilityWindowForm', 'BaseModal', 'BaseButton', 'BaseLoader', 'BaseInput', 'BaseField', 'ModalCloseButton', 'TrashIcon']

// Bundle and mount production SFCs in memory: no Nuxt, dev server, or shared caches.
test('isolated availability modal: mobile/desktop layout, per-day times, retry and cancellation', { timeout: 60000 }, async () => {
  const styles = []
  const bundle = await build({
    stdin: { resolveDir: appRoot, sourcefile: 'availability-fixture.js', contents: `
      import { createApp, h, ref, reactive } from 'vue';
      import { useBookingFormatting } from './composables/useBookingFormatting.ts';
      ${components.map(name => `import ${name} from './components/${name}.vue';`).join('\n')}
      const auth = reactive({ sessionRevision: 1, user: { id: 1, role: 'admin', master_id: 7 } });
      const open = ref(true), calls = [], windows = []; let fail = true;
      const api = {
        adminGetAvailability: async () => windows,
        adminCreateAvailabilityWindow: async body => {
          calls.push(body);
          if (calls.length === 2 && fail) { fail = false; throw new Error('mock failure'); }
          windows.push({ id: calls.length, ...body });
        }
      };
      Object.assign(globalThis, {
        useBackofficeApi: () => api, useAuthStore: () => auth,
        useAssetUrl: () => value => value, useBaseToastNotification: () => ({ warning() {} }),
        useBookingCalendar: () => ({ workdayStart: '09:30', workdayEnd: '20:00' }),
        useBookingFormatting,
        onBeforeRouteLeave: () => {},
      });
      const formatting = useBookingFormatting();
      const first = formatting.addDaysInput(formatting.todayInput(), 1), second = formatting.addDaysInput(first, 1);
      window.fixture = { auth, open, calls, first, second };
      const app = createApp({ render: () => h(AvailabilityWindowFormModal, {
        modelValue: open.value, 'onUpdate:modelValue': value => open.value = value,
        admin: true, masters: [{ id: 7, full_name: 'Test Master' }], initialDate: first, initialMasterId: 7,
      }) });
      ${components.slice(1).map(name => `app.component('${name}', ${name});`).join('\n')}
      app.mount('#app');
    ` },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    define: { 'import.meta.client': 'true', 'process.env.NODE_ENV': '"production"' },
    alias: { vue: vueRequire.resolve('vue/dist/vue.esm-bundler.js') },
    plugins: [{ name: 'isolated-sfc', setup(builder) {
      builder.onResolve({ filter: /^@shared-utils$/ }, () => ({ path: 'shared-utils', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const initials = value => String(value).slice(0, 2)' }))
      builder.onLoad({ filter: /\.vue$/ }, async ({ path: filename }) => {
        let source = await readFile(filename, 'utf8')
        if (!source.includes('<script')) source = '<script setup>\n</script>\n' + source
        const imports = ['ref', 'reactive', 'computed', 'watch', 'nextTick', 'onMounted', 'onBeforeUnmount', 'useAttrs']
        if (!/import\s*\{[^}]*\buseId\b/.test(source)) imports.push('useId')
        source = source.replace(/(<script setup[^>]*>)/, `$1\nimport { ${imports.join(', ')} } from 'vue'\n`)
        const { descriptor } = parse(source)
        const id = `fixture-${path.basename(filename)}`
        for (const style of descriptor.styles) styles.push(compileStyle({ source: style.content, filename, id }).code)
        return { contents: compileScript(descriptor, { id, inlineTemplate: true }).content, loader: 'ts', resolveDir: path.dirname(filename) }
      })
    } }],
  })
  const css = await cssRequire('postcss')([cssRequire('tailwindcss')({ content: components.map(name => path.join(appRoot, 'components', `${name}.vue`)) })])
    .process(await readFile(path.join(appRoot, 'assets/css/main.css'), 'utf8'), { from: undefined })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setContent('<html data-backoffice-theme="light"><body><div id="app"></div></body></html>')
    await page.addStyleTag({ content: `${css.css}\n${styles.join('\n')}` })
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    const { first, second } = await page.evaluate(() => ({ first: fixture.first, second: fixture.second }))
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.locator(`[data-selected-date="${first}"]`)).toHaveCount(1)
    if (first.slice(0, 7) !== second.slice(0, 7)) await page.getByRole('button', { name: 'Наступний місяць' }).click()
    await page.locator(`[data-date="${second}"]`).click()
    await page.getByRole('textbox', { name: `Початок ${second}`, exact: true }).fill('11:00')
    for (const [width, height, theme] of [[375, 667, 'light'], [320, 568, 'dark'], [1280, 900, 'light']]) {
      await page.setViewportSize({ width, height })
      await page.evaluate(theme => document.documentElement.dataset.backofficeTheme = theme, theme)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      for (const input of await page.locator('.availability-draft-row input').all()) {
        const box = await input.boundingBox()
        // Five-character 24h times fit compact two-card rows; each field remains at least 36px wide.
        assert.ok(box.width >= 36 && box.x >= 0 && box.x + box.width <= width, JSON.stringify(box))
      }
      await page.screenshot({ path: `/tmp/sc-availability-${width}.png`, animations: 'disabled' })
    }
    await page.locator('button[type="submit"]').click()
    await expect(page.locator(`[data-selected-date="${first}"]`)).toHaveCount(0)
    await expect(page.locator(`[data-selected-date="${second}"]`)).toHaveCount(1)
    await page.locator('button[type="submit"]').click()
    await expect(dialog).toHaveCount(0)
    const calls = await page.evaluate(() => fixture.calls)
    assert.equal(calls.length, 3)
    assert.equal(calls[0].master_id, 7)
    assert.equal(calls[1].start_at, calls[2].start_at)
    assert.notEqual(calls[0].start_at.slice(11, 16), calls[1].start_at.slice(11, 16))
    await page.evaluate(() => fixture.open.value = true)
    await expect(dialog).toBeVisible()
    await page.evaluate(() => fixture.auth.sessionRevision++)
    await expect(dialog).toHaveCount(0)
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
