const allowedEmails = new Set([
  'admin.generated@example.com',
  'admin.valery@gmail.com',
  'admin.gleb@gmail.com',
])

export function canAccessShopBalance(user: {
  email: string
  is_active: boolean
  is_superuser: boolean
  role?: string | null
} | null) {
  return Boolean(user?.is_active && (user.is_superuser || user.role === 'admin')
    && allowedEmails.has(user.email.toLowerCase()))
}
