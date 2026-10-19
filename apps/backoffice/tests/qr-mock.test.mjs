import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const zxing = require('@zxing/library')
Object.assign(globalThis, zxing)
const source = (await readFile(new URL('../utils/qrMock.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const utils = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('QR local link accepts only exact authenticated simulator path and loopback origin', () => {
  assert.equal(utils.qrMockLocalUrl('/orders/qr-simulator/12', 'http://localhost:6090', 12), 'http://localhost:6090/orders/qr-simulator/12')
  for (const origin of ['https://bank.example', 'javascript:alert(1)', 'http://user:pass@localhost', 'http://localhost/path', 'http://localhost/?x=1', 'http://localhost/#x']) assert.equal(utils.qrMockLocalUrl('/orders/qr-simulator/12', origin, 12), null)
  for (const path of ['//bank.example', 'https://bank.example', '/orders/qr-simulator/13', '/orders/qr-simulator/12?paid=1', '/orders/qr-simulator/12/']) assert.equal(utils.qrMockLocalUrl(path, 'http://localhost', 12), null)
})
test('rendered QR modules decode to the exact local simulator URL', () => {
  const url = 'http://127.0.0.1:6090/orders/qr-simulator/1234'
  const { size, path } = utils.qrMockCode(url)
  const pixels = new Int32Array(size * size).fill(0xffffff)
  for (const match of path.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) pixels[Number(match[2]) * size + Number(match[1])] = 0
  const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(pixels, size, size)))
  assert.equal(new zxing.QRCodeReader().decode(bitmap).getText(), url)
})
test('unknown, processing and paid receipts retain QR ownership; only server terminal unpaid permits another sale', () => {
  for (const payment_status of ['waiting', 'unknown', 'processing', 'paid', 'HOLD', 'unrecognized']) assert.equal(utils.qrMockOwnsSale({ payment_status }), true)
  for (const payment_status of ['declined', 'expired', 'cancelled']) assert.equal(utils.qrMockOwnsSale({ payment_status }), false)
  assert.equal(utils.qrMockMoney(12345), '123.45 грн')
  assert.match(utils.qrMockReceiptLabel('error'), /оплату не повторюйте/)
})

test('actual fiscal preview payment label preserves original monobank QR method on return receipts', async () => {
  const source = await readFile(new URL('../utils/fiscalMock.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  const { fiscalPaymentMethodLabel } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  assert.equal(fiscalPaymentMethodLabel('monobank_qr'), 'monobank QR')
  assert.equal(fiscalPaymentMethodLabel('card'), 'картка')
  assert.equal(fiscalPaymentMethodLabel('cash'), 'готівка')
  assert.match(fiscalPaymentMethodLabel('unknown'), /невідомий спосіб/)
})
