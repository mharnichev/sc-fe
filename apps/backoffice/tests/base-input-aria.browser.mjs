import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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

test('BaseInput validates aria-invalid without losing descriptions or form behavior', { timeout: 60_000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'base-input-aria-'))
  let server
  let browser
  try {
    await writeFile(path.join(root, 'Fixture.vue'), `<script setup>
import { ref } from 'vue'
import BaseInput from '${appRoot}components/BaseInput.vue'
const invalid = ref(undefined), error = ref(''), value = ref('')
window.fixture = { invalid, error, value }
</script>
<template><main>
<p id="external-description">External description</p>
<BaseInput id="wrapped-input" label="Wrapped input" hint="Input hint" :error="error" :aria-invalid="invalid" aria-describedby="external-description external-description" v-model="value" />
<BaseInput id="bare-input" aria-label="Bare input" :aria-invalid="invalid" v-model="value" />
</main></template>`)
    await writeFile(path.join(root, 'index.html'), '<div id="app"></div><script type="module" src="/main.js"></script>')
    await writeFile(path.join(root, 'main.js'), `import { createApp } from 'vue'; import Fixture from './Fixture.vue'; import BaseField from '${appRoot}components/BaseField.vue'; createApp(Fixture).component('BaseField', BaseField).mount('#app');`)
    server = await createServer({
      configFile: false, root, logLevel: 'error', optimizeDeps: { noDiscovery: true },
      resolve: { alias: { vue: builderRequire.resolve('vue/dist/vue.runtime.esm-bundler.js') } },
      server: { host: '127.0.0.1', port: 0, fs: { allow: [root, path.resolve(appRoot, '../..')] } },
      plugins: [{ name: 'nuxt-autoimports-fixture', enforce: 'pre', transform(source, id) {
        if (!id.endsWith('.vue') || !id.startsWith(appRoot)) return
        return source.replace(/(<script setup[^>]*>)/, '$1\nimport { ref, computed, useAttrs, inject } from "vue"\n')
      } }, vue()],
    })
    await server.listen()
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort()
    })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0])
    const wrapped = page.getByRole('textbox', { name: 'Wrapped input', exact: true })
    const bare = page.getByRole('textbox', { name: 'Bare input', exact: true })
    await expect(wrapped).toBeVisible()
    for (const value of [true, false, 'true', 'false', 'grammar', 'spelling', undefined, null, '', 'invalid', 1, {}, []]) {
      await t.test(`aria-invalid ${JSON.stringify(value)}`, async () => {
        await page.evaluate(value => { window.fixture.invalid.value = value }, value)
        const expected = [true, false, 'true', 'false', 'grammar', 'spelling'].includes(value) ? String(value) : null
        await expect(wrapped).toHaveAttribute('id', 'wrapped-input')
        assert.equal(await wrapped.getAttribute('aria-invalid'), expected)
        assert.equal(await bare.getAttribute('aria-invalid'), expected)
      })
    }
    await t.test('an error wins over an explicit false and references only rendered descriptions', async () => {
      assert.equal(await wrapped.getAttribute('aria-describedby'), 'external-description wrapped-input-hint')
      await page.evaluate(() => { window.fixture.invalid.value = false; window.fixture.error.value = 'Input error' })
      await expect(wrapped).toHaveAttribute('aria-invalid', 'true')
      const ids = (await wrapped.getAttribute('aria-describedby')).split(/\s+/)
      assert.deepEqual(new Set(ids), new Set(['external-description', 'wrapped-input-error']))
      assert.equal(ids.length, 2)
      for (const id of ids) await expect(page.locator(`#${id}`)).toHaveCount(1)
      await wrapped.fill('Updated input')
      await expect(bare).toHaveValue('Updated input')
      await page.evaluate(() => { window.fixture.error.value = '' })
      await expect(wrapped).toHaveAttribute('aria-invalid', 'false')
      await expect(wrapped).toHaveAttribute('aria-describedby', 'external-description wrapped-input-hint')
    })
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
})
