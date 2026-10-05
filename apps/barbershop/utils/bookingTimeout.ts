/** Keep request cancellation separate from a deadline so current errors remain visible. */
export const withBookingTimeout = async <T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parent?: AbortSignal,
): Promise<T> => {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const stopped = new Promise<never>((_resolve, reject) => {
    const stop = (reason: unknown) => {
      reject(reason)
      controller.abort(reason)
    }
    onAbort = () => stop(parent?.reason ?? new DOMException('Request cancelled', 'AbortError'))
    if (parent?.aborted) {
      onAbort()
      return
    }
    parent?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => stop(new DOMException('Booking request timed out', 'TimeoutError')), timeoutMs)
  })
  try {
    // The explicit rejection also bounds transports that fail to settle on abort.
    return await Promise.race([
      stopped,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted()
        return request(controller.signal)
      }),
    ])
  }
  finally {
    if (timer !== undefined) clearTimeout(timer)
    if (onAbort) parent?.removeEventListener('abort', onAbort)
  }
}
