import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const apiSource = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')
const modalSource = await readFile(new URL('../components/PromotionFormModal.vue', import.meta.url), 'utf8')
const promotionsPageSource = await readFile(new URL('../pages/promotions.vue', import.meta.url), 'utf8')

const extractDeclaration = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  assert.notEqual(start, -1, `Missing ${startMarker}`)
  assert.notEqual(end, -1, `Missing ${endMarker}`)
  return source.slice(start, end)
}

const formLogic = () => {
  const normalizeCode = extractDeclaration(modalSource, 'const normalizeCode', 'const fillForm')
    .replace('(value: string)', '(value)')
  const validate = extractDeclaration(modalSource, 'const validate', 'const promotionPayload')
  const payload = extractDeclaration(modalSource, 'const promotionPayload', 'const submit')
    .replace('const promotionPayload = (): PromotionPayload =>', 'const promotionPayload = () =>')
  const build = new Function('form', 'toIsoOrNull', 'normalizeNumberIds', `${normalizeCode}\n${validate}\n${payload}\nreturn { validate, promotionPayload }`)
  return build
}

const validForm = () => ({
  code: 'FIRST_VISIT20',
  name_uk: 'Перший візит',
  name_en: 'First visit',
  description_uk: null,
  description_en: null,
  discount_percent: 20,
  application_mode: 'automatic',
  eligibility_type: 'first_visit',
  inactive_days: null,
  starts_at: '',
  ends_at: '',
  applies_to_all_masters: true,
  master_ids: [],
  applies_to_all_services: true,
  base_service_ids: [],
  is_active: true,
  is_public: true,
})

test('promotion administration models automatic first-visit offers and public availability', () => {
  assert.match(apiSource, /export type PromotionApplicationMode = 'code' \| 'automatic'/)
  assert.match(apiSource, /'first_visit'/)
  assert.match(apiSource, /application_mode: PromotionApplicationMode/)
  assert.match(apiSource, /is_public: boolean/)
})

test('promotion form keeps automatic offers identifiable internally and rejects automatic military offers', () => {
  assert.match(modalSource, /Внутрішній ідентифікатор/)
  assert.match(modalSource, /Клієнту не потрібно вводити код/)
  assert.match(modalSource, /серед усіх майстрів/)
  assert.match(modalSource, /Вибір іншого майстра не поновлює знижку/)
  assert.match(modalSource, /Уже підтверджені записи зберігають зафіксовані ціни/)
  assert.match(modalSource, /form\.application_mode === 'automatic' && form\.eligibility_type === 'military_customers'/)
  assert.match(modalSource, /Number\.isInteger\(form\.discount_percent\)/)
  assert.match(modalSource, /step="1"/)
  assert.match(modalSource, /v-model="form\.is_public"/)
  assert.match(modalSource, /application_mode: form\.application_mode/)
  assert.match(modalSource, /is_public: form\.is_public/)
})

test('promotion form validates integer percentages and sends automatic first-visit payload fields', () => {
  const form = validForm()
  const { validate, promotionPayload } = formLogic()(form, value => value || null, values => values.map(Number))

  assert.equal(validate(), '')
  assert.deepEqual(promotionPayload(), {
    ...form,
    code: 'FIRST_VISIT20',
    description_uk: null,
    description_en: null,
    discount_type: 'percent',
    discount_percent: 20,
    inactive_days: null,
    starts_at: null,
    ends_at: null,
    master_ids: [],
    base_service_ids: [],
  })

  form.discount_percent = 20.5
  assert.equal(validate(), 'Знижка має бути цілим числом від 1 до 100%.')
})

test('promotions list identifies automatic mode, first visits, and public availability', () => {
  assert.match(promotionsPageSource, /promotion\.eligibility_type === 'first_visit'/)
  assert.match(promotionsPageSource, /'Перший візит до барбершопу'/)
  assert.match(promotionsPageSource, /promotion\.application_mode === 'automatic'/)
  assert.match(promotionsPageSource, /'Автоматично'/)
  assert.match(promotionsPageSource, /promotion\.is_public \? 'публічна' : 'приватна'/)
})
