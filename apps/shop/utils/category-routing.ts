import type { CategoryTreeNodeDto } from '@shared-types'

export interface CategoryRouteCrumb {
  id: number
  name: string
  slug: string
  to?: string
}

const normalizeSegments = (segments: Array<string | number | null | undefined>) =>
  segments.map(segment => String(segment ?? '').trim()).filter(Boolean)

export const categoryPathBySlug = (
  nodes: CategoryTreeNodeDto[],
  targetSlug: string,
  trail: CategoryTreeNodeDto[] = [],
): CategoryTreeNodeDto[] => {
  for (const node of nodes) {
    const nextTrail = [...trail, node]
    if (node.slug === targetSlug) return nextTrail

    const childTrail = categoryPathBySlug(node.children || [], targetSlug, nextTrail)
    if (childTrail.length) return childTrail
  }

  return []
}

export const categoryPathBySegments = (
  nodes: CategoryTreeNodeDto[],
  segments: string[],
) => {
  const cleanSegments = normalizeSegments(segments)
  if (!cleanSegments.length) return []

  const path = categoryPathBySlug(nodes, cleanSegments[cleanSegments.length - 1] || '')
  if (!path.length) return []

  const pathSegments = path.map(category => category.slug)
  return cleanSegments.every((segment, index) => pathSegments[index] === segment) ? path : []
}

export const categoryLandingPath = (path: CategoryTreeNodeDto[] | string[]) => {
  const segments = normalizeSegments(path.map(item => typeof item === 'string' ? item : item.slug))
  return segments.length ? `/${segments.join('/')}` : '/catalog'
}

export const categoryGoodsPath = (path: CategoryTreeNodeDto[] | string[]) => {
  const landing = categoryLandingPath(path)
  return landing === '/catalog' ? '/catalog' : `${landing}/goods/`
}

export const categoryPathForNode = (
  nodes: CategoryTreeNodeDto[],
  category: Pick<CategoryTreeNodeDto, 'slug'>,
) => categoryPathBySlug(nodes, category.slug)

export const categoryDestination = (
  nodes: CategoryTreeNodeDto[],
  category: CategoryTreeNodeDto,
) => {
  const path = categoryPathForNode(nodes, category)
  if (!path.length) {
    return { path: '/catalog', query: { category: category.slug } }
  }

  return {
    path: category.children.length ? categoryLandingPath(path) : categoryGoodsPath(path),
  }
}

export const categoryGoodsDestination = (
  nodes: CategoryTreeNodeDto[],
  category: Pick<CategoryTreeNodeDto, 'slug'>,
) => {
  const path = categoryPathForNode(nodes, category)
  if (!path.length) {
    return { path: '/catalog', query: { category: category.slug } }
  }

  return { path: categoryGoodsPath(path) }
}
