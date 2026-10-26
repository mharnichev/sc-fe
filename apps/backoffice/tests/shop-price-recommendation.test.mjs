import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/shopPriceRecommendation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { recommendShopPrice } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('recommends lower ending-9 prices within the two percent limit', () => {
  for (const [input, expected] of [[500, 499], [555, 549], [544, 539], [1000, 999], [1097, 1089], ['499.99', 499], [450, 449], ['10.00', null]]) {
    assert.equal(recommendShopPrice(input), expected, String(input))
  }
})

test('keeps manual choices where no safe lower recommendation exists', () => {
  for (const input of [115, 145, 499, 9, 1, 0, null, undefined, '', ' ', -100, Infinity, NaN, '500.001', '1e3', '1,000', '100000000', {}, true]) {
    assert.equal(recommendShopPrice(input), null, String(input))
  }
  assert.equal(recommendShopPrice('99999999.99'), 99999999)
})

test('uses exact cents at the two percent boundary and is idempotent', () => {
  assert.equal(recommendShopPrice('50.00'), 49)
  assert.equal(recommendShopPrice('50.01'), null)
  for (let cents = 1; cents < 200000; cents += 37) {
    const input = (cents / 100).toFixed(2)
    const result = recommendShopPrice(input)
    if (result === null) continue
    assert.equal(result % 10, 9)
    assert.ok(result * 100 < cents)
    assert.ok((cents - result * 100) * 100 <= cents * 2)
    assert.equal(recommendShopPrice(result), null)
  }
})

test('the form presents an accessible optional recommendation without implicit rounding', async () => {
  const form = await readFile(new URL('../components/ProductForm.vue', import.meta.url), 'utf8')
  assert.match(form, /computed\(\(\) => recommendShopPrice\(form\.shop_price\)\)/)
  assert.match(form, /:aria-describedby="`\$\{formId\}-shop-price-policy \$\{formId\}-shop-price-recommendation`"/)
  assert.match(form, /role="status" aria-live="polite" aria-atomic="true"/)
  assert.match(form, /type="button"[^>]*@click="applyShopPriceRecommendation"/)
  assert.match(form, /зниження не перевищує 2%/)
  assert.match(form, /500 → 499 грн/)
  assert.doesNotMatch(form, /@(?:blur|change|submit)="applyShopPriceRecommendation/)
  assert.equal((form.match(/form\.shop_price = shopPriceRecommendation\.value/g) || []).length, 1)
})
