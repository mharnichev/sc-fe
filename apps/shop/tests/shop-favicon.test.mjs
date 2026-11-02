import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const asset = file => readFile(new URL(`../public/${file}`, import.meta.url))
test('prepared Shop favicons contain the declared raster sizes and self-contained SVG', async () => {
  for (const [file, size] of [['favicon-96x96.png', 96], ['apple-touch-icon.png', 180]]) {
    const png = await asset(file)
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
  const ico = await asset('favicon.ico')
  assert.equal(ico.readUInt16LE(0), 0)
  assert.equal(ico.readUInt16LE(2), 1)
  const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => ico[6 + index * 16] || 256)
  assert.deepEqual(sizes, [16, 32, 48, 64, 128, 256])
  const svg = (await asset('favicon.svg')).toString()
  assert.match(svg, /viewBox="0 0 64 64"/)
  assert.doesNotMatch(svg, /<script|<foreignObject|(?:href|src)\s*=/i)
})

test('favicon head uses the runtime mount for both root and prefixed deployments', async () => {
  const source = await readFile(new URL('../plugins/favicon.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source.replace('export default ', 'globalThis.plugin = '), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  for (const base of ['/', '/shop/', '/another-mount/']) {
    let head
    const context = vm.createContext({
      defineNuxtPlugin: fn => fn,
      useShopAsset: () => path => `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
      useHead: value => { head = value },
    })
    vm.runInContext(compiled, context)
    context.plugin()
    assert.equal(head.link.length, 4)
    for (const link of head.link) assert.ok(link.href.startsWith(base), link.href)
    assert.equal(head.link[0].href, `${base}favicon.ico`)
  }
})
