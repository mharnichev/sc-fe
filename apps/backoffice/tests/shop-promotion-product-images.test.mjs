import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const { productDisplayImage } = await import(moduleUrl(await read('../utils/productImages.ts')))
const { resolveApiAssetUrl } = await import(moduleUrl(await read('../../../packages/shared-utils/src/index.ts')))
const formSource = await read('../components/ShopPromotionFormModal.vue')
const optionsSource = formSource.slice(formSource.indexOf('const productOptions ='), formSource.indexOf('const categoryOptions ='))
const mapOptions = products => new Function('products', 'computed', 'assetUrl', 'productDisplayImage', `${compile(optionsSource)}; return productOptions;`)(
  { value: products },
  getter => getter(),
  value => resolveApiAssetUrl(value, 'https://api.example.com/api/v1', 'https://admin.example.com'),
  productDisplayImage,
)

test('promotion product options resolve the display projection while preserving IDs and search metadata', () => {
  const [option] = mapOptions([{
    id: 42, name: 'Shampoo', sku: 'SH-42',
    display_image_url: '/media/display.webp', image_url: '/media/original.webp',
  }])
  assert.deepEqual(option, {
    value: 42, label: 'Shampoo', description: 'SKU: SH-42', searchText: 'Shampoo SH-42',
    imageUrl: 'https://api.example.com/media/display.webp',
  })
})

test('promotion options support gallery and legacy images and leave missing images empty', () => {
  const options = mapOptions([
    { id: 1, name: 'Gallery', images: [
      { id: 2, sort_order: 0, is_active: false, image_url: '/media/inactive.webp' },
      { id: 3, sort_order: 1, is_active: true, image_url: '/media/active.webp' },
    ] },
    { id: 2, name: 'Legacy', image_url: 'https://cdn.example.com/legacy.webp' },
    { id: 3, name: 'No photo' },
  ])
  assert.deepEqual(options.map(option => option.imageUrl), [
    'https://api.example.com/media/active.webp', 'https://cdn.example.com/legacy.webp', '',
  ])
  assert.equal(options[2].description, null)
  assert.equal(options[2].searchText, 'No photo ')
})
