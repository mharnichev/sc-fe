import type { Master } from '~/composables/useBackofficeApi'

export const useBackofficeAccess = (masters?: Ref<Master[]>) => {
  const auth = useAuthStore()

  const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))

  const linkedMaster = computed(() => {
    if (!auth.user || !masters?.value.length) return null
    return masters.value.find(master => master.admin_user_id === auth.user?.id || master.id === auth.user?.master_id) || null
  })

  const isBarber = computed(() => Boolean((linkedMaster.value || auth.user?.master_id || auth.user?.role === 'barber') && !isAdmin.value))

  const roleLabel = computed(() => {
    if (isAdmin.value) return 'Адміністратор'
    if (isBarber.value) return 'Майстер'
    return 'Користувач backoffice'
  })

  const canManageBooking = (masterId?: number | null) =>
    isAdmin.value || Boolean(linkedMaster.value && masterId === linkedMaster.value.id)

  return {
    isAdmin,
    isBarber,
    linkedMaster,
    roleLabel,
    canManageBooking,
  }
}
