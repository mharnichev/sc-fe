import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function declaration(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0]
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue
    const node = statement.declarationList.declarations.find(node => ts.isIdentifier(node.name) && node.name.text === name)
    if (node) return ts.transpileModule(`const ${node.getText(ast)}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText
  }
  throw new Error(`Missing declaration: ${name}`)
}
const page = declaration('../pages/products/[id].vue', 'initialValue')
const form = declaration('../components/ProductForm.vue', 'form')
const submit = declaration('../components/ProductForm.vue', 'submit')
const initialValue = product => new Function('product', 'computed', `${page}; return initialValue;`)({ value: product }, fn => fn())
const initialize = initial => new Function('props', 'reactive', `${form}; return form;`)({ initialValue: initial }, value => value)
function payload(state) {
  let result
  new Function('form', 'catalogEditable', 'parseError', 'mergeStructuredAttributes', 'parseAttributeText', 'normalizeText', 'emit', 'toast', `${submit}; submit();`)(
    state, { value: true }, { value: '' }, value => value, () => state.attributes_json || {},
    value => value.trim() || null, (event, value) => { assert.equal(event, 'submit'); result = value },
    { warning: () => assert.fail('Unexpected validation warning') },
  )
  return result
}
const product = { name: 'Synthetic', slug: 'synthetic', price: '100.00', recommended_retail_price: '200.00',
  shop_price: '180.00', stock_quantity: 1, is_active: true, attributes_json: null }

test('editing another product field preserves independent shop price through page, form and payload', () => {
  const state = initialize(initialValue(product))
  state.name = 'Updated name'
  const result = payload(state)
  assert.equal(result.name, 'Updated name')
  assert.equal(result.shop_price, 180)
  assert.equal(result.price, 100)
  assert.equal(result.recommended_retail_price, 200)
  assert.equal(product.shop_price, '180.00')
})
for (const [value, expected] of [['829.00', 829], ['0.01', 0.01], ['0.00', 0], [null, null], [undefined, null]]) {
  test(`shop price mapping preserves ${String(value)}`, () => {
    const state = initialize(initialValue({ ...product, shop_price: value }))
    assert.equal(state.shop_price, expected)
    assert.equal(payload(state).shop_price, expected)
  })
}
test('explicit manual price edits and explicit clearing retain their intended payload', () => {
  const state = initialize(initialValue(product))
  state.shop_price = 145.25
  assert.equal(payload(state).shop_price, 145.25)
  state.shop_price = ''
  assert.equal(payload(state).shop_price, null)
})

test('compact overview uses base price only for absent shop prices and never mutates product prices', () => {
  const metrics = declaration('../pages/products/[id].vue', 'productMetrics')
  for (const [value, expected] of [[null, '100.00'], [undefined, '100.00'], [0, 0], ['0.00', '0.00'], ['180.00', '180.00']]) {
    const record = Object.freeze({ ...product, shop_price: value })
    const result = new Function('product', 'computed', 'formatPrice', 'CurrencyDollarIcon', 'TagIcon', 'CubeIcon', `${metrics}; return productMetrics;`)(
      { value: record }, fn => fn(), value => value, null, null, null,
    )
    assert.equal(result.find(metric => metric.label === 'Ціна магазину').value, expected)
    assert.equal(record.shop_price, value)
    assert.equal(record.price, '100.00')
    assert.ok(result.some(metric => metric.label === 'На складі'))
    assert.ok(result.some(metric => metric.label === 'У резерві'))
    assert.ok(result.some(metric => metric.label === 'Доступно'))
  }
})
