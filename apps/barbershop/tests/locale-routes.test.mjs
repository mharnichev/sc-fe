import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../utils/localeRoutes.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { localizedPublicPath, unlocalizedPath, publicRouteLocale, isPublicLocalizedPage } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('language URLs are stable and preserve booking queries and fragments', () => {
  for (const path of ['/', '/services', '/masters/hlib-anotskyi-1', '/services/haircut-7', '/contacts', '/terms']) {
    const english = localizedPublicPath(path, 'en')
    assert.equal(localizedPublicPath(english, 'en'), english)
    assert.equal(localizedPublicPath(english, 'uk'), path)
    assert.equal(publicRouteLocale(english), 'en')
    assert.equal(unlocalizedPath(english), path)
  }
  assert.equal(localizedPublicPath('/?service=haircut-7&master=1#booking', 'en'), '/en/?service=haircut-7&master=1#booking')
  assert.equal(localizedPublicPath('/en/?service=haircut-7&master=1#booking', 'uk'), '/?service=haircut-7&master=1#booking')
  assert.equal(localizedPublicPath('/en', 'en'), '/en/')
})

test('private routes, assets, API and separate applications never enter public locale namespace', () => {
  for (const path of ['/booking', '/booking/manage#token', '/review/abc#secret', '/api/v1/public/masters', '/_nuxt/file.js', '/blog/', '//outside.example/services', 'https://example.com/services', 'mailto:a@example.com', '#booking', '/unknown']) {
    assert.equal(localizedPublicPath(path, 'en'), path)
    assert.equal(isPublicLocalizedPage(path), false)
  }
})
