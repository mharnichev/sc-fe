import type { CameraFrame, CameraWorkerResult } from './barcodeCamera.worker'

export const isCameraBarcode = (value: string): boolean => value.length <= 64 && Boolean(value.trim())

export const stopCameraTracks = (stream: Pick<MediaStream, 'getTracks'> | null) => {
  stream?.getTracks().forEach(track => track.stop())
}

export const cameraErrorMessage = (error: unknown): string => {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Дозвольте доступ до камери в налаштуваннях браузера або введіть штрихкод вручну.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Камеру не знайдено. Введіть штрихкод вручну.'
  if (name === 'NotReadableError') return 'Камера зайнята іншою програмою. Закрийте її та спробуйте ще раз або введіть код вручну.'
  return 'Не вдалося запустити сканування. Спробуйте ще раз або введіть штрихкод вручну.'
}

// UPC-A and EAN-13 with a leading zero share the same bars. Prefer the
// database's existing representation without changing unknown or manual codes.
export const resolveCameraBarcode = async (
  barcode: string,
  lookup: (value: string) => Promise<{ barcode?: string | null }>,
): Promise<string> => {
  if (!/^0\d{12}$/.test(barcode)) return barcode
  for (const candidate of [barcode, barcode.slice(1)]) {
    try {
      const product = await lookup(candidate)
      return product.barcode || candidate
    } catch (cause) {
      const failure = cause as { status?: number, statusCode?: number, response?: { status?: number } } | null
      if ((failure?.response?.status ?? failure?.statusCode ?? failure?.status) !== 404) throw cause
    }
  }
  return barcode
}

export type CameraDecoder = {
  decode: (video: HTMLVideoElement) => Promise<string | null>
  dispose: () => void
}

export const createCameraDecoder = (signal?: AbortSignal): Promise<CameraDecoder> => new Promise((resolve, reject) => {
  const worker = new Worker(new URL('./barcodeCamera.worker.ts', import.meta.url), { type: 'module' })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  let disposed = false
  let frame = 0
  let pending: { resolve: (value: string | null) => void, reject: (reason: Error) => void } | undefined
  let timeout: ReturnType<typeof setTimeout>
  const dispose = () => {
    if (disposed) return
    disposed = true
    clearTimeout(timeout)
    signal?.removeEventListener('abort', dispose)
    worker.terminate()
    const error = new DOMException('Scanner stopped', 'AbortError')
    pending?.reject(error)
    pending = undefined
    reject(error)
    canvas.width = canvas.height = 0
  }
  const fail = () => {
    const error = new Error('Barcode decoder unavailable')
    pending?.reject(error)
    pending = undefined
    reject(error)
    dispose()
  }
  timeout = setTimeout(fail, 20000)
  signal?.addEventListener('abort', dispose, { once: true })
  if (!context) { fail(); return }
  if (signal?.aborted) { dispose(); return }
  worker.onerror = fail
  worker.onmessageerror = fail
  worker.onmessage = (event: MessageEvent<CameraWorkerResult>) => {
    if (disposed) return
    if (event.data.type === 'error') { fail(); return }
    clearTimeout(timeout)
    if (event.data.type === 'ready') {
      resolve({ decode, dispose })
    } else {
      const value = event.data.barcode
      pending?.resolve(value && isCameraBarcode(value) ? value : null)
      pending = undefined
    }
  }
  const decode = async (video: HTMLVideoElement): Promise<string | null> => {
    if (disposed) throw new DOMException('Scanner stopped', 'AbortError')
    if (pending || !video.videoWidth || !video.videoHeight || video.readyState < 2) return null
    // Scan the guide most frames; periodically include the whole image so a
    // code outside the guide is not permanently excluded.
    const fullFrame = frame++ % 5 === 4
    const sourceWidth = video.videoWidth * (fullFrame ? 1 : 0.85)
    const sourceHeight = video.videoHeight * (fullFrame ? 1 : 0.6)
    const scale = Math.min(1, 1024 / sourceWidth)
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    context.drawImage(video, (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height)
    return new Promise((resolveFrame, rejectFrame) => {
      pending = { resolve: resolveFrame, reject: rejectFrame }
      timeout = setTimeout(fail, 10000)
      try {
        const message: CameraFrame = { buffer: pixels.data.buffer as ArrayBuffer, width, height }
        worker.postMessage(message, [message.buffer])
      } catch { fail() }
    })
  }
})
