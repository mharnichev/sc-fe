import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/barcodeCamera.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("new URL('./barcodeCamera.worker.ts', import.meta.url)", "new URL('file:///barcodeCamera.worker.ts')")
const { isCameraBarcode, stopCameraTracks, cameraErrorMessage, createCameraDecoder, resolveCameraBarcode } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

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

test('camera errors offer localized manual recovery', () => {
  for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'Other']) {
    const error = new Error('private details')
    error.name = name
    assert.match(cameraErrorMessage(error), /вручну/)
    assert.doesNotMatch(cameraErrorMessage(error), /private details/)
  }
})

test('worker decoder transfers one frame at a time and rejects in-flight work on shutdown', async () => {
  const originalWorker = globalThis.Worker
  const originalDocument = globalThis.document
  let instance
  const transfers = []
  globalThis.Worker = class {
    constructor() { instance = this; queueMicrotask(() => this.onmessage({ data: { type: 'ready' } })) }
    postMessage(message, transfer) { transfers.push({ message, transfer }) }
    terminate() { this.terminated = true }
  }
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    drawImage() {}, getImageData: (x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
  }) }) }
  try {
    const abort = new AbortController()
    const decoder = await createCameraDecoder(abort.signal)
    const video = { videoWidth: 1920, videoHeight: 1080, readyState: 2 }
    const first = decoder.decode(video)
    assert.equal(await decoder.decode(video), null)
    assert.equal(transfers.length, 1)
    assert.equal(transfers[0].message.width, 1024)
    assert.equal(transfers[0].transfer[0], transfers[0].message.buffer)
    instance.onmessage({ data: { type: 'result', barcode: '0012345678905' } })
    assert.equal(await first, '0012345678905')
    const pending = decoder.decode(video)
    abort.abort()
    await assert.rejects(pending, { name: 'AbortError' })
    assert.equal(instance.terminated, true)
    await assert.rejects(decoder.decode(video), { name: 'AbortError' })
  } finally {
    globalThis.Worker = originalWorker
    globalThis.document = originalDocument
  }
})

test('worker startup error terminates resources and allows manual recovery', async () => {
  const originalWorker = globalThis.Worker
  const originalDocument = globalThis.document
  let instance
  globalThis.Worker = class {
    constructor() { instance = this; queueMicrotask(() => this.onerror(new Error('load failed'))) }
    terminate() { this.terminated = true }
  }
  globalThis.document = { createElement: () => ({ getContext: () => ({}) }) }
  try {
    await assert.rejects(createCameraDecoder(), /unavailable/)
    assert.equal(instance.terminated, true)
  } finally { globalThis.Worker = originalWorker; globalThis.document = originalDocument }
})

test('actual WASM worker preserves EAN leading zeros and literal Code39 punctuation', async () => {
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const wasm = await import('zxing-wasm/reader')
  const { writeBarcode, prepareZXingModule } = await import('zxing-wasm/writer')
  const readerBinary = await readFile(require.resolve('zxing-wasm/reader/zxing_reader.wasm'))
  const writerBinary = await readFile(require.resolve('zxing-wasm/writer/zxing_writer.wasm'))
  await prepareZXingModule({ overrides: { wasmBinary: writerBinary }, fireImmediately: true })
  const workerSource = await readFile(new URL('../utils/barcodeCamera.worker.ts', import.meta.url), 'utf8')
  const workerCode = ts.transpileModule(workerSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/^import .*;$/gm, '').replace(/^export .*;$/gm, '')
  const messages = []
  const scope = { postMessage: message => messages.push(message) }
  class Pixels { constructor(data, width, height) { Object.assign(this, { data, width, height }) } }
  new Function('prepareZXingModule', 'readBarcodes', 'ImageData', 'globalThis', 'wasmUrl', workerCode)(
    () => wasm.prepareZXingModule({ overrides: { wasmBinary: readerBinary }, fireImmediately: true }),
    wasm.readBarcodes, Pixels, scope, '',
  )
  for (const [format, text, expected = text] of [['EAN13', '0012345678905'], ['EAN8', '96385074'], ['UPCA', '012345678905', '0012345678905'], ['Code39', 'A+B'], ['Code128', 'AbC-001']]) {
    const { symbol } = await writeBarcode(text, { format, scale: 4 })
    const rgba = new Uint8ClampedArray(symbol.width * symbol.height * 4)
    for (let i = 0; i < symbol.data.length; i++) rgba.set([symbol.data[i], symbol.data[i], symbol.data[i], 255], i * 4)
    await scope.onmessage({ data: { buffer: rgba.buffer, width: symbol.width, height: symbol.height } })
    assert.deepEqual(messages.at(-1), { type: 'result', barcode: expected })
  }
})

test('camera UPC lookup prefers exact match, retries only 404 and preserves unknown input', async () => {
  const code = '0012345678905'
  const absent = { response: { status: 404 } }
  const calls = []
  assert.equal(await resolveCameraBarcode(code, async value => { calls.push(value); return { barcode: value } }), code)
  assert.deepEqual(calls, [code])
  calls.length = 0
  assert.equal(await resolveCameraBarcode(code, async value => {
    calls.push(value)
    if (value === code) throw absent
    return { barcode: value }
  }), '012345678905')
  assert.deepEqual(calls, [code, '012345678905'])
  assert.equal(await resolveCameraBarcode(code, async () => { throw absent }), code)
  let attempts = 0
  const failure = { statusCode: 503 }
  await assert.rejects(resolveCameraBarcode(code, async () => { attempts++; throw failure }), error => error === failure)
  assert.equal(attempts, 1)
  assert.equal(await resolveCameraBarcode('5901234123457', async () => { throw Error('Unexpected lookup') }), '5901234123457')
})
