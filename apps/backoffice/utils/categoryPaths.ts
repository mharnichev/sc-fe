import type { Category } from '../composables/useBackofficeApi'

export const categoryPathLabels = (categories: Category[]): Map<number, string> => {
  const byId = new Map(categories.map(category => [category.id, category]))
  return new Map(categories.map(category => {
    const names: string[] = []
    const visited = new Set<number>()
    let current: Category | undefined = category
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      names.unshift(current.name)
      current = current.parent_id == null ? undefined : byId.get(current.parent_id)
    }
    return [category.id, names.join(' → ')]
  }))
}
