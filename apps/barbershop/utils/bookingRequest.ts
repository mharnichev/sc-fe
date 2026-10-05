/** A generation, rather than the context string, distinguishes A → B → A. */
export const createBookingRequest = () => {
  let generation = 0
  let controller: AbortController | undefined
  const cancel = () => {
    generation += 1
    controller?.abort()
    controller = undefined
  }
  return {
    cancel,
    begin() {
      cancel()
      const ownGeneration = generation
      controller = new AbortController()
      const signal = controller.signal
      return { signal, current: () => generation === ownGeneration && !signal.aborted }
    },
  }
}

export const bookingContextKey = (masterId: number | null, serviceIds: number[], date: string, duration: number) =>
  masterId && serviceIds.length && date && duration > 0
    ? `${masterId}:${[...new Set(serviceIds)].sort((a, b) => a - b).join(',')}:${date}:${duration}`
    : ''
