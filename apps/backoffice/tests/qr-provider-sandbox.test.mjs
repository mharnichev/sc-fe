import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../utils/qrProviderSandbox.ts', import.meta.url), 'utf8')
const { qrProviderSandboxUrl, qrProviderSandboxReceiptLabel, qrProviderSandboxBlockingReason } = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`)
const attempt = { mode: 'provider_sandbox', simulation: true, payment_url: 'https://pay.mbnk.biz/testInvoice123' }
test('sandbox QR permits only explicitly typed sandbox attempts and the pinned invoice origin', () => {
  assert.equal(qrProviderSandboxUrl(attempt), attempt.payment_url)
  for (const payment_url of ['http://pay.mbnk.biz/a', 'https://pay.mbnk.biz.evil.test/a', 'https://evil.test/a', 'https://user:pass@pay.mbnk.biz/a', 'https://pay.mbnk.biz:444/a', 'https://pay.mbnk.biz/a?x=1', 'https://pay.mbnk.biz/a#x', 'https://pay.mbnk.biz/', 'https://pay.mbnk.biz/a/b', 'https://pay.mbnk.biz/a%2fb', ' https://pay.mbnk.biz/a', '//pay.mbnk.biz/a', 'javascript:alert(1)']) assert.equal(qrProviderSandboxUrl({ ...attempt, payment_url }), null, payment_url)
  assert.equal(qrProviderSandboxUrl({ ...attempt, mode: 'mock_only' }), null)
  assert.equal(qrProviderSandboxUrl({ ...attempt, simulation: false }), null)
  assert.equal(qrProviderSandboxUrl({ ...attempt, payment_url: null }), null)
})
test('sandbox receipt labels distinguish provider test receipt from local mock', () => {
  assert.match(qrProviderSandboxReceiptLabel('issued'), /тестовий чек Checkbox/)
  assert.match(qrProviderSandboxReceiptLabel('error'), /оплату не повторюйте/)
  assert.doesNotMatch(qrProviderSandboxReceiptLabel('issued'), /MOCK/)
})

test('sandbox readiness explains manual shift prerequisites', () => {
  assert.match(qrProviderSandboxBlockingReason('local_shift_closed'), /локальну тестову зміну обліку/)
  assert.match(qrProviderSandboxBlockingReason('checkbox_test_shift_required'), /Checkbox у провайдера/)
})


test('accepts the current exact monobank payment origin', () => {
  const payment_url = 'https://pay.monobank.ua/opaque-payment_123'
  assert.equal(qrProviderSandboxUrl({ ...attempt, payment_url }), payment_url)
  assert.equal(qrProviderSandboxUrl({ ...attempt, payment_url: 'https://pay.monobank.ua.evil.test/a' }), null)
})
