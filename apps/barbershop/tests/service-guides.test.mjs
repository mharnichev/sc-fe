import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const namesSource = await readFile(new URL('../data/serviceGuideNames.ts', import.meta.url), 'utf8')
const namesCompiled = ts.transpileModule(namesSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
globalThis.__guideNames = await import(`data:text/javascript;base64,${Buffer.from(namesCompiled).toString('base64')}`)
const source = (await readFile(new URL('../data/serviceGuides.ts', import.meta.url), 'utf8')).replace("import { hasServiceGuide } from './serviceGuideNames'", 'const { hasServiceGuide } = globalThis.__guideNames')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { serviceGuide } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const pageSource = await readFile(new URL('../pages/services/[slug].vue', import.meta.url), 'utf8')

test('all nine confirmed service types have helpful guidance in both languages', () => {
  const services = [
    [7, 'Стрижка'],
    [6, 'Стрижка машинкою'],
    [4, 'Стрижка + борода'],
    [5, 'Стрижка бороди'],
    [1, 'Традиційне гоління'],
    [2, 'Дитяча стрижка'],
    [3, 'Стрижка машинкою + стрижка бороди'],
    [8, 'Укладка волосся'],
    [10, 'Камуфляж сивини бороди'],
  ]

  for (const locale of ['uk', 'en']) {
    const guides = services.map(([id, name]) => serviceGuide(id, name, locale))
    assert.ok(guides.every(Boolean))
    for (const field of ['intro', 'choice', 'preparation', 'result']) {
      if (field === 'intro' || field === 'choice') {
        assert.equal(new Set(guides.map(guide => guide[field])).size, services.length)
      }
      assert.ok(guides.every(guide => guide[field].length > 20))
    }
    assert.ok(guides.every(guide => guide.faq.length >= 1))
  }
})

test('unknown or renamed catalog services retain the generic detail page', () => {
  assert.equal(serviceGuide(999, 'Інша послуга', 'uk'), null)
  assert.equal(serviceGuide(7, 'Інша послуга', 'en'), null)
  assert.equal(serviceGuide(null, 'Стрижка', 'uk'), null)
  assert.match(pageSource, /v-if="guide"/)
  assert.match(pageSource, /statusCode: 404/)
})

test('service and barber calls to action preserve booking context', () => {
  assert.match(pageSource, /const bookingPath = seoBookingPath\(\{ serviceSlug: serviceSeoSlug\(service\) \}\)/)
  assert.match(pageSource, /:to="bookingPath"/)
  assert.match(pageSource, /seoBookingPath\(\{ serviceSlug: serviceSeoSlug\(service\), masterId: offer\.master\.id \}\)/)
})



test('personal practice stays attributed and no invented camouflage guarantees or child age are added', () => {
  for (const locale of ['uk', 'en']) {
    const beard = serviceGuide(5, 'Стрижка бороди', locale)
    assert.match(beard.result, /Глеб|Hlib/)
    const grey = serviceGuide(10, 'Камуфляж сивини бороди', locale)
    assert.doesNotMatch(JSON.stringify(grey), /2[–-]3|алергопроб|allergy test/i)
    const child = serviceGuide(2, 'Дитяча стрижка', locale)
    assert.doesNotMatch(JSON.stringify({ ...child, relatedServiceIds: undefined }), /[67][–-][67]|мінімальн.*[0-9]|minimum.*[0-9]/i)
    for (const [id, name] of [[7, 'Стрижка'], [6, 'Стрижка машинкою']]) {
      assert.match(JSON.stringify(serviceGuide(id, name, locale)), /fade/)
    }
  }
})

test('related service links come from the live indexable catalog and editorial intro drives SEO', () => {
  assert.match(pageSource, /const relatedServices = computed/)
  assert.match(pageSource, /guide\.value\?\.relatedServiceIds\.includes/)
  assert.match(pageSource, /v-for="item in relatedServices"/)
  assert.match(pageSource, /sentence\(guide\.value\?\.intro \|\| serviceDescription\.value\)/)
})
