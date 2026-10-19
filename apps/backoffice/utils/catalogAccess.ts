interface CatalogActor {
  role?: string | null
  master_id?: number | null
  is_superuser?: boolean
}

// Sales and inventory grants do not grant catalog management to a linked master.
export const canManageCatalog = (user: CatalogActor | null | undefined) => Boolean(
  user && (user.is_superuser || (user.role !== 'master' && user.master_id == null)),
)

export const isCatalogManagementPath = (path: string) => /^\/products(?:\/|$)/i.test(path)
