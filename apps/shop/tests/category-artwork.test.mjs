import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const artwork = JSON.parse(await read('../data/category-artwork.json'))
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')}`)
const { categoryArtwork } = await importSource((await read('../utils/category-artwork.ts'))
  .replace("import artwork from '~/data/category-artwork.json'", `const artwork = ${JSON.stringify(artwork)}`))
const routing = await importSource(await read('../utils/category-routing.ts'))
const nodes = artwork.map(item => ({ ...item, name: item.slug, children: [] }))
for (const item of nodes) {
  const parent = nodes.find(parent => parent.id === item.parent_id)
  if (parent) parent.children.push(item)
}
const roots = nodes.filter(item => item.parent_id === null)

test('44 distinct category identities resolve their own transparent PNG, regardless of display language', async () => {
  assert.equal(artwork.length, 44)
  assert.equal(new Set(artwork.map(item => item.slug)).size, 44)
  assert.equal(new Set(artwork.map(item => item.id)).size, 44)
  assert.equal(new Set(artwork.map(item => item.file)).size, 44)
  for (const item of artwork) {
    const resolved = categoryArtwork(item.slug)
    assert.equal(resolved.id, item.id)
    assert.equal(resolved.src, `/category-cartoons/${item.id}-${item.slug}.png`)
    const png = await readFile(new URL(`../public${resolved.src}`, import.meta.url))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(png.readUInt32BE(16), item.width)
    assert.equal(png.readUInt32BE(20), item.height)
    assert.equal(png[25], 6, 'PNG must retain RGBA, including opaque white interiors')
  }
  assert.equal(categoryArtwork('unknown-category'), null)
})

test('every image has a valid category path, including repeated leaf names in different branches', () => {
  for (const node of nodes) {
    if (node.parent_id !== null) assert.ok(nodes.some(parent => parent.id === node.parent_id))
    const path = routing.categoryPathBySlug(roots, node.slug)
    assert.equal(path.at(-1).id, node.id)
    const destination = routing.categoryDestination(roots, node).path
    assert.equal(destination, `/${path.map(item => item.slug).join('/')}${node.children.length ? '' : '/goods/'}`)
  }
  assert.notEqual(categoryArtwork('kosmetika-pislia-golinnia-balzam').file, categoryArtwork('kosmetika-dlia-borodi-balzam').file)
})

test('illustrated cards retain the existing localized description and empty-description fallback contract', async () => {
  const cards = await read('../components/catalog/CatalogCategoryCards.vue')
  const landing = await read('../components/catalog/CatalogCategoryLandingRoute.vue')
  assert.match(cards, /categoryDisplayName, categoryDisplayDescription/)
  assert.match(cards, /v-if="categoryDisplayDescription\(category\)"/)
  assert.match(cards, /\{\{ categoryDisplayDescription\(category\) \}\}/)
  assert.match(cards, /terms\.catalog\.sidebarFallbackTitle : terms\.catalog\.productsSuffix/)
  assert.match(landing, /categoryDisplayDescription\(currentCategory\)/)
  assert.match(landing, /<CatalogCategoryCards/)
})
