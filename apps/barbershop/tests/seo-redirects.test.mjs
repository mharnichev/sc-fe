import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../server/middleware/seo-redirects.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const setup = `const defineEventHandler = value => value; const getRequestURL = event => new URL(event.url); const sendRedirect = (event, to, code) => ({to, code});\n`
const { default: redirect } = await import(`data:text/javascript;base64,${Buffer.from(setup + compiled).toString('base64')}`)

test('retired service redirects permanently in either language without losing booking parameters', () => {
  for (const prefix of ['', '/en']) for (const trailing of ['', '/']) {
    const target = `${prefix}/services/clipper-cut-beard-trim-3?master=1&source=google`
    const url = `https://soulcuts.com.ua${prefix}/services/clipper-cut-beard-trim-ukrainian-armed-forces-15${trailing}?master=1&source=google`
    assert.deepEqual(redirect({ url }), { to: target, code: 301 })
  }
})

test('English home has one canonical slash form; public and private routes pass through', () => {
  assert.deepEqual(redirect({ url: 'https://soulcuts.com.ua/en?service=haircut-7' }), { to: '/en/?service=haircut-7', code: 301 })
  for (const path of ['/en/', '/', '/services/haircut-7', '/booking/manage', '/api/v1/public/masters']) {
    assert.equal(redirect({ url: `https://soulcuts.com.ua${path}` }), undefined)
  }
})
