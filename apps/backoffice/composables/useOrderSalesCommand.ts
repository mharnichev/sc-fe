import { parseSalesIntent, salesErrorDetail, salesIntentStorageKey } from '~/utils/orderSales'
import type { SalesIntent } from '~/utils/orderSales'

// Persist before sending. Unknown network outcomes always retain the exact key and body.
export const useOrderSalesCommand = <T extends object>(operation: string, resource: MaybeRefOrGetter<string>, definitiveErrorCodes: readonly string[] = []) => {
  const auth = useAuthStore()
  const intent = shallowRef<SalesIntent<T> | null>(null)
  const busy = ref(false)
  const error = ref('')
  let generation = 0, active = true
  if (getCurrentScope()) onScopeDispose(() => { active = false; generation++ })
  const scope = computed(() => auth.user?.id ? salesIntentStorageKey(auth.user.id, operation, toValue(resource)) : '')
  watch(scope, key => {
    generation++; intent.value = null; error.value = ''; busy.value = false
    if (!import.meta.client || !key) return
    try { intent.value = parseSalesIntent<T>(localStorage.getItem(key)) }
    catch { error.value = 'Сховище недоступне. Команди заблоковано для безпечного повтору.' }
  }, { immediate: true, flush: 'sync' })
  const clear = () => {
    if (scope.value && intent.value && parseSalesIntent<T>(localStorage.getItem(scope.value))?.key === intent.value.key) localStorage.removeItem(scope.value)
    intent.value = null
  }
  const execute = async (body: T, send: (body: T, key: string) => Promise<{ id: number }>, success: (id: number) => unknown | Promise<unknown>) => {
    if (!active || busy.value || !scope.value) return
    const startedScope = scope.value, startedGeneration = generation
    const current = () => active && generation === startedGeneration && scope.value === startedScope
    let command: SalesIntent<T> | null = null, persisted = false
    const ownsIntent = () => {
      if (!current() || !command) return false
      try { return parseSalesIntent<T>(localStorage.getItem(startedScope))?.key === command.key }
      catch { return false }
    }
    busy.value = true; error.value = ''
    try {
      command = parseSalesIntent<T>(localStorage.getItem(startedScope)) || intent.value || { key: crypto.randomUUID(), body: JSON.parse(JSON.stringify(body)) as T }
      localStorage.setItem(startedScope, JSON.stringify(command))
      persisted = true
      intent.value = command
      const result = command.resultId ? { id: command.resultId } : await send(command.body, command.key)
      // Only the current instance and durable intent may accept a late response.
      if (!ownsIntent()) return
      command.resultId = result.id
      localStorage.setItem(startedScope, JSON.stringify(command))
      await success(result.id)
    }
    catch (cause) {
      if (!current() || (persisted && command && !ownsIntent())) return
      const detail = salesErrorDetail(cause)
      const failure = cause as { statusCode?: number, status?: number, response?: { status?: number } }
      const status = failure.response?.status ?? failure.statusCode ?? failure.status
      const rawDetail = cause && typeof cause === 'object' && 'data' in cause ? (cause.data as { detail?: unknown })?.detail : undefined
      const stockRejected = status === 409 && typeof rawDetail === 'string' && /^Insufficient stock for product \d+; backorders are disabled$/.test(rawDetail)
      const definitiveRejection = status === 409 && !!detail.code && definitiveErrorCodes.includes(detail.code)
      if (definitiveRejection || stockRejected || detail.code === 'revision_conflict' || status === 422 || status === 400 || ['insufficient_stock', 'product_not_found', 'product_unavailable'].includes(detail.code || '')) clear()
      error.value = detail.message || 'Результат не підтверджено. Повторіть той самий запит; нову операцію не створено.'
    }
    finally { if (current()) busy.value = false }
  }
  return { intent, busy, error, execute, clear }
}
