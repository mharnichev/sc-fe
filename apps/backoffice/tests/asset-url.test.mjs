import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const sharedSource = await readFile(new URL('../../../packages/shared-utils/src/index.ts', import.meta.url), 'utf8')
const sharedUrl = `data:text/javascript;base64,${Buffer.from(compile(sharedSource)).toString('base64')}`
const source = (await readFile(new URL('../composables/useAssetUrl.ts', import.meta.url), 'utf8'))
  .replace("'../../../packages/shared-utils/src/index'", JSON.stringify(sharedUrl))
  .replace('import.meta.client', 'true')
const { useAssetUrl } = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`)

const resolver = (origin, apiBase = '/api/v1') => {
  globalThis.window = { location: { origin } }
  globalThis.useRuntimeConfig = () => ({ public: { apiBase } })
  return useAssetUrl()
}

test('backoffice media uses the public domain and retains upload version and URL suffixes', () => {
  const assetUrl = resolver('https://admin.soulcuts.com.ua')
  assert.equal(assetUrl('/media/barbers/master.webp'), 'https://soulcuts.com.ua/media/barbers/master.webp')
  assert.equal(assetUrl({ id: 42, file_url: '/media/barbers/master.webp' }), 'https://soulcuts.com.ua/media/barbers/master.webp?v=42')
  assert.equal(assetUrl('https://admin.soulcuts.com.ua/media/master.webp?size=small#photo'), 'https://soulcuts.com.ua/media/master.webp?size=small#photo')
})

test('local development, API and external origins, and non-media assets retain their URLs', () => {
  assert.equal(resolver('http://localhost:4040')('/media/master.webp'), 'http://localhost:4040/media/master.webp')
  const assetUrl = resolver('https://admin.soulcuts.com.ua', 'https://api.soulcuts.com.ua/api/v1')
  assert.equal(assetUrl('/media/master.webp'), 'https://api.soulcuts.com.ua/media/master.webp')
  assert.equal(assetUrl('https://cdn.example.com/master.webp'), 'https://cdn.example.com/master.webp')
  assert.equal(assetUrl('blob:preview'), 'blob:preview')
  assert.equal(assetUrl(null), '')
  assert.equal(resolver('https://admin.soulcuts.com.ua')('/icons/logo.svg'), 'https://admin.soulcuts.com.ua/icons/logo.svg')
})
