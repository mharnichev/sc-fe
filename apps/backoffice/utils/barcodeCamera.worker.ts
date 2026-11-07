import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

export type CameraFrame = { buffer: ArrayBuffer, width: number, height: number }
export type CameraWorkerResult = { type: 'ready' } | { type: 'result', barcode: string | null } | { type: 'error' }

const send = (message: CameraWorkerResult) => globalThis.postMessage(message)
const ready = prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => path.endsWith('.wasm') ? wasmUrl : prefix + path },
  fireImmediately: true,
})
void ready.then(() => send({ type: 'ready' }), () => send({ type: 'error' }))

globalThis.onmessage = async (event: MessageEvent<CameraFrame>) => {
  try {
    await ready
    const { buffer, width, height } = event.data
    const results = await readBarcodes(new ImageData(new Uint8ClampedArray(buffer), width, height), {
      formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'Code39Std', 'ITF'],
      maxNumberOfSymbols: 1,
      textMode: 'Plain',
      tryHarder: true,
    })
    send({ type: 'result', barcode: results[0]?.text ?? null })
  } catch { send({ type: 'error' }) }
}
