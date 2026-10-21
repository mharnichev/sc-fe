import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'))
const vueRequire = createRequire(nuxtRequire.resolve('vue/package.json'))
const compilerRequire = createRequire(vueRequire.resolve('vue/compiler-sfc'))
const { parse } = vueRequire('vue/compiler-sfc')
const { parse: parseTemplate } = compilerRequire('@vue/compiler-dom')
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const source = read('components/catalog/CatalogAllGoodsRoute.vue')
const { descriptor } = parse(source)
const nodes = []
function visit(node) {
  if (node.type === 1) nodes.push(node)
  for (const child of node.children || []) visit(child)
}
visit(parseTemplate(descriptor.template.content))
const directive = (node, name) => node.props.find(prop => prop.type === 7 && prop.name === name)
const className = node => node.props.find(prop => prop.name === 'class')?.value?.content

test('ordinary catalog renders localized breadcrumbs and one screen-reader H1', () => {
  const crumb = nodes.find(node => node.tag === 'CatalogBreadcrumbs')
  assert.equal(directive(crumb, 'if').exp.content, '!topOnly')
  assert.equal(directive(crumb, 'bind').exp.content, "[{ id: 0, slug: 'catalog', name: terms.catalog.title }]")
  const headings = nodes.filter(node => node.tag === 'h1')
  assert.equal(headings.length, 2)
  const hidden = headings.find(node => directive(node, 'if'))
  assert.equal(directive(hidden, 'if').exp.content, '!topOnly')
  assert.equal(className(hidden), 'sr-only')
  assert.equal(hidden.children.find(node => node.type === 5).content.content, 'terms.catalog.title')
  assert.ok(!hidden.props.some(prop => ['hidden', 'aria-hidden'].includes(prop.name)))
})

test('popular keeps its visible heading and description without catalog breadcrumbs', () => {
  const wrapper = nodes.find(node => className(node) === 'catalog-route__title-wrapper')
  assert.equal(directive(wrapper, 'if').exp.content, 'topOnly')
  const heading = wrapper.children.flatMap(node => node.children || []).find(node => node.tag === 'h1')
  assert.equal(className(heading), 'catalog-route__title section-title type-title-strong')
  assert.equal(heading.children.find(node => node.tag === 'BaseScribbleOutline').children[0].content.content,
    'topOnly ? terms.home.popularTitle : terms.catalog.title')
  assert.ok(wrapper.children.flatMap(node => node.children || []).some(node => className(node) === 'catalog-route__description'))
  assert.match(read('pages/top.vue'), /<CatalogAllGoodsRoute top-only\s*\//)
  assert.match(read('pages/catalog.vue'), /<CatalogAllGoodsRoute\s*\//)
})
