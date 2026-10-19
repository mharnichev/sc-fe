import type { NpDirectory } from '~/types/nova-poshta'

/** Each query owns its results, loading and errors, including while debounce is pending. */
export const useNovaPoshtaSearch = <T>(path: string, params: () => Record<string, string> | null, errorMessage: () => string) => {
  const api = useApi()
  const items = ref<T[]>([])
  const loading = ref(false)
  const error = ref('')
  const stale = ref(false)
  let sequence = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  const run = (immediate = false) => {
    const current = ++sequence
    clearTimeout(timer)
    controller?.abort()
    const query = params()
    items.value = []
    error.value = ''
    stale.value = false
    loading.value = Boolean(query)
    if (!query) return
    timer = setTimeout(async () => {
      controller = new AbortController()
      try {
        const response = await api<NpDirectory<T>>(`/public/delivery/np/${path}`, { query, signal: controller.signal })
        if (current !== sequence) return
        items.value = response.items as typeof items.value
        stale.value = response.stale
      }
      catch {
        if (current === sequence) error.value = errorMessage()
      }
      finally {
        if (current === sequence) loading.value = false
      }
    }, immediate ? 0 : 250)
  }
  watch(params, () => run(), { immediate: true })
  onBeforeUnmount(() => { ++sequence; clearTimeout(timer); controller?.abort() })
  return { items, loading, error, stale, retry: () => run(true) }
}
