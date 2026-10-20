import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const base = process.env.SHOP_SMOKE_ORIGIN || 'http://localhost:6070'
const artwork = JSON.parse(await readFile(new URL('../data/category-artwork.json', import.meta.url), 'utf8'))
const assetResults = []
for (const item of artwork) {
  const path = `/shop/category-cartoons/${item.file}`
  const response = await fetch(base + path)
  assert.equal(response.status, 200, path)
  assert.match(response.headers.get('content-type'), /image\/png/)
  const png = Buffer.from(await response.arrayBuffer())
  assert.equal(png.readUInt32BE(16), item.width)
  assert.equal(png.readUInt32BE(20), item.height)
  assetResults.push(path)
}
const treeResponse = await fetch(`${base}/api/v1/public/categories/tree?includeEmpty=true`)
assert.equal(treeResponse.status, 200)
const tree = await treeResponse.json()
const paths = []
const collect = (nodes, trail = []) => {
  for (const node of nodes) {
    const path = [...trail, node.slug]
    assert.ok(artwork.some(item => item.slug === node.slug), `Missing artwork: ${node.slug}`)
    paths.push({ ...node, path: `/shop/${path.join('/')}` })
    collect(node.children || [], path)
  }
}
collect(tree)
for (const node of paths.filter(node => node.children?.length)) {
  const response = await fetch(base + node.path, { headers: { accept: 'text/html' } })
  assert.equal(response.status, 200, node.path)
  const html = await response.text()
  for (const child of node.children) assert.ok(html.includes(`data-category-artwork="${child.slug}"`), child.slug)
}
for (const locale of ['uk', 'en']) {
  for (const suffix of ['category-artwork-missing-route', 'category-artwork-missing-route/goods/']) {
    const response = await fetch(`${base}/shop/${suffix}`, { headers: { accept: 'text/html', cookie: `shop-locale=${locale}` } })
    assert.equal(response.status, 404, suffix)
    const html = await response.text()
    assert.ok(html.includes('/shop/illustrations/retro-cartoon-404.png'))
    assert.match(html, /<h1[^>]*>/)
    assert.ok(html.includes(locale === 'en' ? 'This page wandered off' : 'Ця сторінка кудись поділася'))
    assert.ok(html.includes('>404</span>'))
  }
}
const errorAsset = await fetch(`${base}/shop/illustrations/retro-cartoon-404.png`)
assert.equal(errorAsset.status, 200)
for (const path of ['/shop/', '/shop/catalog', '/shop/brands', '/shop/contacts', '/shop/cabinet', '/shop/checkout/purchase']) {
  const response = await fetch(base + path, { headers: { accept: 'text/html' } })
  assert.ok(response.status < 400, `${path}: ${response.status}`)
}
console.log(JSON.stringify({ assets: assetResults.length + 1, publicCategories: paths.length, categoryPages: paths.filter(node => node.children?.length).length, notFoundChecks: 4, mainRoutes: 6, passed: true }, null, 2))
