import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const source = readFileSync(new URL('../utils/inputSafety.ts', import.meta.url), 'utf8')
const exports = {}
vm.runInNewContext(compile(source), { exports })
const { sanitizeInput, checkedInput, checkedBirthday, safeRequestBody, boundedInteger } = exports
const plain = value => JSON.parse(JSON.stringify(value))

test('plain text removes markup, invisible controls, bounds length and preserves Ukrainian names', () => {
  assert.equal(sanitizeInput('  Мар’яна О\u200bʼНіл <b>Іван</b>42', 'name'), '  Мар’яна ОʼНіл Іван')
  assert.equal(sanitizeInput('a\u0000\u202eb\r\nc', 'search'), 'ab c')
  assert.equal(sanitizeInput('x'.repeat(500), 'search').length, 120)
  assert.equal(sanitizeInput('a\n\n\n\n\nb', 'message'), 'a\n\n\nb')
  assert.equal(sanitizeInput('12x34 56', 'otp'), '123456')
  assert.equal(sanitizeInput('12/А<script>!</script>', 'unit'), '12/А')
})

test('invalid email, OTP, phones and repetitive/link spam are rejected before HTTP', () => {
  for (const value of ['a@b', 'a@b.com\r\nBcc:foo@bar.com', 'a'.repeat(255)]) assert.throws(() => checkedInput(value, 'email', true))
  for (const value of ['1234', '1234567', 'abcdef']) assert.throws(() => checkedInput(value, 'otp', true))
  assert.equal(checkedInput('+380 99 123 45 67', 'phone'), '+380 99 123 45 67')
  assert.equal(checkedInput('+491234567890', 'phone'), '+491234567890')
  assert.throws(() => checkedInput('+3801', 'phone'))
  for (const value of [' ', 'Hi', 'a'.repeat(25), 'https://a https://b https://c']) assert.throws(() => checkedInput(value, 'message', true))
  assert.equal(checkedInput('Доброго дня! Потрібна допомога із замовленням.', 'message', true), 'Доброго дня! Потрібна допомога із замовленням.')
})

test('birthday validates real calendar days and optional fields stay absent', () => {
  for (const value of ['1899-12-31', '2099-01-01', '2001-02-29', '2020-02-31', '2020-1-01']) assert.throws(() => checkedBirthday(value))
  assert.equal(checkedBirthday('2000-02-29'), '2000-02-29')
  assert.equal(checkedBirthday(''), '')
  const patch = safeRequestBody('/public/customers/me', 'PATCH', { name: ' Олег ', notes: undefined, birthday: undefined })
  assert.deepEqual(plain(patch), { name: 'Олег' })
  assert.deepEqual(plain(safeRequestBody('/public/customers/me', 'PATCH', { notes: null, birthday: null })), { notes: null, birthday: null })
})

test('API body validation covers feedback, auth, review and checkout without mutating callers', () => {
  assert.throws(() => safeRequestBody('/public/feedback/email', 'POST', { name: 'А', email: 'a@b.co', text: 'Доброго дня!' }))
  assert.throws(() => safeRequestBody('/public/products/1/reviews', 'POST', { rating: 6, comment: 'Добре!' }))
  assert.throws(() => safeRequestBody('/public/customers/auth/verify-otp', 'POST', { phone: '+380991234567', otp_code: '1234' }))
  const order = { firstName: '  Олег ', lastName: 'Іваненко', phoneNumber: '+380991234567', comment: 'Доставка ввечері' }
  const safe = safeRequestBody('/public/orders', 'POST', order)
  assert.equal(safe.firstName, 'Олег')
  assert.equal(order.firstName, '  Олег ')
  assert.equal(JSON.stringify(safeRequestBody('/public/orders', 'POST', safe)), JSON.stringify(safe))
  assert.equal(exports.requestCooldown('/public/feedback/email', 'POST'), 30000)
  assert.equal(exports.requestCooldown('/public/customers/me/phone-change/request-otp', 'POST'), 30000)
  assert.equal(exports.requestCooldown('/public/orders', 'POST'), 0)
})

test('quantity normalization rejects NaN/infinity and fractions and clamps bounds', () => {
  assert.equal(boundedInteger(NaN, 1, 5), 1)
  assert.equal(boundedInteger(Infinity, 1, 5), 1)
  assert.equal(boundedInteger(2.9, 1, 5), 2)
  assert.equal(boundedInteger(-1, 1, 5), 1)
  assert.equal(boundedInteger(99, 1, 5), 5)
})

test('API hook enforces shared cooldowns, sanitizes queries and preserves legacy retry intents', () => {
  const states = new Map()
  const apiExports = {}
  const apiSource = readFileSync(new URL('../composables/useApi.ts', import.meta.url), 'utf8')
    .replace(/^import .*\n/, '').replaceAll('import.meta.client', 'true').replaceAll('import.meta.server', 'false')
  vm.runInNewContext(compile(apiSource), {
    ...exports, exports: apiExports, Headers, Date,
    useRuntimeConfig: () => ({ public: { apiBase: '/api' } }),
    useCustomerAuthStore: () => ({}),
    useState: (key, init) => { if (!states.has(key)) states.set(key, { value: init() }); return states.get(key) },
    $fetch: { create: config => config },
    localStorage: { getItem: () => 'visitor-test' },
  })
  const first = apiExports.useApi(), second = apiExports.useApi()
  const body = { name: 'Олег', email: 'a@b.co', text: 'Допоможіть із замовленням, будь ласка.' }
  first.onRequest({ request: '/public/feedback/email', options: { method: 'POST', body } })
  assert.throws(() => second.onRequest({ request: '/public/feedback/email', options: { method: 'POST', body } }))
  const options = { query: { q: '<b>shampoo</b>' } }
  first.onRequest({ request: '/public/products/search', options })
  assert.equal(options.query.q, 'shampoo')
  const order = { firstName: ' Олег ', lastName: 'Іваненко', phoneNumber: '+380991234567' }
  const original = { method: 'POST', body: order }
  first.onRequest({ request: '/public/orders', options: original })
  assert.equal(original.body, order)
  assert.equal(original.body.firstName, ' Олег ')
  const safe = safeRequestBody('/public/orders', 'POST', order)
  const retry = { method: 'POST', body: safe }
  first.onRequest({ request: '/public/orders', options: retry })
  assert.equal(retry.body, safe)
})

test('clearing quantity is a draft; only explicit zero can remove the item', () => {
  const component = readFileSync(new URL('../components/ui/BaseQuantityStepper.vue', import.meta.url), 'utf8')
  const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*$/m, '')
  const model = { value: 3 }
  const context = vm.createContext({
    boundedInteger,
    defineProps: () => ({ min: 0, max: 10, step: 1 }), withDefaults: value => value,
    defineModel: () => model, computed: fn => fn,
    useShopLocale: () => ({ terms: { value: { quantity: { label: 'Quantity' } } } }),
  })
  vm.runInContext(compile(script) + '\nglobalThis.handlers = { onInput, onBlur }', context)
  const target = { value: '', valueAsNumber: NaN }
  context.handlers.onInput({ target })
  assert.equal(model.value, 3)
  context.handlers.onBlur({ target })
  assert.equal(target.value, '3')
  target.value = '4.5'; target.valueAsNumber = 4.5
  context.handlers.onInput({ target })
  assert.equal(model.value, 3)
  context.handlers.onBlur({ target })
  assert.equal(target.value, '3')
  target.value = '0.5'; target.valueAsNumber = 0.5
  context.handlers.onInput({ target })
  assert.equal(model.value, 3)
  context.handlers.onBlur({ target })
  assert.equal(target.value, '3')
  target.value = '0'; target.valueAsNumber = 0
  context.handlers.onInput({ target })
  assert.equal(model.value, 0)
})

test('base input retains numeric models and never rewrites an invalid OTP into six digits', () => {
  const component = readFileSync(new URL('../components/ui/BaseInput.vue', import.meta.url), 'utf8')
  const script = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*$/m, '')
  for (const [props, raw, expected] of [
    [{ type: 'number' }, '2.5', 2.5],
    [{ type: 'number' }, '', ''],
    [{ type: 'password' }, '<secret> value', '<secret> value'],
    [{ type: 'email' }, 'first last@example.test', 'first last@example.test'],
    [{ type: 'email' }, '<b>buyer</b>@example.test', '<b>buyer</b>@example.test'],
    [{ type: 'text', autocomplete: 'one-time-code' }, '1234567', '1234567'],
    [{ type: 'text', autocomplete: 'one-time-code' }, '12345x', '12345x'],
    [{ type: 'text', autocomplete: 'one-time-code' }, '012345', '012345'],
  ]) {
    const model = { value: '' }
    const context = vm.createContext({
      sanitizeInput, inputLimits: exports.inputLimits,
      defineProps: () => props, withDefaults: value => value,
      defineModel: () => model,
      computed: getter => ({ get value() { return getter() } }), nextTick: fn => fn(),
    })
    vm.runInContext(compile(script) + '\nglobalThis.inputHandler = onInput', context)
    const target = { value: raw, valueAsNumber: Number(raw) }
    context.inputHandler({ target })
    assert.equal(model.value, expected)
    assert.equal(target.value, String(expected))
  }
  assert.match(component, /nativeValue \|\| resolvedRule === 'otp' \? undefined : inputLimits/)
})

test('address unit punctuation matches supported backend apartment formats', () => {
  for (const unit of ['№ 12-А', '1/2', '3, корпус 2', '#4', '5.1']) {
    assert.equal(checkedInput(unit, 'unit'), unit)
  }
})

test('malformed email is rejected rather than silently changing the recipient', () => {
  for (const email of ['first last@example.test', '<b>buyer</b>@example.test', 'buyer\u200b@example.test', 'buyer\n@example.test', 'Buyer <buyer@example.test>']) {
    assert.throws(() => checkedInput(email, 'email', true))
    assert.throws(() => safeRequestBody('/public/feedback/email', 'POST', { name: 'Buyer', email, text: 'Please help with my order.' }))
    assert.throws(() => safeRequestBody('/public/orders', 'POST', { firstName: 'Buyer', lastName: 'Test', phoneNumber: '+380990001234', email }))
  }
  assert.equal(checkedInput(' buyer+tag@example.test ', 'email', true), 'buyer+tag@example.test')
})

test('checkout keeps both explicit callback choices and leaves old pending intents unchanged', () => {
 const order = { firstName: 'Олег', lastName: 'Іваненко', phoneNumber: '+380991234567' }
 for (const callbackRequested of [false, true]) {
  const safe = safeRequestBody('/public/orders', 'POST', { ...order, callbackRequested })
  assert.equal(safe.callbackRequested, callbackRequested)
 }
 assert.equal(Object.hasOwn(safeRequestBody('/public/orders', 'POST', order), 'callbackRequested'), false)
})
