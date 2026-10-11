import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/barcodeCamera.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { isCameraBarcode, stopCameraTracks, cameraErrorMessage, createCameraDecoder } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('camera barcode validation preserves exact EAN and alphanumeric strings', () => {
  assert.equal(isCameraBarcode('0012345678905'), true)
  assert.equal(isCameraBarcode('00123456'), true)
  assert.equal(isCameraBarcode(' AbC-00 '), true)
  for (const value of ['', '   ', 'a'.repeat(65)]) assert.equal(isCameraBarcode(value), false)
})

test('camera cleanup stops every track, including audio if present', () => {
  const stopped = []
  stopCameraTracks({ getTracks: () => [{ stop: () => stopped.push('video') }, { stop: () => stopped.push('audio') }] })
  assert.deepEqual(stopped, ['video', 'audio'])
  assert.doesNotThrow(() => stopCameraTracks(null))
})

test('native decoder configures both EAN formats and returns the exact code', async () => {
  const original = globalThis.BarcodeDetector
  let configured
  globalThis.BarcodeDetector = class {
    static async getSupportedFormats() { return ['ean_13', 'ean_8'] }
    constructor(options) { configured = options.formats }
    async detect() { return [{ rawValue: '' }, { rawValue: '0012345678905' }] }
  }
  try {
    const decode = await createCameraDecoder()
    assert.deepEqual(configured, ['ean_13', 'ean_8'])
    assert.equal(await decode({}), '0012345678905')
  } finally { globalThis.BarcodeDetector = original }
})

test('camera errors offer localized manual recovery', () => {
  for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'Other']) {
    const error = new Error('private details')
    error.name = name
    assert.match(cameraErrorMessage(error), /вручну/)
    assert.doesNotMatch(cameraErrorMessage(error), /private details/)
  }
})

// Exercise the real JS fallback against generated EAN artwork rather than a
// mocked decoder result. Browser canvas image reads are the only adapter.
const { createRequire } = await import('node:module')
const { pathToFileURL } = await import('node:url')
const require = createRequire(import.meta.url)
const fallbackCompiled = compiled.replaceAll("'@zxing/browser'", `'${pathToFileURL(require.resolve('@zxing/browser')).href}'`).replaceAll("'@zxing/library'", `'${pathToFileURL(require.resolve('@zxing/library')).href}'`)
const fallbackUtils = await import(`data:text/javascript;base64,${Buffer.from(fallbackCompiled).toString('base64')}`)

test('software fallback reads actual EAN13 and EAN8 barcode pixels', async () => {
  const left = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
  const even = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
  const parity = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
  const right = left.map(bits => bits.replace(/[01]/g, bit => bit === '0' ? '1' : '0'))
  const originalDocument = globalThis.document
  const originalDetector = globalThis.BarcodeDetector
  try {
    globalThis.BarcodeDetector = undefined
    for (const value of ['5901234123457', '96385074']) {
      const digits = [...value].map(Number)
      const start = value.length === 13 ? 1 : 0
      const half = value.length === 13 ? 6 : 4
      const bars = '0'.repeat(12) + '101' + digits.slice(start, start + half).map((digit, index) => value.length === 13 && parity[digits[0]][index] === 'G' ? even[digit] : left[digit]).join('') + '01010' + digits.slice(start + half).map(digit => right[digit]).join('') + '101' + '0'.repeat(12)
      const width = bars.length * 3
      const height = 120
      const data = new Uint8ClampedArray(width * height * 4)
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4
        const shade = bars[Math.floor(x / 3)] === '1' ? 0 : 255
        data.set([shade, shade, shade, 255], offset)
      }
      const context = { drawImage() {}, getImageData: () => ({ data }) }
      globalThis.document = { createElement: () => ({ width, height, getContext: () => context }) }
      const decode = await fallbackUtils.createCameraDecoder()
      assert.equal(await decode({ videoWidth: width, videoHeight: height }), value)
    }
  } finally {
    globalThis.document = originalDocument
    globalThis.BarcodeDetector = originalDetector
  }
})
