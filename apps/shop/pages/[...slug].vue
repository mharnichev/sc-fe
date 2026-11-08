<script setup lang="ts">
import legacyPaths from '~/data/legacy-category-paths.json'
import { categoryPathBySegments } from '~/utils/category-routing'

const route = useRoute()
const domain = useCatalogDomain()
const segments = (Array.isArray(route.params.slug) ? route.params.slug : [route.params.slug])
  .map(String).filter(Boolean)
if (segments.at(-1) === 'goods') segments.pop()

const legacyPrefix = ['roboche-mistse', 'roboche-mistse-profesiini-grebeni-ta-shchitki']
if (legacyPrefix.every((segment, index) => segments[index] === segment)) {
  segments.splice(0, 2, 'profesiini-grebeni-ta-shchitki')
}

const knownPaths: Readonly<Record<string, string>> = legacyPaths
const path = segments.join('/')
let category = Object.hasOwn(knownPaths, path) ? knownPaths[path] : undefined
if (!category && segments.length) {
  const tree = await domain.getCategoryTree()
  category = categoryPathBySegments(tree, segments).at(-1)?.slug
}
if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found' })

await navigateTo(
  { path: '/catalog', query: { ...route.query, category }, hash: route.hash },
  { redirectCode: 301, replace: true },
)
</script>
