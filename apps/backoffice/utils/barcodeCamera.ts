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

type Detector = { detect: (video: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }
type DetectorConstructor = {
  new (options: { formats: string[] }): Detector
  getSupportedFormats: () => Promise<string[]>
}

// Lazy loading keeps the decoder out of the normal manual-input path. Safari
// currently needs the software decoder; native support is checked by format.
export const createCameraDecoder = async (): Promise<(video: HTMLVideoElement) => Promise<string | null>> => {
  const NativeDetector = (globalThis as typeof globalThis & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
  if (NativeDetector) {
    try {
      const formats = await NativeDetector.getSupportedFormats()
      if (['ean_13', 'ean_8'].every(format => formats.includes(format))) {
        const requested = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']
        const detector = new NativeDetector({ formats: requested.filter(format => formats.includes(format)) })
        return async video => {
          try {
            const results = await detector.detect(video)
            return results.find(result => isCameraBarcode(result.rawValue))?.rawValue ?? null
          } catch { return null }
        }
      }
    } catch { /* Fall back if native detection cannot be initialized. */ }
  }
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'), import('@zxing/library'),
  ])
  const reader = new BrowserMultiFormatReader(new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF]],
  ]))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas unavailable')
  return async video => {
    if (!video.videoWidth || !video.videoHeight) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0)
    try {
      const value = reader.decodeFromCanvas(canvas).getText()
      return isCameraBarcode(value) ? value : null
    } catch { return null }
  }
}
