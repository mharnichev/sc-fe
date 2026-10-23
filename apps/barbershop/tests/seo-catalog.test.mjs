import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const moduleUrl = async (path, replacements = []) => {
  let source = await readFile(new URL(path, import.meta.url), 'utf8')
  for (const [from, to] of replacements) source = source.replace(from, to)
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
}
const guideUrl = await moduleUrl('../data/serviceGuideNames.ts')
const activeUrl = await moduleUrl('../composables/useActiveServiceCatalog.ts')
const seoUrl = await moduleUrl('../utils/seoRoutes.ts', [
  ["'~/data/serviceGuideNames'", JSON.stringify(guideUrl)],
  ["'~/composables/useActiveServiceCatalog'", JSON.stringify(activeUrl)],
])
const { hasServiceGuide, serviceGuideNames, serviceGuideEditorialUpdatedAt, serviceGuideLastmod } = await import(guideUrl)
const { activeCatalogItems, activeBaseCatalogItems, activeMasterServices, isPublicServiceActive, retiredBaseServiceReplacements } = await import(activeUrl)
const { indexableServiceCatalog, serviceSeoPath } = await import(seoUrl)

const service = (id, overrides = {}) => ({
  catalog_id: `base:${id}`,
  base_service_id: id,
  source_type: 'base',
  title_uk: serviceGuideNames[id] || `Послуга ${id}`,
  name: serviceGuideNames[id] || `Послуга ${id}`,
  price: 400,
  duration_minutes: 30,
  barber_services: [{ id: id * 100, barber_id: 1 }],
  ...overrides,
})

test('guide identity requires an exact approved ID and trimmed Ukrainian name', () => {
  for (const [id, name] of Object.entries(serviceGuideNames)) {
    assert.equal(hasServiceGuide(Number(id), ` ${name} `), true)
    assert.equal(hasServiceGuide(Number(id), name.toLowerCase()), false)
  }
  for (const id of [null, undefined, 999]) assert.equal(hasServiceGuide(id, 'Стрижка'), false)
  assert.equal(hasServiceGuide(7, null), false)
  assert.equal(hasServiceGuide(7, 'Інша послуга'), false)
})

test('retired ZSU service is excluded from public offers even while API rows remain active', () => {
  const retired = service(15, { description_uk: 'Legacy service', is_active: true })
  const available = service(3)
  const masterRows = [{ id: 1500, base_service_id: 15, is_active: true }, { id: 300, base_service_id: 3 }]
  assert.equal(retiredBaseServiceReplacements[15], 3)
  assert.equal(isPublicServiceActive(masterRows[0]), false)
  assert.deepEqual(activeCatalogItems([retired, available]).map(row => row.base_service_id), [3])
  assert.equal(activeBaseCatalogItems([retired, available])[0].base_service_id, 3)
  assert.deepEqual(activeMasterServices(masterRows), [masterRows[1]])
  assert.deepEqual(indexableServiceCatalog([retired, available]).map(row => row.base_service_id), [3])
  assert.equal(retired.is_active, true)
  assert.equal(masterRows.length, 2)
  assert.equal(hasServiceGuide(15, 'Стрижка машинкою+стрижка бороди ЗСУ'), false)
})

test('editorial modification dates cover only exact approved guides and stay tied to the published revision', () => {
  assert.deepEqual(Object.keys(serviceGuideEditorialUpdatedAt), Object.keys(serviceGuideNames))
  for (const [id, name] of Object.entries(serviceGuideNames)) {
    assert.equal(serviceGuideLastmod(Number(id), name), '2026-10-21T12:59:14.000Z')
  }
  assert.equal(serviceGuideLastmod(7, 'Renamed service'), undefined)
  assert.equal(serviceGuideLastmod(15, 'Стрижка машинкою+стрижка бороди ЗСУ'), undefined)
  assert.equal(serviceGuideLastmod(null, 'Стрижка'), undefined)
})

test('approved guides allow the cheapest merged child haircut and shave without API descriptions', () => {
  const cheapChild = service(2, { price: 350 })
  const expensiveChild = service(2, {
    price: 500,
    description_uk: 'Опис API',
    barber_services: [{ id: 201, barber_id: 2 }],
  })
  const result = indexableServiceCatalog([cheapChild, expensiveChild, service(1)])
  assert.equal(result.length, 2)
  assert.equal(result[0].price, 350)
  assert.equal(result[0].barber_services.length, 2)
  assert.equal(result[0].description_uk, undefined)
  assert.equal(serviceSeoPath(result[0]), '/services/dytyacha-stryzhka-2')
  assert.equal(serviceSeoPath(result[1]), '/services/tradytsiyne-holinnya-1')
})

test('unknown and renamed services still require descriptions', () => {
  assert.deepEqual(indexableServiceCatalog([
    service(999),
    service(7, { title_uk: 'Нова назва' }),
    service(6, { title_uk: null, name: 'Нова назва' }),
  ]), [])
  assert.equal(indexableServiceCatalog([service(999, { description_en: 'Approved API content' })]).length, 1)
  assert.equal(indexableServiceCatalog([service(7, { title_uk: null })]).length, 1)
})

test('guide manifest does not manufacture routes or bypass activity, offers, custom or duplicate guards', () => {
  assert.deepEqual(indexableServiceCatalog([]), [])
  assert.deepEqual(indexableServiceCatalog([
    service(1, { source_type: 'custom' }),
    service(2, { is_active: false }),
    service(3, { barber_services: [] }),
    service(4, { barber_services: [{ id: 400, barber_id: 1, is_active: false }] }),
    service(5, { slug: 'collision' }),
    service(6, { slug: 'collision' }),
    service(7, { base_service_id: null }),
  ]), [])
  assert.equal(indexableServiceCatalog([service(8)]).length, 1)
  assert.equal(serviceSeoPath(service(8, { slug: 'approved-api-slug' })), '/services/approved-api-slug')
})
