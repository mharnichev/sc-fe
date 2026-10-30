import type { RewardCommand } from '~/types/masterRewards'
const root = '/backoffice/master-rewards'
const messages: Record<string, string> = {
  revision_conflict: 'Дані змінилися. Оновіть сторінку та перевірте вибрані записи.',
  policy_not_configured: 'Спочатку явно налаштуйте ставку.', entry_exists: 'Ця позиція вже має нарахування.',
  sale_not_eligible: 'Продаж не відповідає умовам нарахування.', entry_not_available: 'Нарахування недоступне для передачі. Перевірте спір або повернення.',
  total_mismatch: 'Сума змінилася. Повторно перевірте склад передачі.', idempotency_conflict: 'Конфлікт ключа операції. Перевірте результат збереженої команди.',
}
export const rewardError = (cause: unknown) => {
  const error = cause as { data?: { detail?: { code?: string } }, response?: { status?: number } }
  if (error?.response?.status === 403) return 'Немає доступу до цих даних або дії.'
  if (error?.response?.status === 404) return 'Запис недоступний або не знайдений.'
  if (error?.response?.status === 422) return 'Перевірте суму, дати та обов’язкові поля.'
  return messages[error?.data?.detail?.code || ''] || 'Не вдалося підтвердити результат. Відновіть збережену операцію перед новими діями.'
}
export const useMasterRewardsCommand = () => {
  const auth = useAuthStore(), api = useApi()
  const saved = shallowRef<(RewardCommand & { key: string }) | null>(null)
  const busy = ref(false), error = ref(''), storageFault = ref(false)
  let generation = 0
  const storageKey = computed(() => auth.user?.id && auth.user.is_active && auth.user.is_superuser ? `master-rewards-command:v1:${auth.user.id}` : '')
  watch(storageKey, key => {
    generation++; saved.value = null; error.value = ''; busy.value = false; storageFault.value = false
    if (!import.meta.client || !key) return
    try {
      const value = sessionStorage.getItem(key)
      if (value) { const parsed = JSON.parse(value); if (!/^[0-9a-f-]{36}$/i.test(parsed.key || '') || !['policy', 'entry', 'review', 'settlement'].includes(parsed.kind) || !parsed.body || typeof parsed.body !== 'object' || !['PUT', 'POST'].includes(parsed.method) || !/^\/(policy|entries|settlements)(\/\d+\/review)?$/.test(parsed.path || '')) throw new Error(); saved.value = parsed }
    }
    catch { storageFault.value = true; error.value = 'Сховище команд недоступне. Оновіть сторінку перед операціями.' }
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { generation++ })
  const clear = () => { if (storageKey.value) sessionStorage.removeItem(storageKey.value); saved.value = null }
  const execute = async (command?: RewardCommand, recover = false) => {
    if (storageFault.value || busy.value || !auth.user?.is_active || !auth.user?.is_superuser || !storageKey.value) return false
    const currentGeneration = generation, key = storageKey.value
    busy.value = true; error.value = ''
    try {
      if (!saved.value) {
        if (!command) return false
        const value = { ...command, key: crypto.randomUUID() }
        sessionStorage.setItem(key, JSON.stringify(value)); saved.value = value
      }
      const value = saved.value
      if (recover) {
        try { await api(`${root}/operations/${value.key}`, { retry: 0, cache: 'no-store' }); if (generation !== currentGeneration) return false; clear(); return true }
        catch (cause) { if ((cause as { response?: { status?: number } }).response?.status !== 404) throw cause }
      }
      if (generation !== currentGeneration) return false
      await api(`${root}${value.path}`, { method: value.method, body: value.body, headers: { 'Idempotency-Key': value.key }, retry: 0, cache: 'no-store' })
      if (generation !== currentGeneration) return false
      clear(); return true
    }
    catch (cause) {
      if (generation !== currentGeneration) return false
      const status = (cause as { response?: { status?: number } }).response?.status
      const code = (cause as { data?: { detail?: { code?: string } } }).data?.detail?.code
      // Definitive rejection has no financial effect; uncertain results retain the exact body and key.
      if ([400, 422].includes(status || 0) || (status === 409 && code !== 'idempotency_conflict')) clear()
      error.value = rewardError(cause); return false
    }
    finally { if (generation === currentGeneration) busy.value = false }
  }
  return { saved, busy, error, storageFault, execute }
}
